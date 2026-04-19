import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Building2, Users, Plus, Pencil, Trash2, UserPlus, Eye, ScrollText } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { handleEdgeError } from '@/lib/friendly-errors';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface Company {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_active: boolean;
  created_at: string;
  logo_url: string | null;
  user_count?: number;
  active_user_count?: number;
  max_seats?: number;
}

interface CompanyUser {
  user_id: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  roles: string[];
  company_name?: string;
}

interface AuditEntry {
  id: string;
  user_name: string;
  action: string;
  module: string;
  details: any;
  created_at: string;
}

const ROLES = [
  { value: 'gerencia', label: 'Gerencia' },
  { value: 'coordinador_mercadeo', label: 'Coordinador de Mercadeo' },
  { value: 'admin_contabilidad', label: 'Administración / Contabilidad' },
  { value: 'analista', label: 'Analista' },
];

export default function SuperAdminPage() {
  const { session, user } = useAuth();
  const [tab, setTab] = useState('companies');
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  // Companies
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanySlug, setNewCompanySlug] = useState('');
  const [newCompanyDomain, setNewCompanyDomain] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);

  // Company users view
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [loadingCompanyUsers, setLoadingCompanyUsers] = useState(false);

  // Create user for company
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [targetCompany, setTargetCompany] = useState<Company | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newRole, setNewRole] = useState('gerencia');
  const [creating, setCreating] = useState(false);

  // All users
  const [allUsers, setAllUsers] = useState<CompanyUser[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(true);

  // Audit
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);

  // Delete company
  const [showDeleteCompany, setShowDeleteCompany] = useState(false);
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState(false);

  // Edit user
  const [showEditUser, setShowEditUser] = useState(false);
  const [editUser, setEditUser] = useState<CompanyUser | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete user
  const [showDeleteUser, setShowDeleteUser] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<CompanyUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Edit licencias (max_seats)
  const [showEditSeats, setShowEditSeats] = useState(false);
  const [seatsTarget, setSeatsTarget] = useState<Company | null>(null);
  const [seatsValue, setSeatsValue] = useState<number>(5);
  const [savingSeats, setSavingSeats] = useState(false);

  useEffect(() => {
    if (!user) return;
    // super_admin must also NOT belong to any company (platform owner only)
    Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin'),
      supabase.from('profiles').select('company_id').eq('user_id', user.id).maybeSingle(),
    ]).then(([rolesRes, profileRes]) => {
      const hasSuperAdminRole = (rolesRes.data || []).length > 0;
      const hasNoCompany = !profileRes.data?.company_id;
      setIsSuperAdmin(hasSuperAdminRole && hasNoCompany);
    });
  }, [user]);

  const fetchCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    const { data: companiesData } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    const { data: profilesData } = await supabase.from('profiles').select('company_id, is_active');

    const countMap: Record<string, number> = {};
    const activeMap: Record<string, number> = {};
    (profilesData || []).forEach(p => {
      if (!p.company_id) return;
      countMap[p.company_id] = (countMap[p.company_id] || 0) + 1;
      if (p.is_active) activeMap[p.company_id] = (activeMap[p.company_id] || 0) + 1;
    });

    setCompanies((companiesData || []).map(c => ({
      ...c,
      user_count: countMap[c.id] || 0,
      active_user_count: activeMap[c.id] || 0,
    })));
    setLoadingCompanies(false);
  }, []);

  const fetchAllUsers = useCallback(async () => {
    setLoadingAllUsers(true);
    const [profRes, rolesRes, companiesRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, first_name, last_name, email, is_active, company_id'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('companies').select('id, name'),
    ]);
    const rolesMap: Record<string, string[]> = {};
    (rolesRes.data || []).forEach(r => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });
    const companyMap: Record<string, string> = {};
    (companiesRes.data || []).forEach(c => { companyMap[c.id] = c.name; });

    setAllUsers((profRes.data || []).map(p => ({
      user_id: p.user_id,
      email: p.email || '',
      full_name: p.full_name || '',
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      is_active: p.is_active ?? true,
      roles: rolesMap[p.user_id] || [],
      company_name: p.company_id ? companyMap[p.company_id] || 'Sin empresa' : 'Sin empresa',
    })));
    setLoadingAllUsers(false);
  }, []);

  const fetchAudit = useCallback(async () => {
    setLoadingAudit(true);
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
    setAuditLog((data || []) as AuditEntry[]);
    setLoadingAudit(false);
  }, []);

  useEffect(() => { 
    if (isSuperAdmin) { fetchCompanies(); fetchAllUsers(); fetchAudit(); }
  }, [isSuperAdmin, fetchCompanies, fetchAllUsers, fetchAudit]);

  if (isSuperAdmin === false) return <Navigate to="/dashboard" replace />;
  if (isSuperAdmin === null) return <div className="flex items-center justify-center min-h-[50vh]"><p>Verificando permisos...</p></div>;

  async function fetchCompanyUsers(company: Company) {
    setSelectedCompany(company);
    setLoadingCompanyUsers(true);
    const [profRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, first_name, last_name, email, is_active').eq('company_id', company.id),
      supabase.from('user_roles').select('user_id, role'),
    ]);
    const rolesMap: Record<string, string[]> = {};
    (rolesRes.data || []).forEach(r => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });
    setCompanyUsers((profRes.data || []).map(p => ({
      user_id: p.user_id,
      email: p.email || '',
      full_name: p.full_name || '',
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      is_active: p.is_active ?? true,
      roles: rolesMap[p.user_id] || [],
    })));
    setLoadingCompanyUsers(false);
  }

  async function handleCreateCompany() {
    if (!newCompanyName.trim() || !newCompanySlug.trim() || !newCompanyDomain.trim()) {
      toast.error('Nombre, slug y dominio son obligatorios');
      return;
    }
    const domain = newCompanyDomain.trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
      toast.error('Dominio inválido. Ejemplo: empresa.com');
      return;
    }
    setCreatingCompany(true);
    const { error } = await supabase.from('companies').insert({
      name: newCompanyName.trim(),
      slug: newCompanySlug.trim().toLowerCase(),
      domain,
    });
    if (error) { toast.error(`Error: ${error.message}`); setCreatingCompany(false); return; }
    toast.success('Empresa creada exitosamente');
    setShowCreateCompany(false);
    setNewCompanyName(''); setNewCompanySlug(''); setNewCompanyDomain('');
    setCreatingCompany(false);
    fetchCompanies();

    await supabase.from('audit_log').insert({
      user_id: session?.user?.id,
      user_name: session?.user?.user_metadata?.full_name || session?.user?.email || '',
      action: 'create_company',
      module: 'super_admin',
      details: { company_name: newCompanyName.trim(), domain },
    });
  }

  async function toggleCompanyActive(company: Company) {
    const { error } = await supabase.from('companies').update({ is_active: !company.is_active }).eq('id', company.id);
    if (error) { toast.error('Error al actualizar'); return; }
    toast.success(company.is_active ? 'Empresa desactivada' : 'Empresa activada');
    fetchCompanies();
  }

  function openCreateUserForCompany(company: Company) {
    setTargetCompany(company);
    setNewEmail(''); setNewPassword(''); setNewFirstName(''); setNewLastName(''); setNewRole('gerencia');
    setShowCreateUser(true);
  }

  async function handleCreateUser() {
    if (!newEmail || !newPassword || !newFirstName || !newLastName || !targetCompany) { toast.error('Todos los campos son obligatorios'); return; }
    if (newPassword.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    setCreating(true);

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { email: newEmail.trim(), password: newPassword, first_name: newFirstName.trim(), last_name: newLastName.trim(), role: newRole, company_id: targetCompany.id },
    });

    if (error || data?.error) { handleEdgeError(data, error); setCreating(false); return; }
    toast.success(`Usuario creado para ${targetCompany.name}`);
    setShowCreateUser(false);
    setCreating(false);
    fetchCompanies();
    fetchAllUsers();
    if (selectedCompany?.id === targetCompany.id) fetchCompanyUsers(targetCompany);
  }

  const actionLabels: Record<string, string> = {
    create_user: 'Creó usuario', edit_user: 'Editó usuario', deactivate_user: 'Desactivó usuario',
    activate_user: 'Activó usuario', delete_user: 'Eliminó usuario', export_data: 'Exportó datos',
    bulk_delete: 'Eliminación masiva', create_company: 'Creó empresa', delete_company: 'Eliminó empresa',
  };

  function confirmDeleteCompany(company: Company) {
    setDeleteCompanyTarget(company);
    setShowDeleteCompany(true);
  }

  async function handleDeleteCompany() {
    if (!deleteCompanyTarget) return;
    setDeletingCompany(true);
    const { data, error } = await supabase.functions.invoke('admin-delete-company', {
      body: { company_id: deleteCompanyTarget.id },
    });
    if (error || data?.error) { handleEdgeError(data, error); setDeletingCompany(false); return; }
    toast.success(`Empresa "${deleteCompanyTarget.name}" eliminada con ${data.deleted_users} usuario(s)`);
    setShowDeleteCompany(false);
    setDeleteCompanyTarget(null);
    setDeletingCompany(false);
    fetchCompanies();
    fetchAllUsers();
    fetchAudit();
  }
  function openEditUser(u: CompanyUser) {
    setEditUser(u);
    setEditFirstName(u.first_name);
    setEditLastName(u.last_name);
    setEditEmail(u.email);
    setEditEmail(u.email);
    setEditRole(u.roles[0] || 'analista');
    setShowEditUser(true);
  }

  async function handleEditUser() {
    if (!editUser) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-edit-user', {
      body: { user_id: editUser.user_id, email: editEmail.trim(), first_name: editFirstName.trim(), last_name: editLastName.trim(), role: editRole },
    });
    if (error || data?.error) { toast.error(data?.error || error?.message || 'Error al editar'); setSaving(false); return; }
    toast.success('Usuario actualizado');
    setShowEditUser(false);
    setSaving(false);
    if (selectedCompany) fetchCompanyUsers(selectedCompany);
    fetchAllUsers();
  }

  async function handleToggleUserActive(u: CompanyUser) {
    const newActive = !u.is_active;
    const { error } = await supabase.from('profiles').update({ is_active: newActive }).eq('user_id', u.user_id);
    if (error) { toast.error('Error al cambiar estado'); return; }
    toast.success(newActive ? 'Usuario activado' : 'Usuario desactivado');
    await supabase.from('audit_log').insert({
      user_id: session?.user?.id,
      user_name: session?.user?.user_metadata?.full_name || session?.user?.email || '',
      action: newActive ? 'activate_user' : 'deactivate_user',
      module: 'super_admin',
      details: { target_user: u.email },
    });
    if (selectedCompany) fetchCompanyUsers(selectedCompany);
    fetchAllUsers();
  }

  function confirmDeleteUser(u: CompanyUser) {
    setDeleteUserTarget(u);
    setShowDeleteUser(true);
  }

  async function handleDeleteUser() {
    if (!deleteUserTarget) return;
    setDeletingUser(true);
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { user_id: deleteUserTarget.user_id },
    });
    if (error || data?.error) { toast.error(data?.error || error?.message || 'Error al eliminar'); setDeletingUser(false); return; }
    toast.success('Usuario eliminado');
    setShowDeleteUser(false);
    setDeleteUserTarget(null);
    setDeletingUser(false);
    if (selectedCompany) fetchCompanyUsers(selectedCompany);
    fetchCompanies();
    fetchAllUsers();
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Panel Super Admin</h1>
        <p className="text-sm text-muted-foreground">Gestión global de empresas clientes y usuarios</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="companies" className="gap-1.5"><Building2 className="w-4 h-4" /> Empresas</TabsTrigger>
          <TabsTrigger value="all-users" className="gap-1.5"><Users className="w-4 h-4" /> Todos los Usuarios</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="w-4 h-4" /> Auditoría Global</TabsTrigger>
        </TabsList>

        {/* COMPANIES TAB */}
        <TabsContent value="companies" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="gradient" className="gap-2" onClick={() => setShowCreateCompany(true)}>
              <Plus className="w-4 h-4" /> Nueva Empresa
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loadingCompanies ? (
              <p className="text-muted-foreground col-span-full text-center py-8">Cargando empresas...</p>
            ) : companies.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8">No hay empresas registradas</p>
            ) : companies.map(company => (
              <Card key={company.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{company.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">/{company.slug}</p>
                      {company.domain ? (
                        <p className="text-xs font-medium text-primary mt-1">@{company.domain}</p>
                      ) : (
                        <p className="text-xs text-destructive mt-1">⚠ Sin dominio</p>
                      )}
                    </div>
                    <Badge className={company.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                      {company.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(() => {
                    const active = company.active_user_count ?? 0;
                    const total = company.user_count ?? 0;
                    const seats = company.max_seats ?? 0;
                    const pct = seats > 0 ? Math.min(100, (active / seats) * 100) : 0;
                    const nearLimit = seats > 0 && active / seats >= 0.8;
                    const atLimit = seats > 0 && active >= seats;
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="w-4 h-4" />
                            <span>Usuarios activos</span>
                          </div>
                          <span className={`font-semibold tabular-nums ${atLimit ? 'text-destructive' : nearLimit ? 'text-amber-600' : 'text-foreground'}`}>
                            {active} / {seats}
                          </span>
                        </div>
                        <Progress value={pct} className={`h-2 ${atLimit ? '[&>div]:bg-destructive' : nearLimit ? '[&>div]:bg-amber-500' : ''}`} />
                        {total > active && (
                          <p className="text-xs text-muted-foreground">{total - active} inactivo(s) · {total} total</p>
                        )}
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground">
                    Creada: {new Date(company.created_at).toLocaleDateString('es-CO')}
                  </p>
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => fetchCompanyUsers(company)}>
                      <Eye className="w-3.5 h-3.5" /> Ver Usuarios
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => openCreateUserForCompany(company)}>
                      <UserPlus className="w-3.5 h-3.5" /> Agregar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggleCompanyActive(company)}>
                      {company.is_active ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => confirmDeleteCompany(company)}>
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Company users panel */}
          {selectedCompany && (
            <Card className="mt-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Usuarios de {selectedCompany.name}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCompany(null)}>Cerrar</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingCompanyUsers ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                    ) : companyUsers.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin usuarios</TableCell></TableRow>
                    ) : companyUsers.map(u => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {u.roles.map(r => <Badge key={r} variant="secondary" className="text-xs capitalize">{ROLES.find(rl => rl.value === r)?.label || r}</Badge>)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                            {u.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openEditUser(u)} title="Editar"><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleUserActive(u)} title={u.is_active ? 'Desactivar' : 'Activar'}>
                              {u.is_active ? '🔒' : '🔓'}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => confirmDeleteUser(u)} title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ALL USERS TAB */}
        <TabsContent value="all-users" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAllUsers ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Cargando...</TableCell></TableRow>
                ) : allUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin usuarios</TableCell></TableRow>
                ) : allUsers.map(u => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{u.company_name}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map(r => <Badge key={r} variant="secondary" className="text-xs capitalize">{ROLES.find(rl => rl.value === r)?.label || r}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openEditUser(u)} title="Editar"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleUserActive(u)} title={u.is_active ? 'Desactivar' : 'Activar'}>
                          {u.is_active ? '🔒' : '🔓'}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => confirmDeleteUser(u)} title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
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
      </Tabs>

      {/* CREATE COMPANY DIALOG */}
      <Dialog open={showCreateCompany} onOpenChange={setShowCreateCompany}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Empresa Cliente</DialogTitle>
            <DialogDescription>El dominio corporativo es la clave del aislamiento entre empresas. Solo usuarios con email de ese dominio podrán pertenecer a esta empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la empresa</Label>
              <Input value={newCompanyName} onChange={e => { setNewCompanyName(e.target.value); setNewCompanySlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')); }} placeholder="Japani Racer" />
            </div>
            <div className="space-y-2">
              <Label>Slug (identificador URL)</Label>
              <Input value={newCompanySlug} onChange={e => setNewCompanySlug(e.target.value)} placeholder="japani-racer" />
            </div>
            <div className="space-y-2">
              <Label>Dominio corporativo <span className="text-destructive">*</span></Label>
              <Input
                value={newCompanyDomain}
                onChange={e => setNewCompanyDomain(e.target.value)}
                placeholder="japaniracer.com"
              />
              <p className="text-xs text-muted-foreground">Sin @ ni https://. Ej: <code className="text-xs bg-muted px-1 rounded">groupeseb.com</code>. No se permiten dominios públicos (gmail, hotmail, etc.) ni el dominio de la plataforma.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCompany(false)}>Cancelar</Button>
            <Button variant="gradient" onClick={handleCreateCompany} disabled={creatingCompany}>{creatingCompany ? 'Creando...' : 'Crear Empresa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE USER FOR COMPANY DIALOG */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Usuario para {targetCompany?.name}</DialogTitle>
            <DialogDescription>
              {targetCompany?.domain
                ? <>El email debe ser del dominio <strong>@{targetCompany.domain}</strong>.</>
                : <span className="text-destructive">⚠ Esta empresa no tiene dominio configurado. Edítala primero.</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nombre <span className="text-destructive">*</span></Label><Input value={newFirstName} onChange={e => setNewFirstName(e.target.value)} required placeholder="Nombre" /></div>
              <div className="space-y-2"><Label>Apellido <span className="text-destructive">*</span></Label><Input value={newLastName} onChange={e => setNewLastName(e.target.value)} required placeholder="Apellido" /></div>
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                placeholder={targetCompany?.domain ? `nombre@${targetCompany.domain}` : 'correo@empresa.com'}
              />
            </div>
            <div className="space-y-2"><Label>Contraseña <span className="text-destructive">*</span></Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" /></div>
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

      {/* DELETE COMPANY CONFIRMATION */}
      <AlertDialog open={showDeleteCompany} onOpenChange={setShowDeleteCompany}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empresa "{deleteCompanyTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es <strong>irreversible</strong>. Se eliminarán permanentemente:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Todos los usuarios de la empresa</li>
                <li>Todos los acuerdos, pagos, entregables y KPIs</li>
                <li>Todo el historial de auditoría relacionado</li>
                <li>La empresa misma</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCompany}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCompany}
              disabled={deletingCompany}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingCompany ? 'Eliminando...' : 'Sí, eliminar todo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* EDIT USER DIALOG */}
      <Dialog open={showEditUser} onOpenChange={setShowEditUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>Modifica los datos del usuario {editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nombre</Label><Input value={editFirstName} onChange={e => setEditFirstName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Apellido</Label><Input value={editLastName} onChange={e => setEditLastName(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} /></div>
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
            <Button variant="gradient" onClick={handleEditUser} disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cambios'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE USER CONFIRMATION */}
      <AlertDialog open={showDeleteUser} onOpenChange={setShowDeleteUser}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario "{deleteUserTarget?.full_name || deleteUserTarget?.email}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la cuenta del usuario, su perfil y todos sus roles. Los datos de negocio asociados se mantendrán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deletingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingUser ? 'Eliminando...' : 'Sí, eliminar usuario'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
