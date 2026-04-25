import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";



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

    // ---------- Catálogos ----------
    const INFLUENCERS = [
      { nombre: "Andrea López", handle: "@andrealopez", seguidores: 125000 },
      { nombre: "Carlos Méndez", handle: "@carlosmendez", seguidores: 89000 },
      { nombre: "Valeria Ruiz", handle: "@valeriaruiz", seguidores: 210000 },
      { nombre: "Diego Torres", handle: "@diegotorres", seguidores: 67000 },
      { nombre: "Sofía Ramírez", handle: "@sofiramirez", seguidores: 340000 },
    ];
    const REDES = ["Instagram", "TikTok", "YouTube"];
    const TIPOS = ["Reel", "Story", "Post", "Video"];
    const ESTADOS_ACUERDO = ["Activo", "Finalizado", "Pausado"];
    const ESTADOS_PAGO = ["Pagado", "Pendiente", "Parcial"];
    const ESTADOS_ENTREGABLE = ["Entregado", "Pendiente", "En producción"];

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
    const acuerdosPayload = INFLUENCERS.map((inf, i) => {
      const fechaInicio = new Date(sixMonthsAgo.getTime() + i * 20 * 24 * 60 * 60 * 1000);
      const fechaFin = new Date(fechaInicio.getTime() + 90 * 24 * 60 * 60 * 1000);
      const valorMensual = 800000 + Math.floor(Math.random() * 3200000);
      return {
        company_id: companyId,
        user_id: creatorUserId,
        influencer: inf.nombre,
        red_social: [REDES[i % REDES.length]],
        plataforma: REDES[i % REDES.length],
        seguidores: inf.seguidores,
        tipo_contenido: [TIPOS[i % TIPOS.length], TIPOS[(i + 1) % TIPOS.length]],
        reels_pactados: 2 + (i % 3),
        stories_pactadas: 4 + (i % 5),
        fecha_inicio: fechaInicio.toISOString().slice(0, 10),
        fecha_fin: fechaFin.toISOString().slice(0, 10),
        duracion_meses: 3,
        valor_mensual: valorMensual,
        valor_total: valorMensual * 3,
        moneda: "COP",
        estado: ESTADOS_ACUERDO[i % ESTADOS_ACUERDO.length],
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
        const fechaPago = new Date(sixMonthsAgo.getTime() + (idx * 20 + m * 30) * 24 * 60 * 60 * 1000);
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
        const fechaProg = new Date(sixMonthsAgo.getTime() + (idx * 20 + e * 15) * 24 * 60 * 60 * 1000);
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
          estado: "Publicado",
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

    while (kpisPayload.length < 20 && acuerdosCreados!.length > 0) {
      const randomAcuerdo: any = acuerdosCreados![kpisPayload.length % acuerdosCreados!.length];
      const alcance = 15000 + Math.floor(Math.random() * 85000);
      const impresiones = Math.floor(alcance * 1.5);
      const interacciones = Math.floor(alcance * 0.05);
      kpisPayload.push({
        company_id: companyId,
        user_id: creatorUserId,
        acuerdo_id: randomAcuerdo.id,
        influencer: randomAcuerdo.influencer,
        alcance,
        impresiones,
        interacciones,
        clicks: Math.floor(interacciones * 0.2),
        engagement: Number(((interacciones / alcance) * 100).toFixed(2)),
        cpr: Math.floor(Math.random() * 500) + 100,
        cpc: Math.floor(Math.random() * 2000) + 500,
        periodo: "consolidado",
        estado: "Publicado",
        valor_mensual_snapshot: randomAcuerdo.valor_mensual,
        notas: "KPI demo consolidado",
        is_demo_data: true,
      });
    }

    const { error: errKpis } = await admin.from("kpis").insert(kpisPayload);
    if (errKpis) throw new Error(`Error creando KPIs: ${errKpis.message}`);

    // ---------- 5. Campaign Monitor (solo planes premium) ----------
    let campaignMetricsCreated = 0;
    const { data: companyData } = await admin
      .from("companies")
      .select("plan")
      .eq("id", companyId)
      .maybeSingle();

    if (companyData && ["pro", "enterprise"].includes(companyData.plan)) {
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
        const campañasPayload = [
          {
            company_id: companyId,
            connection_id: conn.id,
            platform: "google_ads",
            external_campaign_id: "GADS-001",
            campaign_name: "Campaña Search Demo",
            status: "active",
            daily_budget: 150000,
            total_budget: 4500000,
            currency: "COP",
            start_date: sixMonthsAgo.toISOString().slice(0, 10),
            is_demo_data: true,
          },
          {
            company_id: companyId,
            connection_id: conn.id,
            platform: "google_ads",
            external_campaign_id: "GADS-002",
            campaign_name: "Campaña Display Demo",
            status: "active",
            daily_budget: 200000,
            total_budget: 6000000,
            currency: "COP",
            start_date: sixMonthsAgo.toISOString().slice(0, 10),
            is_demo_data: true,
          },
        ];

        const { data: camps, error: errCamps } = await admin
          .from("campaigns_sync")
          .insert(campañasPayload)
          .select("id");

        if (errCamps) console.error("Error camps:", errCamps);

        if (camps && camps.length > 0) {
          const metricsPayload: any[] = [];
          for (const camp of camps as any[]) {
            for (let d = 0; d < 30; d++) {
              const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
              const impressions = 5000 + Math.floor(Math.random() * 15000);
              const clicks = Math.floor(impressions * (0.01 + Math.random() * 0.04));
              const conversions = Math.floor(clicks * (0.02 + Math.random() * 0.08));
              const cost = Math.round(clicks * (500 + Math.random() * 1500));
              const conversionValue = conversions * (8000 + Math.random() * 12000);
              metricsPayload.push({
                company_id: companyId,
                campaign_sync_id: camp.id,
                date: date.toISOString().slice(0, 10),
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
            }
          }

          const { error: errMet } = await admin.from("campaign_metrics").insert(metricsPayload);
          if (errMet) {
            console.error("Error metrics:", errMet);
          } else {
            campaignMetricsCreated = metricsPayload.length;
          }
        }
      }
    }

    // ---------- Audit log ----------
    await admin.from("audit_log").insert({
      user_id: user.id,
      user_name: user.email || "super_admin",
      action: "DEMO_DATA_GENERATED",
      module: "super_admin",
      company_id: companyId,
      details: {
        target_company_id: companyId,
        acuerdos: acuerdosCreados!.length,
        pagos: pagosPayload.length,
        entregables: entregablesCreados!.length,
        kpis: kpisPayload.length,
        campaign_metrics: campaignMetricsCreated,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          acuerdos: acuerdosCreados!.length,
          pagos: pagosPayload.length,
          entregables: entregablesCreados!.length,
          kpis: kpisPayload.length,
          campaign_metrics: campaignMetricsCreated,
        },
      }),
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