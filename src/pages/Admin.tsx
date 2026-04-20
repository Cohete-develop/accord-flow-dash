import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Shield, ScrollText, UserPlus, Trash2, Pencil, Database, Crown } from 'lucide-react';
import { Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { handleEdgeError } from '@/lib/friendly-errors';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import AdminDataManagement from '@/components/admin/AdminDataManagement';
import InvitationsManager from '@/components/admin/InvitationsManager';

const ALL_ROLES = [
  { value: 'gerencia', label: 'Gerencia' },
  { value: 'coordinador_mercadeo', label: 'Coordinador de Mercadeo' },
  { value: 'admin_contabilidad', label: 'Administración / Contabilidad' },
  { value: 'analista', label: 'Analista' },
];

// Roles that a gerencia user can assign (not gerencia or super_admin)
const GERENCIA_ASSIGNABLE_ROLES = [
  { value: 'coordinador_mercadeo', label: 'Coordinador de Mercadeo' },
  { value: 'admin_contabilidad', label: 'Administración / Contabilidad' },
  { value: 'analista', label: 'Analista' },
];

// Coordinador can only assign analista
const COORDINADOR_ASSIGNABLE_ROLES = [
  { value: 'analista', label: 'Analista' },
];

const MODULES = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'acuerdos', label: 'Acuerdos' },
  { value: 'pagos', label: 'Pagos' },
  { value: 'entregables', label: 'Entregables' },
  { value: 'kpis', label: 'KPIs' },
  { value: 'admin', label: 'Administración' },
];

interface UserRow {
  user_id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
}

interface ModulePermission {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface AuditEntry {
  id: string;
  user_name: string;
  action: string;
  module: string;
  details: any;
  created_at: string;
}

export default function AdminPage() {
  const { session, user } = useAuth();
  const [tab, setTab] = useState('users');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [callerIsSuperAdmin, setCallerIsSuperAdmin] = useState(false);
  const [callerIsGerencia, setCallerIsGerencia] = useState(false);
  const [callerIsCoordinador, setCallerIsCoordinador] = useState(false);
  const [callerCompany, setCallerCompany] = useState<{ id: string; name: string; domain: string | null } | null>(null);
  const [companyPlan, setCompanyPlan] = useState<{
    plan_id: string;
    display_name: string;
    max_seats: number;
    features: string[];
    modules_included: string[];
    max_ad_connections: number;
    sync_interval_minutes: number;
    active_user_count: number;
  } | null>(null);

  // Users state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newRole, setNewRole] = useState('coordinador_mercadeo');
  const [creating, setCreating] = useState(false);

  // Edit user
  const [showEditUser, setShowEditUser] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editing, setEditing] = useState(false);

  // Delete user
  const [showDeleteUser, setShowDeleteUser] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [transferUserId, setTransferUserId] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Permissions
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [selectedRole, setSelectedRole] = useState('coordinador_mercadeo');

  // Audit
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);

  async function fetchUsers() {
    setLoadingUsers(true);
    const [profRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, email, is_active'),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    const rolesMap: Record<string, string[]> = {};
    (rolesRes.data || []).forEach(r => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });
    setUsers((profRes.data || []).map(p => ({
      user_id: p.user_id,
      email: p.email || '',
      full_name: p.full_name || '',
      is_active: p.is_active ?? true,
      roles: rolesMap[p.user_id] || [],
    })));
    setLoadingUsers(false);
  }

  async function fetchPermissions() {
    setLoadingPerms(true);
    const { data } = await supabase.from('module_permissions').select('*');
    setPermissions((data || []) as ModulePermission[]);
    setLoadingPerms(false);
  }

  async function fetchAudit() {
    setLoadingAudit(true);
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100);
    setAuditLog((data || []) as AuditEntry[]);
    setLoadingAudit(false);
  }

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id)
        .in('role', ['gerencia', 'super_admin', 'coordinador_mercadeo']),
      supabase.from('profiles').select('company_id').eq('user_id', user.id).maybeSingle(),
    ]).then(async ([rolesRes, profileRes]) => {
      const roles = (rolesRes.data || []).map(r => r.role);
      const hasNoCompany = !profileRes.data?.company_id;
      // super_admin powers only for platform owners (no company_id)
      const effectiveSuperAdmin = roles.includes('super_admin') && hasNoCompany;
      setIsAuthorized(roles.includes('gerencia') || effectiveSuperAdmin || roles.includes('coordinador_mercadeo'));
      setCallerIsSuperAdmin(effectiveSuperAdmin);
      setCallerIsGerencia(roles.includes('gerencia'));
      setCallerIsCoordinador(roles.includes('coordinador_mercadeo'));
      if (profileRes.data?.company_id) {
        const { data: c } = await supabase.from('companies').select('id, name, domain').eq('id', profileRes.data.company_id).maybeSingle();
        if (c) setCallerCompany(c);

        // Cargar plan de la empresa + conteo de usuarios activos
        const [{ data: companyData }, { data: profilesData }] = await Promise.all([
          supabase.from('companies').select('plan').eq('id', profileRes.data.company_id).maybeSingle(),
          supabase.from('profiles').select('is_active').eq('company_id', profileRes.data.company_id),
        ]);
        if (companyData?.plan) {
          const { data: planDef } = await supabase
            .from('plan_definitions')
            .select('*')
            .eq('id', companyData.plan)
            .maybeSingle();
          if (planDef) {
            const activeCount = (profilesData || []).filter(p => p.is_active).length;
            setCompanyPlan({
              plan_id: planDef.id,
              display_name: planDef.display_name,
              max_seats: planDef.max_seats,
              features: (planDef.features as string[]) || [],
              modules_included: planDef.modules_included || [],
              max_ad_connections: planDef.max_ad_connections || 0,
              sync_interval_minutes: planDef.sync_interval_minutes || 0,
              active_user_count: activeCount,
            });
          }
        }
      }
    });
  }, [user]);

  useEffect(() => { 
    if (isAuthorized) { fetchUsers(); fetchPermissions(); fetchAudit(); }
  }, [isAuthorized]);

  // Roles available for assignment based on caller's role
  const ROLES = callerIsSuperAdmin ? ALL_ROLES : callerIsGerencia ? GERENCIA_ASSIGNABLE_ROLES : COORDINADOR_ASSIGNABLE_ROLES;
  
  // Only gerencia and super_admin can create users
  const canCreateUsers = callerIsSuperAdmin || callerIsGerencia;
  
  // Only gerencia and super_admin can delete users  
  const canDeleteUsers = callerIsSuperAdmin || callerIsGerencia;
  
  // Determine which permission roles this user can edit
  const editablePermissionRoles = callerIsSuperAdmin 
    ? ALL_ROLES 
    : callerIsGerencia 
      ? GERENCIA_ASSIGNABLE_ROLES 
      : COORDINADOR_ASSIGNABLE_ROLES;

  const rolePermissions = useMemo(() => permissions.filter(p => p.role === selectedRole), [permissions, selectedRole]);
  const otherUsers = users.filter(u => u.user_id !== deleteTarget?.user_id);

  if (isAuthorized === false) return <Navigate to="/dashboard" replace />;
  if (isAuthorized === null) return <div className="flex items-center justify-center min-h-[50vh]"><p>Verificando permisos...</p></div>;

  async function handleCreateUser() {
    if (!newEmail || !newPassword || !newFirstName || !newLastName) { toast.error('Todos los campos son obligatorios'); return; }
    if (newPassword.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    setCreating(true);

    // Get caller's company_id
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('user_id', session?.user?.id).maybeSingle();

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { email: newEmail.trim(), password: newPassword, first_name: newFirstName.trim(), last_name: newLastName.trim(), role: newRole, company_id: profile?.company_id },
    });

    if (error || data?.error) { handleEdgeError(data, error); setCreating(false); return; }
    toast.success('Usuario creado exitosamente');
    setShowCreateUser(false);
    setNewEmail(''); setNewPassword(''); setNewFirstName(''); setNewLastName(''); setNewRole('coordinador_mercadeo');
    setCreating(false);
    fetchUsers();
  }

  async function toggleUserActive(userId: string, currentActive: boolean) {
    const { error } = await supabase.from('profiles').update({ is_active: !currentActive }).eq('user_id', userId);
    if (error) { toast.error('Error al actualizar'); return; }
    toast.success(currentActive ? 'Usuario desactivado' : 'Usuario activado');
    fetchUsers();
  }

  function openEditUser(user: UserRow) {
    setEditTarget(user);
    const parts = user.full_name.split(' ');
    setEditFirstName(parts[0] || '');
    setEditLastName(parts.slice(1).join(' ') || '');
    setEditEmail(user.email);
    setEditRole(user.roles[0] || 'coordinador_mercadeo');
    setShowEditUser(true);
  }

  async function handleEditUser() {
    if (!editTarget || !editEmail.trim() || !editFirstName.trim() || !editLastName.trim()) { toast.error('Todos los campos son obligatorios'); return; }
    setEditing(true);
    const { data, error } = await supabase.functions.invoke('admin-edit-user', {
      body: { user_id: editTarget.user_id, email: editEmail.trim(), first_name: editFirstName.trim(), last_name: editLastName.trim(), role: editRole },
    });
    if (error || data?.error) { handleEdgeError(data, error); setEditing(false); return; }
    toast.success('Usuario actualizado');
    setShowEditUser(false); setEditTarget(null); setEditing(false);
    fetchUsers();
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { user_id: deleteTarget.user_id, transfer_to_user_id: transferUserId || null },
    });
    if (error || data?.error) { handleEdgeError(data, error); setDeleting(false); return; }
    toast.success('Usuario eliminado');
    setShowDeleteUser(false); setDeleteTarget(null); setDeleting(false);
    fetchUsers();
  }

  async function updatePermission(permId: string, field: string, value: boolean) {
    const { error } = await supabase.from('module_permissions').update({ [field]: value }).eq('id', permId);
    if (error) { toast.error('Error al actualizar permiso'); return; }
    setPermissions(prev => prev.map(p => p.id === permId ? { ...p, [field]: value } : p));
  }


  const actionLabels: Record<string, string> = {
    create_user: 'Creó usuario',
    edit_user: 'Editó usuario',
    deactivate_user: 'Desactivó usuario',
    activate_user: 'Activó usuario',
    delete_user: 'Eliminó usuario',
    export_data: 'Exportó datos',
    bulk_delete: 'Eliminación masiva',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="text-sm text-muted-foreground">Gestión de usuarios, permisos y auditoría</p>
      </div>

      {companyPlan && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Crown className="w-5 h-5" /> Tu Plan
              </CardTitle>
              <Badge
                className={`${
                  companyPlan.plan_id === 'enterprise' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                  companyPlan.plan_id === 'pro' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                  companyPlan.plan_id === 'starter' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                  'bg-muted text-muted-foreground border border-border'
                } gap-1`}
              >
                <Crown className="w-3 h-3" /> {companyPlan.display_name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold mb-2">Incluye</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {companyPlan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Usuarios</p>
                  <p className="font-semibold">
                    {companyPlan.active_user_count} de {companyPlan.max_seats} incluidos en tu plan
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Campaign Monitor</p>
                  {companyPlan.modules_included.includes('campaign_monitor') ? (
                    <p className="font-semibold">
                      Hasta {companyPlan.max_ad_connections} conexiones, sync cada {companyPlan.sync_interval_minutes} min
                    </p>
                  ) : (
                    <p className="font-semibold text-muted-foreground">No incluido en tu plan</p>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-3">
              Para cambiar de plan, contacta a Cohete en <a href="mailto:soporte@cohete-it.com" className="text-primary font-medium hover:underline">soporte@cohete-it.com</a>
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" /> Usuarios</TabsTrigger>
          {canCreateUsers && callerCompany && (
            <TabsTrigger value="invitations" className="gap-1.5"><Send className="w-4 h-4" /> Invitaciones</TabsTrigger>
          )}
          <TabsTrigger value="permissions" className="gap-1.5"><Shield className="w-4 h-4" /> Permisos</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="w-4 h-4" /> Auditoría</TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5"><Database className="w-4 h-4" /> Gestión de Datos</TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4">
          {canCreateUsers && (
            <div className="flex justify-end">
              <Button className="gap-2" variant="gradient" onClick={() => setShowCreateUser(true)}>
                <UserPlus className="w-4 h-4" /> Nuevo Usuario
              </Button>
            </div>
          )}

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUsers ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No hay usuarios</TableCell></TableRow>
                ) : users.map(u => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.length === 0 && <Badge variant="outline" className="text-xs">Sin rol</Badge>}
                        {u.roles.map(r => <Badge key={r} variant="secondary" className="text-xs capitalize">{ALL_ROLES.find(rl => rl.value === r)?.label || r}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                    {(() => {
                        // Determine if the current user can manage this user
                        const targetRoles = u.roles;
                        const isProtected = targetRoles.includes('super_admin');
                        const isGerenciaTarget = targetRoles.includes('gerencia');
                        const isContabilidadTarget = targetRoles.includes('admin_contabilidad');
                        const isCoordinadorTarget = targetRoles.includes('coordinador_mercadeo');
                        
                        // Super admin can manage everyone except other super_admins
                        // Gerencia can manage coordinador, contabilidad, analista (not gerencia or super_admin)
                        // Coordinador can only manage analista
                        let canManage = false;
                        if (callerIsSuperAdmin) canManage = !isProtected;
                        else if (callerIsGerencia) canManage = !isProtected && !isGerenciaTarget;
                        else if (callerIsCoordinador) canManage = targetRoles.includes('analista');
                        
                        if (!canManage) return <span className="text-xs text-muted-foreground">—</span>;
                        return (
                          <div className="flex gap-1.5">
                            <Button variant="outline" size="sm" className="text-xs" onClick={() => openEditUser(u)}><Pencil className="w-3.5 h-3.5" /></Button>
                            {canDeleteUsers && (
                              <>
                                <Button variant="outline" size="sm" className="text-xs" onClick={() => toggleUserActive(u.user_id, u.is_active)}>{u.is_active ? 'Desactivar' : 'Activar'}</Button>
                                <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => { setDeleteTarget(u); setShowDeleteUser(true); }}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* INVITATIONS TAB */}
        {canCreateUsers && callerCompany && (
          <TabsContent value="invitations" className="space-y-4">
            <Card className="p-4">
              <InvitationsManager
                companies={[callerCompany]}
                fixedCompanyId={callerCompany.id}
                availableRoles={ROLES}
              />
            </Card>
          </TabsContent>
        )}

        {/* PERMISSIONS TAB */}
        <TabsContent value="permissions" className="space-y-4">
          <div className="flex items-center gap-3">
            <Label>Rol:</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {editablePermissionRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Módulo</TableHead>
                  <TableHead className="text-center">Ver</TableHead>
                  <TableHead className="text-center">Crear</TableHead>
                  <TableHead className="text-center">Editar</TableHead>
                  <TableHead className="text-center">Eliminar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPerms ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : rolePermissions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin permisos configurados</TableCell></TableRow>
                ) : rolePermissions.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{MODULES.find(m => m.value === p.module)?.label || p.module}</TableCell>
                    <TableCell className="text-center"><Checkbox checked={p.can_view} onCheckedChange={(v) => updatePermission(p.id, 'can_view', !!v)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={p.can_create} onCheckedChange={(v) => updatePermission(p.id, 'can_create', !!v)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={p.can_edit} onCheckedChange={(v) => updatePermission(p.id, 'can_edit', !!v)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={p.can_delete} onCheckedChange={(v) => updatePermission(p.id, 'can_delete', !!v)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* AUDIT TAB */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAudit ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : auditLog.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin registros</TableCell></TableRow>
                ) : auditLog.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(entry.created_at).toLocaleString('es-CO')}</TableCell>
                    <TableCell className="font-medium">{entry.user_name || '—'}</TableCell>
                    <TableCell>{actionLabels[entry.action] || entry.action}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{entry.module || '—'}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{entry.details ? JSON.stringify(entry.details) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* DATA MANAGEMENT TAB */}
        <TabsContent value="data" className="space-y-4">
          <AdminDataManagement canDelete={callerIsSuperAdmin || callerIsGerencia} />
        </TabsContent>
      </Tabs>

      {/* CREATE USER DIALOG */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuevo Usuario</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nombre</Label><Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Apellido</Label><Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Contraseña</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUser(false)}>Cancelar</Button>
            <Button variant="gradient" onClick={handleCreateUser} disabled={creating}>{creating ? 'Creando...' : 'Crear Usuario'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT USER DIALOG */}
      <Dialog open={showEditUser} onOpenChange={setShowEditUser}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Usuario</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nombre</Label><Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Apellido</Label><Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditUser(false)}>Cancelar</Button>
            <Button variant="gradient" onClick={handleEditUser} disabled={editing}>{editing ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE USER DIALOG */}
      <Dialog open={showDeleteUser} onOpenChange={setShowDeleteUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Eliminar Usuario</DialogTitle>
            <DialogDescription>Se eliminará a <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.email}). Opcionalmente puedes transferir sus registros a otro usuario.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Transferir registros a:</Label>
            <Select value={transferUserId} onValueChange={setTransferUserId}>
              <SelectTrigger><SelectValue placeholder="No transferir (eliminar todo)" /></SelectTrigger>
              <SelectContent>
                {otherUsers.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name} ({u.email})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteUser(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting}>{deleting ? 'Eliminando...' : 'Eliminar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
