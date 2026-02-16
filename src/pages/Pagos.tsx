import { useState, useEffect } from "react";
import { Pago } from "@/types/crm";
import { getPagos, savePago, deletePago, getAcuerdos, generateId } from "@/data/crm-store";
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
  Pagado: "bg-emerald-100 text-emerald-800",
  Vencido: "bg-red-100 text-red-800",
  Cancelado: "bg-slate-100 text-slate-600",
};

const kanbanColumns: KanbanColumn[] = [
  { key: "Pendiente", label: "Pendiente", colorClass: "bg-amber-100 text-amber-800" },
  { key: "Pagado", label: "Pagado", colorClass: "bg-emerald-100 text-emerald-800" },
  { key: "Vencido", label: "Vencido", colorClass: "bg-red-100 text-red-800" },
  { key: "Cancelado", label: "Cancelado", colorClass: "bg-slate-100 text-slate-700" },
];

const emptyPago = (): Omit<Pago, "id" | "createdAt"> => ({
  acuerdoId: "", influencer: "", concepto: "", monto: 0, moneda: "COP",
  fechaPago: "", fechaVencimiento: "", estado: "Pendiente", metodoPago: "", comprobante: "", notas: "",
});

function NumericInput({ value, onChange, ...props }: { value: number; onChange: (v: number) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [display, setDisplay] = useState(value === 0 ? "" : String(value));
  useEffect(() => { setDisplay(value === 0 ? "" : String(value)); }, [value]);
  return (
    <Input
      {...props}
      type="number"
      value={display}
      onChange={(e) => { setDisplay(e.target.value); onChange(e.target.value === "" ? 0 : +e.target.value); }}
      placeholder="0"
    />
  );
}

export default function PagosPage() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pago | null>(null);
  const [form, setForm] = useState(emptyPago());
  const [view, setView] = useState<ViewMode>("list");
  const [filterAcuerdo, setFilterAcuerdo] = useState("all");
  const acuerdos = getAcuerdos();
  

  useEffect(() => { setPagos(getPagos()); }, []);
  const refresh = () => setPagos(getPagos());

  const filtered = filterAcuerdo === "all" ? pagos : pagos.filter((p) => p.acuerdoId === filterAcuerdo);

  const handleOpen = (p?: Pago) => {
    if (p) { setEditing(p); const { id, createdAt, ...rest } = p; setForm(rest); }
    else { setEditing(null); setForm(emptyPago()); }
    setOpen(true);
  };

  const handleSave = () => {
    const selected = acuerdos.find((a) => a.id === form.acuerdoId);
    const pago: Pago = { ...form, influencer: selected?.influencer || form.influencer, id: editing?.id || generateId(), createdAt: editing?.createdAt || new Date().toISOString() };
    savePago(pago); refresh(); setOpen(false);
  };

  const handleDelete = (id: string) => { deletePago(id); refresh(); };
  const update = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));


  const handleStatusChange = (item: Pago, newStatus: string) => {
    const updated = { ...item, estado: newStatus as Pago["estado"] };
    savePago(updated); refresh();
  };

  const totalPagado = filtered.filter((p) => p.estado === "Pagado").reduce((s, p) => s + p.monto, 0);
  const totalPendiente = filtered.filter((p) => p.estado === "Pendiente").reduce((s, p) => s + p.monto, 0);

  const renderCard = (p: Pago) => (
    <div>
      <div className="font-semibold">{p.influencer}</div>
      <div className="text-muted-foreground text-xs">{p.concepto}</div>
      <div className="font-bold mt-1">${p.monto.toLocaleString()} {p.moneda}</div>
      <div className="text-xs text-muted-foreground">{p.metodoPago} · Vence: {p.fechaVencimiento || "—"}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagos</h1>
          <p className="text-muted-foreground text-sm">Control de pagos vinculados a acuerdos</p>
        </div>
        <Button onClick={() => handleOpen()} disabled={acuerdos.length === 0}><Plus className="h-4 w-4 mr-2" /> Nuevo Pago</Button>
      </div>

      <ViewToolbar view={view} onViewChange={setView} acuerdos={acuerdos} selectedAcuerdo={filterAcuerdo} onAcuerdoChange={setFilterAcuerdo} />

      {acuerdos.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Primero debes crear un acuerdo en el módulo de Acuerdos antes de registrar pagos.</CardContent></Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Pagado</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">${totalPagado.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pendiente</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">${totalPendiente.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Registros</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{filtered.length}</div></CardContent></Card>
      </div>

      {view === "kanban" && (
        <KanbanBoard items={filtered} columns={kanbanColumns} getId={(p) => p.id} getStatus={(p) => p.estado} getValue={(p) => p.monto} renderCard={renderCard} onStatusChange={handleStatusChange} />
      )}

      {view === "forecast" && (
        <ForecastBoard items={filtered} getDate={(p) => p.fechaVencimiento} getValue={(p) => p.monto} renderCard={renderCard} getId={(p) => p.id} />
      )}

      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Influencer</TableHead><TableHead>Concepto</TableHead><TableHead>Monto</TableHead>
                  <TableHead>Fecha Pago</TableHead><TableHead>Vencimiento</TableHead><TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay pagos registrados.</TableCell></TableRow>
                ) : filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.influencer}</TableCell>
                    <TableCell>{p.concepto}</TableCell>
                    <TableCell>${p.monto.toLocaleString()}</TableCell>
                    <TableCell>{p.fechaPago}</TableCell>
                    <TableCell>{p.fechaVencimiento}</TableCell>
                    <TableCell>{p.metodoPago}</TableCell>
                    <TableCell><Badge variant="secondary" className={estadoColors[p.estado]}>{p.estado}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpen(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Editar Pago" : "Nuevo Pago"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Acuerdo (Influencer)</Label>
              <Select value={form.acuerdoId} onValueChange={(v) => update("acuerdoId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar acuerdo" /></SelectTrigger>
                <SelectContent>{acuerdos.map((a) => <SelectItem key={a.id} value={a.id}>{a.influencer} — {(Array.isArray(a.redSocial) ? a.redSocial : [a.redSocial]).join(", ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Concepto</Label><Input value={form.concepto} onChange={(e) => update("concepto", e.target.value)} /></div>
            <div className="space-y-2"><Label>Monto</Label><NumericInput value={form.monto} onChange={(v) => update("monto", v)} /></div>
            <div className="space-y-2"><Label>Moneda</Label><Select value={form.moneda} onValueChange={(v) => update("moneda", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Fecha Pago</Label><Input type="date" value={form.fechaPago} onChange={(e) => update("fechaPago", e.target.value)} /></div>
            <div className="space-y-2"><Label>Fecha Vencimiento</Label><Input type="date" value={form.fechaVencimiento} onChange={(e) => update("fechaVencimiento", e.target.value)} /></div>
            <div className="space-y-2"><Label>Método de Pago</Label><Select value={form.metodoPago} onValueChange={(v) => update("metodoPago", v)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="Transferencia">Transferencia</SelectItem><SelectItem value="Efectivo">Efectivo</SelectItem><SelectItem value="PayPal">PayPal</SelectItem><SelectItem value="Otro">Otro</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Estado</Label><Select value={form.estado} onValueChange={(v) => update("estado", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pendiente">Pendiente</SelectItem><SelectItem value="Pagado">Pagado</SelectItem><SelectItem value="Vencido">Vencido</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem></SelectContent></Select></div>
            <div className="col-span-2 space-y-2"><Label>Comprobante</Label><Input value={form.comprobante} onChange={(e) => update("comprobante", e.target.value)} placeholder="Referencia o número de comprobante" /></div>
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
