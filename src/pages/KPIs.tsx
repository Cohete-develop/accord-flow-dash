import { useState } from "react";
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
import { Plus, Pencil, Trash2, TrendingUp, Eye, MousePointerClick } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import ViewToolbar, { ViewMode, DateRange } from "@/components/ViewToolbar";
import KanbanBoard, { KanbanColumn } from "@/components/KanbanBoard";
import ForecastBoard from "@/components/ForecastBoard";
import SortableTableHead, { SortDirection, useSort } from "@/components/SortableTableHead";
import { useColumnOrder, ColumnDef } from "@/hooks/useColumnOrder";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { exportToFile, ExportFormat } from "@/lib/export-utils";

const kanbanColumns: KanbanColumn[] = [
  { key: "Pendiente", label: "Pendiente", colorClass: "bg-amber-100 text-amber-800" },
  { key: "Medido", label: "Medido", colorClass: "bg-blue-100 text-blue-800" },
  { key: "Revisado", label: "Revisado", colorClass: "bg-purple-100 text-purple-800" },
  { key: "Aprobado", label: "Aprobado", colorClass: "bg-emerald-100 text-emerald-800" },
];

const emptyKPI = (): Omit<KPI, "id" | "createdAt"> => ({
  entregableId: "", acuerdoId: "", influencer: "", alcance: 0, impresiones: 0,
  interacciones: 0, clicks: 0, engagement: 0, cpr: 0, cpc: 0, periodo: "", estado: "Pendiente", notas: "",
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

// Convert periodo "Enero 2026" to a date string for filtering
function periodoToDate(periodo: string): string {
  const meses: Record<string, string> = { Enero: "01", Febrero: "02", Marzo: "03", Abril: "04", Mayo: "05", Junio: "06", Julio: "07", Agosto: "08", Septiembre: "09", Octubre: "10", Noviembre: "11", Diciembre: "12" };
  const parts = periodo.split(" ");
  if (parts.length === 2 && meses[parts[0]]) return `${parts[1]}-${meses[parts[0]]}-01`;
  return "";
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

  const kpiColumns: ColumnDef<KPI>[] = [
    { key: "influencer", label: "Influencer", sortKey: "influencer", render: (k) => <span className="font-medium">{k.influencer}{k.id.startsWith("placeholder-") && <span className="ml-2 text-xs text-amber-600 font-normal">Sin KPI</span>}</span> },
    { key: "alcance", label: "Alcance", sortKey: "alcance", render: (k) => k.id.startsWith("placeholder-") ? "—" : k.alcance.toLocaleString() },
    { key: "impresiones", label: "Impresiones", sortKey: "impresiones", render: (k) => k.id.startsWith("placeholder-") ? "—" : k.impresiones.toLocaleString() },
    { key: "interacciones", label: "Interacciones", sortKey: "interacciones", render: (k) => k.id.startsWith("placeholder-") ? "—" : k.interacciones.toLocaleString() },
    { key: "clicks", label: "Clicks", sortKey: "clicks", render: (k) => k.id.startsWith("placeholder-") ? "—" : k.clicks.toLocaleString() },
    { key: "engagement", label: "Engagement", sortKey: "engagement", render: (k) => k.id.startsWith("placeholder-") ? "—" : `${k.engagement}%` },
    { key: "cpr", label: "CPR", sortKey: "cpr", render: (k) => k.id.startsWith("placeholder-") ? "—" : `$${k.cpr}` },
    { key: "cpc", label: "CPC", sortKey: "cpc", render: (k) => k.id.startsWith("placeholder-") ? "—" : `$${k.cpc}` },
    { key: "periodo", label: "Periodo", sortKey: "periodo", render: (k) => k.id.startsWith("placeholder-") ? "—" : k.periodo },
  ];

  const { orderedColumns, draggedColumn, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useColumnOrder(kpiColumns);
  const { columnWidths, handleResizeStart } = useResizableColumns(orderedColumns.map(c => c.key), 110);

  const influencersWithKpis = new Set(kpis.map(k => k.acuerdoId));
  const placeholderKpis: KPI[] = acuerdos
    .filter(a => !influencersWithKpis.has(a.id) && a.estado !== 'Cancelado')
    .map(a => ({
      id: `placeholder-${a.id}`,
      entregableId: "",
      acuerdoId: a.id,
      influencer: a.influencer,
      alcance: 0, impresiones: 0, interacciones: 0, clicks: 0, engagement: 0, cpr: 0, cpc: 0,
      periodo: "", estado: "Pendiente" as const, notas: "", createdAt: "",
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
    if (k) { setEditing(k); const { id, createdAt, ...rest } = k; setForm(rest); }
    else { setEditing(null); setForm(emptyKPI()); }
    setOpen(true);
  };

  const handleSave = async () => {
    const selected = acuerdos.find((a) => a.id === form.acuerdoId);
    await save({ data: { ...form, influencer: selected?.influencer || form.influencer }, id: editing?.id });
    setOpen(false);
  };

  const handleDelete = async (id: string) => { await remove(id); };
  const update = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleStatusChange = async (item: KPI, newStatus: string) => {
    const { id, createdAt, ...data } = item;
    await save({ data: { ...data, estado: newStatus as KPI["estado"] }, id });
  };

  const avgEngagement = filtered.length > 0 ? (filtered.reduce((s, k) => s + k.engagement, 0) / filtered.length).toFixed(2) : "0";
  const totalAlcance = filtered.reduce((s, k) => s + k.alcance, 0);
  const totalClicks = filtered.reduce((s, k) => s + k.clicks, 0);

  const byInfluencer = filtered.reduce<Record<string, { alcance: number; interacciones: number }>>((acc, k) => {
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
        <span>Eng: {k.engagement}%</span>
        <span>Clicks: {k.clicks}</span>
        <span>CPR: ${k.cpr}</span>
      </div>
    </div>
  );

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

      <ViewToolbar view={view} onViewChange={setView} acuerdos={acuerdos} selectedAcuerdo={filterAcuerdo} onAcuerdoChange={setFilterAcuerdo} dateRange={dateRange} onDateRangeChange={setDateRange} onExport={(fmt) => exportToFile(filtered, orderedColumns.map(c => ({ key: c.key, label: c.label })), fmt, "kpis")} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Registros</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{filtered.length}</div></CardContent></Card>
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

      {view === "forecast" && (
        <ForecastBoard items={filtered} getDate={(k) => periodoToDate(k.periodo)} getValue={(k) => k.alcance} renderCard={renderCard} getId={(k) => k.id} valuePrefix="" emptyLabel="No hay KPIs con periodo asignado." />
      )}

      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  {orderedColumns.map((col) => (
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
                  <TableRow><TableCell colSpan={orderedColumns.length + 1} className="text-center py-8 text-muted-foreground">No hay KPIs registrados.</TableCell></TableRow>
                ) : filtered.map((k) => {
                  const isPlaceholder = k.id.startsWith("placeholder-");
                  return (
                    <TableRow key={k.id} className={isPlaceholder ? "opacity-60 bg-muted/30" : ""}>
                      {orderedColumns.map((col) => (
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
              <Select value={form.acuerdoId} onValueChange={(v) => update("acuerdoId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar acuerdo" /></SelectTrigger>
                <SelectContent>{acuerdos.map((a) => <SelectItem key={a.id} value={a.id}>{a.influencer} — {(Array.isArray(a.redSocial) ? a.redSocial : [a.redSocial]).join(", ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Estado</Label><Select value={form.estado} onValueChange={(v) => update("estado", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="Medido">Medido</SelectItem><SelectItem value="Revisado">Revisado</SelectItem><SelectItem value="Aprobado">Aprobado</SelectItem></SelectContent></Select></div>
            <div className="space-y-2">
              <Label>Periodo</Label>
              <div className="flex gap-2">
                <Select value={form.periodo.split(" ")[0] || ""} onValueChange={(m) => update("periodo", `${m} ${form.periodo.split(" ")[1] || new Date().getFullYear()}`)}>
                  <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
                  <SelectContent>
                    {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={form.periodo.split(" ")[1] || ""} onValueChange={(y) => update("periodo", `${form.periodo.split(" ")[0] || "Enero"} ${y}`)}>
                  <SelectTrigger className="w-[100px]"><SelectValue placeholder="Año" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 7 }, (_, i) => String(new Date().getFullYear() - 1 + i)).map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Alcance</Label><Input type="number" value={form.alcance} onChange={(e) => update("alcance", +e.target.value)} /></div>
            <div className="space-y-2"><Label>Impresiones</Label><Input type="number" value={form.impresiones} onChange={(e) => update("impresiones", +e.target.value)} /></div>
            <div className="space-y-2"><Label>Interacciones</Label><Input type="number" value={form.interacciones} onChange={(e) => update("interacciones", +e.target.value)} /></div>
            <div className="space-y-2"><Label>Clicks</Label><Input type="number" value={form.clicks} onChange={(e) => update("clicks", +e.target.value)} /></div>
            <div className="space-y-2"><Label>Engagement (%)</Label><Input type="number" step="0.01" value={form.engagement} onChange={(e) => update("engagement", +e.target.value)} /></div>
            <div className="space-y-2"><Label>CPR</Label><Input type="number" step="0.01" value={form.cpr} onChange={(e) => update("cpr", +e.target.value)} /></div>
            <div className="space-y-2"><Label>CPC</Label><Input type="number" step="0.01" value={form.cpc} onChange={(e) => update("cpc", +e.target.value)} /></div>
            <div className="col-span-2 space-y-2"><Label>Notas</Label><Textarea value={form.notas} onChange={(e) => update("notas", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="gradient" onClick={handleSave}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
