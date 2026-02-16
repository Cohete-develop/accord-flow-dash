import { useState, useEffect } from "react";
import { Acuerdo } from "@/types/crm";
import { getAcuerdos, saveAcuerdo, deleteAcuerdo, generateId } from "@/data/crm-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import ViewToolbar, { ViewMode } from "@/components/ViewToolbar";
import KanbanBoard, { KanbanColumn } from "@/components/KanbanBoard";
import ForecastBoard from "@/components/ForecastBoard";

const emptyAcuerdo = (): Omit<Acuerdo, "id" | "createdAt"> => ({
  influencer: "", redSocial: "", seguidores: 0, plataforma: "", tipoContenido: "",
  reelsPactados: 0, storiesPactadas: 0, fechaInicio: "", fechaFin: "",
  duracionMeses: 0, valorTotal: 0, moneda: "COP", estado: "Activo", contacto: "", notas: "",
});

const estadoColors: Record<string, string> = {
  Activo: "bg-emerald-100 text-emerald-800",
  Pausado: "bg-amber-100 text-amber-800",
  Finalizado: "bg-slate-100 text-slate-600",
  Cancelado: "bg-red-100 text-red-800",
};

const kanbanColumns: KanbanColumn[] = [
  { key: "Activo", label: "Activo", colorClass: "bg-emerald-100 text-emerald-800" },
  { key: "Pausado", label: "Pausado", colorClass: "bg-amber-100 text-amber-800" },
  { key: "Finalizado", label: "Finalizado", colorClass: "bg-slate-100 text-slate-700" },
  { key: "Cancelado", label: "Cancelado", colorClass: "bg-red-100 text-red-800" },
];

export default function AcuerdosPage() {
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Acuerdo | null>(null);
  const [form, setForm] = useState(emptyAcuerdo());
  const [view, setView] = useState<ViewMode>("list");
  const [filterAcuerdo, setFilterAcuerdo] = useState("all");

  useEffect(() => { setAcuerdos(getAcuerdos()); }, []);
  const refresh = () => setAcuerdos(getAcuerdos());

  const filtered = filterAcuerdo === "all" ? acuerdos : acuerdos.filter((a) => a.id === filterAcuerdo);

  const handleOpen = (a?: Acuerdo) => {
    if (a) { setEditing(a); const { id, createdAt, ...rest } = a; setForm(rest); }
    else { setEditing(null); setForm(emptyAcuerdo()); }
    setOpen(true);
  };

  const handleSave = () => {
    const acuerdo: Acuerdo = { ...form, id: editing?.id || generateId(), createdAt: editing?.createdAt || new Date().toISOString() };
    saveAcuerdo(acuerdo); refresh(); setOpen(false);
  };

  const handleDelete = (id: string) => { deleteAcuerdo(id); refresh(); };
  const update = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleStatusChange = (item: Acuerdo, newStatus: string) => {
    const updated = { ...item, estado: newStatus as Acuerdo["estado"] };
    saveAcuerdo(updated); refresh();
  };

  const renderCard = (a: Acuerdo) => (
    <div>
      <div className="font-semibold">{a.influencer}</div>
      <div className="text-muted-foreground text-xs">{a.redSocial} · {a.seguidores.toLocaleString()} seg.</div>
      <div className="font-bold mt-1">${a.valorTotal.toLocaleString()} {a.moneda}</div>
      <div className="text-xs text-muted-foreground">{a.fechaInicio} → {a.fechaFin}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acuerdos</h1>
          <p className="text-muted-foreground text-sm">Gestión de acuerdos con influencers</p>
        </div>
        <Button onClick={() => handleOpen()}><Plus className="h-4 w-4 mr-2" /> Nuevo Acuerdo</Button>
      </div>

      <ViewToolbar view={view} onViewChange={setView} acuerdos={acuerdos} selectedAcuerdo={filterAcuerdo} onAcuerdoChange={setFilterAcuerdo} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Acuerdos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{filtered.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Activos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">{filtered.filter((a) => a.estado === "Activo").length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">${filtered.reduce((s, a) => s + a.valorTotal, 0).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Influencers</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2"><Users className="h-5 w-5 text-muted-foreground" /><span className="text-2xl font-bold">{new Set(filtered.map((a) => a.influencer)).size}</span></div></CardContent></Card>
      </div>

      {view === "kanban" && (
        <KanbanBoard items={filtered} columns={kanbanColumns} getId={(a) => a.id} getStatus={(a) => a.estado} getValue={(a) => a.valorTotal} renderCard={renderCard} onStatusChange={handleStatusChange} />
      )}

      {view === "forecast" && (
        <ForecastBoard items={filtered} getDate={(a) => a.fechaFin} getValue={(a) => a.valorTotal} renderCard={renderCard} getId={(a) => a.id} />
      )}

      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Influencer</TableHead><TableHead>Red Social</TableHead><TableHead>Seguidores</TableHead>
                  <TableHead>Reels</TableHead><TableHead>Stories</TableHead><TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead><TableHead>Duración</TableHead><TableHead>Valor</TableHead>
                  <TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No hay acuerdos registrados.</TableCell></TableRow>
                ) : filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.influencer}</TableCell>
                    <TableCell>{a.redSocial}</TableCell>
                    <TableCell>{a.seguidores.toLocaleString()}</TableCell>
                    <TableCell>{a.reelsPactados}</TableCell>
                    <TableCell>{a.storiesPactadas}</TableCell>
                    <TableCell>{a.fechaInicio}</TableCell>
                    <TableCell>{a.fechaFin}</TableCell>
                    <TableCell>{a.duracionMeses} meses</TableCell>
                    <TableCell>${a.valorTotal.toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary" className={estadoColors[a.estado]}>{a.estado}</Badge></TableCell>
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
            <div className="space-y-2"><Label>Influencer</Label><Input value={form.influencer} onChange={(e) => update("influencer", e.target.value)} /></div>
            <div className="space-y-2"><Label>Red Social</Label><Select value={form.redSocial} onValueChange={(v) => update("redSocial", v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="Instagram">Instagram</SelectItem><SelectItem value="TikTok">TikTok</SelectItem><SelectItem value="YouTube">YouTube</SelectItem><SelectItem value="Twitter">Twitter</SelectItem><SelectItem value="Facebook">Facebook</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Seguidores</Label><Input type="number" value={form.seguidores} onChange={(e) => update("seguidores", +e.target.value)} /></div>
            <div className="space-y-2"><Label>Plataforma</Label><Input value={form.plataforma} onChange={(e) => update("plataforma", e.target.value)} /></div>
            <div className="space-y-2"><Label>Tipo de Contenido</Label><Input value={form.tipoContenido} onChange={(e) => update("tipoContenido", e.target.value)} /></div>
            <div className="space-y-2"><Label># Reels Pactados</Label><Input type="number" value={form.reelsPactados} onChange={(e) => update("reelsPactados", +e.target.value)} /></div>
            <div className="space-y-2"><Label># Stories Pactadas</Label><Input type="number" value={form.storiesPactadas} onChange={(e) => update("storiesPactadas", +e.target.value)} /></div>
            <div className="space-y-2"><Label>Fecha Inicio</Label><Input type="date" value={form.fechaInicio} onChange={(e) => update("fechaInicio", e.target.value)} /></div>
            <div className="space-y-2"><Label>Fecha Fin</Label><Input type="date" value={form.fechaFin} onChange={(e) => update("fechaFin", e.target.value)} /></div>
            <div className="space-y-2"><Label>Duración (meses)</Label><Input type="number" value={form.duracionMeses} onChange={(e) => update("duracionMeses", +e.target.value)} /></div>
            <div className="space-y-2"><Label>Valor Total</Label><Input type="number" value={form.valorTotal} onChange={(e) => update("valorTotal", +e.target.value)} /></div>
            <div className="space-y-2"><Label>Moneda</Label><Select value={form.moneda} onValueChange={(v) => update("moneda", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Estado</Label><Select value={form.estado} onValueChange={(v) => update("estado", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Activo">Activo</SelectItem><SelectItem value="Pausado">Pausado</SelectItem><SelectItem value="Finalizado">Finalizado</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Contacto</Label><Input value={form.contacto} onChange={(e) => update("contacto", e.target.value)} /></div>
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
