import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, AlertTriangle, Loader2, Plus } from "lucide-react";
import type { Platform } from "@/hooks/useCampaignMonitor";

const PLATFORM_LABELS: Record<Platform, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads",
  linkedin_ads: "LinkedIn Ads",
};

type NumFmt = "es" | "us" | "plain";
type DateFmt = "dmy" | "mdy" | "iso";

type Row = {
  campaign_name: string;
  impressions: string;
  clicks: string;
  cost: string;
  date: string;
  conversions: string;
  conversion_value: string;
  familia_producto: string;
};

const COLS: { key: keyof Row; label: string; required: boolean; numeric: boolean; isDate?: boolean }[] = [
  { key: "campaign_name", label: "campaign_name", required: true, numeric: false },
  { key: "impressions", label: "impressions", required: true, numeric: true },
  { key: "clicks", label: "clicks", required: true, numeric: true },
  { key: "cost", label: "cost", required: true, numeric: true },
  { key: "date", label: "date", required: false, numeric: false, isDate: true },
  { key: "conversions", label: "conversions", required: false, numeric: true },
  { key: "conversion_value", label: "conversion_value", required: false, numeric: true },
  { key: "familia_producto", label: "familia_producto", required: false, numeric: false },
];

const emptyRow = (): Row => ({
  campaign_name: "", impressions: "", clicks: "", cost: "",
  date: "", conversions: "", conversion_value: "", familia_producto: "",
});

function parseNumber(raw: string, fmt: NumFmt): number | null {
  if (!raw || !raw.trim()) return null;
  let s = raw.trim().replace(/[\s$€£]/g, "");
  if (fmt === "es") s = s.replace(/\./g, "").replace(/,/g, ".");
  else if (fmt === "us") s = s.replace(/,/g, "");
  // plain: leave as-is
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string, fmt: DateFmt): string | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  let y: number, m: number, d: number;
  if (fmt === "iso") {
    const mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!mt) return null;
    y = +mt[1]; m = +mt[2]; d = +mt[3];
  } else {
    const mt = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!mt) return null;
    if (fmt === "dmy") { d = +mt[1]; m = +mt[2]; y = +mt[3]; }
    else { m = +mt[1]; d = +mt[2]; y = +mt[3]; }
    if (y < 100) y += 2000;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Validar días reales por mes (incluye bisiestos). new Date "corrige" fechas
  // inválidas (Feb 30 -> Mar 2), así que comparamos componentes.
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  const iso = `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  return iso;
}

function isRowEmpty(r: Row): boolean {
  return COLS.every((c) => !r[c.key].trim());
}

function isTotalRow(r: Row): boolean {
  return r.campaign_name.trim().toLowerCase().startsWith("total");
}

export function ManualImportDialog({
  open,
  onOpenChange,
  platform,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  platform: Platform;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);

  // Step 1 — recalculamos defaults en cada reset() para evitar fechas viejas
  // si el diálogo estuvo montado desde antes de medianoche.
  const computeDefaults = () => {
    const today = new Date().toISOString().slice(0, 10);
    const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { today, thirtyAgo };
  };
  const initialDefaults = computeDefaults();
  const [periodStart, setPeriodStart] = useState(initialDefaults.thirtyAgo);
  const [periodEnd, setPeriodEnd] = useState(initialDefaults.today);
  const [currency, setCurrency] = useState("COP");

  // Step 2
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 30 }, emptyRow));

  // Step 3
  const [numFmt, setNumFmt] = useState<NumFmt | "">("");
  const [dateFmt, setDateFmt] = useState<DateFmt | "">("");

  // Submission
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    const { today, thirtyAgo } = computeDefaults();
    setStep(1);
    setPeriodStart(thirtyAgo);
    setPeriodEnd(today);
    setCurrency("COP");
    setRows(Array.from({ length: 30 }, emptyRow));
    setNumFmt(""); setDateFmt("");
    setSubmitting(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const updateCell = (rIdx: number, key: keyof Row, val: string) => {
    setRows((prev) => {
      const next = prev.slice();
      next[rIdx] = { ...next[rIdx], [key]: val };
      return next;
    });
  };

  const addRows = (n = 10) => setRows((prev) => [...prev, ...Array.from({ length: n }, emptyRow)]);

  const handlePaste = (e: React.ClipboardEvent, rIdx: number, cIdx: number) => {
    const text = e.clipboardData.getData("text");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return; // single cell paste, let default work
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((_, i, arr) => i < arr.length - 1 || arr[i] !== "");
    setRows((prev) => {
      const next = prev.slice();
      lines.forEach((line, li) => {
        const cells = line.includes("\t") ? line.split("\t") : [line];
        const targetRow = rIdx + li;
        while (next.length <= targetRow) next.push(emptyRow());
        const row = { ...next[targetRow] };
        cells.forEach((cell, ci) => {
          const colIdx = cIdx + ci;
          if (colIdx >= COLS.length) return;
          (row as any)[COLS[colIdx].key] = cell.trim();
        });
        next[targetRow] = row;
      });
      return next;
    });
  };

  // Computed: counts
  const nonEmpty = useMemo(() => rows.filter((r) => !isRowEmpty(r)), [rows]);
  const totals = useMemo(() => nonEmpty.filter(isTotalRow), [nonEmpty]);
  const validCandidates = useMemo(() => nonEmpty.filter((r) => !isTotalRow(r)), [nonEmpty]);

  const hasAnyDate = useMemo(() => validCandidates.some((r) => r.date.trim() !== ""), [validCandidates]);

  // Cell validity (visual)
  const cellInvalid = (r: Row, key: keyof Row): boolean => {
    const col = COLS.find((c) => c.key === key)!;
    const val = r[key].trim();
    if (!val) return false;
    if (col.numeric && numFmt) return parseNumber(val, numFmt) === null;
    if (col.isDate && dateFmt) return parseDate(val, dateFmt) === null;
    return false;
  };

  // Build interpreted payload — alineado 1:1 con validCandidates.
  type InterpretedEntry =
    | { parseStatus: "ok"; row: any; errors: [] }
    | { parseStatus: "invalid"; row: null; errors: string[] };
  const interpreted = useMemo(() => {
    const entries: InterpretedEntry[] = [];
    const validRows: any[] = [];
    if (!numFmt) {
      for (let i = 0; i < validCandidates.length; i++) {
        entries.push({ parseStatus: "invalid", row: null, errors: ["Formato numérico no declarado"] });
      }
      return { entries, validRows, invalid: validCandidates.length };
    }
    let invalid = 0;
    for (const r of validCandidates) {
      const errors: string[] = [];
      const impressions = parseNumber(r.impressions, numFmt);
      const clicks = parseNumber(r.clicks, numFmt);
      const cost = parseNumber(r.cost, numFmt);
      if (!r.campaign_name.trim()) errors.push("Campaña vacía");
      if (impressions === null) errors.push("impressions inválido");
      if (clicks === null) errors.push("clicks inválido");
      if (cost === null) errors.push("cost inválido");

      let dateIso: string | null = null;
      if (r.date.trim()) {
        if (!dateFmt) {
          errors.push("Formato de fecha no declarado");
        } else {
          dateIso = parseDate(r.date, dateFmt);
          if (!dateIso) errors.push("Fecha inválida");
        }
      } else {
        dateIso = periodEnd;
      }
      const conv = r.conversions.trim() ? parseNumber(r.conversions, numFmt) : 0;
      const convVal = r.conversion_value.trim() ? parseNumber(r.conversion_value, numFmt) : 0;
      if (conv === null) errors.push("conversions inválido");
      if (convVal === null) errors.push("conversion_value inválido");

      if (
        errors.length > 0 ||
        impressions === null || clicks === null || cost === null ||
        conv === null || convVal === null || !dateIso
      ) {
        invalid++;
        entries.push({ parseStatus: "invalid", row: null, errors });
        continue;
      }
      const row = {
        campaign_name: r.campaign_name.trim(),
        date: dateIso,
        impressions: Math.max(0, Math.round(impressions)),
        clicks: Math.max(0, Math.round(clicks)),
        cost,
        conversions: Math.max(0, Math.round(conv)),
        conversion_value: convVal,
        currency,
        familia_producto: r.familia_producto.trim() || null,
      };
      validRows.push(row);
      entries.push({ parseStatus: "ok", row, errors: [] });
    }
    return { entries, validRows, invalid };
  }, [validCandidates, numFmt, dateFmt, periodEnd, currency]);

  const uniqueCampaigns = useMemo(() => {
    const s = new Set(interpreted.validRows.map((r) => r.campaign_name.toLowerCase()));
    return s.size;
  }, [interpreted.validRows]);

  // Step navigation guards
  const canNextFromStep1 = periodStart && periodEnd && periodStart <= periodEnd;
  const canNextFromStep2 = validCandidates.length > 0;
  const step3NeedsDate = hasAnyDate;
  const canNextFromStep3 = !!numFmt && (!step3NeedsDate || !!dateFmt);

  // Submit
  const handleSubmit = async () => {
    if (interpreted.validRows.length === 0) {
      toast.error("No hay filas válidas para importar");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("campaign-import-metrics", {
        body: {
          platform,
          period_start: periodStart,
          period_end: periodEnd,
          rows: interpreted.validRows,
        },
      });
      if (error) throw new Error(error.message || "Error al invocar la función");
      const res = data as any;
      if (!res?.ok) {
        if (res?.code === "PLAN_REQUIRED" || res?.code === "PLAN_NOT_ALLOWED") {
          toast.error("Tu plan no incluye Campaign Monitor");
        } else {
          toast.error(res?.error || "Error al importar");
        }
        return;
      }
      toast.success(
        `Importación completada: ${res.inserted} nuevas, ${res.updated} actualizadas${res.skipped ? `, ${res.skipped} descartadas` : ""}`
      );
      qc.invalidateQueries({ queryKey: ["campaigns_sync"] });
      qc.invalidateQueries({ queryKey: ["campaign_metrics"] });
      qc.invalidateQueries({ queryKey: ["ad_connections"] });
      handleClose(false);
    } catch (e: any) {
      toast.error(e?.message || "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Importar métricas
            <Badge variant="secondary">{PLATFORM_LABELS[platform]}</Badge>
          </DialogTitle>
          <DialogDescription>
            Pega tus métricas exportadas desde la plataforma. InfluXpert las normalizará e importará.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-1 pb-2 border-b">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step === s ? "bg-primary text-primary-foreground" : step > s ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              <span className={`text-xs ${step === s ? "font-semibold" : "text-muted-foreground"}`}>
                {s === 1 ? "Información" : s === 2 ? "Datos" : s === 3 ? "Formato" : "Confirmación"}
              </span>
              {s < 4 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto pr-1">
          {step === 1 && (
            <div className="space-y-4 pt-4">
              <div>
                <Label className="text-xs text-muted-foreground">Plataforma</Label>
                <div className="mt-1"><Badge variant="outline" className="text-base px-3 py-1">{PLATFORM_LABELS[platform]}</Badge></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Fecha inicio</Label>
                  <Input type="date" value={periodStart} max={periodEnd} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div>
                  <Label>Fecha fin</Label>
                  <Input type="date" value={periodEnd} min={periodStart} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
                <div>
                  <Label>Moneda</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COP">COP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="MXN">MXN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Si los datos que vas a pegar son <strong>totales del período</strong> (sin desglose día por día),
                  InfluXpert los registrará como una sola fila fechada al cierre del período. Esto permite ver
                  agregados pero no tendencias diarias.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Pega tus datos desde Excel/Google Sheets con <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+V</kbd> en cualquier celda.
                Múltiples columnas se distribuyen automáticamente.
              </p>
              <div className="border rounded-md overflow-auto max-h-[50vh]">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gradient-to-r from-primary/10 to-accent/10 z-10">
                    <tr>
                      <th className="px-2 py-2 text-xs text-muted-foreground w-10">#</th>
                      {COLS.map((c) => (
                        <th key={c.key} className="px-2 py-2 text-left text-xs font-semibold whitespace-nowrap">
                          {c.label}
                          {c.required ? <span className="text-destructive ml-0.5">*</span> : <span className="text-muted-foreground/60 ml-1 font-normal">(opc.)</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rIdx) => {
                      const empty = isRowEmpty(row);
                      const total = !empty && isTotalRow(row);
                      return (
                        <tr key={rIdx} className={total ? "bg-amber-100/40 dark:bg-amber-900/20" : ""} title={total ? "Esta fila será descartada" : undefined}>
                          <td className="px-2 py-1 text-xs text-muted-foreground text-center">{rIdx + 1}</td>
                          {COLS.map((c, cIdx) => {
                            const invalid = cellInvalid(row, c.key);
                            return (
                              <td key={c.key} className={!c.required ? "bg-muted/20" : ""}>
                                <input
                                  className={`w-full px-2 py-1 bg-transparent border outline-none focus:ring-1 focus:ring-primary ${
                                    invalid ? "border-destructive" : "border-transparent"
                                  }`}
                                  value={row[c.key]}
                                  onChange={(e) => updateCell(rIdx, c.key, e.target.value)}
                                  onPaste={(e) => handlePaste(e, rIdx, cIdx)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <Button variant="outline" size="sm" onClick={() => addRows(10)}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar 10 filas
                </Button>
                <div>
                  {nonEmpty.length} con datos · {validCandidates.length} válidas · {totals.length} descartadas
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">¿Cómo vienen los números en tu archivo?</CardTitle></CardHeader>
                <CardContent>
                  <RadioGroup value={numFmt} onValueChange={(v) => setNumFmt(v as NumFmt)}>
                    {[
                      { v: "es", label: "1.234,56", hint: "Punto miles, coma decimal (Colombia/Europa)" },
                      { v: "us", label: "1,234.56", hint: "Coma miles, punto decimal (USA/Google Ads)" },
                      { v: "plain", label: "1234.56", hint: "Sin separador de miles" },
                    ].map((o) => (
                      <label key={o.v} className="flex items-start gap-2 py-1.5 cursor-pointer">
                        <RadioGroupItem value={o.v} id={`num-${o.v}`} />
                        <div className="flex-1">
                          <div className="font-mono text-sm">{o.label}</div>
                          <div className="text-xs text-muted-foreground">{o.hint}</div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">¿Las columnas de porcentaje vienen como?</CardTitle></CardHeader>
                <CardContent>
                  <RadioGroup value={pctFmt} onValueChange={(v) => setPctFmt(v as PctFmt)}>
                    {[
                      { v: "percent", label: "51.77", hint: "Representa 51.77%" },
                      { v: "decimal", label: "0.5177", hint: "Representa 51.77%" },
                    ].map((o) => (
                      <label key={o.v} className="flex items-start gap-2 py-1.5 cursor-pointer">
                        <RadioGroupItem value={o.v} id={`pct-${o.v}`} />
                        <div className="flex-1">
                          <div className="font-mono text-sm">{o.label}</div>
                          <div className="text-xs text-muted-foreground">{o.hint}</div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">¿Las fechas vienen en formato?</CardTitle></CardHeader>
                <CardContent>
                  {!step3NeedsDate ? (
                    <p className="text-xs text-muted-foreground">
                      No aplica — usarás la fecha de cierre del período ({periodEnd}).
                    </p>
                  ) : (
                    <RadioGroup value={dateFmt} onValueChange={(v) => setDateFmt(v as DateFmt)}>
                      {[
                        { v: "dmy", label: "DD/MM/AAAA", hint: "Día primero (Colombia)" },
                        { v: "mdy", label: "MM/DD/AAAA", hint: "Mes primero (USA)" },
                        { v: "iso", label: "AAAA-MM-DD", hint: "ISO (Meta exports)" },
                      ].map((o) => (
                        <label key={o.v} className="flex items-start gap-2 py-1.5 cursor-pointer">
                          <RadioGroupItem value={o.v} id={`date-${o.v}`} />
                          <div className="flex-1">
                            <div className="font-mono text-sm">{o.label}</div>
                            <div className="text-xs text-muted-foreground">{o.hint}</div>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 pt-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Original vs Interpretado (primeras 5 filas)</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-2 py-1">Campaña</th>
                          <th className="text-left px-2 py-1">Original cost</th>
                          <th className="text-left px-2 py-1">Interpretado cost</th>
                          <th className="text-left px-2 py-1">Original date</th>
                          <th className="text-left px-2 py-1">Interpretado date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validCandidates.slice(0, 5).map((r, i) => {
                          const interp = interpreted.rows[i];
                          return (
                            <tr key={i} className="border-t">
                              <td className="px-2 py-1">{r.campaign_name}</td>
                              <td className="px-2 py-1 font-mono">{r.cost}</td>
                              <td className="px-2 py-1 font-mono">{interp ? `${interp.cost.toLocaleString("en-US")} ${currency}` : "—"}</td>
                              <td className="px-2 py-1 font-mono">{r.date || "(vacío)"}</td>
                              <td className="px-2 py-1 font-mono">{interp?.date || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Resumen de carga</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Plataforma:</span> {PLATFORM_LABELS[platform]}</p>
                  <p><span className="text-muted-foreground">Período:</span> {periodStart} al {periodEnd}</p>
                  <p><span className="text-muted-foreground">Moneda:</span> {currency}</p>
                  <p><span className="text-muted-foreground">Campañas únicas:</span> {uniqueCampaigns}</p>
                  <p><span className="text-muted-foreground">Filas a importar:</span> {interpreted.rows.length}</p>
                  <p><span className="text-muted-foreground">Filas descartadas:</span> {totals.length + interpreted.invalid} ({totals.length} totales, {interpreted.invalid} inválidas)</p>
                </CardContent>
              </Card>

              {!hasAnyDate && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Tu importación no incluye desglose diario. Las métricas se registrarán como una fila única
                    fechada al <strong>{periodEnd}</strong>. Verás agregados pero no tendencias por día.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3 flex !justify-between gap-2">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
                Atrás
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
              Cancelar
            </Button>
            {step < 4 ? (
              <Button
                variant="gradient"
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 1 && !canNextFromStep1) ||
                  (step === 2 && !canNextFromStep2) ||
                  (step === 3 && !canNextFromStep3)
                }
              >
                Siguiente
              </Button>
            ) : (
              <Button variant="gradient" onClick={handleSubmit} disabled={submitting || interpreted.rows.length === 0}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</> : "Confirmar e Importar"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}