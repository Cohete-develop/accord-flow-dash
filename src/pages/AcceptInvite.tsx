import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { handleEdgeError } from "@/lib/friendly-errors";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

interface InvitePreview {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  company_name: string;
}

const ROLE_LABELS: Record<string, string> = {
  gerencia: "Gerencia",
  coordinador_mercadeo: "Coordinador de Mercadeo",
  admin_contabilidad: "Administración / Contabilidad",
  analista: "Analista",
  super_admin: "Super Admin",
};

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorCode("MISSING_TOKEN");
      setErrorMsg("Falta el token de invitación en la URL.");
      setLoading(false);
      return;
    }
    fetch(`${FUNCTIONS_BASE}/accept-invite?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setErrorCode(data.code || "UNKNOWN");
          setErrorMsg(data.error || "No se pudo validar la invitación");
        } else {
          setInvite(data.invite);
        }
      })
      .catch((e) => {
        setErrorCode("NETWORK");
        setErrorMsg(e.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        handleEdgeError(data, null);
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      toast.success("¡Cuenta activada! Redirigiendo al login...");
      setTimeout(() => navigate("/auth", { replace: true }), 2000);
    } catch (err) {
      handleEdgeError(null, err as Error);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="InfluXpert by Cohete" className="h-16 mx-auto mb-2" />
          <CardTitle className="text-xl">Activa tu cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Validando invitación...</p>
            </div>
          ) : errorCode ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="w-12 h-12 text-destructive" />
              <div>
                <p className="font-semibold">Invitación no válida</p>
                <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
                <p className="text-xs text-muted-foreground mt-2">Código: {errorCode}</p>
              </div>
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Ir al login
              </Button>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="font-semibold">¡Cuenta activada!</p>
              <p className="text-sm text-muted-foreground">Redirigiendo...</p>
            </div>
          ) : invite ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <CardDescription className="text-center -mt-2 mb-2">
                Bienvenido(a), <span className="font-semibold text-foreground">{invite.first_name} {invite.last_name}</span>.
                <br />
                Has sido invitado(a) a <span className="font-semibold text-foreground">{invite.company_name}</span> como <span className="font-semibold text-foreground">{ROLE_LABELS[invite.role] || invite.role}</span>.
              </CardDescription>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={invite.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Crea tu contraseña</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2">Confirma tu contraseña</Label>
                <Input id="pw2" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required />
              </div>
              <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
                {submitting ? "Activando..." : "Activar mi cuenta"}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}