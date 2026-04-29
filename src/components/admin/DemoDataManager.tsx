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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Database, Trash2, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type PresetKey = 'small' | 'medium' | 'large';

const PRESET_OPTIONS: {
  key: PresetKey;
  label: string;
  acuerdos: number;
  campaigns: number;
  days: number;
  recommended?: boolean;
}[] = [
  { key: 'small',  label: 'Set chico',   acuerdos: 5,  campaigns: 2, days: 30 },
  { key: 'medium', label: 'Set mediano', acuerdos: 10, campaigns: 4, days: 60, recommended: true },
  { key: 'large',  label: 'Set grande',  acuerdos: 15, campaigns: 6, days: 90 },
];

export default function DemoDataManager() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [tenantPlan, setTenantPlan] = useState<string | null>(null);
  const [demoCount, setDemoCount] = useState(0);
  const [working, setWorking] = useState(false);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('medium');

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
      const impCompanyId = (imp as string) || null;
      setImpersonating(impCompanyId);

      if (impCompanyId) {
        const { data: company } = await supabase
          .from('companies')
          .select('plan')
          .eq('id', impCompanyId)
          .maybeSingle();
        setTenantPlan((company as any)?.plan || null);
      } else {
        setTenantPlan(null);
      }
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

  const isLowPlan = tenantPlan === 'trial' || tenantPlan === 'starter';

  const handleGenerate = async () => {
    setPresetDialogOpen(false);
    setWorking(true);
    const { data, error } = await supabase.functions.invoke('generate-demo-data', {
      body: { preset: selectedPreset },
    });
    setWorking(false);

    if (error) {
      toast.error(`Error: ${error.message}`);
      return;
    }
    const summary = (data as any)?.summary;
    if (summary) {
      const base = `Acuerdos: ${summary.acuerdos}, Pagos: ${summary.pagos}, Entregables: ${summary.entregables}, KPIs: ${summary.kpis}`;
      const cm = summary.is_premium && summary.campaigns > 0
        ? ` · ${summary.campaigns} campañas, ${summary.campaign_metrics} métricas, ${summary.campaign_keywords} keywords, ${summary.campaign_alerts} alertas, ${summary.alert_history} hist.`
        : '';
      toast.success(`Datos demo generados (${summary.preset}) — ${base}${cm}`);
    } else {
      toast.success('Datos demo generados');
    }
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
          {tenantPlan && (
            <> · Plan tenant: <Badge variant="outline" className="ml-1">{tenantPlan}</Badge></>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button disabled={working} className="gap-2" onClick={() => setPresetDialogOpen(true)}>
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {working ? 'Generando…' : 'Generar datos demo'}
          </Button>

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

        <Dialog open={presetDialogOpen} onOpenChange={(o) => !working && setPresetDialogOpen(o)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Elegí el set de datos demo a generar</DialogTitle>
              <DialogDescription>
                Cuanto más grande el set, más realista la demo, pero también más tiempo de generación
                (10–30 segundos en grande).
              </DialogDescription>
            </DialogHeader>

            {isLowPlan && (
              <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-foreground">
                ⚠️ Este tenant tiene plan <strong>{tenantPlan}</strong>. Solo se generarán datos de
                CRM (acuerdos, pagos, entregables, KPIs). El módulo Campaign Monitor no aplica a
                este plan.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {PRESET_OPTIONS.map((opt) => {
                const isSelected = selectedPreset === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedPreset(opt.key)}
                    className={cn(
                      'relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40',
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-semibold text-foreground">{opt.label}</span>
                      {opt.recommended && (
                        <Badge variant="default" className="text-[10px]">Recomendado</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>{opt.acuerdos} acuerdos</div>
                      {!isLowPlan && (
                        <>
                          <div>{opt.campaigns} campañas</div>
                          <div>{opt.days} días de métricas</div>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" disabled={working} onClick={() => setPresetDialogOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={working} onClick={handleGenerate} className="gap-2">
                {working && <Loader2 className="w-4 h-4 animate-spin" />}
                {working ? 'Generando… puede tardar 10–30s' : 'Generar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
