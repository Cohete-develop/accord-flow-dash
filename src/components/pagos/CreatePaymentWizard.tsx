import { useState, useMemo, useEffect } from "react";
import { Acuerdo, Pago, Entregable } from "@/types/crm";
import { useAcuerdos, useEntregables, usePagos } from "@/hooks/useCrmData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Calendar, Package, FileText, Plus, Trash2, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type WizardStep = "origin" | "agreement" | "modality" | "monthly" | "deliverable" | "manual";

interface DraftPago {
  monto: number;
  fecha_pago: string;
  concepto: string;
  entregable_id?: string;
  entregable_tmp_id?: string;
}

interface DraftEntregable {
  tmp_id: string;
  descripcion: string;
  fecha_programada: string;
  tipo_contenido: string;
}

function getLastBusinessDay(year: number, month: number): string {
  const lastDay = new Date(year, month + 1, 0);
  const dow = lastDay.getDay();
  if (dow === 0) lastDay.setDate(lastDay.getDate() - 2);
  else if (dow === 6) lastDay.setDate(lastDay.getDate() - 1);
  return lastDay.toISOString().split("T")[0];
}

function distributeAuto(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((total / n) * 100) / 100;
  const last = +(total - base * (n - 1)).toFixed(2);
  return [...Array(n - 1).fill(base), last];
}

function validateSum(amounts: number[], expected: number) {
  const sum = amounts.reduce((s, v) => s + (v || 0), 0);
  const diff = +(sum - expected).toFixed(2);
  return { sum, diff, ok: Math.abs(diff) < 0.01, exceeds: diff > 0.01 };
}

function fmt(n: number, currency = "USD") {
  return `${currency} ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function CreatePaymentWizard({ open, onClose, onSaved }: Props) {
  const { acuerdos } = useAcuerdos();
  const { entregables } = useEntregables();
  const { pagos, save: savePago } = usePagos();

  const [step, setStep] = useState<WizardStep>("origin");
  const [acuerdoId, setAcuerdoId] = useState<string>("");
  const [modality, setModality] = useState<"monthly" | "deliverable" | null>(null);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // monthly state
  const [startDate, setStartDate] = useState<string>("");
  const [draftPagos, setDraftPagos] = useState<DraftPago[]>([]);

  // deliverable state
  const [distMode, setDistMode] = useState<"auto" | "manual">("auto");
  const [useExisting, setUseExisting] = useState<boolean>(true);
  const [draftEntregables, setDraftEntregables] = useState<DraftEntregable[]>([]);
  const [delAmounts, setDelAmounts] = useState<number[]>([]);

  // manual fallback
  const [manualForm, setManualForm] = useState({
    influencer: "",
    concepto: "",
    monto: 0,
    moneda: "USD",
    fechaPago: "",
    estado: "Pendiente" as Pago["estado"],
    metodoPago: "Transferencia",
  });

  const acuerdo = useMemo(() => acuerdos.find((a) => a.id === acuerdoId), [acuerdos, acuerdoId]);
  const existingDel = useMemo(
    () => entregables.filter((e) => e.acuerdoId === acuerdoId),
    [entregables, acuerdoId]
  );
  const pagosDelAcuerdo = useMemo(
    () => pagos.filter((p) => p.acuerdoId === acuerdoId),
    [pagos, acuerdoId]
  );
  const yaPagado = pagosDelAcuerdo.reduce((s, p) => s + p.monto, 0);
  const restante = acuerdo ? +(acuerdo.valorTotal - yaPagado).toFixed(2) : 0;

  // Reset everything when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("origin");
      setAcuerdoId("");
      setModality(null);
      setDraftPagos([]);
      setDraftEntregables([]);
      setDelAmounts([]);
      setSearch("");
      setStartDate("");
      setUseExisting(true);
      setDistMode("auto");
      setManualForm({ influencer: "", concepto: "", monto: 0, moneda: "USD", fechaPago: "", estado: "Pendiente", metodoPago: "Transferencia" });
    }
  }, [open]);

  // ---- Builders ----

  const buildMonthlyDrafts = (a: Acuerdo, fromDate: string): DraftPago[] => {
    const start = new Date(fromDate || a.fechaInicio || new Date().toISOString());
    const months = a.duracionMeses > 0 ? a.duracionMeses : 1;
    const out: DraftPago[] = [];
    for (let i = 0; i < months; i++) {
      const m = new Date(start.getFullYear(), start.getMonth() + i, 1);
      out.push({
        monto: a.valorMensual,
        fecha_pago: getLastBusinessDay(m.getFullYear(), m.getMonth()),
        concepto: `Pago mensual ${i + 1}/${months}`,
      });
    }
    return out;
  };

  // ---- Step transitions ----

  const goAgreement = () => setStep("agreement");
  const goModality = () => {
    if (!acuerdo) return;
    setStep("modality");
  };
  const goMonthly = () => {
    if (!acuerdo) return;
    const sd = acuerdo.fechaInicio || new Date().toISOString().split("T")[0];
    setStartDate(sd);
    setDraftPagos(buildMonthlyDrafts(acuerdo, sd));
    setModality("monthly");
    setStep("monthly");
  };
  const goDeliverable = () => {
    if (!acuerdo) return;
    const hasExisting = existingDel.length > 0;
    setUseExisting(hasExisting);
    if (hasExisting) {
      setDelAmounts(distributeAuto(acuerdo.valorTotal, existingDel.length));
      setDraftEntregables([]);
    } else {
      setDraftEntregables([
        { tmp_id: crypto.randomUUID(), descripcion: "", fecha_programada: "", tipo_contenido: "Reel" },
      ]);
      setDelAmounts([acuerdo.valorTotal]);
    }
    setDistMode("auto");
    setModality("deliverable");
    setStep("deliverable");
  };

  // ---- Monthly handlers ----
  const updateMonthly = (i: number, field: "monto" | "fecha_pago", v: any) => {
    setDraftPagos((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: v } : p)));
  };

  // ---- Deliverable handlers ----
  const addDraftEntregable = () => {
    const next = [
      ...draftEntregables,
      { tmp_id: crypto.randomUUID(), descripcion: "", fecha_programada: "", tipo_contenido: "Reel" },
    ];
    setDraftEntregables(next);
    if (acuerdo && distMode === "auto") setDelAmounts(distributeAuto(acuerdo.valorTotal, next.length));
    else setDelAmounts((prev) => [...prev, 0]);
  };
  const removeDraftEntregable = (i: number) => {
    const next = draftEntregables.filter((_, idx) => idx !== i);
    setDraftEntregables(next);
    if (acuerdo && distMode === "auto" && next.length > 0)
      setDelAmounts(distributeAuto(acuerdo.valorTotal, next.length));
    else setDelAmounts((prev) => prev.filter((_, idx) => idx !== i));
  };
  const updateDraftEntregable = (i: number, field: keyof DraftEntregable, v: string) => {
    setDraftEntregables((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: v } : e)));
  };
  const updateDelAmount = (i: number, v: number) => {
    setDelAmounts((prev) => prev.map((a, idx) => (idx === i ? v : a)));
  };
  const switchDistMode = (mode: "auto" | "manual") => {
    setDistMode(mode);
    if (mode === "auto" && acuerdo) {
      const n = useExisting ? existingDel.length : draftEntregables.length;
      if (n > 0) setDelAmounts(distributeAuto(acuerdo.valorTotal, n));
    }
  };

  // ---- Submission ----

  const submitMonthly = async () => {
    if (!acuerdo) return;
    const amounts = draftPagos.map((d) => d.monto || 0);
    const v = validateSum(amounts, acuerdo.valorTotal);
    if (v.exceeds) {
      toast.error(`La suma (${fmt(v.sum, acuerdo.moneda)}) excede el total del acuerdo (${fmt(acuerdo.valorTotal, acuerdo.moneda)})`);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("create_payments_from_agreement", {
        _acuerdo_id: acuerdo.id,
        _new_entregables: [],
        _new_pagos: draftPagos.map((d) => ({
          monto: d.monto,
          fecha_pago: d.fecha_pago,
          concepto: d.concepto,
          influencer: acuerdo.influencer,
          moneda: acuerdo.moneda,
          estado: "Pendiente",
          metodo_pago: "Transferencia",
        })),
      });
      if (error) throw error;
      toast.success(`Se generaron ${draftPagos.length} pago(s)`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("Error al generar pagos: " + (e?.message || "desconocido"));
    } finally {
      setSubmitting(false);
    }
  };

  const submitDeliverable = async () => {
    if (!acuerdo) return;
    const v = validateSum(delAmounts, acuerdo.valorTotal);
    if (v.exceeds) {
      toast.error(`La suma (${fmt(v.sum, acuerdo.moneda)}) excede el total del acuerdo (${fmt(acuerdo.valorTotal, acuerdo.moneda)})`);
      return;
    }
    setSubmitting(true);
    try {
      let pagosPayload: any[] = [];
      let entregablesPayload: any[] = [];

      if (useExisting) {
        pagosPayload = existingDel.map((e, i) => ({
          monto: delAmounts[i] || 0,
          fecha_pago: e.fechaProgramada || acuerdo.fechaInicio || new Date().toISOString().split("T")[0],
          concepto: e.descripcion || `Pago entregable ${i + 1}`,
          influencer: acuerdo.influencer,
          moneda: acuerdo.moneda,
          estado: "Pendiente",
          metodo_pago: "Transferencia",
          entregable_id: e.id,
        })).filter((p) => p.monto > 0);
      } else {
        // Validate drafts
        const invalid = draftEntregables.findIndex((d) => !d.descripcion.trim());
        if (invalid >= 0) {
          toast.error(`El entregable #${invalid + 1} necesita descripción`);
          setSubmitting(false);
          return;
        }
        entregablesPayload = draftEntregables.map((d) => ({
          tmp_id: d.tmp_id,
          descripcion: d.descripcion,
          fecha_programada: d.fecha_programada,
          tipo_contenido: d.tipo_contenido,
          influencer: acuerdo.influencer,
        }));
        pagosPayload = draftEntregables.map((d, i) => ({
          monto: delAmounts[i] || 0,
          fecha_pago: d.fecha_programada || acuerdo.fechaInicio || new Date().toISOString().split("T")[0],
          concepto: d.descripcion || `Pago entregable ${i + 1}`,
          influencer: acuerdo.influencer,
          moneda: acuerdo.moneda,
          estado: "Pendiente",
          metodo_pago: "Transferencia",
          entregable_tmp_id: d.tmp_id,
        })).filter((p) => p.monto > 0);
      }

      const { error } = await supabase.rpc("create_payments_from_agreement", {
        _acuerdo_id: acuerdo.id,
        _new_entregables: entregablesPayload,
        _new_pagos: pagosPayload,
      });
      if (error) throw error;
      toast.success(`Se generaron ${pagosPayload.length} pago(s)${entregablesPayload.length ? ` y ${entregablesPayload.length} entregable(s)` : ""}`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("Error al generar pagos: " + (e?.message || "desconocido"));
    } finally {
      setSubmitting(false);
    }
  };

  const submitManual = async () => {
    if (!manualForm.influencer.trim()) {
      toast.error("Influencer requerido");
      return;
    }
    if (manualForm.monto <= 0) {
      toast.error("Monto debe ser mayor a 0");
      return;
    }
    setSubmitting(true);
    try {
      await savePago({
        data: {
          acuerdoId: "",
          influencer: manualForm.influencer,
          concepto: manualForm.concepto,
          monto: manualForm.monto,
          moneda: manualForm.moneda,
          fechaPago: manualForm.fechaPago,
          estado: manualForm.estado,
          metodoPago: manualForm.metodoPago,
          comprobante: "",
          notas: "",
        },
      });
      toast.success("Pago manual creado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("Error: " + (e?.message || "desconocido"));
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Renders ----

  const filteredAcuerdos = acuerdos
    .filter((a) => a.estado === "Activo" || a.estado === "En Negociación" || a.estado === "Pausado")
    .filter((a) => !search || a.influencer.toLowerCase().includes(search.toLowerCase()));

  const titleByStep: Record<WizardStep, string> = {
    origin: "Nuevo Pago — Origen",
    agreement: "Selecciona el acuerdo",
    modality: "Modalidad de pagos",
    monthly: "Pagos mensuales",
    deliverable: "Pagos por entregable",
    manual: "Pago manual",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleByStep[step]}</DialogTitle>
        </DialogHeader>

        {/* STEP: ORIGIN */}
        {step === "origin" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card
              className="cursor-pointer hover:border-primary transition border-2"
              onClick={goAgreement}
            >
              <CardContent className="p-5 text-center space-y-2">
                <FileText className="h-8 w-8 mx-auto text-primary" />
                <div className="font-semibold">Desde un acuerdo</div>
                <p className="text-xs text-muted-foreground">
                  Genera pagos coherentes con el valor total del acuerdo (recomendado).
                </p>
                <Badge variant="secondary">Recomendado</Badge>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-primary transition border-2"
              onClick={() => setStep("manual")}
            >
              <CardContent className="p-5 text-center space-y-2">
                <Plus className="h-8 w-8 mx-auto text-muted-foreground" />
                <div className="font-semibold">Pago manual</div>
                <p className="text-xs text-muted-foreground">
                  Para casos sueltos: bonos, ajustes o gastos sin acuerdo origen.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP: AGREEMENT */}
        {step === "agreement" && (
          <div className="space-y-4">
            <Input
              placeholder="Buscar influencer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
              {filteredAcuerdos.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No hay acuerdos disponibles.
                </div>
              )}
              {filteredAcuerdos.map((a) => {
                const pagado = pagos.filter((p) => p.acuerdoId === a.id).reduce((s, p) => s + p.monto, 0);
                const sel = a.id === acuerdoId;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAcuerdoId(a.id)}
                    className={`w-full text-left p-3 flex items-center justify-between hover:bg-muted/50 transition ${sel ? "bg-muted" : ""}`}
                  >
                    <div>
                      <div className="font-medium">{a.influencer}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmt(a.valorTotal, a.moneda)} · {a.duracionMeses} meses · {a.estado}
                      </div>
                    </div>
                    <div className="text-xs text-right">
                      <div>Pagado: {fmt(pagado, a.moneda)}</div>
                      <div className="text-muted-foreground">Saldo: {fmt(a.valorTotal - pagado, a.moneda)}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {acuerdo && (
              <Card className="bg-muted/30">
                <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><div className="text-muted-foreground text-xs">V. Mensual</div><div className="font-semibold">{fmt(acuerdo.valorMensual, acuerdo.moneda)}</div></div>
                  <div><div className="text-muted-foreground text-xs">V. Total</div><div className="font-semibold">{fmt(acuerdo.valorTotal, acuerdo.moneda)}</div></div>
                  <div><div className="text-muted-foreground text-xs">Pagado</div><div className="font-semibold">{fmt(yaPagado, acuerdo.moneda)}</div></div>
                  <div><div className="text-muted-foreground text-xs">Restante</div><div className="font-semibold">{fmt(restante, acuerdo.moneda)}</div></div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* STEP: MODALITY */}
        {step === "modality" && acuerdo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="cursor-pointer hover:border-primary transition border-2" onClick={goMonthly}>
              <CardContent className="p-5 text-center space-y-2">
                <Calendar className="h-8 w-8 mx-auto text-primary" />
                <div className="font-semibold">Mensual fijo</div>
                <p className="text-xs text-muted-foreground">
                  Genera {acuerdo.duracionMeses} pagos de {fmt(acuerdo.valorMensual, acuerdo.moneda)} cada uno.
                </p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary transition border-2" onClick={goDeliverable}>
              <CardContent className="p-5 text-center space-y-2">
                <Package className="h-8 w-8 mx-auto text-primary" />
                <div className="font-semibold">Por entregable</div>
                <p className="text-xs text-muted-foreground">
                  Distribuye {fmt(acuerdo.valorTotal, acuerdo.moneda)} entre los entregables del acuerdo.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP: MONTHLY */}
        {step === "monthly" && acuerdo && (() => {
          const v = validateSum(draftPagos.map((d) => d.monto || 0), acuerdo.valorTotal);
          return (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label>Fecha de inicio de pagos</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDraftPagos(buildMonthlyDrafts(acuerdo, e.target.value));
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground pb-2">
                  Día por defecto: último día hábil del mes
                </div>
              </div>

              <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                {draftPagos.map((d, i) => (
                  <div key={i} className="p-3 flex items-center gap-3">
                    <div className="text-xs text-muted-foreground w-8">#{i + 1}</div>
                    <Input
                      type="date"
                      value={d.fecha_pago}
                      onChange={(e) => updateMonthly(i, "fecha_pago", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={d.monto || ""}
                      onChange={(e) => updateMonthly(i, "monto", +e.target.value || 0)}
                      className="w-36"
                      placeholder="Monto"
                    />
                  </div>
                ))}
              </div>

              <SumStatus v={v} expected={acuerdo.valorTotal} currency={acuerdo.moneda} />
            </div>
          );
        })()}

        {/* STEP: DELIVERABLE */}
        {step === "deliverable" && acuerdo && (() => {
          const v = validateSum(delAmounts, acuerdo.valorTotal);
          return (
            <div className="space-y-4">
              {existingDel.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant={useExisting ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setUseExisting(true);
                      setDelAmounts(distributeAuto(acuerdo.valorTotal, existingDel.length));
                    }}
                  >
                    Usar {existingDel.length} entregable(s) existentes
                  </Button>
                  <Button
                    variant={!useExisting ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setUseExisting(false);
                      setDraftEntregables([{ tmp_id: crypto.randomUUID(), descripcion: "", fecha_programada: "", tipo_contenido: "Reel" }]);
                      setDelAmounts([acuerdo.valorTotal]);
                    }}
                  >
                    Crear nuevos
                  </Button>
                </div>
              )}

              <div className="flex gap-2 items-center">
                <Label className="text-xs">Distribución:</Label>
                <Button variant={distMode === "auto" ? "default" : "outline"} size="sm" onClick={() => switchDistMode("auto")}>
                  Automática
                </Button>
                <Button variant={distMode === "manual" ? "default" : "outline"} size="sm" onClick={() => switchDistMode("manual")}>
                  Manual
                </Button>
              </div>

              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                {useExisting
                  ? existingDel.map((e, i) => (
                      <div key={e.id} className="p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{e.descripcion || `Entregable ${i + 1}`}</div>
                          <div className="text-xs text-muted-foreground">
                            {e.tipoContenido} · {e.fechaProgramada || "Sin fecha"}
                          </div>
                        </div>
                        <Input
                          type="number"
                          value={delAmounts[i] || ""}
                          onChange={(ev) => updateDelAmount(i, +ev.target.value || 0)}
                          disabled={distMode === "auto"}
                          className="w-36"
                        />
                      </div>
                    ))
                  : draftEntregables.map((d, i) => (
                      <div key={d.tmp_id} className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground w-8">#{i + 1}</div>
                          <Input
                            placeholder="Descripción del entregable"
                            value={d.descripcion}
                            onChange={(ev) => updateDraftEntregable(i, "descripcion", ev.target.value)}
                            className="flex-1"
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeDraftEntregable(i)} disabled={draftEntregables.length === 1}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 pl-10">
                          <Select value={d.tipo_contenido} onValueChange={(v) => updateDraftEntregable(i, "tipo_contenido", v)}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Reel">Reel</SelectItem>
                              <SelectItem value="Story">Story</SelectItem>
                              <SelectItem value="Collab">Collab</SelectItem>
                              <SelectItem value="UGC">UGC</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            value={d.fecha_programada}
                            onChange={(ev) => updateDraftEntregable(i, "fecha_programada", ev.target.value)}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            value={delAmounts[i] || ""}
                            onChange={(ev) => updateDelAmount(i, +ev.target.value || 0)}
                            disabled={distMode === "auto"}
                            placeholder="Monto"
                            className="w-36"
                          />
                        </div>
                      </div>
                    ))}
              </div>

              {!useExisting && (
                <Button variant="outline" size="sm" onClick={addDraftEntregable}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar entregable
                </Button>
              )}

              <SumStatus v={v} expected={acuerdo.valorTotal} currency={acuerdo.moneda} />
            </div>
          );
        })()}

        {/* STEP: MANUAL */}
        {step === "manual" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Influencer / Concepto principal</Label>
              <Input value={manualForm.influencer} onChange={(e) => setManualForm({ ...manualForm, influencer: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Concepto</Label>
              <Input value={manualForm.concepto} onChange={(e) => setManualForm({ ...manualForm, concepto: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Monto</Label>
              <Input type="number" value={manualForm.monto || ""} onChange={(e) => setManualForm({ ...manualForm, monto: +e.target.value || 0 })} />
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={manualForm.moneda} onValueChange={(v) => setManualForm({ ...manualForm, moneda: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="COP">COP</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fecha de pago</Label>
              <Input type="date" value={manualForm.fechaPago} onChange={(e) => setManualForm({ ...manualForm, fechaPago: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={manualForm.estado} onValueChange={(v) => setManualForm({ ...manualForm, estado: v as Pago["estado"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Programado">Programado</SelectItem>
                  <SelectItem value="Pagado">Pagado</SelectItem>
                  <SelectItem value="Vencido">Vencido</SelectItem>
                  <SelectItem value="Cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <div>
            {step !== "origin" && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (step === "agreement") setStep("origin");
                  else if (step === "modality") setStep("agreement");
                  else if (step === "monthly" || step === "deliverable") setStep("modality");
                  else if (step === "manual") setStep("origin");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            {step === "agreement" && (
              <Button variant="gradient" disabled={!acuerdo} onClick={goModality}>
                Continuar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === "monthly" && (
              <Button variant="gradient" disabled={submitting} onClick={submitMonthly}>
                Generar {draftPagos.length} pagos
              </Button>
            )}
            {step === "deliverable" && (
              <Button variant="gradient" disabled={submitting} onClick={submitDeliverable}>
                Generar pagos
              </Button>
            )}
            {step === "manual" && (
              <Button variant="gradient" disabled={submitting} onClick={submitManual}>
                Crear pago
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SumStatus({ v, expected, currency }: { v: ReturnType<typeof validateSum>; expected: number; currency: string }) {
  if (v.ok) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-md">
        <Check className="h-4 w-4" /> Total cuadra: {fmt(v.sum, currency)} de {fmt(expected, currency)}
      </div>
    );
  }
  if (v.exceeds) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-md">
        <AlertTriangle className="h-4 w-4" /> Te excedes en {fmt(v.diff, currency)} (suma {fmt(v.sum, currency)} vs total {fmt(expected, currency)})
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
      <AlertTriangle className="h-4 w-4" /> Faltan {fmt(-v.diff, currency)} para llegar al total ({fmt(v.sum, currency)} de {fmt(expected, currency)})
    </div>
  );
}