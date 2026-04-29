import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import logo from "@/assets/logo.png";
import Footer from "@/components/Footer";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  if (user) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Verificar rol para redirigir según super_admin o usuario normal
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (userId) {
      // Pre-fetch en paralelo: rol + perfil para que el Layout pinte instantáneo
      await Promise.all([
        qc.prefetchQuery({
          queryKey: ["user_roles", userId],
          queryFn: async () => {
            const { data } = await supabase.from('user_roles')
              .select('role').eq('user_id', userId);
            return data || [];
          },
        }),
        qc.prefetchQuery({
          queryKey: ["user_profile", userId],
          queryFn: async () => {
            const { data } = await supabase.from('profiles')
              .select('company_id').eq('user_id', userId).maybeSingle();
            return data;
          },
        }),
      ]);
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle();
      navigate(roleData ? "/super-admin/tenants" : "/dashboard", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="InfluXpert by Cohete" className="h-16 mx-auto mb-2" />
          <CardDescription>Inicia sesión en tu cuenta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Cargando..." : "Iniciar Sesión"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full text-sm text-muted-foreground"
              onClick={async () => {
                if (!email.trim()) {
                  toast({ title: "Ingresa tu email", description: "Escribe tu correo para recuperar la contraseña", variant: "destructive" });
                  return;
                }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) {
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                } else {
                  toast({ title: "Correo enviado", description: "Revisa tu bandeja de entrada para restablecer tu contraseña" });
                }
              }}
            >
              ¿Olvidaste tu contraseña?
            </Button>
          </form>
        </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
