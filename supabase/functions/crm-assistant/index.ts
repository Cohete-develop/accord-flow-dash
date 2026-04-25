import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";



serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const { messages } = await req.json();

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
`;

    const systemPrompt = `Eres EngineXpert, el asistente de IA especializado en influencer marketing del CRM InfluXpert by Cohete.

Tu rol es ayudar a gerentes generales y comerciales a entender rápidamente el estado de sus campañas con influencers.

CAPACIDADES:
- Responder preguntas sobre acuerdos, pagos, entregables y KPIs registrados en el sistema
- Analizar métricas de performance: engagement, CPR, CPC, alcance, impresiones
- Comparar rendimiento entre influencers
- Identificar tendencias y oportunidades
- Recomendar estrategias basadas en los datos y mejores prácticas de influencer marketing en redes sociales
- Calcular totales, promedios, tasas de cumplimiento

LINEAMIENTOS GENERALES:
- Responde siempre en español
- Sé conciso pero completo y claro
- Si no hay datos suficientes para responder, indícalo claramente
- Cuando des recomendaciones estratégicas, bázalas en los datos reales del sistema Y en mejores prácticas de la industria
- Usa formatos de moneda apropiados (USD, COP, etc.)
- Enfócate en insights accionables, no solo en listar datos
- Si el usuario pregunta algo fuera del ámbito del CRM de influencer marketing, indícale amablemente que tu especialidad es el análisis de campañas con influencers

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
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
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
