import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, ArrowUp, ArrowDown, Power } from "lucide-react";
import { toast } from "sonner";

interface ContentType {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  companyId: string;
  canDelete: boolean;
}

export default function ContentTypesManager({ companyId }: Props) {
  const [items, setItems] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContentType | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_types")
      .select("id, name, is_active, sort_order")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true });
    if (error) toast.error("Error al cargar tipos de contenido");
    setItems((data as ContentType[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (companyId) fetchItems();
  }, [companyId]);

  function openCreate() {
    setEditing(null);
    setName("");
    setOpen(true);
  }

  function openEdit(t: ContentType) {
    setEditing(t);
    setName(t.name);
    setOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("content_types")
        .update({ name: name.trim() })
        .eq("id", editing.id);
      if (error) {
        toast.error(error.message.includes("duplicate") ? "Ya existe un tipo con ese nombre" : "Error al actualizar");
        setSaving(false);
        return;
      }
      toast.success("Tipo de contenido actualizado");
    } else {
      const nextOrder = (items[items.length - 1]?.sort_order ?? 0) + 1;
      const { error } = await supabase.from("content_types").insert({
        company_id: companyId,
        name: name.trim(),
        sort_order: nextOrder,
        is_active: true,
      });
      if (error) {
        toast.error(error.message.includes("duplicate") ? "Ya existe un tipo con ese nombre" : "Error al crear");
        setSaving(false);
        return;
      }
      toast.success("Tipo de contenido creado");
    }
    setSaving(false);
    setOpen(false);
    fetchItems();
  }

  async function toggleActive(t: ContentType) {
    const { error } = await supabase
      .from("content_types")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) {
      toast.error("Error al cambiar estado");
      return;
    }
    toast.success(t.is_active ? "Tipo desactivado" : "Tipo activado");
    fetchItems();
  }

  async function moveItem(index: number, direction: -1 | 1) {
    const target = items[index + direction];
    if (!target) return;
    const current = items[index];
    await Promise.all([
      supabase.from("content_types").update({ sort_order: target.sort_order }).eq("id", current.id),
      supabase.from("content_types").update({ sort_order: current.sort_order }).eq("id", target.id),
    ]);
    fetchItems();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tipos de Contenido</h2>
          <p className="text-sm text-muted-foreground">
            Configura los tipos de contenido disponibles en los Acuerdos de tu empresa (Reel, Story, Live, Podcast, etc.).
          </p>
        </div>
        <Button variant="gradient" className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Agregar tipo
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Orden</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-48 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                Aún no hay tipos de contenido configurados. Agrega el primero para que aparezca en los Acuerdos.
              </TableCell></TableRow>
            ) : items.map((t, idx) => (
              <TableRow key={t.id} className={!t.is_active ? "opacity-60" : ""}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveItem(idx, -1)}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === items.length - 1} onClick={() => moveItem(idx, 1)}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>
                  <Badge className={t.is_active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}>
                    {t.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => toggleActive(t)}>
                      <Power className="w-3.5 h-3.5" />
                      {t.is_active ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Los tipos inactivos no aparecen al crear nuevos Acuerdos, pero los Acuerdos existentes conservan su valor original.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tipo de contenido" : "Nuevo tipo de contenido"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Live, Podcast, Newsletter" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="gradient" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}