import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, Copy, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { handleEdgeError } from "@/lib/friendly-errors";
import { toast } from "sonner";

interface Invitation {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
}

interface Props {
  /** Empresas a las que se puede invitar (super_admin: todas; gerencia: solo la propia) */
  companies: Company[];
  /** Si está fijo a una empresa, no se muestra el selector */
  fixedCompanyId?: string;
  /** Roles que el caller puede asignar */
  availableRoles: { value: string; label: string }[];
}

export default function InvitationsManager({ companies, fixedCompanyId, availableRoles }: Props) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [showInvite, setShowInvite] = useState(false);
  const [companyId, setCompanyId] = useState<string>(fixedCompanyId || companies[0]?.id || "");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState(availableRoles[0]?.value || "analista");
  const [sending, setSending] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<Invitation | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("invitations").select("*").order("created_at", { ascending: false });
    if (fixedCompanyId) q = q.eq("company_id", fixedCompanyId);
    const { data } = await q;
    setInvitations((data || []) as Invitation[]);
    setLoading(false);
  }, [fixedCompanyId]);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  const targetDomain = companies.find(c => c.id === companyId)?.domain || "";

  async function handleSend() {
    if (!email.trim() || !firstName.trim() || !lastName.trim() || !companyId) {
      toast.error("Todos los campos son obligatorios");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("admin-invite-user", {
      body: { email: email.trim().toLowerCase(), first_name: firstName.trim(), last_name: lastName.trim(), role, company_id: companyId },
    });
    if (error || data?.error) {
      handleEdgeError(data, error);
      setSending(false);
      return;
    }
    const url = `${window.location.origin}/accept-invite?token=${data.invite.token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Invitación creada", { description: "El link se copió al portapapeles. Compártelo con el invitado." });
    setShowInvite(false);
    setEmail(""); setFirstName(""); setLastName("");
    setSending(false);
    fetchInvitations();
  }

  async function copyLink(inv: Invitation) {
    const url = `${window.location.origin}/accept-invite?token=${inv.token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado al portapapeles");
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    const { error } = await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", revokeTarget.id);
    if (error) { toast.error("Error al revocar", { description: error.message }); setRevoking(false); return; }
    toast.success("Invitación revocada");
    setRevokeTarget(null);
    setRevoking(false);
    fetchInvitations();
  }

  function statusBadge(inv: Invitation) {
    if (inv.accepted_at) return <Badge className="bg-emerald-100 text-emerald-800">Aceptada</Badge>;
    if (inv.revoked_at) return <Badge className="bg-zinc-200 text-zinc-700">Revocada</Badge>;
    if (new Date(inv.expires_at) < new Date()) return <Badge className="bg-amber-100 text-amber-800">Expirada</Badge>;
    return <Badge className="bg-blue-100 text-blue-800">Pendiente</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Invitaciones</h3>
          <p className="text-sm text-muted-foreground">Genera un link único para que un nuevo usuario active su cuenta y defina su contraseña.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchInvitations}><RefreshCw className="w-4 h-4" /></Button>
          <Button variant="gradient" size="sm" className="gap-1.5" onClick={() => setShowInvite(true)}>
            <Send className="w-4 h-4" /> Nueva invitación
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invitado</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Cargando...</TableCell></TableRow>
            ) : invitations.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No hay invitaciones</TableCell></TableRow>
            ) : invitations.map(inv => {
              const isPending = !inv.accepted_at && !inv.revoked_at && new Date(inv.expires_at) > new Date();
              return (
                <TableRow key={inv.id}>
                  <TableCell>{inv.first_name} {inv.last_name}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.email}</TableCell>
                  <TableCell>{availableRoles.find(r => r.value === inv.role)?.label || inv.role}</TableCell>
                  <TableCell>{statusBadge(inv)}</TableCell>
                  <TableCell className="text-xs">{new Date(inv.expires_at).toLocaleDateString("es-CO")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {isPending && (
                        <>
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => copyLink(inv)}>
                            <Copy className="w-3.5 h-3.5" /> Copiar link
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRevokeTarget(inv)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* INVITE DIALOG */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva invitación</DialogTitle>
            <DialogDescription>
              El invitado recibirá un link único (válido por 7 días) para definir su propia contraseña y activar su cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!fixedCompanyId && (
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} {c.domain && <span className="text-muted-foreground ml-1">@{c.domain}</span>}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nombre</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Apellido</Label><Input value={lastName} onChange={e => setLastName(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={targetDomain ? `nombre@${targetDomain}` : "nombre@empresa.com"} />
              {targetDomain && <p className="text-xs text-muted-foreground">Debe terminar en @{targetDomain}</p>}
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{availableRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)} disabled={sending}>Cancelar</Button>
            <Button variant="gradient" onClick={handleSend} disabled={sending}>{sending ? "Generando..." : "Generar link"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REVOKE CONFIRM */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar invitación a {revokeTarget?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              El link dejará de funcionar inmediatamente. Si el invitado aún quiere unirse, deberás generar una nueva invitación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} disabled={revoking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {revoking ? "Revocando..." : "Sí, revocar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}