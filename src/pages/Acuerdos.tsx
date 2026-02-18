import { useState, useEffect } from "react";
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
import ViewToolbar, { ViewMode } from "@/components/ViewToolbar";
import KanbanBoard, { KanbanColumn } from "@/components/KanbanBoard";
import ForecastBoard from "@/components/ForecastBoard";

const REDES_SOCIALES = ["Instagram", "TikTok", "YouTube", "Twitter", "Facebook"];
const TIPOS_CONTENIDO = ["Reel", "Story", "Collab", "UGC"];
const FAMILIAS_PRODUCTO = ["Lubricantes", "Llantas", "Transmisión", "Frenos", "Luces/Iluminación", "Baterías"];

const emptyAcuerdo = (): Omit<Acuerdo, "id" | "createdAt"> => ({
  influencer: "", redSocial: [], seguidores: 0, plataforma: "", tipoContenido: [],
  reelsPactados: 0, storiesPactadas: 0, fechaInicio: "", fechaFin: "",
  duracionMeses: 0, valorMensual: 0, valorTotal: 0, moneda: "COP", estado: "Activo", contacto: "", familiaProducto: "", notas: "",
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
  reelsPactados: "Cantidad de reels acordados en el contrato",
  storiesPactadas: "Cantidad de stories acordadas en el contrato",
  fechaInicio: "Fecha de inicio del acuerdo",
  fechaFin: "Fecha de finalización del acuerdo",
  valorMensual: "Monto mensual antes de IVA",
  valorTotal: "Valor total del acuerdo (calculado: mensual × duración)",
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

export default function AcuerdosPage() {
  const { acuerdos, isLoading, save, remove } = useAcuerdos();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Acuerdo | null>(null);
  const [form, setForm] = useState(emptyAcuerdo());
  const [view, setView] = useState<ViewMode>("list");
  const [filterAcuerdo, setFilterAcuerdo] = useState("all");

  const filtered = filterAcuerdo === "all" ? acuerdos : acuerdos.filter((a) => a.id === filterAcuerdo);

  useEffect(() => {
    const dur = calcDuration(form.fechaInicio, form.fechaFin);
    const total = dur * form.valorMensual;
    if (dur !== form.duracionMeses || total !== form.valorTotal) {
      setForm((p) => ({ ...p, duracionMeses: dur, valorTotal: dur * p.valorMensual }));
    }
  }, [form.fechaInicio, form.fechaFin, form.valorMensual]);

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
    await save({ data: form, id: editing?.id });
    setOpen(false);
  };

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
        <KanbanBoard items={filtered} columns={kanbanColumns} getId={(a) => a.id} getStatus={(a) => a.estado} getValue={(a) => a.valorTotal} renderCard={renderCard} onStatusChange={handleStatusChange} onCardClick={(a) => handleOpen(a)} />
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
                  <TableHead>Tipo</TableHead><TableHead>Reels</TableHead><TableHead>Stories</TableHead>
                  <TableHead>Inicio</TableHead><TableHead>Fin</TableHead><TableHead>Duración</TableHead>
                  <TableHead>V. Mensual</TableHead><TableHead>V. Total</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No hay acuerdos registrados.</TableCell></TableRow>
                ) : filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.influencer}</TableCell>
                    <TableCell>{(Array.isArray(a.redSocial) ? a.redSocial : [a.redSocial]).join(", ")}</TableCell>
                    <TableCell>{a.seguidores.toLocaleString()}</TableCell>
                    <TableCell>{(Array.isArray(a.tipoContenido) ? a.tipoContenido : [a.tipoContenido]).filter(Boolean).join(", ")}</TableCell>
                    <TableCell>{a.reelsPactados}</TableCell>
                    <TableCell>{a.storiesPactadas}</TableCell>
                    <TableCell>{a.fechaInicio}</TableCell>
                    <TableCell>{a.fechaFin}</TableCell>
                    <TableCell>{a.duracionMeses} meses</TableCell>
                    <TableCell>${(a.valorMensual || 0).toLocaleString()}</TableCell>
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
                {TIPOS_CONTENIDO.map((tipo) => (
                  <label key={tipo} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={(form.tipoContenido || []).includes(tipo)} onCheckedChange={() => toggleTipoContenido(tipo)} />
                    {tipo}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2"><FieldLabel field="reelsPactados"># Reels Pactados</FieldLabel><NumericInput value={form.reelsPactados} onChange={(v) => update("reelsPactados", v)} /></div>
            <div className="space-y-2"><FieldLabel field="storiesPactadas"># Stories Pactadas</FieldLabel><NumericInput value={form.storiesPactadas} onChange={(v) => update("storiesPactadas", v)} /></div>
            <div className="space-y-2"><FieldLabel field="fechaInicio">Fecha Inicio</FieldLabel><Input type="date" value={form.fechaInicio} onChange={(e) => update("fechaInicio", e.target.value)} /></div>
            <div className="space-y-2"><FieldLabel field="fechaFin">Fecha Fin</FieldLabel><Input type="date" value={form.fechaFin} onChange={(e) => update("fechaFin", e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Duración (meses)</Label>
              <p className="text-xs text-muted-foreground">Calculado automáticamente desde las fechas</p>
              <Input type="number" value={form.duracionMeses} disabled className="bg-muted" />
            </div>
            <div className="space-y-2"><FieldLabel field="valorMensual">Valor Mensual (antes de IVA)</FieldLabel><NumericInput value={form.valorMensual} onChange={(v) => update("valorMensual", v)} /></div>
            <div className="space-y-2">
              <FieldLabel field="valorTotal">Valor Total</FieldLabel>
              <Input type="number" value={form.valorTotal} disabled className="bg-muted" />
            </div>
            <div className="space-y-2"><FieldLabel field="moneda">Moneda</FieldLabel><Select value={form.moneda} onValueChange={(v) => update("moneda", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COP">COP</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><FieldLabel field="estado">Estado</FieldLabel><Select value={form.estado} onValueChange={(v) => update("estado", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Activo">Activo</SelectItem><SelectItem value="Pausado">Pausado</SelectItem><SelectItem value="Finalizado">Finalizado</SelectItem><SelectItem value="Cancelado">Cancelado</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><FieldLabel field="contacto">Contacto</FieldLabel><Input value={form.contacto} onChange={(e) => update("contacto", e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Familias de productos</Label>
              <Select value={form.familiaProducto} onValueChange={(v) => update("familiaProducto", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar familia" /></SelectTrigger>
                <SelectContent>{FAMILIAS_PRODUCTO.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2"><FieldLabel field="notas">Notas</FieldLabel><Textarea value={form.notas} onChange={(e) => update("notas", e.target.value)} /></div>
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
