import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Trash2, Download, RefreshCw, AlertTriangle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import * as XLSX from 'xlsx';

const DATA_MODULES = [
  { value: 'acuerdos', label: 'Acuerdos', table: 'acuerdos' as const },
  { value: 'pagos', label: 'Pagos', table: 'pagos' as const },
  { value: 'entregables', label: 'Entregables', table: 'entregables' as const },
  { value: 'kpis', label: 'KPIs', table: 'kpis' as const },
];

type TableName = 'acuerdos' | 'pagos' | 'entregables' | 'kpis';

const TABLE_COLUMNS: Record<string, { key: string; label: string }[]> = {
  acuerdos: [
    { key: 'influencer', label: 'Influencer' },
    { key: 'estado', label: 'Estado' },
    { key: 'valor_total', label: 'Valor Total' },
    { key: 'fecha_inicio', label: 'Inicio' },
    { key: 'created_at', label: 'Creación' },
  ],
  pagos: [
    { key: 'influencer', label: 'Influencer' },
    { key: 'concepto', label: 'Concepto' },
    { key: 'monto', label: 'Monto' },
    { key: 'estado', label: 'Estado' },
    { key: 'created_at', label: 'Creación' },
  ],
  entregables: [
    { key: 'influencer', label: 'Influencer' },
    { key: 'tipo_contenido', label: 'Tipo' },
    { key: 'estado', label: 'Estado' },
    { key: 'fecha_programada', label: 'Programada' },
    { key: 'created_at', label: 'Creación' },
  ],
  kpis: [
    { key: 'influencer', label: 'Influencer' },
    { key: 'alcance', label: 'Alcance' },
    { key: 'engagement', label: 'Engagement' },
    { key: 'estado', label: 'Estado' },
    { key: 'periodo', label: 'Periodo' },
  ],
};

export default function AdminDataManagement() {
  const { session } = useAuth();
  const [selectedModule, setSelectedModule] = useState(DATA_MODULES[0].value);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const moduleConfig = DATA_MODULES.find(m => m.value === selectedModule)!;
  const tableName = moduleConfig.table;
  const columns = TABLE_COLUMNS[tableName] || [];

  const filteredRecords = records.filter(record => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return columns.some(col => {
      const val = record[col.key];
      if (val == null) return false;
      return String(val).toLowerCase().includes(q);
    });
  });

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    const { data, error } = await supabase.from(tableName).select('*').order('created_at', { ascending: false }).limit(500);
    if (error) { toast.error('Error al cargar registros'); setLoading(false); return; }
    setRecords(data || []);
    setLoading(false);
  }, [tableName]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredRecords.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredRecords.map(r => r.id)));
  }

  function formatCellValue(value: any, key: string): string {
    if (value == null) return '—';
    if (key === 'created_at' || key === 'fecha_inicio' || key === 'fecha_fin' || key === 'fecha_programada' || key === 'fecha_entrega' || key === 'fecha_pago' || key === 'fecha_vencimiento') {
      return new Date(value).toLocaleDateString('es-CO');
    }
    if (key === 'valor_total' || key === 'valor_mensual' || key === 'monto') {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  async function handleExport() {
    const toExport = selectedIds.size > 0 ? filteredRecords.filter(r => selectedIds.has(r.id)) : filteredRecords;
    if (toExport.length === 0) { toast.error('No hay registros para exportar'); return; }

    const ws = XLSX.utils.json_to_sheet(toExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, moduleConfig.label);
    XLSX.writeFile(wb, `${moduleConfig.label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${toExport.length} registros exportados`);

    await supabase.from('audit_log').insert({
      user_id: session?.user?.id,
      user_name: session?.user?.user_metadata?.full_name || session?.user?.email || '',
      action: 'export_data',
      module: 'admin',
      details: { data_module: moduleConfig.label, count: toExport.length },
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from(tableName).delete().in('id', ids);
    if (error) { toast.error(`Error al eliminar: ${error.message}`); setDeleting(false); setShowDeleteConfirm(false); return; }

    toast.success(`${ids.length} registros eliminados`);
    await supabase.from('audit_log').insert({
      user_id: session?.user?.id,
      user_name: session?.user?.user_metadata?.full_name || session?.user?.email || '',
      action: 'bulk_delete',
      module: 'admin',
      details: { data_module: moduleConfig.label, count: ids.length },
    });

    setDeleting(false);
    setShowDeleteConfirm(false);
    setSelectedIds(new Set());
    fetchRecords();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label>Módulo:</Label>
        <Select value={selectedModule} onValueChange={setSelectedModule}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DATA_MODULES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchRecords}>
          <RefreshCw className="w-3.5 h-3.5" /> Recargar
        </Button>
        <Badge variant="secondary">{records.length} registros</Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar en registros..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setSelectedIds(new Set()); }} className="pl-9" />
        {searchQuery && <Badge variant="outline" className="absolute right-2 top-2 text-xs">{filteredRecords.length} de {records.length}</Badge>}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-md bg-muted/50 border">
          <Badge>{selectedIds.size} seleccionados</Badge>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Exportar seleccionados
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="w-3.5 h-3.5" /> Eliminar seleccionados
          </Button>
        </div>
      )}

      {selectedIds.size === 0 && filteredRecords.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Exportar todos ({filteredRecords.length})
          </Button>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length} onCheckedChange={toggleSelectAll} />
              </TableHead>
              {columns.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
              <TableHead className="w-10">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={columns.length + 2} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length + 2} className="text-center text-muted-foreground">{searchQuery ? 'Sin resultados' : 'No hay registros'}</TableCell></TableRow>
            ) : filteredRecords.map(record => (
              <TableRow key={record.id} className={selectedIds.has(record.id) ? 'bg-muted/30' : ''}>
                <TableCell><Checkbox checked={selectedIds.has(record.id)} onCheckedChange={() => toggleSelect(record.id)} /></TableCell>
                {columns.map(col => (
                  <TableCell key={col.key} className="text-sm max-w-[200px] truncate">{formatCellValue(record[col.key], col.key)}</TableCell>
                ))}
                <TableCell>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setSelectedIds(new Set([record.id])); setShowDeleteConfirm(true); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" /> Confirmar Eliminación</DialogTitle>
            <DialogDescription>Vas a eliminar <span className="font-semibold">{selectedIds.size} registro(s)</span> de {moduleConfig.label}. Esta acción es irreversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>{deleting ? 'Eliminando...' : `Eliminar ${selectedIds.size} registro(s)`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
