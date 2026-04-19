import { toast } from "sonner";

/**
 * Mapa de códigos de error → mensaje amigable + sugerencia de acción.
 * Los códigos pueden venir del backend (edge functions) en el campo `code`,
 * o se infieren desde el texto del error como fallback.
 */
type FriendlyEntry = { title: string; hint: string };

const FRIENDLY_MAP: Record<string, FriendlyEntry> = {
  EMAIL_ALREADY_REGISTERED: {
    title: "Este correo ya está registrado",
    hint: "Usa un correo distinto o, si el usuario ya existe, edítalo desde la lista de usuarios en lugar de crearlo de nuevo.",
  },
  WEAK_PASSWORD: {
    title: "La contraseña es muy débil",
    hint: "Usa al menos 6 caracteres combinando letras y números.",
  },
  INVALID_EMAIL: {
    title: "Correo inválido",
    hint: "Verifica que el correo tenga el formato nombre@dominio.com.",
  },
  DOMAIN_MISMATCH: {
    title: "El dominio del correo no coincide con la empresa",
    hint: "El correo debe terminar en el mismo dominio configurado para la empresa destino.",
  },
  PUBLIC_DOMAIN_BLOCKED: {
    title: "Dominio público no permitido",
    hint: "Usa un correo corporativo (no Gmail, Hotmail, Yahoo, etc.).",
  },
  PLATFORM_DOMAIN_RESERVED: {
    title: "Dominio reservado para la plataforma",
    hint: "Solo super_admins pueden tener este dominio. Usa el dominio corporativo del cliente.",
  },
  MISSING_FIELDS: {
    title: "Faltan campos obligatorios",
    hint: "Completa todos los campos antes de continuar.",
  },
  FORBIDDEN: {
    title: "No tienes permisos para esta acción",
    hint: "Contacta a un administrador si crees que deberías poder hacerlo.",
  },
  NOT_AUTHENTICATED: {
    title: "Tu sesión expiró",
    hint: "Cierra sesión y vuelve a entrar.",
  },
  COMPANY_DOMAIN_MISSING: {
    title: "La empresa no tiene dominio configurado",
    hint: "Asigna un dominio a la empresa desde Super Admin antes de crear usuarios.",
  },
  SUPER_ADMIN_NEEDS_NO_COMPANY: {
    title: "Los super_admin no se asocian a empresas",
    hint: "Deja el campo de empresa vacío al crear un super_admin.",
  },
  SUPER_ADMIN_REQUIRES_PLATFORM_DOMAIN: {
    title: "Rol super_admin solo para dominio plataforma",
    hint: "Asigna otro rol o usa un correo del dominio plataforma.",
  },
  PLATFORM_DOMAIN_NEEDS_SUPER_ADMIN: {
    title: "Este dominio requiere rol super_admin",
    hint: "Cambia el rol a super_admin para correos del dominio plataforma.",
  },
  UNKNOWN: {
    title: "Ocurrió un error inesperado",
    hint: "Intenta nuevamente. Si persiste, contacta a soporte.",
  },
};

/** Inferir código desde texto crudo (Supabase, Postgres, etc.) */
function inferCode(rawMessage: string): string {
  const m = rawMessage.toLowerCase();
  if (m.includes("already been registered") || m.includes("already registered") || m.includes("already exists")) return "EMAIL_ALREADY_REGISTERED";
  if (m.includes("password") && (m.includes("weak") || m.includes("at least") || m.includes("6 characters"))) return "WEAK_PASSWORD";
  if (m.includes("invalid email") || m.includes("email inválido")) return "INVALID_EMAIL";
  if (m.includes("dominio del email") || m.includes("dominio @")) return "DOMAIN_MISMATCH";
  if (m.includes("público y no se permite") || m.includes("público y no puede usarse")) return "PUBLIC_DOMAIN_BLOCKED";
  if (m.includes("reservado para la plataforma")) return "PLATFORM_DOMAIN_RESERVED";
  if (m.includes("faltan campos")) return "MISSING_FIELDS";
  if (m.includes("no tienes permisos") || m.includes("solo gerencia") || m.includes("solo puedes crear")) return "FORBIDDEN";
  if (m.includes("not authenticated") || m.includes("no authorization")) return "NOT_AUTHENTICATED";
  if (m.includes("no tiene dominio configurado")) return "COMPANY_DOMAIN_MISSING";
  if (m.includes("super_admin no pueden estar asociados")) return "SUPER_ADMIN_NEEDS_NO_COMPANY";
  if (m.includes("super_admin solo se asigna")) return "SUPER_ADMIN_REQUIRES_PLATFORM_DOMAIN";
  if (m.includes("deben tener rol super_admin")) return "PLATFORM_DOMAIN_NEEDS_SUPER_ADMIN";
  return "UNKNOWN";
}

export interface FriendlyErrorInput {
  /** Código explícito devuelto por el backend (preferido). */
  code?: string;
  /** Mensaje crudo, usado como fallback para inferir código y como detalle. */
  rawMessage?: string;
  /** Hint personalizado que sobreescribe el del mapa. */
  hint?: string;
}

export function showFriendlyError(input: FriendlyErrorInput | string) {
  const normalized: FriendlyErrorInput =
    typeof input === "string" ? { rawMessage: input } : input;
  const raw = normalized.rawMessage || "";
  const code = normalized.code || inferCode(raw);
  const entry = FRIENDLY_MAP[code] || FRIENDLY_MAP.UNKNOWN;
  const hint = normalized.hint || entry.hint;

  toast.error(entry.title, {
    description: `${hint}\n\nCódigo: ${code}${raw && code === "UNKNOWN" ? ` · ${raw}` : ""}`,
    duration: 7000,
  });
}

/** Helper para respuestas de edge functions: { error?, code? } */
export function handleEdgeError(
  data: { error?: string; code?: string } | null | undefined,
  error: { message?: string } | null | undefined,
  fallbackHint?: string,
) {
  const code = data?.code;
  const rawMessage = data?.error || error?.message || "";
  showFriendlyError({ code, rawMessage, hint: fallbackHint });
}