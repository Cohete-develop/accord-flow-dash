// =============================================================================
// EngineXpert (crm-assistant)
//
// RATE LIMITING: NO implementado por falta de primitivas backend robustas
// (no hay Redis/KV gestionado en este stack). Mitigaciones activas:
//   1. max_tokens cap por respuesta (ver MAX_RESPONSE_TOKENS más abajo).
//   2. Cap de historial multi-turno (MAX_TURNS).
//   3. Monitoreo via vista SQL `audit_log_ai_usage_hourly`:
//        SELECT * FROM audit_log_ai_usage_hourly WHERE invocations > 50;
// Si se detecta abuso real, evaluar implementación con Redis/Upstash o similar.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- Constantes de tuneo (ajustar acá sin buscar en el código) --------
const MAX_TURNS = 20;                  // cap historial: ~10 user + 10 assistant
const MAX_RESPONSE_TOKENS = 2000;      // cap tokens por respuesta del modelo
const MIN_COST_FOR_RANKING = 10;       // USD mínimo para entrar al ranking ROAS
const PERIOD_DAYS = 30;                // ventana del resumen de campañas
const TOP_BOTTOM_N = 3;                // top 3 + bottom 3 por plataforma
const TOP_KEYWORDS = 5;
const RECENT_ALERTS = 20;
// -----------------------------------------------------------------------------

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get and validate bearer token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice(7).trim();

    // Create authenticated supabase client with caller context
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT claims (compatible with signing keys in Lovable Cloud)
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = (claimsData.claims.email as string | undefined) ?? "unknown";

    const { messages } = await req.json();

    // ---------- Fase 1: cap de historial multi-turno ----------
    const incomingMessages = Array.isArray(messages) ? messages : [];
    const messagesTruncated = incomingMessages.length > MAX_TURNS;
    const trimmedMessages = messagesTruncated
      ? incomingMessages.slice(-MAX_TURNS)
      : incomingMessages;

    // ---------- Fase 1: resolver company_id + plan + acceso a campañas ----------
    // get_user_company_id respeta impersonación de super_admin automáticamente
    let companyId: string | null = null;
    let planId: string | null = null;
    let modulesIncluded: string[] = [];
    let campaignAccessAllowed = false;

    try {
      const { data: companyIdData } = await supabase.rpc("get_user_company_id", {
        _user_id: userId,
      });
      companyId = (companyIdData as string | null) ?? null;

      if (companyId) {
        const { data: limits } = await supabase.rpc("get_company_plan_limits", {
          _company_id: companyId,
        });
        const row = Array.isArray(limits) ? limits[0] : limits;
        if (row) {
          planId = (row.plan_id as string) ?? null;
          modulesIncluded = (row.modules_included as string[] | null) ?? [];
          campaignAccessAllowed = modulesIncluded.includes("campaign_monitor");
        }
      }
    } catch (e) {
      console.error("Error resolving plan/company for assistant:", e);
    }

    // Service role para auditoría e inyección de campañas (bypass RLS controlado)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all CRM data in parallel using the user's RLS context
    const [acuerdosRes, pagosRes, entregablesRes, kpisRes] = await Promise.all([
      supabase.from("acuerdos").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("pagos").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("entregables").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("kpis").select("*").order("created_at", { ascending: false }).limit(200),
    ]);

    const acuerdos = acuerdosRes.data || [];
    const pagos = pagosRes.data || [];
    const entregables = entregablesRes.data || [];
    const kpis = kpisRes.data || [];

    // ---------- Fase 2: resumen de campañas (solo Pro/Enterprise) ----------
    let campaignsBlock = "";
    let campaignSummaryInjected = false;
    let campaignsSummarySizeBytes = 0;

    // ---------- Fase 3: cruce influencers vs ads (siempre que haya pagos) ----
    // Pro -> usa también totales de ads (mismas 30d).
    // Trial/Starter -> solo lado influencers, sin bloque de ads.
    let crossChannelBlock = "";
    let crossChannelInjected = false;
    // Estos los popula la rama Pro y los reutilizamos en el bloque de cruce
    let adsTotalsByCurrency: Record<string, { cost: number; conversions: number }> = {};
    let adsCampaignsForCross: Array<{ campaign_name: string; platform: string; cost: number; conversions: number; currency: string }> = [];
    // -----------------------------------------------------------------------

    if (campaignAccessAllowed && companyId) {
      try {
        const today = new Date();
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (PERIOD_DAYS - 1)); // inclusivo del actual
        const prevEnd = new Date(startDate);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - (PERIOD_DAYS - 1));

        const startStr = fmt(startDate);
        const endStr = fmt(endDate);
        const prevStartStr = fmt(prevStart);
        const prevEndStr = fmt(prevEnd);

        const [
          connectionsRes,
          campaignsRes,
          metricsCurrRes,
          metricsPrevRes,
          keywordsRes,
          alertsRes,
          rankingRes,
        ] = await Promise.all([
          supabase
            .from("ad_platform_connections")
            .select("platform, account_name, status, last_sync_at"),
          supabase
            .from("campaigns_sync")
            .select("id, platform, campaign_name, status, daily_budget, total_budget, currency, start_date, end_date"),
          supabase
            .from("campaign_metrics")
            .select("campaign_sync_id, cost, impressions, clicks, conversions, conversion_value")
            .gte("date", startStr)
            .lte("date", endStr),
          supabase
            .from("campaign_metrics")
            .select("cost, impressions, clicks, conversions, conversion_value")
            .gte("date", prevStartStr)
            .lte("date", prevEndStr),
          supabase
            .from("campaign_keywords")
            .select("keyword, match_type, cost, clicks, impressions, conversions, ctr, cpc, quality_score")
            .gte("date", startStr)
            .lte("date", endStr)
            .order("clicks", { ascending: false })
            .limit(50),
          supabase
            .from("alert_history")
            .select("triggered_at, message, metric_value, threshold_value, campaign_sync_id, acknowledged_at")
            .is("acknowledged_at", null)
            .order("triggered_at", { ascending: false })
            .limit(RECENT_ALERTS),
          supabaseAdmin.rpc("get_campaign_roas_ranking", {
            _company_id: companyId,
            _start_date: startStr,
            _end_date: endStr,
            _min_cost: MIN_COST_FOR_RANKING,
            _top_n: TOP_BOTTOM_N,
          }),
        ]);

        const connections = connectionsRes.data || [];
        const campaigns = campaignsRes.data || [];
        const metricsCurr = metricsCurrRes.data || [];
        const metricsPrev = metricsPrevRes.data || [];
        const keywords = keywordsRes.data || [];
        const alerts = alertsRes.data || [];
        const ranking = rankingRes.data || [];

        if (connections.length === 0) {
          campaignsBlock = `\n### CAMPAÑAS PAGADAS\n`
            + `El tenant tiene plan Pro pero NO hay plataformas de ads conectadas. `
            + `Si el usuario pregunta sobre campañas, sugerile conectar al menos una plataforma `
            + `(Google Ads, Meta, TikTok o LinkedIn) desde Campaign Monitor.\n`;
          campaignSummaryInjected = true;
        } else if (campaigns.length === 0 || metricsCurr.length === 0) {
          campaignsBlock = `\n### CAMPAÑAS PAGADAS\n`
            + `El tenant tiene plan Pro y ${connections.length} plataforma(s) conectada(s) `
            + `(${connections.map(c => c.platform).join(", ")}), pero no hay campañas con datos `
            + `sincronizados en los últimos ${PERIOD_DAYS} días. Sugerile sincronizar desde Campaign Monitor.\n`;
          campaignSummaryInjected = true;
        } else {
          // Index de campaña por id para joins en memoria
          const campaignById = new Map(campaigns.map(c => [c.id, c]));

          // Agregación por plataforma y por campaña (período actual)
          type Agg = { cost: number; impressions: number; clicks: number; conversions: number; conversion_value: number };
          const empty = (): Agg => ({ cost: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 });
          const sum = (a: Agg, m: any) => {
            a.cost += Number(m.cost || 0);
            a.impressions += Number(m.impressions || 0);
            a.clicks += Number(m.clicks || 0);
            a.conversions += Number(m.conversions || 0);
            a.conversion_value += Number(m.conversion_value || 0);
          };

          const byPlatform = new Map<string, Agg>();
          const byCampaign = new Map<string, Agg>();
          for (const m of metricsCurr) {
            const camp = campaignById.get(m.campaign_sync_id);
            if (!camp) continue;
            if (!byPlatform.has(camp.platform)) byPlatform.set(camp.platform, empty());
            sum(byPlatform.get(camp.platform)!, m);
            if (!byCampaign.has(m.campaign_sync_id)) byCampaign.set(m.campaign_sync_id, empty());
            sum(byCampaign.get(m.campaign_sync_id)!, m);
          }

          const totalsCurr = empty();
          for (const m of metricsCurr) sum(totalsCurr, m);
          const totalsPrev = empty();
          for (const m of metricsPrev) sum(totalsPrev, m);

          const pct = (curr: number, prev: number) =>
            prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
          const div = (a: number, b: number) => (b === 0 ? 0 : a / b);
          const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

          const platformSummary = Array.from(byPlatform.entries()).map(([platform, a]) => ({
            platform,
            cost: round(a.cost),
            impressions: a.impressions,
            clicks: a.clicks,
            conversions: a.conversions,
            conversion_value: round(a.conversion_value),
            ctr: round(div(a.clicks, a.impressions) * 100, 2),
            cpc: round(div(a.cost, a.clicks), 2),
            cpa: round(div(a.cost, a.conversions), 2),
            roas: round(div(a.conversion_value, a.cost), 2),
          }));

          // Pacing por campaña activa (gasto vs daily_budget × días transcurridos)
          const campaignSummary = Array.from(byCampaign.entries()).map(([id, a]) => {
            const camp = campaignById.get(id)!;
            const expectedSpend = Number(camp.daily_budget || 0) * PERIOD_DAYS;
            return {
              campaign_name: camp.campaign_name,
              platform: camp.platform,
              status: camp.status,
              currency: camp.currency,
              daily_budget: Number(camp.daily_budget || 0),
              cost: round(a.cost),
              clicks: a.clicks,
              conversions: a.conversions,
              ctr: round(div(a.clicks, a.impressions) * 100, 2),
              cpa: round(div(a.cost, a.conversions), 2),
              roas: round(div(a.conversion_value, a.cost), 2),
              budget_pacing_pct: expectedSpend > 0 ? round(div(a.cost, expectedSpend) * 100, 1) : null,
            };
          });

          // Top keywords por clicks, bottom por ROI (conversions/cost)
          const kwsWithRoi = keywords.map((k: any) => ({
            ...k,
            roi: Number(k.cost) > 0 ? Number(k.conversions) / Number(k.cost) : 0,
          }));
          const topKeywords = [...kwsWithRoi]
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, TOP_KEYWORDS)
            .map(k => ({
              keyword: k.keyword,
              clicks: k.clicks,
              cpc: round(Number(k.cpc), 2),
              ctr: round(Number(k.ctr), 2),
              conversions: k.conversions,
            }));
          const bottomKeywords = [...kwsWithRoi]
            .filter(k => Number(k.cost) >= 1)
            .sort((a, b) => a.roi - b.roi)
            .slice(0, TOP_KEYWORDS)
            .map(k => ({
              keyword: k.keyword,
              cost: round(Number(k.cost), 2),
              conversions: k.conversions,
              cpc: round(Number(k.cpc), 2),
            }));

          // Ranking ROAS (de la función SQL)
          const rankingByPlatform: Record<string, { top: any[]; bottom: any[] }> = {};
          for (const r of ranking) {
            if (!rankingByPlatform[r.platform]) rankingByPlatform[r.platform] = { top: [], bottom: [] };
            const item = {
              campaign_name: r.campaign_name,
              cost: round(Number(r.cost), 2),
              conversions: Number(r.conversions),
              roas: round(Number(r.roas), 2),
            };
            if (r.rank_type === "top") rankingByPlatform[r.platform].top.push(item);
            else rankingByPlatform[r.platform].bottom.push(item);
          }

          const periodComparison = {
            cost: { curr: round(totalsCurr.cost), prev: round(totalsPrev.cost), pct_change: round(pct(totalsCurr.cost, totalsPrev.cost), 1) },
            clicks: { curr: totalsCurr.clicks, prev: totalsPrev.clicks, pct_change: round(pct(totalsCurr.clicks, totalsPrev.clicks), 1) },
            conversions: { curr: totalsCurr.conversions, prev: totalsPrev.conversions, pct_change: round(pct(totalsCurr.conversions, totalsPrev.conversions), 1) },
            roas: {
              curr: round(div(totalsCurr.conversion_value, totalsCurr.cost), 2),
              prev: round(div(totalsPrev.conversion_value, totalsPrev.cost), 2),
            },
          };

          const summary = {
            period: { start: startStr, end: endStr, days: PERIOD_DAYS },
            connections: connections.map(c => ({
              platform: c.platform,
              account_name: c.account_name,
              status: c.status,
              last_sync_at: c.last_sync_at,
            })),
            totals_current_period: {
              cost: round(totalsCurr.cost),
              clicks: totalsCurr.clicks,
              conversions: totalsCurr.conversions,
              conversion_value: round(totalsCurr.conversion_value),
            },
            period_comparison_vs_previous_30d: periodComparison,
            by_platform: platformSummary,
            campaigns: campaignSummary,
            roas_ranking_by_platform: rankingByPlatform,
            top_keywords_by_clicks: topKeywords,
            bottom_keywords_by_roi: bottomKeywords,
            unacknowledged_alerts: alerts.map(a => ({
              triggered_at: a.triggered_at,
              message: a.message,
              metric_value: Number(a.metric_value),
              threshold_value: Number(a.threshold_value),
              campaign_sync_id: a.campaign_sync_id,
            })),
            notes: `Ranking ROAS excluye campañas con cost < ${MIN_COST_FOR_RANKING} USD en el período para evitar distorsión.`,
          };

          const summaryJson = JSON.stringify(summary, null, 0);
          campaignsBlock = `\n### CAMPAÑAS PAGADAS — Resumen agregado (últimos ${PERIOD_DAYS} días)\n${summaryJson}\n`;
          campaignSummaryInjected = true;
          campaignsSummarySizeBytes = new TextEncoder().encode(summaryJson).length;
        }
      } catch (e) {
        console.error("Error building campaigns summary:", e);
        campaignsBlock = "";
        campaignSummaryInjected = false;
      }
    }

    // ---------- Fase 1+2: auditoría SIEMPRE (no condicional al texto) ----------
    try {
      const { error: auditError } = await supabaseAdmin.from("audit_log").insert({
        user_id: userId,
        user_name: userEmail,
        action: "ai_assistant_invoke",
        module: "ai_assistant",
        company_id: companyId,
        details: {
          model: "google/gemini-2.5-flash",
          campaign_access_allowed: campaignAccessAllowed,
          campaign_summary_injected: campaignSummaryInjected,
          campaigns_summary_size_bytes: campaignsSummarySizeBytes,
          plan: planId,
          messages_count: incomingMessages.length,
          messages_truncated: messagesTruncated,
          max_response_tokens: MAX_RESPONSE_TOKENS,
        },
      });
      if (auditError) {
        console.error("audit_log insert returned error:", {
          message: auditError.message,
          code: auditError.code,
          details: auditError.details,
          hint: auditError.hint,
          user_id: userId,
          company_id: companyId,
        });
      }
    } catch (e) {
      console.error("audit_log insert threw exception:", e);
    }

    // Build data context summary
    const dataContext = `
## DATOS ACTUALES DEL CRM DE INFLUENCER MARKETING (InfluXpert)

### ACUERDOS (${acuerdos.length} registros)
${JSON.stringify(acuerdos, null, 0)}

### PAGOS (${pagos.length} registros)
${JSON.stringify(pagos, null, 0)}

### ENTREGABLES (${entregables.length} registros)
${JSON.stringify(entregables, null, 0)}

### KPIs (${kpis.length} registros)
${JSON.stringify(kpis, null, 0)}
${campaignsBlock}`;

    const systemPrompt = `Eres EngineXpert, el asistente de IA especializado en influencer marketing del CRM InfluXpert by Cohete.

Tu rol es ayudar a gerentes generales y comerciales a entender rápidamente el estado de sus campañas con influencers Y, cuando el plan lo incluya, sus campañas pagadas en plataformas de ads.

InfluXpert combina dos mundos: marketing con influencers (acuerdos/orgánico) y campañas pagadas en Google Ads, Meta Ads, TikTok Ads y LinkedIn Ads. Puedes cruzar ambos cuando tenga sentido (por ejemplo, comparar inversión en influencers vs ads en un mismo período).

CAPACIDADES:
- Responder preguntas sobre acuerdos, pagos, entregables y KPIs registrados en el sistema
- Analizar métricas de performance: engagement, CPR, CPC, alcance, impresiones
- Comparar rendimiento entre influencers
- Identificar tendencias y oportunidades
- Recomendar estrategias basadas en los datos y mejores prácticas de influencer marketing en redes sociales
- Calcular totales, promedios, tasas de cumplimiento
${campaignAccessAllowed ? `- Analizar campañas pagadas: ROAS, CPA, CPC, CTR, gasto, conversiones por plataforma y por campaña
- Comparar rendimiento entre plataformas (Google, Meta, TikTok, LinkedIn)
- Detectar campañas que pierden dinero (ROAS bajo) y oportunidades para escalar (ROAS alto)
- Recomendar pausas, cambios de creativo, redistribución de presupuesto
- Hablar de keywords ganadoras/perdedoras
- Reportar el pacing del consumo de presupuesto vs lo planeado` : ""}

LINEAMIENTOS GENERALES:
- Responde siempre en español
- Sé conciso pero completo y claro
- Si no hay datos suficientes para responder, indícalo claramente
- Cuando des recomendaciones estratégicas, bázalas en los datos reales del sistema Y en mejores prácticas de la industria
- Usa formatos de moneda apropiados (USD, COP, etc.)
- Enfócate en insights accionables, no solo en listar datos
- Si el usuario pregunta algo fuera del ámbito (CRM de influencers o campañas pagadas si están disponibles), indícale amablemente cuál es tu especialidad
${!campaignAccessAllowed ? `- IMPORTANTE: el plan actual NO incluye el módulo de Campaign Monitor (campañas pagadas). Si el usuario pregunta sobre Google Ads, Meta Ads, TikTok Ads, LinkedIn Ads, ROAS, CPA o keywords, respondé que ese módulo no está activo en su plan y sugerile contactar al administrador para activarlo. NO inventes datos de campañas pagadas.` : ""}

FORMATO DE RESPUESTA (MUY IMPORTANTE — el chat es angosto, ~400px):
- ❌ NUNCA uses tablas markdown con barras (|). Se ven rotas en el chat.
- ✅ Para comparar items (influencers, acuerdos, pagos, etc.) usa formato de CARDS:
  cada item es un bloque con el nombre en **negrita** seguido de los valores clave en líneas separadas.
  Ejemplo:

  **Mariana Palacio**
  Monto: $1.500.000 COP
  Fecha: 2026-04-30
  Estado: Programado

  **Juan Manuel Zapata**
  Monto: $1.100.000 COP
  Fecha: 2026-04-30
  Estado: Pendiente

- ✅ Para resúmenes numéricos usa listas con la etiqueta en **negrita** inline:
  **Total pagado:** $1.800.000
  **Pendiente:** $7.000.000
  **Próximo vencimiento:** 2026-04-30

- ✅ Usa separadores (---) entre secciones cuando la respuesta sea larga.
- ✅ Para rankings o comparativas, usa listas numeradas con los valores clave inline:
  1. **Mariana Palacio** — Engagement 8.2% · Alcance 120K
  2. **Juan Zapata** — Engagement 6.5% · Alcance 95K

- ✅ Máximo 3-4 métricas por card. Si hay más datos, agrupa por categoría con subtítulos en negrita.
- ✅ Prefiere bullets cortos y líneas separadas en vez de párrafos densos.

CONTEXTO DE DATOS:
${dataContext}

Responde basándote en estos datos reales. Si el usuario pide algo que no está en los datos, dilo claramente.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...trimmedMessages,
        ],
        stream: true,
        max_tokens: MAX_RESPONSE_TOKENS,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos momentos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados. Contacta al administrador." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("crm-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
