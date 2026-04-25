import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Acuerdo } from "@/types/crm";
import { useAcuerdos } from "@/hooks/useCrmData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import ViewToolbar, { ViewMode, DateRange } from "@/components/ViewToolbar";
import KanbanBoard, { KanbanColumn } from "@/components/KanbanBoard";
import ForecastBoard from "@/components/ForecastBoard";
import SortableTableHead, { SortDirection, useSort } from "@/components/SortableTableHead";
import { useColumnOrder, ColumnDef } from "@/hooks/useColumnOrder";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { exportToFile, ExportFormat } from "@/lib/export-utils";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { supabase } from "@/integrations/supabase/client";

const REDES_SOCIALES = ["Instagram", "TikTok", "YouTube", "Twitter", "Facebook"];

const emptyAcuerdo = (): Omit<Acuerdo, "id" | "createdAt"> => ({
  influencer: "", redSocial: [], seguidores: 0, plataforma: "", tipoContenido: [],
  reelsPactados: 0, storiesPactadas: 0, fechaInicio: "", fechaFin: "",
  duracionMeses: 0, valorMensual: 0, valorTotal: 0, moneda: "COP", estado: "Activo", contacto: "", familiaProducto: [], notas: "",
});

const estadoColors: Record<string, string> = {
  "En Negociación": "bg-blue-100 text-blue-800",
  Activo: "bg-emerald-100 text-emerald-800",
  Pausado: "bg-amber-100 text-amber-800",
  Finalizado: "bg-slate-100 text-slate-600",
  Cancelado: "bg-red-100 text-red-800",
};

const kanbanColumns: KanbanColumn[] = [
  { key: "En Negociación", label: "En Negociación", colorClass: "bg-blue-100 text-blue-800" },
  { key: "Activo", label: "Activo", colorClass: "bg-emerald-100 text-emerald-800" },
  { key: "Pausado", label: "Pausado", colorClass: "bg-amber-100 text-amber-800" },
  { key: "Finalizado", label: "Finalizado", colorClass: "bg-slate-100 text-slate-700" },
  { key: "Cancelado", label: "Cancelado", colorClass: "bg-red-100 text-red-800" },
];

function calcDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return Math.max(0, months);
}

const fieldDescriptions: Record<string, string> = {
  influencer: "Nombre del influencer o creador de contenido",
  redSocial: "Redes sociales donde el influencer publica contenido",
  seguidores: "Cantidad total de seguidores del influencer",
  plataforma: "Herramienta o agencia intermediaria (ej: CreatorIQ, AspireIQ, directo)",
  tipoContenido: "Formato principal del contenido pactado",
  reelsPactados: "Cantidad de reels mensuales acordados",
  storiesPactadas: "Cantidad de stories mensuales acordadas",
  fechaInicio: "Fecha de inicio del acuerdo",
  fechaFin: "Fecha de finalización del acuerdo",
  valorMensual: "Calculado automáticamente: valor total ÷ duración en meses",
  valorTotal: "Valor total del acuerdo antes de IVA",
  moneda: "Divisa del pago",
  estado: "Estado actual del acuerdo",
  contacto: "Email o teléfono de contacto del influencer o agencia",
  notas: "Observaciones adicionales sobre el acuerdo",
};

function FieldLabel({ field, children }: { field: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{children}</Label>
      {fieldDescriptions[field] && (
        <p className="text-xs text-muted-foreground mt-0.5">{fieldDescriptions[field]}</p>
      )}
    </div>
  );
}

function NumericInput({ value, onChange, ...props }: { value: number; onChange: (v: number) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [display, setDisplay] = useState(value === 0 ? "" : String(value));
  useEffect(() => { setDisplay(value === 0 ? "" : String(value)); }, [value]);
  return (
    <Input
      {...props}
      type="number"
      value={display}
      onChange={(e) => {
        setDisplay(e.target.value);
        onChange(e.target.value === "" ? 0 : +e.target.value);
      }}
      placeholder="0"
    />
  );
}

function filterByDateRange<T>(items: T[], dateRange: DateRange, getDateFields: (item: T) => string[]): T[] {
  if (!dateRange.from && !dateRange.to) return items;
  return items.filter((item) => {
    const dates = getDateFields(item).filter(Boolean).map((d) => new Date(d));
    if (dates.length === 0) return true;
    return dates.some((d) => {
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (d > endOfDay) return false;
      }
      return true;
    });
  });
}

export default function AcuerdosPage() {
  const { acuerdos, isLoading, save, remove } = useAcuerdos();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Acuerdo | null>(null);
  const [form, setForm] = useState(emptyAcuerdo());
  const [view, setView] = useState<ViewMode>("list");
  const [filterAcuerdo, setFilterAcuerdo] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const { sortItems, toggleSort } = useSort<Acuerdo>();
  const [familias, setFamilias] = useState<string[]>([]);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("product_families")
      .select("name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setFamilias((data || []).map((f) => f.name));
      });
  }, []);

  const [tiposContenido, setTiposContenido] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("content_types")
      .select("name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setTiposContenido((data || []).map((t) => t.name));
      });
  }, []);

  const acuerdoColumns: ColumnDef<Acuerdo>[] = [
    { key: "influencer", label: "Influencer", sortKey: "influencer", render: (a) => <span className="font-medium">{a.influencer}</span> },
    { key: "redSocial", label: "Red Social", sortKey: "redSocial", render: (a) => (Array.isArray(a.redSocial) ? a.redSocial : [a.redSocial]).join(", ") },
    { key: "seguidores", label: "Seguidores", sortKey: "seguidores", render: (a) => a.seguidores.toLocaleString() },
    { key: "tipoContenido", label: "Tipo", sortKey: "tipoContenido", render: (a) => (Array.isArray(a.tipoContenido) ? a.tipoContenido : [a.tipoContenido]).filter(Boolean).join(", ") },
    { key: "reelsPactados", label: "Reels/mes", sortKey: "reelsPactados", render: (a) => a.reelsPactados },
    { key: "storiesPactadas", label: "Stories/mes", sortKey: "storiesPactadas", render: (a) => a.storiesPactadas },
    { key: "fechaInicio", label: "Inicio", sortKey: "fechaInicio", render: (a) => a.fechaInicio },
    { key: "fechaFin", label: "Fin", sortKey: "fechaFin", render: (a) => a.fechaFin },
    { key: "duracionMeses", label: "Duración", sortKey: "duracionMeses", render: (a) => `${a.duracionMeses} meses` },
    { key: "valorMensual", label: "V. Mensual", sortKey: "valorMensual", render: (a) => `$${(a.valorMensual || 0).toLocaleString()}` },
    { key: "valorTotal", label: "V. Total", sortKey: "valorTotal", render: (a) => `$${a.valorTotal.toLocaleString()}` },
    { key: "estado", label: "Estado", sortKey: "estado", render: (a) => <Badge variant="secondary" className={estadoColors[a.estado]}>{a.estado}</Badge> },
  ];

  const { orderedColumns, draggedColumn, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useColumnOrder(acuerdoColumns);
  const { columnWidths, handleResizeStart } = useResizableColumns(orderedColumns.map(c => c.key), 110);
  const { isVisible, toggleColumn, showAll } = useColumnVisibility(orderedColumns.map(c => c.key));
  const visibleColumns = orderedColumns.filter(c => isVisible(c.key));
  const byAcuerdo = filterAcuerdo === "all" ? acuerdos : acuerdos.filter((a) => a.id === filterAcuerdo);
  const byDate = filterByDateRange(byAcuerdo, dateRange, (a) => [a.fechaInicio, a.fechaFin]);
  const filtered = sortItems(byDate, sortKey, sortDirection);

  const handleSort = (key: string) => {
    const result = toggleSort(key, sortKey, sortDirection);
    setSortKey(result.sortKey);
    setSortDirection(result.sortDirection);
  };

  useEffect(() => {
    const dur = calcDuration(form.fechaInicio, form.fechaFin);

    if (form.fechaInicio && form.fechaFin && dur <= 0) {
      setDateError("La fecha de fin debe ser posterior a la fecha de inicio");
      if (form.duracionMeses !== 0 || form.valorMensual !== 0) {
        setForm((p) => ({ ...p, duracionMeses: 0, valorMensual: 0 }));
      }
      return;
    }
    setDateError(null);

    const mensual = dur > 0 ? +(form.valorTotal / dur).toFixed(2) : 0;
    if (dur !== form.duracionMeses || mensual !== form.valorMensual) {
      setForm((p) => ({
        ...p,
        duracionMeses: dur,
        valorMensual: dur > 0 ? +(p.valorTotal / dur).toFixed(2) : 0,
      }));
    }
  }, [form.fechaInicio, form.fechaFin, form.valorTotal]);

  const handleOpen = (a?: Acuerdo) => {
    if (a) {
      setEditing(a);
      const { id, createdAt, ...rest } = a;
      setForm({
        ...rest,
        redSocial: Array.isArray(rest.redSocial) ? rest.redSocial : rest.redSocial ? [rest.redSocial] : [],
        tipoContenido: Array.isArray(rest.tipoContenido) ? rest.tipoContenido : rest.tipoContenido ? [rest.tipoContenido] : [],
      });
    } else { setEditing(null); setForm(emptyAcuerdo()); }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.fechaInicio || !form.fechaFin) {
      toast.error("Debes especificar fecha de inicio y fecha de fin");
      return;
    }
    if (new Date(form.fechaFin) < new Date(form.fechaInicio)) {
      toast.error("La fecha de fin no puede ser anterior a la fecha de inicio");
      return;
    }
    if (form.duracionMeses <= 0) {
      toast.error("La duración del acuerdo debe ser mayor a 0 meses");
      return;
    }
    if (form.valorTotal <= 0) {
      toast.error("El valor total debe ser mayor a 0");
      return;
    }
    await save({ data: form, id: editing?.id });
    setOpen(false);
  };

  // Open edit dialog when ?edit={id} is present in the URL
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && acuerdos.length > 0 && !open) {
      const a = acuerdos.find((x) => x.id === editId);
      if (a) {
        handleOpen(a);
        searchParams.delete("edit");
        setSearchParams(searchParams, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, acuerdos]);

  const handleDelete = async (id: string) => { await remove(id); };
  const update = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const toggleRedSocial = (red: string) => {
    setForm((p) => ({
      ...p,
      redSocial: p.redSocial.includes(red) ? p.redSocial.filter((r) => r !== red) : [...p.redSocial, red],
    }));
  };

  const toggleTipoContenido = (tipo: string) => {
    setForm((p) => ({
      ...p,
      tipoContenido: p.tipoContenido.includes(tipo) ? p.tipoContenido.filter((t) => t !== tipo) : [...p.tipoContenido, tipo],
    }));
  };

  const toggleFamiliaProducto = (familia: string) => {
    setForm((p) => ({
      ...p,
      familiaProducto: (p.familiaProducto || []).includes(familia) ? p.familiaProducto.filter((f) => f !== familia) : [...(p.familiaProducto || []), familia],
    }));
  };

  const handleStatusChange = async (item: Acuerdo, newStatus: string) => {
    const { id, createdAt, ...data } = item;
    await save({ data: { ...data, estado: newStatus as Acuerdo["estado"] }, id });
  };

  const renderCard = (a: Acuerdo) => (
    <div>
      <div className="font-semibold">{a.influencer}</div>
      <div className="text-muted-foreground text-xs">{(Array.isArray(a.redSocial) ? a.redSocial : [a.redSocial]).filter(Boolean).join(", ")} · {a.seguidores.toLocaleString()} seg.</div>
      <div className="font-bold mt-1">${a.valorTotal.toLocaleString()} {a.moneda}</div>
      <div className="text-xs text-muted-foreground">{a.fechaInicio} → {a.fechaFin}</div>
    </div>
  );

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Cargando acuerdos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Acuerdos</h1>
          <p className="text-white/80 text-sm">Gestión de acuerdos con influencers</p>
        </div>
        <Button variant="gradient" onClick={() => handleOpen()}><Plus className="h-4 w-4 mr-2" /> Nuevo Acuerdo</Button>
      </div>

      <ViewToolbar view={view} onViewChange={setView} acuerdos={acuerdos} selectedAcuerdo={filterAcuerdo} onAcuerdoChange={setFilterAcuerdo} dateRange={dateRange} onDateRangeChange={setDateRange} onExport={(fmt) => exportToFile(filtered, visibleColumns.map(c => ({ key: c.key, label: c.label })), fmt, "acuerdos")} columns={orderedColumns.map(c => ({ key: c.key, label: c.label }))} isColumnVisible={isVisible} onToggleColumn={toggleColumn} onShowAllColumns={showAll} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Acuerdos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{filtered.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">{filtered.filter((a) => a.estado === "Activo").length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">${filtered.reduce((s, a) => s + a.valorTotal, 0).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Influencers</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2"><Users className="h-5 w-5 text-muted-foreground" /><span className="text-2xl font-bold">{new Set(filtered.map((a) => a.influencer)).size}</span></div></CardContent></Card>
      </div>

      {view === "kanban" && (
        <KanbanBoard items={filtered} columns={kanbanColumns} getId={(a) => a.id} getStatus={(a) => a.estado} getValue={(a) => a.valorTotal} renderCard={renderCard} onStatusChange={handleStatusChange} onCardClick={(a) => handleOpen(a)} />
      )}

      {view === "forecast" && (
        <ForecastBoard items={filtered} getDate={(a) => a.fechaFin} getValue={(a) => a.valorTotal} renderCard={renderCard} getId={(a) => a.id} />
      )}

      {view === "list" && (
        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  {visibleColumns.map((col) => (
                    <SortableTableHead
                      key={col.key}
                      label={col.label}
                      sortKey={col.sortKey || col.key}
                      currentSortKey={sortKey}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                      draggable
                      onDragStart={(e) => handleDragStart(e as any, col.key)}
                      onDragOver={(e) => handleDragOver(e as any, col.key)}
                      onDrop={(e) => handleDrop(e as any, col.key)}
                      onDragEnd={handleDragEnd}
                      className={draggedColumn === col.key ? "opacity-50" : ""}
                      width={columnWidths[col.key]}
                      onResizeStart={(e) => handleResizeStart(e, col.key)}
                    />
                  ))}
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">No hay acuerdos registrados.</TableCell></TableRow>
                ) : filtered.map((a) => (
                  <TableRow key={a.id}>
                    {visibleColumns.map((col) => (
                      <TableCell key={col.key} className="truncate overflow-hidden whitespace-nowrap" style={{ minWidth: `${columnWidths[col.key]}px` }}>{col.render(a)}</TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(a)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Acuerdo" : "Nuevo Acuerdo"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><FieldLabel field="influencer">Influencer</FieldLabel><Input value={form.influencer} onChange={(e) => update("influencer", e.target.value)} /></div>
            <div className="space-y-2">
              <FieldLabel field="redSocial">Redes Sociales</FieldLabel>
              <div className="flex flex-wrap gap-3 pt-1">
                {REDES_SOCIALES.map((red) => (
                  <label key={red} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={form.redSocial.includes(red)} onCheckedChange={() => toggleRedSocial(red)} />
                    {red}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2"><FieldLabel field="seguidores">Seguidores</FieldLabel><NumericInput value={form.seguidores} onChange={(v) => update("seguidores", v)} /></div>
            <div className="space-y-2"><FieldLabel field="plataforma">Plataforma</FieldLabel><Input value={form.plataforma} onChange={(e) => update("plataforma", e.target.value)} placeholder="Ej: CreatorIQ, directo" /></div>
            <div className="space-y-2">
              <FieldLabel field="tipoContenido">Tipo de Contenido</FieldLabel>
              <div className="flex flex-wrap gap-3 pt-1">
                {tiposContenido.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sin tipos de contenido configurados. Configúralos en Administración.
                  </p>
                ) : (
                  tiposContenido.map((tipo) => (
                    <label key={tipo} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox checked={(form.tipoContenido || []).includes(tipo)} onCheckedChange={() => toggleTipoContenido(tipo)} />
                      {tipo}
                    </label>
                  ))
                )}
              </div>
            </div>
            {(form.tipoContenido || []).includes("Reel") && (
              <div className="space-y-2"><FieldLabel field="reelsPactados">Reels Mensuales</FieldLabel><NumericInput value={form.reelsPactados} onChange={(v) => update("reelsPactados", v)} /></div>
            )}
            {(form.tipoContenido || []).includes("Story") && (
              <div className="space-y-2"><FieldLabel field="storiesPactadas">Stories Mensuales</FieldLabel><NumericInput value={form.storiesPactadas} onChange={(v) => update("storiesPactadas", v)} /></div>
            )}
            <div className="space-y-2"><FieldLabel field="fechaInicio">Fecha Inicio</FieldLabel><Input type="date" value={form.fechaInicio} onChange={(e) => update("fechaInicio", e.target.value)} /></div>
            <div className="space-y-2"><FieldLabel field="fechaFin">Fecha Fin</FieldLabel><Input type="date" value={form.fechaFin} onChange={(e) => update("fechaFin", e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Duración (meses)</Label>
              <p className="text-xs text-muted-foreground">Calculado automáticamente desde las fechas</p>
              <Input type="number" value={form.duracionMeses} disabled className="bg-muted" />
              {dateError && <p className="text-xs text-destructive">{dateError}</p>}
            </div>
            <div className="space-y-2">
              <FieldLabel field="valorTotal">Valor Total del Acuerdo (antes de IVA)</FieldLabel>
              <NumericInput value={form.valorTotal} onChange={(v) => update("valorTotal", v)} />
            </div>
            <div className="space-y-2">
              <Label>Valor Mensual</Label>
              <p className="text-xs text-muted-foreground">Calculado automáticamente: valor total ÷ duración</p>
              <Input type="number" value={form.valorMensual} disabled className="bg-muted" />
            </div>
            <div className="space-y-2"><FieldLabel field="moneda">Moneda</FieldLabel><Select value={form.moneda} onValueChange={(v) => update("moneda", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><FieldLabel field="estado">Estado</FieldLabel><Select value={form.estado} onValueChange={(v) => update("estado", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="En Negociación">En Negociación</SelectItem><SelectItem value="Activo">Activo</SelectItem><SelectItem value="Pausado">Pausado</SelectItem><SelectItem value="Finalizado">Finalizado</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><FieldLabel field="contacto">Contacto</FieldLabel><Input value={form.contacto} onChange={(e) => update("contacto", e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Familias de productos</Label>
              <div className="flex flex-wrap gap-3 pt-1">
                {familias.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sin familias de producto configuradas. Configúralas en Administración.
                  </p>
                ) : (
                  familias.map((f) => (
                    <label key={f} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox checked={(form.familiaProducto || []).includes(f)} onCheckedChange={() => toggleFamiliaProducto(f)} />
                      {f}
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="col-span-2 space-y-2"><FieldLabel field="notas">Notas</FieldLabel><Textarea value={form.notas} onChange={(e) => update("notas", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="gradient"
              onClick={handleSave}
              disabled={!!dateError || form.valorTotal <= 0 || form.duracionMeses <= 0}
            >
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
