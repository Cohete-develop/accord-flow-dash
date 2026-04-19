# 🏢 Guía Multi-Tenant de InfluXpert

Este documento es **obligatorio** para cualquier desarrollador (humano o IA) que agregue un módulo nuevo, una tabla nueva o una funcionalidad que toque datos en InfluXpert.

InfluXpert es una plataforma **multi-tenant basada en dominio corporativo**: cada empresa (tenant) se identifica por su dominio de email (ej: `groupeseb.com`). Todos los usuarios cuyo email pertenece a ese dominio operan dentro de esa empresa, completamente aislados de otras empresas.

---

## 📐 Arquitectura

| Concepto | Implementación |
|---|---|
| Tenant | Tabla `companies` (con campo `domain` único) |
| Membresía usuario↔tenant | Tabla `profiles` (`company_id`, `member_role`, `member_status`) |
| Permisos finos por rol | Tabla `user_roles` (enum `app_role`) |
| Invitaciones | Tabla `invitations` (con validación de dominio por trigger) |
| Dominios públicos bloqueados | Tabla `blocked_domains` |
| Dueño de plataforma (Cohete) | Rol `super_admin` SIN `company_id` (cross-tenant) |

### Mapeo de roles
| `app_role` (legacy) | `member_role` (multi-tenant) |
|---|---|
| `gerencia` | `owner` |
| `coordinador_mercadeo` | `admin` |
| `analista`, `admin_contabilidad` | `member` |
| `super_admin` | (sin organización — plataforma) |

---

## ✅ Checklist obligatorio para CADA tabla nueva

Si la tabla almacena datos de negocio que pertenecen a una empresa:

1. **Columna `company_id`**:
   ```sql
   company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE
   ```
2. **Índice en `company_id`**:
   ```sql
   CREATE INDEX idx_<tabla>_company_id ON public.<tabla>(company_id);
   ```
3. **RLS activado**:
   ```sql
   ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;
   ```
4. **Las 4 policies estándar de aislamiento**:
   ```sql
   CREATE POLICY "Users view <tabla> by company"
     ON public.<tabla> FOR SELECT
     USING (company_id = public.get_user_company_id(auth.uid()));

   CREATE POLICY "Users insert <tabla> with company"
     ON public.<tabla> FOR INSERT
     WITH CHECK (
       auth.uid() = user_id
       AND company_id = public.get_user_company_id(auth.uid())
     );

   CREATE POLICY "Users update <tabla> by company"
     ON public.<tabla> FOR UPDATE
     USING (company_id = public.get_user_company_id(auth.uid()));

   CREATE POLICY "Users delete <tabla> by company"
     ON public.<tabla> FOR DELETE
     USING (company_id = public.get_user_company_id(auth.uid()));
   ```
5. **Policy de super_admin (Cohete)**:
   ```sql
   CREATE POLICY "Super admin full access <tabla>"
     ON public.<tabla> FOR ALL
     USING (public.has_role(auth.uid(), 'super_admin'))
     WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
   ```

---

## ✅ Checklist obligatorio para CADA query desde el frontend

- ❌ **NUNCA** hagas `supabase.from('tabla').select('*')` sin confiar en RLS o sin filtrar por `company_id` explícitamente.
- ✅ Usa el hook `useCrmData` cuando se trate de los módulos centrales (Acuerdos, Pagos, Entregables, KPIs).
- ✅ El filtro por `company_id` ocurre automáticamente vía RLS — NO hardcodees `company_id` en el cliente.
- ✅ En `INSERT`, siempre setea `user_id = auth.uid()` y deja que RLS valide `company_id`.
- ❌ **NUNCA** expongas `company_id` de otras empresas en la UI ni en logs.

---

## ✅ Checklist obligatorio para CADA Edge Function

- Validar JWT con `supabase.auth.getClaims(token)`.
- Usar el cliente con header `Authorization` del caller para que RLS aplique automáticamente.
- Si necesitas service role, **valida explícitamente** que el caller tenga `company_id` correcto antes de operar.
- Si la función crea/invita/asocia usuarios, **valida que el dominio del email coincida con el de la company**:
  ```ts
  const emailDomain = email.split('@')[1].toLowerCase();
  const { data: company } = await admin.from('companies')
    .select('domain').eq('id', company_id).single();
  if (company.domain !== emailDomain) throw new Error('Dominio no coincide');
  ```
- Si la función crea organizaciones desde un email, valida que el dominio NO esté en `blocked_domains`.

---

## ✅ Checklist obligatorio para creación de usuarios

- Solo `gerencia` o `super_admin` pueden crear usuarios (no hay self-signup).
- El email del nuevo usuario **DEBE** tener el dominio de la company donde se crea (validado en `admin-create-user`).
- Las invitaciones expiran a 7 días por defecto.
- Máximo de licencias controlado por `companies.max_seats`.

---

## ✅ Permisos por rol (UI)

Próximamente: hook `usePermissions()` que expone:
- `canManageTeam()` → owner / admin
- `canEditAcuerdos()` / `canEditPagos()` / `canEditEntregables()` / `canEditKpis()` → owner / admin / member
- `canViewDashboard()` / `canViewKpis()` → todos
- `canManageBilling()` / `canDeleteOrganization()` → solo owner

Hasta que exista, sigue usando `has_role()` con el enum `app_role` actual.

---

## 🚫 Reglas innegociables

1. **Nunca** desactives RLS en una tabla con datos de tenants.
2. **Nunca** crees una tabla de negocio sin `company_id`.
3. **Nunca** permitas que un usuario tenga email de un dominio distinto al de su company.
4. **Nunca** permitas que se creen empresas con dominios listados en `blocked_domains`.
5. **Nunca** confíes solo en filtros del cliente — RLS es la última línea de defensa.
6. **Nunca** expongas datos cross-tenant fuera de los flujos explícitos del rol `super_admin`.

---

## 📚 Funciones helper disponibles

| Función | Qué hace |
|---|---|
| `public.get_user_company_id(_user_id uuid)` | Devuelve el `company_id` del usuario |
| `public.get_user_email_domain()` | Devuelve el dominio del email del usuario actual |
| `public.has_role(_user_id uuid, _role app_role)` | Verifica si el usuario tiene un rol |
| `public.is_protected_user(_user_id uuid)` | True si el usuario es super_admin (no se puede borrar) |
| `public.validate_invitation_domain()` | Trigger que valida dominio en `invitations` |

---

_Última actualización: migración multi-tenant fase 1 (modelo de datos basado en dominio)._