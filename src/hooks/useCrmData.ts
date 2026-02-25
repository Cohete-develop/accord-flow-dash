import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Acuerdo, Pago, Entregable, KPI } from "@/types/crm";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// Hook to get user's company_id
export function useCompanyId() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCompanyId(data?.company_id || null));
  }, [user]);

  return companyId;
}

// ---- Mappers: DB (snake_case) <-> App (camelCase) ----

function dbToAcuerdo(row: any): Acuerdo {
  return {
    id: row.id, influencer: row.influencer, redSocial: row.red_social || [],
    seguidores: row.seguidores, plataforma: row.plataforma, tipoContenido: row.tipo_contenido || [],
    reelsPactados: row.reels_pactados, storiesPactadas: row.stories_pactadas,
    fechaInicio: row.fecha_inicio || "", fechaFin: row.fecha_fin || "",
    duracionMeses: row.duracion_meses, valorMensual: Number(row.valor_mensual),
    valorTotal: Number(row.valor_total), moneda: row.moneda, estado: row.estado,
    contacto: row.contacto, familiaProducto: row.familia_producto || [],
    notas: row.notas, createdAt: row.created_at,
  };
}

function acuerdoToDb(a: Omit<Acuerdo, "id" | "createdAt">, userId: string, companyId: string | null) {
  return {
    user_id: userId, company_id: companyId,
    influencer: a.influencer, red_social: a.redSocial, seguidores: a.seguidores,
    plataforma: a.plataforma, tipo_contenido: a.tipoContenido,
    reels_pactados: a.reelsPactados, stories_pactadas: a.storiesPactadas,
    fecha_inicio: a.fechaInicio || null, fecha_fin: a.fechaFin || null,
    duracion_meses: a.duracionMeses, valor_mensual: a.valorMensual,
    valor_total: a.valorTotal, moneda: a.moneda, estado: a.estado,
    contacto: a.contacto, familia_producto: a.familiaProducto, notas: a.notas,
  };
}

function dbToPago(row: any): Pago {
  return {
    id: row.id, acuerdoId: row.acuerdo_id || "", influencer: row.influencer,
    concepto: row.concepto, monto: Number(row.monto), moneda: row.moneda,
    fechaPago: row.fecha_pago || "",
    estado: row.estado, metodoPago: row.metodo_pago, comprobante: row.comprobante,
    notas: row.notas, createdAt: row.created_at,
  };
}

function pagoToDb(p: Omit<Pago, "id" | "createdAt">, userId: string, companyId: string | null) {
  return {
    user_id: userId, company_id: companyId,
    acuerdo_id: p.acuerdoId || null, influencer: p.influencer, concepto: p.concepto,
    monto: p.monto, moneda: p.moneda, fecha_pago: p.fechaPago || null,
    estado: p.estado,
    metodo_pago: p.metodoPago, comprobante: p.comprobante, notas: p.notas,
  };
}

function dbToEntregable(row: any): Entregable {
  return {
    id: row.id, acuerdoId: row.acuerdo_id || "", influencer: row.influencer,
    tipoContenido: row.tipo_contenido, descripcion: row.descripcion,
    fechaProgramada: row.fecha_programada || "", fechaEntrega: row.fecha_entrega || "",
    estado: row.estado, urlContenido: row.url_contenido, notas: row.notas,
    createdAt: row.created_at,
  };
}

function entregableToDb(e: Omit<Entregable, "id" | "createdAt">, userId: string, companyId: string | null) {
  return {
    user_id: userId, company_id: companyId,
    acuerdo_id: e.acuerdoId || null, influencer: e.influencer,
    tipo_contenido: e.tipoContenido, descripcion: e.descripcion,
    fecha_programada: e.fechaProgramada || null, fecha_entrega: e.fechaEntrega || null,
    estado: e.estado, url_contenido: e.urlContenido, notas: e.notas,
  };
}

function dbToKPI(row: any): KPI {
  return {
    id: row.id, entregableId: row.entregable_id || "", acuerdoId: row.acuerdo_id || "",
    influencer: row.influencer, alcance: row.alcance, impresiones: row.impresiones,
    interacciones: row.interacciones, clicks: row.clicks, engagement: Number(row.engagement),
    cpr: Number(row.cpr), cpc: Number(row.cpc), periodo: row.periodo,
    estado: row.estado, notas: row.notas, valorMensualSnapshot: Number(row.valor_mensual_snapshot || 0),
    createdAt: row.created_at,
  };
}

function kpiToDb(k: Omit<KPI, "id" | "createdAt">, userId: string, companyId: string | null) {
  return {
    user_id: userId, company_id: companyId,
    entregable_id: k.entregableId || null, acuerdo_id: k.acuerdoId || null,
    influencer: k.influencer, alcance: k.alcance, impresiones: k.impresiones,
    interacciones: k.interacciones, clicks: k.clicks, engagement: k.engagement,
    cpr: k.cpr, cpc: k.cpc, periodo: k.periodo, estado: k.estado, notas: k.notas,
    valor_mensual_snapshot: k.valorMensualSnapshot || 0,
  };
}

// ---- Hooks ----

export function useAcuerdos() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["acuerdos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("acuerdos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(dbToAcuerdo);
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: Omit<Acuerdo, "id" | "createdAt">; id?: string }) => {
      if (!user) throw new Error("Not authenticated");
      if (id) {
        const { company_id, user_id, ...updateData } = acuerdoToDb(data, user.id, companyId);
        const { error } = await supabase.from("acuerdos").update(updateData).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("acuerdos").insert(acuerdoToDb(data, user.id, companyId));
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acuerdos"] }),
    onError: (error: any) => toast.error("Error al guardar acuerdo: " + (error?.message || "Error desconocido")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("acuerdos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acuerdos"] }),
    onError: (error: any) => toast.error("Error al eliminar acuerdo: " + (error?.message || "Error desconocido")),
  });

  return { acuerdos: query.data || [], isLoading: query.isLoading, save: saveMutation.mutateAsync, remove: deleteMutation.mutateAsync };
}

export function usePagos() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["pagos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(dbToPago);
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: Omit<Pago, "id" | "createdAt">; id?: string }) => {
      if (!user) throw new Error("Not authenticated");
      if (id) {
        const { company_id, user_id, ...updateData } = pagoToDb(data, user.id, companyId);
        const { error } = await supabase.from("pagos").update(updateData).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pagos").insert(pagoToDb(data, user.id, companyId));
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagos"] }),
    onError: (error: any) => toast.error("Error al guardar pago: " + (error?.message || "Error desconocido")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pagos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagos"] }),
    onError: (error: any) => toast.error("Error al eliminar pago: " + (error?.message || "Error desconocido")),
  });

  return { pagos: query.data || [], isLoading: query.isLoading, save: saveMutation.mutateAsync, remove: deleteMutation.mutateAsync };
}

export function useEntregables() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["entregables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("entregables").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(dbToEntregable);
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: Omit<Entregable, "id" | "createdAt">; id?: string }) => {
      if (!user) throw new Error("Not authenticated");
      if (id) {
        const { company_id, user_id, ...updateData } = entregableToDb(data, user.id, companyId);
        const { error } = await supabase.from("entregables").update(updateData).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("entregables").insert(entregableToDb(data, user.id, companyId));
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entregables"] }),
    onError: (error: any) => toast.error("Error al guardar entregable: " + (error?.message || "Error desconocido")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entregables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entregables"] }),
    onError: (error: any) => toast.error("Error al eliminar entregable: " + (error?.message || "Error desconocido")),
  });

  return { entregables: query.data || [], isLoading: query.isLoading, save: saveMutation.mutateAsync, remove: deleteMutation.mutateAsync };
}

export function useKPIs() {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kpis").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(dbToKPI);
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, id }: { data: Omit<KPI, "id" | "createdAt">; id?: string }) => {
      if (!user) throw new Error("Not authenticated");
      if (id) {
        const { company_id, user_id, ...updateData } = kpiToDb(data, user.id, companyId);
        const { error } = await supabase.from("kpis").update(updateData).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("kpis").insert(kpiToDb(data, user.id, companyId));
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpis"] }),
    onError: (error: any) => toast.error("Error al guardar KPI: " + (error?.message || "Error desconocido")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kpis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kpis"] }),
    onError: (error: any) => toast.error("Error al eliminar KPI: " + (error?.message || "Error desconocido")),
  });

  return { kpis: query.data || [], isLoading: query.isLoading, save: saveMutation.mutateAsync, remove: deleteMutation.mutateAsync };
}
