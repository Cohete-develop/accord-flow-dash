import { useState, useEffect } from "react";
import { KPI } from "@/types/crm";
import { getKPIs, saveKPI, deleteKPI, getAcuerdos, getEntregables, generateId } from "@/data/crm-store";
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
import ViewToolbar, { ViewMode } from "@/components/ViewToolbar";
import KanbanBoard, { KanbanColumn } from "@/components/KanbanBoard";
import ForecastBoard from "@/components/ForecastBoard";

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

export default function KPIsPage() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KPI | null>(null);
  const [form, setForm] = useState(emptyKPI());
  const [view, setView] = useState<ViewMode>("list");
  const [filterAcuerdo, setFilterAcuerdo] = useState("all");
  const acuerdos = getAcuerdos();
  const entregables = getEntregables();

  useEffect(() => { setKpis(getKPIs()); }, []);
  const refresh = () => setKpis(getKPIs());

  const filtered = filterAcuerdo === "all" ? kpis : kpis.filter((k) => k.acuerdoId === filterAcuerdo);

  const handleOpen = (k?: KPI) => {
    if (k) { setEditing(k); const { id, createdAt, ...rest } = k; setForm(rest); }
    else { setEditing(null); setForm(emptyKPI()); }
    setOpen(true);
  };

  const handleSave = () => {
    const selected = acuerdos.find((a) => a.id === form.acuerdoId);
    const kpi: KPI = { ...form, influencer: selected?.influencer || form.influencer, id: editing?.id || generateId(), createdAt: editing?.createdAt || new Date().toISOString() };
    saveKPI(kpi); refresh(); setOpen(false);
  };

  const handleDelete = (id: string) => { deleteKPI(id); refresh(); };
  const update = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleStatusChange = (item: KPI, newStatus: string) => {
    const updated = { ...item, estado: newStatus as KPI["estado"] };
    saveKPI(updated); refresh();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">KPIs</h1>
          <p className="text-muted-foreground text-sm">Métricas de rendimiento por influencer</p>
        </div>
        <Button onClick={() => handleOpen()} disabled={acuerdos.length === 0}><Plus className="h-4 w-4 mr-2" /> Nuevo KPI</Button>
      </div>

      <ViewToolbar view={view} onViewChange={setView} acuerdos={acuerdos} selectedAcuerdo={filterAcuerdo} onAcuerdoChange={setFilterAcuerdo} />

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
        <ForecastBoard items={filtered} getDate={() => ""} getValue={(k) => k.alcance} renderCard={renderCard} getId={(k) => k.id} valuePrefix="" emptyLabel="Los KPIs se agrupan por periodo. Usa la vista Kanban o Lista." />
      )}

      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Influencer</TableHead><TableHead>Alcance</TableHead><TableHead>Impresiones</TableHead>
                  <TableHead>Interacciones</TableHead><TableHead>Clicks</TableHead><TableHead>Engagement</TableHead>
                  <TableHead>CPR</TableHead><TableHead>CPC</TableHead><TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No hay KPIs registrados.</TableCell></TableRow>
                ) : filtered.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.influencer}</TableCell>
                    <TableCell>{k.alcance.toLocaleString()}</TableCell>
                    <TableCell>{k.impresiones.toLocaleString()}</TableCell>
                    <TableCell>{k.interacciones.toLocaleString()}</TableCell>
                    <TableCell>{k.clicks.toLocaleString()}</TableCell>
                    <TableCell>{k.engagement}%</TableCell>
                    <TableCell>${k.cpr}</TableCell>
                    <TableCell>${k.cpc}</TableCell>
                    <TableCell>{k.periodo}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(k)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(k.id)}><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Editar KPI" : "Nuevo KPI"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Acuerdo (Influencer)</Label>
              <Select value={form.acuerdoId} onValueChange={(v) => update("acuerdoId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar acuerdo" /></SelectTrigger>
                <SelectContent>{acuerdos.map((a) => <SelectItem key={a.id} value={a.id}>{a.influencer} — {a.redSocial}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Estado</Label><Select value={form.estado} onValueChange={(v) => update("estado", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="Medido">Medido</SelectItem><SelectItem value="Revisado">Revisado</SelectItem><SelectItem value="Aprobado">Aprobado</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Periodo</Label><Input value={form.periodo} onChange={(e) => update("periodo", e.target.value)} placeholder="Ej: Enero 2025" /></div>
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
            <Button onClick={handleSave}>{editing ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
