import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Acuerdo, Pago, Entregable } from "@/types/crm";

interface ChartDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  type: "acuerdos" | "pagos" | "entregables";
  acuerdos?: Acuerdo[];
  pagos?: Pago[];
  entregables?: Entregable[];
}

export default function ChartDetailDialog({ open, onOpenChange, title, type, acuerdos, pagos, entregables }: ChartDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {type === "acuerdos" && acuerdos && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Influencer</TableHead>
                <TableHead>Red Social</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acuerdos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Sin registros</TableCell></TableRow>
              ) : acuerdos.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.influencer}</TableCell>
                  <TableCell>{(Array.isArray(a.redSocial) ? a.redSocial : [a.redSocial]).join(", ")}</TableCell>
                  <TableCell>${a.valorTotal.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary">{a.estado}</Badge></TableCell>
                  <TableCell>{a.fechaInicio}</TableCell>
                  <TableCell>{a.fechaFin}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {type === "pagos" && pagos && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Influencer</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vencimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagos.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Sin registros</TableCell></TableRow>
              ) : pagos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.influencer}</TableCell>
                  <TableCell>{p.concepto}</TableCell>
                  <TableCell>${p.monto.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary">{p.estado}</Badge></TableCell>
                  <TableCell>{p.fechaVencimiento}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {type === "entregables" && entregables && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Influencer</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Programada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entregables.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Sin registros</TableCell></TableRow>
              ) : entregables.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.influencer}</TableCell>
                  <TableCell>{e.tipoContenido}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{e.descripcion}</TableCell>
                  <TableCell><Badge variant="secondary">{e.estado}</Badge></TableCell>
                  <TableCell>{e.fechaProgramada}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
