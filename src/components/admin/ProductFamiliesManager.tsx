import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, ArrowUp, ArrowDown, Power } from "lucide-react";
import { toast } from "sonner";

interface ProductFamily {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

interface Props {
  companyId: string;
  canDelete: boolean;
}

export default function ProductFamiliesManager({ companyId, canDelete }: Props) {
  const [families, setFamilies] = useState<ProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductFamily | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchFamilies() {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_families")
      .select("id, name, description, is_active, sort_order")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true });
    if (error) toast.error("Error al cargar familias");
    setFamilies((data as ProductFamily[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (companyId) fetchFamilies();
  }, [companyId]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setOpen(true);
  }

  function openEdit(f: ProductFamily) {
    setEditing(f);
    setName(f.name);
    setDescription(f.description || "");
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
        .from("product_families")
        .update({ name: name.trim(), description: description.trim() })
        .eq("id", editing.id);
      if (error) {
        toast.error(error.message.includes("duplicate") ? "Ya existe una familia con ese nombre" : "Error al actualizar");
        setSaving(false);
        return;
      }
      toast.success("Familia actualizada");
    } else {
      const nextOrder = (families[families.length - 1]?.sort_order ?? 0) + 1;
      const { error } = await supabase.from("product_families").insert({
        company_id: companyId,
        name: name.trim(),
        description: description.trim(),
        sort_order: nextOrder,
        is_active: true,
      });
      if (error) {
        toast.error(error.message.includes("duplicate") ? "Ya existe una familia con ese nombre" : "Error al crear");
        setSaving(false);
        return;
      }
      toast.success("Familia creada");
    }
    setSaving(false);
    setOpen(false);
    fetchFamilies();
  }

  async function toggleActive(f: ProductFamily) {
    const { error } = await supabase
      .from("product_families")
      .update({ is_active: !f.is_active })
      .eq("id", f.id);
    if (error) {
      toast.error("Error al cambiar estado");
      return;
    }
    toast.success(f.is_active ? "Familia desactivada" : "Familia activada");
    fetchFamilies();
  }

  async function moveItem(index: number, direction: -1 | 1) {
    const target = families[index + direction];
    if (!target) return;
    const current = families[index];
    await Promise.all([
      supabase.from("product_families").update({ sort_order: target.sort_order }).eq("id", current.id),
      supabase.from("product_families").update({ sort_order: current.sort_order }).eq("id", target.id),
    ]);
    fetchFamilies();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Familias de Producto</h2>
          <p className="text-sm text-muted-foreground">
            Configura las familias de producto disponibles en los Acuerdos de tu empresa.
          </p>
        </div>
        <Button variant="gradient" className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Agregar familia
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Orden</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-48 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : families.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                Aún no hay familias de producto configuradas. Agrega la primera para que aparezca en los Acuerdos.
              </TableCell></TableRow>
            ) : families.map((f, idx) => (
              <TableRow key={f.id} className={!f.is_active ? "opacity-60" : ""}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveItem(idx, -1)}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === families.length - 1} onClick={() => moveItem(idx, 1)}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{f.description || "—"}</TableCell>
                <TableCell>
                  <Badge className={f.is_active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}>
                    {f.is_active ? "Activa" : "Inactiva"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => openEdit(f)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => toggleActive(f)}>
                      <Power className="w-3.5 h-3.5" />
                      {f.is_active ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Las familias inactivas no aparecen al crear nuevos Acuerdos, pero los Acuerdos existentes conservan su valor original.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar familia" : "Nueva familia de producto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Lubricantes" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción opcional" />
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