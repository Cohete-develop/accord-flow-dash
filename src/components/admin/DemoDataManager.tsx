import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Database, Trash2, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function DemoDataManager() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [demoCount, setDemoCount] = useState(0);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();
      setIsSuperAdmin(!!role);

      const { data: imp } = await supabase.rpc('get_active_impersonation', {
        _user_id: user.id,
      });
      setImpersonating((imp as string) || null);
    };
    check();
  }, [user]);

  useEffect(() => {
    if (!impersonating) return;
    const loadCount = async () => {
      const { count } = await supabase
        .from('acuerdos')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', impersonating)
        .eq('is_demo_data', true);
      setDemoCount(count || 0);
    };
    loadCount();
  }, [impersonating, working]);

  if (!isSuperAdmin || !impersonating) return null;

  const handleGenerate = async () => {
    setWorking(true);
    const { data, error } = await supabase.functions.invoke('generate-demo-data', {
      body: {},
    });
    setWorking(false);

    if (error) {
      toast.error(`Error: ${error.message}`);
      return;
    }
    const summary = (data as any)?.summary;
    toast.success(
      summary
        ? `Datos demo generados — Acuerdos: ${summary.acuerdos}, Pagos: ${summary.pagos}, Entregables: ${summary.entregables}, KPIs: ${summary.kpis}`
        : 'Datos demo generados',
    );
  };

  const handleClear = async () => {
    setWorking(true);
    const { error } = await supabase.functions.invoke('clear-demo-data', {
      body: {},
    });
    setWorking(false);

    if (error) {
      toast.error(`Error: ${error.message}`);
      return;
    }
    toast.success('Datos demo eliminados');
  };

  return (
    <Card className="border-dashed border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Database className="w-5 h-5" /> Datos Demo (Solo Super Admin)
        </CardTitle>
        <CardDescription>
          Genera o elimina datos de prueba para este tenant. Útil para demostraciones comerciales.
          Los datos demo están marcados con <code className="text-xs">is_demo_data = true</code> y
          se borran con un solo clic sin tocar datos reales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Registros demo actuales: <span className="font-semibold text-foreground">{demoCount}</span>{' '}
          acuerdos (y sus pagos, entregables y KPIs asociados).
        </div>

        <div className="flex flex-wrap gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={working} className="gap-2">
                <Sparkles className="w-4 h-4" /> Generar datos demo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Generar datos demo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se crearán 5 acuerdos, 15 pagos, 10 entregables y 20 KPIs con datos ficticios.
                  Si el tenant tiene plan premium, también se sembrarán 2 campañas con 30 días de
                  métricas. Todos los datos quedarán marcados como demo y podrás eliminarlos
                  después.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleGenerate}>Generar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {demoCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={working} className="gap-2">
                  <Trash2 className="w-4 h-4" /> Limpiar datos demo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" /> ¿Eliminar todos los datos demo?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán TODOS los registros marcados como demo de este tenant. Los datos
                    reales del cliente no serán afectados. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClear}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sí, eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}