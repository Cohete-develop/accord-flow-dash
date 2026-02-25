import { useState, useMemo, useEffect } from "react";
import { KPI } from "@/types/crm";
import { useAcuerdos, useEntregables, useKPIs } from "@/hooks/useCrmData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Eye, MousePointerClick, ArrowUp, ArrowDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import ViewToolbar, { ViewMode, DateRange } from "@/components/ViewToolbar";
import KanbanBoard, { KanbanColumn } from "@/components/KanbanBoard";
import ForecastBoard from "@/components/ForecastBoard";
import SortableTableHead, { SortDirection, useSort } from "@/components/SortableTableHead";
import { useColumnOrder, ColumnDef } from "@/hooks/useColumnOrder";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { exportToFile, ExportFormat } from "@/lib/export-utils";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { toast } from "sonner";

const kanbanColumns: KanbanColumn[] = [
  { key: "Pendiente", label: "Pendiente", colorClass: "bg-amber-100 text-amber-800" },
  { key: "Medido", label: "Medido", colorClass: "bg-blue-100 text-blue-800" },
  { key: "Revisado", label: "Revisado", colorClass: "bg-purple-100 text-purple-800" },
  { key: "Aprobado", label: "Aprobado", colorClass: "bg-emerald-100 text-emerald-800" },
];

const emptyKPI = (): Omit<KPI, "id" | "createdAt"> => ({
  entregableId: "", acuerdoId: "", influencer: "", alcance: 0, impresiones: 0,
  interacciones: 0, clicks: 0, engagement: 0, cpr: 0, cpc: 0, periodo: "",
  estado: "Pendiente", notas: "", valorMensualSnapshot: 0,
});

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

function periodoToDate(periodo: string): string {
  const meses: Record<string, string> = { Enero: "01", Febrero: "02", Marzo: "03", Abril: "04", Mayo: "05", Junio: "06", Julio: "07", Agosto: "08", Septiembre: "09", Octubre: "10", Noviembre: "11", Diciembre: "12" };
  const parts = periodo.split(" ");
  if (parts.length === 2 && meses[parts[0]]) return `${parts[1]}-${meses[parts[0]]}-01`;
  return "";
}

function periodoSortKey(periodo: string): string {
  return periodoToDate(periodo) || "9999-99-99";
}

function fmtCurrency(value: number, moneda: string): string {
  if (!value || !isFinite(value)) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: moneda || "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function KPIsPage() {
  const { acuerdos } = useAcuerdos();
  const { entregables } = useEntregables();
  const { kpis, isLoading, save, remove } = useKPIs();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KPI | null>(null);
  const [form, setForm] = useState(emptyKPI());
  const [view, setView] = useState<ViewMode>("list");
  const [filterAcuerdo, setFilterAcuerdo] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const { sortItems, toggleSort } = useSort<KPI>();
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Get the selected acuerdo for form context
  const selectedAcuerdo = useMemo(() => acuerdos.find(a => a.id === form.acuerdoId), [acuerdos, form.acuerdoId]);

  // Build trend map: for each acuerdo, sort KPIs by periodo and compare consecutive months
  const trendMap = useMemo(() => {
    const map: Record<string, { cprTrend: "up" | "down" | null; cpcTrend: "up" | "down" | null }> = {};
    const byAcuerdo: Record<string, KPI[]> = {};
    kpis.forEach(k => {
      if (!k.acuerdoId) return;
      if (!byAcuerdo[k.acuerdoId]) byAcuerdo[k.acuerdoId] = [];
      byAcuerdo[k.acuerdoId].push(k);
    });
    Object.values(byAcuerdo).forEach(group => {
      const sorted = [...group].sort((a, b) => periodoSortKey(a.periodo).localeCompare(periodoSortKey(b.periodo)));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        map[curr.id] = {
          cprTrend: curr.cpr > 0 && prev.cpr > 0 ? (curr.cpr < prev.cpr ? "down" : curr.cpr > prev.cpr ? "up" : null) : null,
          cpcTrend: curr.cpc > 0 && prev.cpc > 0 ? (curr.cpc < prev.cpc ? "down" : curr.cpc > prev.cpc ? "up" : null) : null,
        };
      }
    });
    return map;
  }, [kpis]);

  // Auto-calculate CPR, CPC, Engagement when inputs change
  useEffect(() => {
    const valorMensual = selectedAcuerdo?.valorMensual || form.valorMensualSnapshot;
    if (!valorMensual) return;

    const engagement = form.alcance > 0 ? parseFloat(((form.interacciones / form.alcance) * 100).toFixed(2)) : 0;
    const cpr = form.interacciones > 0 ? parseFloat((valorMensual / form.interacciones).toFixed(2)) : 0;
    const cpc = form.clicks > 0 ? parseFloat((valorMensual / form.clicks).toFixed(2)) : 0;

    setForm(prev => {
      if (prev.engagement === engagement && prev.cpr === cpr && prev.cpc === cpc) return prev;
      return { ...prev, engagement, cpr, cpc };
    });
  }, [form.alcance, form.impresiones, form.interacciones, form.clicks, selectedAcuerdo?.valorMensual, form.valorMensualSnapshot]);

  // When acuerdo changes, set valorMensualSnapshot
  useEffect(() => {
    if (selectedAcuerdo) {
      setForm(prev => ({
        ...prev,
        valorMensualSnapshot: selectedAcuerdo.valorMensual,
        influencer: selectedAcuerdo.influencer,
      }));
    }
  }, [selectedAcuerdo]);

  const getMoneda = (k: KPI) => {
    const a = acuerdos.find(ac => ac.id === k.acuerdoId);
    return a?.moneda || "USD";
  };

  const TrendIndicator = ({ value, type }: { value: "up" | "down" | null; type: "cost" }) => {
    if (!value) return null;
    // For costs: down is good (green), up is bad (red)
    if (value === "down") return <ArrowDown className="h-3 w-3 text-emerald-600 inline ml-1" />;
    return <ArrowUp className="h-3 w-3 text-red-600 inline ml-1" />;
  };

  const kpiColumns: ColumnDef<KPI>[] = [
    { key: "influencer", label: "Influencer", sortKey: "influencer", render: (k) => <span className="font-medium">{k.influencer}{k.id.startsWith("placeholder-") && <span className="ml-2 text-xs text-amber-600 font-normal">Sin KPI</span>}</span> },
    { key: "periodo", label: "Periodo", sortKey: "periodo", render: (k) => k.id.startsWith("placeholder-") ? "—" : k.periodo },
    { key: "alcance", label: "Alcance", sortKey: "alcance", render: (k) => k.id.startsWith("placeholder-") ? "—" : k.alcance.toLocaleString() },
    { key: "impresiones", label: "Impresiones", sortKey: "impresiones", render: (k) => k.id.startsWith("placeholder-") ? "—" : k.impresiones.toLocaleString() },
    { key: "interacciones", label: "Interacciones", sortKey: "interacciones", render: (k) => k.id.startsWith("placeholder-") ? "—" : k.interacciones.toLocaleString() },
    { key: "clicks", label: "Clicks", sortKey: "clicks", render: (k) => k.id.startsWith("placeholder-") ? "—" : k.clicks.toLocaleString() },
    { key: "engagement", label: "Engagement%", sortKey: "engagement", render: (k) => k.id.startsWith("placeholder-") ? "—" : `${k.engagement.toFixed(2)}%` },
    { key: "cpr", label: "CPR", sortKey: "cpr", render: (k) => {
      if (k.id.startsWith("placeholder-")) return "—";
      const moneda = getMoneda(k);
      const trend = trendMap[k.id];
      return <span>{k.cpr > 0 ? fmtCurrency(k.cpr, moneda) : "—"}<TrendIndicator value={trend?.cprTrend || null} type="cost" /></span>;
    }},
    { key: "cpc", label: "CPC", sortKey: "cpc", render: (k) => {
      if (k.id.startsWith("placeholder-")) return "—";
      const moneda = getMoneda(k);
      const trend = trendMap[k.id];
      return <span>{k.cpc > 0 ? fmtCurrency(k.cpc, moneda) : "—"}<TrendIndicator value={trend?.cpcTrend || null} type="cost" /></span>;
    }},
    { key: "estado", label: "Estado", sortKey: "estado", render: (k) => k.id.startsWith("placeholder-") ? "—" : k.estado },
  ];

  const { orderedColumns, draggedColumn, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useColumnOrder(kpiColumns);
  const { columnWidths, handleResizeStart } = useResizableColumns(orderedColumns.map(c => c.key), 110);
  const { isVisible, toggleColumn, showAll } = useColumnVisibility(orderedColumns.map(c => c.key));
  const visibleColumns = orderedColumns.filter(c => isVisible(c.key));
  const influencersWithKpis = new Set(kpis.map(k => k.acuerdoId));
  const placeholderKpis: KPI[] = acuerdos
    .filter(a => !influencersWithKpis.has(a.id) && a.estado !== 'Cancelado')
    .map(a => ({
      id: `placeholder-${a.id}`,
      entregableId: "",
      acuerdoId: a.id,
      influencer: a.influencer,
      alcance: 0, impresiones: 0, interacciones: 0, clicks: 0, engagement: 0, cpr: 0, cpc: 0,
      periodo: "", estado: "Pendiente" as const, notas: "", valorMensualSnapshot: 0, createdAt: "",
    }));

  const allKpis = [...kpis, ...placeholderKpis];
  const byAcuerdo = filterAcuerdo === "all" ? allKpis : allKpis.filter((k) => k.acuerdoId === filterAcuerdo);
  const byDate = filterByDateRange(byAcuerdo, dateRange, (k) => [periodoToDate(k.periodo)]);
  const filtered = sortItems(byDate, sortKey, sortDirection);

  const handleSort = (key: string) => {
    const result = toggleSort(key, sortKey, sortDirection);
    setSortKey(result.sortKey);
    setSortDirection(result.sortDirection);
  };

  const handleOpen = (k?: KPI) => {
    setFormErrors([]);
    if (k) { setEditing(k); const { id, createdAt, ...rest } = k; setForm(rest); }
    else { setEditing(null); setForm(emptyKPI()); }
    setOpen(true);
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    if (form.interacciones > form.alcance && form.alcance > 0) {
      errors.push("Las interacciones no pueden superar el alcance");
    }
    if (form.clicks > form.impresiones && form.impresiones > 0) {
      errors.push("Los clicks no pueden superar las impresiones");
    }
    return errors;
  };

  const handleSave = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      setFormErrors(errors);
      errors.forEach(e => toast.error(e));
      return;
    }
    const selected = acuerdos.find((a) => a.id === form.acuerdoId);
    const valorSnapshot = selected?.valorMensual || form.valorMensualSnapshot;
    await save({
      data: {
        ...form,
        influencer: selected?.influencer || form.influencer,
        valorMensualSnapshot: valorSnapshot,
      },
      id: editing?.id,
    });
    setOpen(false);
  };

  const handleDelete = async (id: string) => { await remove(id); };
  const updateField = (field: string, value: any) => {
    setFormErrors([]);
    setForm((p) => ({ ...p, [field]: value }));
  };

  const handleStatusChange = async (item: KPI, newStatus: string) => {
    const { id, createdAt, ...data } = item;
    await save({ data: { ...data, estado: newStatus as KPI["estado"] }, id });
  };

  const realKpis = filtered.filter(k => !k.id.startsWith("placeholder-"));
  const avgEngagement = realKpis.length > 0 ? (realKpis.reduce((s, k) => s + k.engagement, 0) / realKpis.length).toFixed(2) : "0";
  const totalAlcance = realKpis.reduce((s, k) => s + k.alcance, 0);
  const totalClicks = realKpis.reduce((s, k) => s + k.clicks, 0);

  const byInfluencer = realKpis.reduce<Record<string, { alcance: number; interacciones: number }>>((acc, k) => {
    if (!acc[k.influencer]) acc[k.influencer] = { alcance: 0, interacciones: 0 };
    acc[k.influencer].alcance += k.alcance;
    acc[k.influencer].interacciones += k.interacciones;
    return acc;
  }, {});
  const chartData = Object.entries(byInfluencer).map(([name, data]) => ({ name, ...data }));

  const renderCard = (k: KPI) => (
    <div>
      <div className="font-semibold">{k.influencer}</div>
      <div className="text-muted-foreground text-xs">{k.periodo}</div>
      <div className="grid grid-cols-2 gap-1 mt-1 text-xs">
        <span>Alcance: {k.alcance.toLocaleString()}</span>
        <span>Eng: {k.engagement.toFixed(2)}%</span>
        <span>Clicks: {k.clicks}</span>
        <span>CPR: {k.cpr > 0 ? fmtCurrency(k.cpr, getMoneda(k)) : "—"}</span>
      </div>
    </div>
  );

  // Display values for calculated fields in form
  const displayEngagement = form.alcance > 0 && form.interacciones > 0 ? `${form.engagement.toFixed(2)}%` : "—";
  const formMoneda = selectedAcuerdo?.moneda || "USD";
  const displayCPR = form.cpr > 0 ? fmtCurrency(form.cpr, formMoneda) : "—";
  const displayCPC = form.cpc > 0 ? fmtCurrency(form.cpc, formMoneda) : "—";

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Cargando KPIs...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">KPIs</h1>
          <p className="text-muted-foreground text-sm">Métricas de rendimiento por influencer</p>
        </div>
        <Button variant="gradient" onClick={() => handleOpen()} disabled={acuerdos.length === 0}><Plus className="h-4 w-4 mr-2" /> Nuevo KPI</Button>
      </div>

      <ViewToolbar view={view} onViewChange={setView} acuerdos={acuerdos} selectedAcuerdo={filterAcuerdo} onAcuerdoChange={setFilterAcuerdo} dateRange={dateRange} onDateRangeChange={setDateRange} onExport={(fmt) => exportToFile(filtered, visibleColumns.map(c => ({ key: c.key, label: c.label })), fmt, "kpis")} columns={orderedColumns.map(c => ({ key: c.key, label: c.label }))} isColumnVisible={isVisible} onToggleColumn={toggleColumn} onShowAllColumns={showAll} showForecast={false} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Registros</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{realKpis.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Alcance Total</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2"><Eye className="h-5 w-5 text-muted-foreground" /><span className="text-2xl font-bold">{totalAlcance.toLocaleString()}</span></div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Clicks Totales</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2"><MousePointerClick className="h-5 w-5 text-muted-foreground" /><span className="text-2xl font-bold">{totalClicks.toLocaleString()}</span></div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Engagement Promedio</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-muted-foreground" /><span className="text-2xl font-bold">{avgEngagement}%</span></div></CardContent></Card>
      </div>

      {view === "list" && chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Alcance e Interacciones por Influencer</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="alcance" fill="hsl(250, 60%, 52%)" name="Alcance" radius={[4, 4, 0, 0]} />
                <Bar dataKey="interacciones" fill="hsl(152, 60%, 42%)" name="Interacciones" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {view === "kanban" && (
        <KanbanBoard items={filtered} columns={kanbanColumns} getId={(k) => k.id} getStatus={(k) => k.estado} getValue={(k) => k.alcance} renderCard={renderCard} onStatusChange={handleStatusChange} valuePrefix="" />
      )}


      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <Table className="table-fixed">
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
                  <TableRow><TableCell colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">No hay KPIs registrados.</TableCell></TableRow>
                ) : filtered.map((k) => {
                  const isPlaceholder = k.id.startsWith("placeholder-");
                  return (
                    <TableRow key={k.id} className={isPlaceholder ? "opacity-60 bg-muted/30" : ""}>
                      {visibleColumns.map((col) => (
                        <TableCell key={col.key} className="truncate overflow-hidden" style={{ width: `${columnWidths[col.key]}px`, minWidth: `${columnWidths[col.key]}px`, maxWidth: `${columnWidths[col.key]}px` }}>{col.render(k)}</TableCell>
                      ))}
                      <TableCell className="text-right">
                        {isPlaceholder ? (
                          <Button variant="outline" size="sm" onClick={() => { setEditing(null); setForm({ ...emptyKPI(), acuerdoId: k.acuerdoId, influencer: k.influencer }); setOpen(true); }}>
                            <Plus className="h-3 w-3 mr-1" /> Crear KPI
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleOpen(k)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(k.id)}><Trash2 className="h-4 w-4" /></Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar KPI" : "Nuevo KPI"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Acuerdo (Influencer)</Label>
              <Select value={form.acuerdoId} onValueChange={(v) => updateField("acuerdoId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar acuerdo" /></SelectTrigger>
                <SelectContent>{acuerdos.map((a) => <SelectItem key={a.id} value={a.id}>{a.influencer} — {(Array.isArray(a.redSocial) ? a.redSocial : [a.redSocial]).join(", ")} ({a.moneda} ${a.valorMensual.toLocaleString()}/mes)</SelectItem>)}</SelectContent>
              </Select>
              {selectedAcuerdo && (
                <p className="text-xs text-muted-foreground">Valor mensual: {fmtCurrency(selectedAcuerdo.valorMensual, selectedAcuerdo.moneda)}</p>
              )}
            </div>
            <div className="space-y-2"><Label>Estado</Label><Select value={form.estado} onValueChange={(v) => updateField("estado", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="Medido">Medido</SelectItem><SelectItem value="Revisado">Revisado</SelectItem><SelectItem value="Aprobado">Aprobado</SelectItem></SelectContent></Select></div>
            <div className="space-y-2">
              <Label>Periodo</Label>
              <div className="flex gap-2">
                <Select value={form.periodo.split(" ")[0] || ""} onValueChange={(m) => updateField("periodo", `${m} ${form.periodo.split(" ")[1] || new Date().getFullYear()}`)}>
                  <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
                  <SelectContent>
                    {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={form.periodo.split(" ")[1] || ""} onValueChange={(y) => updateField("periodo", `${form.periodo.split(" ")[0] || "Enero"} ${y}`)}>
                  <SelectTrigger className="w-[100px]"><SelectValue placeholder="Año" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 7 }, (_, i) => String(new Date().getFullYear() - 1 + i)).map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Alcance</Label>
              <Input type="number" value={form.alcance || ""} onChange={(e) => updateField("alcance", +e.target.value || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Impresiones</Label>
              <Input type="number" value={form.impresiones || ""} onChange={(e) => updateField("impresiones", +e.target.value || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Interacciones (likes + comments + shares)</Label>
              <Input
                type="number"
                value={form.interacciones || ""}
                onChange={(e) => updateField("interacciones", +e.target.value || 0)}
                className={form.interacciones > form.alcance && form.alcance > 0 ? "border-destructive" : ""}
              />
              {form.interacciones > form.alcance && form.alcance > 0 && (
                <p className="text-xs text-destructive">Las interacciones no pueden superar el alcance</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Clicks</Label>
              <Input
                type="number"
                value={form.clicks || ""}
                onChange={(e) => updateField("clicks", +e.target.value || 0)}
                className={form.clicks > form.impresiones && form.impresiones > 0 ? "border-destructive" : ""}
              />
              {form.clicks > form.impresiones && form.impresiones > 0 && (
                <p className="text-xs text-destructive">Los clicks no pueden superar las impresiones</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Engagement (%)</Label>
              <Input value={displayEngagement} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>CPR (Costo por Resultado)</Label>
              <Input value={displayCPR} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>CPC (Costo por Click)</Label>
              <Input value={displayCPC} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Valor Mensual Snapshot</Label>
              <Input value={form.valorMensualSnapshot > 0 ? fmtCurrency(form.valorMensualSnapshot, formMoneda) : "—"} disabled className="bg-muted" />
            </div>
            <div className="col-span-2 space-y-2"><Label>Notas</Label><Textarea value={form.notas} onChange={(e) => updateField("notas", e.target.value)} /></div>
          </div>
          {formErrors.length > 0 && (
            <div className="text-sm text-destructive space-y-1 mt-2">
              {formErrors.map((e, i) => <p key={i}>• {e}</p>)}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="gradient" onClick={handleSave}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
