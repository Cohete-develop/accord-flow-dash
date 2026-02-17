import { useState } from "react";
import { Entregable } from "@/types/crm";
import { useAcuerdos, useEntregables } from "@/hooks/useCrmData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import ViewToolbar, { ViewMode } from "@/components/ViewToolbar";
import KanbanBoard, { KanbanColumn } from "@/components/KanbanBoard";
import ForecastBoard from "@/components/ForecastBoard";

const estadoColors: Record<string, string> = {
  Pendiente: "bg-amber-100 text-amber-800",
  "En progreso": "bg-blue-100 text-blue-800",
  Entregado: "bg-emerald-100 text-emerald-800",
  Aprobado: "bg-green-100 text-green-800",
  Rechazado: "bg-red-100 text-red-800",
};

const kanbanColumns: KanbanColumn[] = [
  { key: "Pendiente", label: "Pendiente", colorClass: "bg-amber-100 text-amber-800" },
  { key: "En progreso", label: "En progreso", colorClass: "bg-blue-100 text-blue-800" },
  { key: "Entregado", label: "Entregado", colorClass: "bg-emerald-100 text-emerald-800" },
  { key: "Aprobado", label: "Aprobado", colorClass: "bg-green-100 text-green-800" },
  { key: "Rechazado", label: "Rechazado", colorClass: "bg-red-100 text-red-800" },
];

const emptyEntregable = (): Omit<Entregable, "id" | "createdAt"> => ({
  acuerdoId: "", influencer: "", tipoContenido: "Reel", descripcion: "",
  fechaProgramada: "", fechaEntrega: "", estado: "Pendiente", urlContenido: "", notas: "",
});

export default function EntregablesPage() {
  const { acuerdos } = useAcuerdos();
  const { entregables, isLoading, save, remove } = useEntregables();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Entregable | null>(null);
  const [form, setForm] = useState(emptyEntregable());
  const [view, setView] = useState<ViewMode>("list");
  const [filterAcuerdo, setFilterAcuerdo] = useState("all");

  const filtered = filterAcuerdo === "all" ? entregables : entregables.filter((e) => e.acuerdoId === filterAcuerdo);

  const handleOpen = (e?: Entregable) => {
    if (e) { setEditing(e); const { id, createdAt, ...rest } = e; setForm(rest); }
    else { setEditing(null); setForm(emptyEntregable()); }
    setOpen(true);
  };

  const handleSave = async () => {
    const selected = acuerdos.find((a) => a.id === form.acuerdoId);
    await save({ data: { ...form, influencer: selected?.influencer || form.influencer }, id: editing?.id });
    setOpen(false);
  };

  const handleDelete = async (id: string) => { await remove(id); };
  const update = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleStatusChange = async (item: Entregable, newStatus: string) => {
    const { id, createdAt, ...data } = item;
    await save({ data: { ...data, estado: newStatus as Entregable["estado"] }, id });
  };

  const entregados = filtered.filter((e) => e.estado === "Entregado" || e.estado === "Aprobado").length;
  const pendientes = filtered.filter((e) => e.estado === "Pendiente" || e.estado === "En progreso").length;

  const renderCard = (e: Entregable) => (
    <div>
      <div className="font-semibold">{e.influencer}</div>
      <div className="text-muted-foreground text-xs">{e.tipoContenido} · {e.descripcion || "Sin descripción"}</div>
      <div className="text-xs text-muted-foreground mt-1">Programado: {e.fechaProgramada || "—"}</div>
      {e.urlContenido && <a href={e.urlContenido} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">Ver contenido</a>}
    </div>
  );

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Cargando entregables...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entregables Detalles</h1>
          <p className="text-muted-foreground text-sm">Seguimiento de contenido por influencer</p>
        </div>
        <Button onClick={() => handleOpen()} disabled={acuerdos.length === 0}><Plus className="h-4 w-4 mr-2" /> Nuevo Entregable</Button>
      </div>

      <ViewToolbar view={view} onViewChange={setView} acuerdos={acuerdos} selectedAcuerdo={filterAcuerdo} onAcuerdoChange={setFilterAcuerdo} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{filtered.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Entregados / Aprobados</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">{entregados}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{pendientes}</div></CardContent></Card>
      </div>

      {view === "kanban" && (
        <KanbanBoard items={filtered} columns={kanbanColumns} getId={(e) => e.id} getStatus={(e) => e.estado} getValue={() => 1} renderCard={renderCard} onStatusChange={handleStatusChange} onCardClick={(e) => handleOpen(e)} valuePrefix="" />
      )}

      {view === "forecast" && (
        <ForecastBoard items={filtered} getDate={(e) => e.fechaProgramada} getValue={() => 1} renderCard={renderCard} getId={(e) => e.id} valuePrefix="" />
      )}

      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Influencer</TableHead><TableHead>Tipo</TableHead><TableHead>Descripción</TableHead>
                  <TableHead>Programada</TableHead><TableHead>Entrega</TableHead><TableHead>Estado</TableHead>
                  <TableHead>URL</TableHead><TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay entregables registrados.</TableCell></TableRow>
                ) : filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.influencer}</TableCell>
                    <TableCell>{e.tipoContenido}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{e.descripcion}</TableCell>
                    <TableCell>{e.fechaProgramada}</TableCell>
                    <TableCell>{e.fechaEntrega}</TableCell>
                    <TableCell><Badge variant="secondary" className={estadoColors[e.estado]}>{e.estado}</Badge></TableCell>
                    <TableCell>{e.urlContenido ? <a href={e.urlContenido} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">Ver</a> : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Entregable" : "Nuevo Entregable"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Acuerdo (Influencer)</Label>
              <Select value={form.acuerdoId} onValueChange={(v) => update("acuerdoId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar acuerdo" /></SelectTrigger>
                <SelectContent>{acuerdos.map((a) => <SelectItem key={a.id} value={a.id}>{a.influencer} — {(Array.isArray(a.redSocial) ? a.redSocial : [a.redSocial]).join(", ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Contenido</Label>
              <Select value={form.tipoContenido} onValueChange={(v) => update("tipoContenido", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reel">Reel</SelectItem>
                  <SelectItem value="Story">Story</SelectItem>
                  <SelectItem value="Collab">Collab</SelectItem>
                  <SelectItem value="UGC">UGC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Estado</Label><Select value={form.estado} onValueChange={(v) => update("estado", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="En progreso">En progreso</SelectItem><SelectItem value="Entregado">Entregado</SelectItem><SelectItem value="Aprobado">Aprobado</SelectItem><SelectItem value="Rechazado">Rechazado</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Fecha Programada</Label><Input type="date" value={form.fechaProgramada} onChange={(e) => update("fechaProgramada", e.target.value)} /></div>
            <div className="space-y-2"><Label>Fecha Entrega</Label><Input type="date" value={form.fechaEntrega} onChange={(e) => update("fechaEntrega", e.target.value)} /></div>
            <div className="col-span-2 space-y-2"><Label>Descripción</Label><Input value={form.descripcion} onChange={(e) => update("descripcion", e.target.value)} /></div>
            <div className="col-span-2 space-y-2"><Label>URL Contenido</Label><Input value={form.urlContenido} onChange={(e) => update("urlContenido", e.target.value)} /></div>
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
