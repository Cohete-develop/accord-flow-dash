import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================
// PRESETS
// ============================================================
const PRESETS = {
  small:  { acuerdos: 5,  campaigns: 2, days_metrics: 30, keywords_per_campaign: 5 },
  medium: { acuerdos: 10, campaigns: 4, days_metrics: 60, keywords_per_campaign: 6 },
  large:  { acuerdos: 15, campaigns: 6, days_metrics: 90, keywords_per_campaign: 8 },
} as const;

type PresetKey = keyof typeof PRESETS;

// ============================================================
// CATÁLOGOS ESTÁTICOS
// ============================================================
const INFLUENCERS = [
  { nombre: "Andrea López",       handle: "@andrealopez",     seguidores: 125000 },
  { nombre: "Carlos Méndez",      handle: "@carlosmendez",    seguidores: 89000  },
  { nombre: "Valeria Ruiz",       handle: "@valeriaruiz",     seguidores: 210000 },
  { nombre: "Diego Torres",       handle: "@diegotorres",     seguidores: 67000  },
  { nombre: "Sofía Ramírez",      handle: "@sofiramirez",     seguidores: 340000 },
  { nombre: "Mateo Gutiérrez",    handle: "@mateogtz",        seguidores: 178000 },
  { nombre: "Camila Vargas",      handle: "@camivargas",      seguidores: 95000  },
  { nombre: "Sebastián Rojas",    handle: "@sebasrojas",      seguidores: 256000 },
  { nombre: "Lucía Castaño",      handle: "@luciacastano",    seguidores: 410000 },
  { nombre: "Tomás Restrepo",     handle: "@tomasrestrepo",   seguidores: 58000  },
  { nombre: "Isabella Quintero",  handle: "@isaquintero",     seguidores: 305000 },
  { nombre: "Joaquín Herrera",    handle: "@joaquinherrera",  seguidores: 142000 },
  { nombre: "Mariana Ospina",     handle: "@mariospina",      seguidores: 78000  },
  { nombre: "Felipe Cárdenas",    handle: "@felicardenas",    seguidores: 195000 },
  { nombre: "Daniela Patiño",     handle: "@danipatino",      seguidores: 488000 },
];

const REDES = ["Instagram", "TikTok", "YouTube"];
const TIPOS = ["Reel", "Story", "Collab", "UGC"];
const ESTADOS_ACUERDO = ["Activo", "Finalizado", "Pausado"];
const ESTADOS_PAGO = ["Pagado", "Pendiente", "Programado"];
const ESTADOS_ENTREGABLE = ["Entregado", "Pendiente", "En progreso", "Aprobado"];

const CAMPAIGN_TEMPLATES = [
  { name: "Search Branded — Marca Principal",        type: "search",   daily_budget: 150000 },
  { name: "Search Non-Branded — Genéricas",          type: "search",   daily_budget: 200000 },
  { name: "Display Remarketing — Carrito Abandonado", type: "display", daily_budget: 100000 },
  { name: "Performance Max — Conversiones",           type: "pmax",    daily_budget: 250000 },
  { name: "Shopping — Catálogo Completo",             type: "shopping",daily_budget: 180000 },
  { name: "YouTube Video Ads — Brand Awareness",      type: "video",   daily_budget: 120000 },
];

const KEYWORD_SUFFIXES = [
  "comprar online", "envío gratis", "mejor precio", "promoción",
  "ofertas", "tienda oficial", "descuento", "outlet",
];

const KEYWORD_FALLBACK_BASES = [
  "zapatillas", "ropa deportiva", "mochilas", "audífonos",
  "smartwatch", "accesorios", "outlet", "ofertas",
];

const MATCH_TYPES = ["broad", "phrase", "exact"];

// ============================================================
// HELPERS
// ============================================================
function getActivityFactor(hour: number, dayOfWeek: number): number {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  let hourFactor: number;
  if (hour >= 0 && hour < 6) hourFactor = 0.05;
  else if (hour < 9)         hourFactor = 0.30;
  else if (hour < 12)        hourFactor = 0.75;
  else if (hour < 14)        hourFactor = 0.90;
  else if (hour < 18)        hourFactor = 0.85;
  else if (hour < 22)        hourFactor = 1.00;
  else                       hourFactor = 0.50;
  const dayFactor = isWeekend ? 0.65 : 1.00;
  const jitter = 0.85 + Math.random() * 0.30;
  return hourFactor * dayFactor * jitter;
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Solo super_admin
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Solo super_admin puede generar datos demo" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Debe estar impersonando un tenant
    const { data: impersonationCompanyId } = await admin.rpc("get_active_impersonation", {
      _user_id: user.id,
    });

    if (!impersonationCompanyId) {
      return new Response(
        JSON.stringify({ error: "Debe estar impersonando un tenant para generar datos demo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const companyId = impersonationCompanyId as string;

    // Parsear preset
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const rawPreset = body?.preset;
    let presetKey: PresetKey = "medium";
    if (rawPreset === "small" || rawPreset === "medium" || rawPreset === "large") {
      presetKey = rawPreset;
    } else if (rawPreset !== undefined) {
      console.warn(`Preset inválido "${rawPreset}", usando "medium" por default`);
    }
    const preset = PRESETS[presetKey];

    // Helper para inserts en lotes
    async function insertInChunks(table: string, rows: any[], size = 500) {
      for (let i = 0; i < rows.length; i += size) {
        const { error } = await admin.from(table).insert(rows.slice(i, i + size));
        if (error) throw new Error(`Error insertando ${table}: ${error.message}`);
      }
    }

    // Familias del tenant
    const { data: familias } = await admin
      .from("product_families")
      .select("name")
      .eq("company_id", companyId)
      .eq("is_active", true);

    const familiasNames = (familias || []).map((f: any) => f.name);
    const defaultFamilia = familiasNames[0] || "General";

    // Usuario del tenant para asignar como creador
    const { data: tenantUser } = await admin
      .from("profiles")
      .select("user_id")
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();

    const creatorUserId = tenantUser?.user_id || user.id;

    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // ---------- 1. Acuerdos ----------
    const influencersUsed = INFLUENCERS.slice(0, preset.acuerdos);
    const acuerdosPayload = influencersUsed.map((inf, i) => {
      const fechaInicio = new Date(sixMonthsAgo.getTime() + i * 12 * 24 * 60 * 60 * 1000);
      const fechaFin = new Date(fechaInicio.getTime() + 90 * 24 * 60 * 60 * 1000);
      const valorMensual = 800000 + Math.floor(Math.random() * 3200000);
      return {
        company_id: companyId,
        user_id: creatorUserId,
        influencer: inf.nombre,
        red_social: [pick(REDES, i)],
        plataforma: pick(REDES, i),
        seguidores: inf.seguidores,
        tipo_contenido: [pick(TIPOS, i), pick(TIPOS, i + 1)],
        reels_pactados: 2 + (i % 3),
        stories_pactadas: 4 + (i % 5),
        fecha_inicio: fechaInicio.toISOString().slice(0, 10),
        fecha_fin: fechaFin.toISOString().slice(0, 10),
        duracion_meses: 3,
        valor_mensual: valorMensual,
        valor_total: valorMensual * 3,
        moneda: "COP",
        estado: pick(ESTADOS_ACUERDO, i),
        contacto: inf.handle,
        familia_producto: [familiasNames[i % Math.max(familiasNames.length, 1)] || defaultFamilia],
        notas: `Acuerdo demo — ${inf.seguidores.toLocaleString()} seguidores`,
        is_demo_data: true,
      };
    });

    const { data: acuerdosCreados, error: errAcuerdos } = await admin
      .from("acuerdos")
      .insert(acuerdosPayload)
      .select("id, influencer, valor_mensual");

    if (errAcuerdos) throw new Error(`Error creando acuerdos: ${errAcuerdos.message}`);

    // ---------- 2. Pagos (3 por acuerdo) ----------
    const pagosPayload: any[] = [];
    acuerdosCreados!.forEach((acuerdo: any, idx: number) => {
      for (let m = 0; m < 3; m++) {
        const fechaPago = new Date(sixMonthsAgo.getTime() + (idx * 12 + m * 30) * 24 * 60 * 60 * 1000);
        pagosPayload.push({
          company_id: companyId,
          user_id: creatorUserId,
          acuerdo_id: acuerdo.id,
          influencer: acuerdo.influencer,
          concepto: `Pago mes ${m + 1} — ${acuerdo.influencer}`,
          monto: acuerdo.valor_mensual,
          moneda: "COP",
          fecha_pago: fechaPago.toISOString().slice(0, 10),
          estado: ESTADOS_PAGO[(idx + m) % ESTADOS_PAGO.length],
          metodo_pago: m === 0 ? "Transferencia" : "PSE",
          comprobante: `DEMO-${idx}-${m}`,
          notas: "Pago demo",
          is_demo_data: true,
        });
      }
    });

    const { error: errPagos } = await admin.from("pagos").insert(pagosPayload);
    if (errPagos) throw new Error(`Error creando pagos: ${errPagos.message}`);

    // ---------- 3. Entregables (2 por acuerdo) ----------
    const entregablesPayload: any[] = [];
    acuerdosCreados!.forEach((acuerdo: any, idx: number) => {
      for (let e = 0; e < 2; e++) {
        const fechaProg = new Date(sixMonthsAgo.getTime() + (idx * 12 + e * 15) * 24 * 60 * 60 * 1000);
        const baseAlcance = 30000 + Math.floor(Math.random() * 70000);
        const baseImpresiones = Math.floor(baseAlcance * (1.3 + Math.random() * 0.7));
        const baseInteracciones = Math.floor(baseAlcance * (0.04 + Math.random() * 0.06));
        const baseClicks = Math.floor(baseInteracciones * (0.15 + Math.random() * 0.25));
        entregablesPayload.push({
          company_id: companyId,
          user_id: creatorUserId,
          acuerdo_id: acuerdo.id,
          influencer: acuerdo.influencer,
          tipo_contenido: TIPOS[(idx + e) % TIPOS.length],
          descripcion: `Contenido ${TIPOS[(idx + e) % TIPOS.length]} — Campaña demo`,
          fecha_programada: fechaProg.toISOString().slice(0, 10),
          fecha_entrega: e === 0 ? fechaProg.toISOString().slice(0, 10) : null,
          estado: ESTADOS_ENTREGABLE[(idx + e) % ESTADOS_ENTREGABLE.length],
          url_contenido: e === 0 ? `https://instagram.com/p/demo${idx}${e}` : "",
          notas: "Entregable demo",
          meta_alcance: baseAlcance,
          meta_impresiones: baseImpresiones,
          meta_interacciones: baseInteracciones,
          meta_clicks: baseClicks,
          is_demo_data: true,
        });
      }
    });

    const { data: entregablesCreados, error: errEntreg } = await admin
      .from("entregables")
      .insert(entregablesPayload)
      .select("id, influencer, acuerdo_id, estado, meta_alcance, meta_impresiones, meta_interacciones, meta_clicks");

    if (errEntreg) throw new Error(`Error creando entregables: ${errEntreg.message}`);

    // ---------- 4. KPIs ----------
    const kpisPayload: any[] = [];
    const entregablesEntregados = entregablesCreados!.filter((e: any) => e.estado === "Entregado");

    entregablesEntregados.forEach((ent: any) => {
      for (let p = 0; p < 2; p++) {
        const meta_alcance = Number(ent.meta_alcance) || 0;
        const meta_impresiones = Number(ent.meta_impresiones) || 0;
        const meta_interacciones = Number(ent.meta_interacciones) || 0;
        const meta_clicks = Number(ent.meta_clicks) || 0;

        const r = Math.random();
        let factor: number;
        if (r < 0.60) factor = 1.0 + Math.random() * 0.3;
        else if (r < 0.85) factor = 0.70 + Math.random() * 0.30;
        else factor = 0.40 + Math.random() * 0.30;

        const jitter = () => factor + (Math.random() - 0.5) * 0.2;
        const alcance = Math.max(0, Math.floor(meta_alcance * factor));
        const impresiones = Math.max(0, Math.floor(meta_impresiones * jitter()));
        const interacciones = Math.max(0, Math.floor(meta_interacciones * jitter()));
        const clicks = Math.max(0, Math.floor(meta_clicks * jitter()));

        const cumplimiento_alcance = meta_alcance > 0 ? +((alcance / meta_alcance) * 100).toFixed(2) : 0;
        const cumplimiento_impresiones = meta_impresiones > 0 ? +((impresiones / meta_impresiones) * 100).toFixed(2) : 0;
        const cumplimiento_interacciones = meta_interacciones > 0 ? +((interacciones / meta_interacciones) * 100).toFixed(2) : 0;
        const cumplimiento_clicks = meta_clicks > 0 ? +((clicks / meta_clicks) * 100).toFixed(2) : 0;

        kpisPayload.push({
          company_id: companyId,
          user_id: creatorUserId,
          acuerdo_id: ent.acuerdo_id,
          entregable_id: ent.id,
          influencer: ent.influencer,
          alcance,
          impresiones,
          interacciones,
          clicks,
          engagement: alcance > 0 ? Number(((interacciones / alcance) * 100).toFixed(2)) : 0,
          cpr: Math.floor(Math.random() * 500) + 100,
          cpc: Math.floor(Math.random() * 2000) + 500,
          periodo: p === 0 ? "primera_semana" : "primer_mes",
          estado: ["Medido", "Revisado", "Aprobado"][Math.floor(Math.random() * 3)],
          valor_mensual_snapshot: 1500000,
          meta_alcance_snapshot: meta_alcance,
          meta_impresiones_snapshot: meta_impresiones,
          meta_interacciones_snapshot: meta_interacciones,
          meta_clicks_snapshot: meta_clicks,
          cumplimiento_alcance,
          cumplimiento_impresiones,
          cumplimiento_interacciones,
          cumplimiento_clicks,
          notas: "KPI demo",
          is_demo_data: true,
        });
      }
    });

    const kpiTarget = Math.max(20, 2 * acuerdosCreados!.length);
    while (kpisPayload.length < kpiTarget && acuerdosCreados!.length > 0) {
      const randomAcuerdo: any = acuerdosCreados![kpisPayload.length % acuerdosCreados!.length];
      const alcance = 15000 + Math.floor(Math.random() * 85000);
      const impresiones = Math.floor(alcance * 1.5);
      const interacciones = Math.floor(alcance * 0.05);
      const clicks = Math.floor(interacciones * 0.2);
      kpisPayload.push({
        company_id: companyId,
        user_id: creatorUserId,
        acuerdo_id: randomAcuerdo.id,
        influencer: randomAcuerdo.influencer,
        alcance,
        impresiones,
        interacciones,
        clicks,
        meta_alcance_snapshot: Math.floor(alcance / (0.7 + Math.random() * 0.6)),
        meta_impresiones_snapshot: Math.floor(impresiones / (0.7 + Math.random() * 0.6)),
        meta_interacciones_snapshot: Math.floor(interacciones / (0.7 + Math.random() * 0.6)),
        meta_clicks_snapshot: Math.floor(clicks / (0.7 + Math.random() * 0.6)),
        cumplimiento_alcance: +(70 + Math.random() * 60).toFixed(2),
        cumplimiento_impresiones: +(70 + Math.random() * 60).toFixed(2),
        cumplimiento_interacciones: +(70 + Math.random() * 60).toFixed(2),
        cumplimiento_clicks: +(70 + Math.random() * 60).toFixed(2),
        engagement: Number(((interacciones / alcance) * 100).toFixed(2)),
        cpr: Math.floor(Math.random() * 500) + 100,
        cpc: Math.floor(Math.random() * 2000) + 500,
        periodo: "consolidado",
        estado: ["Medido", "Revisado", "Aprobado"][Math.floor(Math.random() * 3)],
        valor_mensual_snapshot: randomAcuerdo.valor_mensual,
        notas: "KPI demo consolidado",
        is_demo_data: true,
      });
    }

    const { error: errKpis } = await admin.from("kpis").insert(kpisPayload);
    if (errKpis) throw new Error(`Error creando KPIs: ${errKpis.message}`);

    // ---------- 5. Campaign Monitor (solo planes premium) ----------
    let campaignsCreated = 0;
    let campaignMetricsCreated = 0;
    let campaignKeywordsCreated = 0;
    let campaignAlertsCreated = 0;
    let alertHistoryCreated = 0;

    const { data: companyData } = await admin
      .from("companies")
      .select("plan")
      .eq("id", companyId)
      .maybeSingle();

    const isPremium = !!(companyData && ["pro", "enterprise"].includes(companyData.plan));

    if (isPremium) {
      const { data: conn, error: errConn } = await admin
        .from("ad_platform_connections")
        .insert({
          company_id: companyId,
          platform: "google_ads",
          account_id: "123-456-7890",
          account_name: "Cuenta Demo Google Ads",
          status: "active",
          connected_by: creatorUserId,
          last_sync_at: now.toISOString(),
          sync_interval_minutes: 60,
          is_demo_data: true,
        })
        .select("id")
        .single();

      if (errConn) console.error("Error conn:", errConn);

      if (conn) {
        // 5.1 — Campañas
        const campañasPayload = Array.from({ length: preset.campaigns }, (_, i) => {
          const tpl = pick(CAMPAIGN_TEMPLATES, i);
          return {
            company_id: companyId,
            connection_id: conn.id,
            platform: "google_ads",
            external_campaign_id: `GADS-${String(i + 1).padStart(3, "0")}`,
            campaign_name: tpl.name,
            status: "active",
            daily_budget: tpl.daily_budget,
            total_budget: tpl.daily_budget * 30,
            currency: "COP",
            start_date: sixMonthsAgo.toISOString().slice(0, 10),
            is_demo_data: true,
          };
        });

        const { data: camps, error: errCamps } = await admin
          .from("campaigns_sync")
          .insert(campañasPayload)
          .select("id, campaign_name");

        if (errCamps) console.error("Error camps:", errCamps);

        if (camps && camps.length > 0) {
          campaignsCreated = camps.length;

          // Map id -> template (para tipo y nombre)
          const campMeta = camps.map((c: any, i: number) => ({
            id: c.id,
            name: c.campaign_name,
            type: pick(CAMPAIGN_TEMPLATES, i).type,
          }));

          // 5.2 — Métricas por hora
          const metricsPayload: any[] = [];
          // Agregados por campaña para usar en keywords
          const aggByCamp: Record<string, { impressions: number; clicks: number; cost: number; conversions: number }> = {};

          for (const camp of campMeta) {
            aggByCamp[camp.id] = { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
            for (let d = preset.days_metrics - 1; d >= 0; d--) {
              const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
              const dateStr = date.toISOString().slice(0, 10);
              const dow = date.getDay();
              for (let hour = 0; hour < 24; hour++) {
                const factor = getActivityFactor(hour, dow);
                const baseImpressions = 800 + Math.random() * 1200;
                const impressions = Math.floor(baseImpressions * factor);
                const clicks = Math.floor(impressions * (0.01 + Math.random() * 0.04));
                const conversions = Math.floor(clicks * (0.02 + Math.random() * 0.08));
                const cost = Math.round(clicks * (500 + Math.random() * 1500));
                const conversionValue = conversions * (8000 + Math.random() * 12000);

                metricsPayload.push({
                  company_id: companyId,
                  campaign_sync_id: camp.id,
                  date: dateStr,
                  hour,
                  impressions,
                  clicks,
                  conversions,
                  conversion_value: Math.round(conversionValue),
                  cost,
                  ctr: Number(((clicks / Math.max(impressions, 1)) * 100).toFixed(2)),
                  cpc: Math.round(cost / Math.max(clicks, 1)),
                  cpa: conversions > 0 ? Math.round(cost / conversions) : 0,
                  roas: cost > 0 ? Number((conversionValue / cost).toFixed(2)) : 0,
                  platform_data: {},
                  is_demo_data: true,
                });

                aggByCamp[camp.id].impressions += impressions;
                aggByCamp[camp.id].clicks += clicks;
                aggByCamp[camp.id].cost += cost;
                aggByCamp[camp.id].conversions += conversions;
              }
            }
          }

          await insertInChunks("campaign_metrics", metricsPayload, 500);
          campaignMetricsCreated = metricsPayload.length;

          // 5.3 — Keywords (search/shopping)
          const kwPool = familiasNames.length > 0 ? familiasNames : KEYWORD_FALLBACK_BASES;
          const keywordsPayload: any[] = [];
          const todayStr = now.toISOString().slice(0, 10);

          for (const camp of campMeta) {
            if (camp.type !== "search" && camp.type !== "shopping") continue;
            const agg = aggByCamp[camp.id];
            const n = preset.keywords_per_campaign;

            for (let k = 0; k < n; k++) {
              const base = pick(kwPool, k).toLowerCase();
              const suffix = pick(KEYWORD_SUFFIXES, Math.floor(Math.random() * KEYWORD_SUFFIXES.length));
              const keyword = `${base} ${suffix}`;
              // Top-3 reciben 10-30%, resto 1-5%
              const share = k < 3
                ? 0.10 + Math.random() * 0.20
                : 0.01 + Math.random() * 0.04;
              const impressions = Math.floor(agg.impressions * share);
              const clicks = Math.floor(agg.clicks * share);
              const cost = Math.round(agg.cost * share);
              const conversions = Math.floor(agg.conversions * share);
              keywordsPayload.push({
                company_id: companyId,
                campaign_sync_id: camp.id,
                keyword,
                match_type: pick(MATCH_TYPES, Math.floor(Math.random() * MATCH_TYPES.length)),
                quality_score: randInt(5, 10),
                status: "active",
                date: todayStr,
                impressions,
                clicks,
                cost,
                conversions,
                ctr: Number(((clicks / Math.max(impressions, 1)) * 100).toFixed(2)),
                cpc: Math.round(cost / Math.max(clicks, 1)),
                is_demo_data: true,
              });
            }
          }

          if (keywordsPayload.length > 0) {
            await insertInChunks("campaign_keywords", keywordsPayload, 500);
            campaignKeywordsCreated = keywordsPayload.length;
          }

          // 5.4 — Alertas (3 templates, ciclar campañas)
          const alertTemplates = [
            { metric: "ctr",  condition: "below", threshold: 1.5 },
            { metric: "cpc",  condition: "above", threshold: 3000 },
            { metric: "roas", condition: "below", threshold: 2.0 },
          ];
          const alertsPayload = alertTemplates.map((t, i) => ({
            company_id: companyId,
            campaign_sync_id: pick(campMeta, i).id,
            metric: t.metric,
            condition: t.condition,
            threshold: t.threshold,
            window_minutes: 60,
            notify_channels: ["in_app"],
            is_active: true,
            created_by: creatorUserId,
            is_demo_data: true,
          }));

          const { data: alertsCreated, error: errAlerts } = await admin
            .from("campaign_alerts")
            .insert(alertsPayload)
            .select("id, campaign_sync_id, metric, threshold");

          if (errAlerts) console.error("Error alerts:", errAlerts);

          if (alertsCreated && alertsCreated.length > 0) {
            campaignAlertsCreated = alertsCreated.length;

            // 5.5 — Alert history (5-10 entradas, últimos 7 días)
            const histCount = randInt(5, 10);
            const historyPayload: any[] = [];
            for (let i = 0; i < histCount; i++) {
              const alert: any = pick(alertsCreated as any[], i);
              const camp = campMeta.find((c) => c.id === alert.campaign_sync_id) || campMeta[0];
              const triggered = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
              const acknowledged = Math.random() < 0.40
                ? new Date(triggered.getTime() + randInt(10, 240) * 60 * 1000)
                : null;

              // metric_value que viola el threshold
              let metricValue: number;
              let msg: string;
              if (alert.condition === "below") {
                metricValue = +(Number(alert.threshold) * (0.4 + Math.random() * 0.5)).toFixed(2);
                msg = `${alert.metric.toUpperCase()} de "${camp.name}" cayó a ${metricValue} (umbral ${alert.threshold})`;
              } else {
                metricValue = +(Number(alert.threshold) * (1.1 + Math.random() * 0.6)).toFixed(2);
                msg = `${alert.metric.toUpperCase()} de "${camp.name}" subió a ${metricValue} (umbral ${alert.threshold})`;
              }

              historyPayload.push({
                company_id: companyId,
                campaign_sync_id: alert.campaign_sync_id,
                alert_id: alert.id,
                triggered_at: triggered.toISOString(),
                metric_value: metricValue,
                threshold_value: Number(alert.threshold),
                message: msg,
                acknowledged_at: acknowledged ? acknowledged.toISOString() : null,
                acknowledged_by: acknowledged ? creatorUserId : null,
                is_demo_data: true,
              });
            }

            const { error: errHist } = await admin.from("alert_history").insert(historyPayload);
            if (errHist) console.error("Error alert_history:", errHist);
            else alertHistoryCreated = historyPayload.length;
          }
        }
      }
    }

    // ---------- Audit log ----------
    const summary = {
      preset: presetKey,
      acuerdos: acuerdosCreados!.length,
      pagos: pagosPayload.length,
      entregables: entregablesCreados!.length,
      kpis: kpisPayload.length,
      campaigns: campaignsCreated,
      campaign_metrics: campaignMetricsCreated,
      campaign_keywords: campaignKeywordsCreated,
      campaign_alerts: campaignAlertsCreated,
      alert_history: alertHistoryCreated,
      is_premium: isPremium,
    };

    await admin.from("audit_log").insert({
      user_id: user.id,
      user_name: user.email || "super_admin",
      action: "DEMO_DATA_GENERATED",
      module: "super_admin",
      company_id: companyId,
      details: { target_company_id: companyId, ...summary },
    });

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
