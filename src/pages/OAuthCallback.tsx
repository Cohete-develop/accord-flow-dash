import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type Status = "processing" | "success" | "error";

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState<string>("Procesando autorización...");
  const [accountName, setAccountName] = useState<string>("");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    const oauthErrorDesc = params.get("error_description");

    if (oauthError) {
      setStatus("error");
      setMessage(
        oauthError === "access_denied"
          ? "Cancelaste la autorización. No se conectó ninguna cuenta."
          : oauthErrorDesc || `Google devolvió un error: ${oauthError}`
      );
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setMessage("Faltan parámetros del callback (code o state).");
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("campaign-oauth-callback", {
          body: { code, state },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);

        const acctName = (data as any)?.account_name || (data as any)?.account_id || "Cuenta conectada";
        setAccountName(acctName);
        setStatus("success");
        setMessage("¡Cuenta conectada exitosamente!");

        setTimeout(() => {
          navigate("/campaign-monitor?tab=conexiones", { replace: true });
        }, 2000);
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message || "Error al conectar la cuenta. Intenta de nuevo.");
      }
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Conectando Google Ads</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          {status === "processing" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-center text-muted-foreground">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <div className="text-center space-y-1">
                <p className="font-medium">{message}</p>
                {accountName && (
                  <p className="text-sm text-muted-foreground">{accountName}</p>
                )}
                <p className="text-xs text-muted-foreground pt-2">
                  Redirigiendo a Campaign Monitor...
                </p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-destructive">{message}</p>
              <Button
                onClick={() => navigate("/campaign-monitor?tab=conexiones", { replace: true })}
                className="mt-2"
              >
                Volver a Campaign Monitor
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}