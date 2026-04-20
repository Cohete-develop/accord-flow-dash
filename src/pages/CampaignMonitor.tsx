import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  useIsPremium, useAdConnections, useCampaigns, useCampaignMetrics,
  useCampaignKeywords, useCampaignAlerts, useAlertHistory,
  useSyncCampaigns, useConnectPlatform, useDisconnectPlatform, type Platform,
} from "@/hooks/useCampaignMonitor";
import { Activity, AlertTriangle, CheckCircle2, Crown, Plug, RefreshCw, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { SpendByPlatformCard } from "@/components/campaign-monitor/SpendByPlatformCard";
import { PlatformComparisonCard } from "@/components/campaign-monitor/PlatformComparisonCard";
import { TopBottomCampaignsCard } from "@/components/campaign-monitor/TopBottomCampaignsCard";
import { PeriodComparisonCard } from "@/components/campaign-monitor/PeriodComparisonCard";
import { BudgetPacingCard } from "@/components/campaign-monitor/BudgetPacingCard";
import { CampaignFunnel } from "@/components/campaign-monitor/CampaignFunnel";
import { EfficiencyChart } from "@/components/campaign-monitor/EfficiencyChart";
import { CpaEfficiencyChart } from "@/components/campaign-monitor/CpaEfficiencyChart";
import { HourlyHeatmap } from "@/components/campaign-monitor/HourlyHeatmap";
import { AutoInsights } from "@/components/campaign-monitor/AutoInsights";

const PLATFORM_LABELS: Record<Platform, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads",
  linkedin_ads: "LinkedIn Ads",
};

const fmtMoney = (n: number) => `$${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtNum = (n: number) => (n || 0).toLocaleString("en-US");
const fmtPct = (n: number) => `${(n || 0).toFixed(2)}%`;

// KPI definitions + dynamic interpretation based on current value
const KPI_INFO: Record<string, { desc: string; interpret: (v: number) => { text: string; tone: "good" | "warn" | "bad" | "neutral" } }> = {
  Gasto: {
    desc: "Total invertido en pauta durante el período seleccionado.",
    interpret: (v) => ({
      text: v === 0 ? "Aún no hay inversión registrada en este rango." : `Has invertido $${v.toLocaleString("en-US", { maximumFractionDigits: 0 })} en este período.`,
      tone: "neutral",
    }),
  },
  Impresiones: {
    desc: "Veces que tus anuncios aparecieron frente a usuarios. Mide alcance bruto.",
    interpret: (v) => ({
      text: v < 1000 ? "Volumen muy bajo: revisa presupuesto o segmentación." : v < 50000 ? "Alcance moderado." : "Alcance alto, buena visibilidad.",
      tone: v < 1000 ? "bad" : v < 50000 ? "warn" : "good",
    }),
  },
  Clicks: {
    desc: "Cantidad de personas que hicieron clic en tus anuncios.",
    interpret: (v) => ({
      text: v < 50 ? "Tráfico bajo: el anuncio puede no ser atractivo o la segmentación es muy estrecha." : "Volumen de tráfico saludable.",
      tone: v < 50 ? "warn" : "good",
    }),
  },
  CTR: {
    desc: "Click-Through Rate: % de impresiones que generaron clic. Mide qué tan relevante es tu anuncio.",
    interpret: (v) => ({
      text: v < 1 ? "CTR bajo (<1%): mejora el creativo, copy o segmentación." : v < 2 ? "CTR aceptable (1–2%): hay espacio para optimizar." : "CTR excelente (>2%): tu anuncio resuena bien.",
      tone: v < 1 ? "bad" : v < 2 ? "warn" : "good",
    }),
  },
  Conversiones: {
    desc: "Acciones valiosas completadas tras el clic (compras, leads, registros).",
    interpret: (v) => ({
      text: v === 0 ? "Sin conversiones: revisa el funnel o el seguimiento de eventos." : v < 10 ? "Volumen bajo de conversiones." : "Buen volumen de conversiones.",
      tone: v === 0 ? "bad" : v < 10 ? "warn" : "good",
    }),
  },
  ROAS: {
    desc: "Return on Ad Spend: ingresos generados por cada $1 invertido. ROAS 3x = $3 de retorno por $1 gastado.",
    interpret: (v) => ({
      text: v === 0 ? "Sin retorno medible aún. Verifica que el conversion_value esté configurado." : v < 1 ? `ROAS ${v.toFixed(2)}x: estás perdiendo dinero (gastas más de lo que generas).` : v < 2 ? `ROAS ${v.toFixed(2)}x: rentabilidad ajustada, hay que optimizar.` : v < 4 ? `ROAS ${v.toFixed(2)}x: rentable y saludable.` : `ROAS ${v.toFixed(2)}x: excelente, escala esta campaña.`,
      tone: v === 0 ? "neutral" : v < 1 ? "bad" : v < 2 ? "warn" : "good",
    }),
  },
  "Gasto hoy": {
    desc: "Inversión publicitaria acumulada en el día de hoy contra el presupuesto diario configurado.",
    interpret: (v) => ({
      text: v === 0 ? "Sin gasto registrado aún hoy." : `Llevas $${v.toLocaleString("en-US", { maximumFractionDigits: 0 })} gastados hoy.`,
      tone: "neutral",
    }),
  },
  "Alertas sin reconocer": {
    desc: "Alertas disparadas que aún no han sido revisadas por el equipo.",
    interpret: (v) => ({
      text: v === 0 ? "Todo tranquilo, no hay alertas pendientes." : v < 3 ? `${v} alerta(s) requieren tu atención.` : `${v} alertas acumuladas: revisa el módulo de alertas pronto.`,
      tone: v === 0 ? "good" : v < 3 ? "warn" : "bad",
    }),
  },
};

function UpgradeScreen({ plan }: { plan: string }) {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Crown className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Campaign Monitor es premium</CardTitle>
          <CardDescription>
            Tu plan actual es <span className="font-semibold uppercase">{plan || "trial"}</span>.
            Actualiza a <strong>Pro</strong> o <strong>Enterprise</strong> para monitorear Google Ads, Meta, TikTok
            y LinkedIn en tiempo real con alertas automáticas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>✓ Sincronización de campañas y métricas</li>
            <li>✓ Alertas configurables por métrica</li>
            <li>✓ Análisis de keywords y rendimiento</li>
            <li>✓ Dashboard unificado multi-plataforma</li>
          </ul>
          <Button asChild className="w-full" variant="gradient">
            <Link to="/dashboard">Volver al Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ResumenTab() {
  const { data: campaigns = [], isLoading: loadingCampaigns } = useCampaigns();
  const { data: metrics = [], isLoading: loadingMetrics } = useCampaignMetrics(undefined, 30);
  const { data: history = [], isLoading: loadingHistory } = useAlertHistory();
  const [range, setRange] = useState("7");
  const isLoading = loadingCampaigns || loadingMetrics || loadingHistory;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">Cargando datos de campañas...</div>;
  }

  const filtered = useMemo(() => {
    const days = parseInt(range, 10);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const cutoff = since.toISOString().slice(0, 10);
    return metrics.filter((m) => m.date >= cutoff);
  }, [metrics, range]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, m) => ({
        cost: acc.cost + Number(m.cost),
        impressions: acc.impressions + Number(m.impressions),
        clicks: acc.clicks + Number(m.clicks),
        conversions: acc.conversions + Number(m.conversions),
        conversion_value: acc.conversion_value + Number(m.conversion_value),
      }),
      { cost: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 }
    );
  }, [filtered]);

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const roas = totals.cost > 0 ? totals.conversion_value / totals.cost : 0;
  const unack = history.filter((h) => !h.acknowledged_at).length;

  // Trend: cost vs conversions per day
  const trend = useMemo(() => {
    const byDate = new Map<string, { date: string; cost: number; conversions: number }>();
    filtered.forEach((m) => {
      const cur = byDate.get(m.date) || { date: m.date, cost: 0, conversions: 0 };
      cur.cost += Number(m.cost);
      cur.conversions += Number(m.conversions);
      byDate.set(m.date, cur);
    });
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  // Per-campaign performance for traffic light
  const perCampaign = useMemo(() => {
    const map = new Map<string, { cost: number; conv: number; clicks: number; impressions: number }>();
    filtered.forEach((m) => {
      const cur = map.get(m.campaign_sync_id) || { cost: 0, conv: 0, clicks: 0, impressions: 0 };
      cur.cost += Number(m.cost);
      cur.conv += Number(m.conversions);
      cur.clicks += Number(m.clicks);
      cur.impressions += Number(m.impressions);
      map.set(m.campaign_sync_id, cur);
    });
    return campaigns.map((c) => {
      const t = map.get(c.id) || { cost: 0, conv: 0, clicks: 0, impressions: 0 };
      const cpa = t.conv > 0 ? t.cost / t.conv : 0;
      const status = cpa > 0 && cpa < 30 ? "green" : cpa < 60 ? "yellow" : "red";
      return { ...c, ...t, cpa, light: status };
    });
  }, [filtered, campaigns]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label>Rango:</Label>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="14">Últimos 14 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {unack > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> {unack} alertas sin reconocer
          </Badge>
        )}
      </div>

      <TooltipProvider delayDuration={150}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Gasto" value={fmtMoney(totals.cost)} raw={totals.cost} />
          <SummaryCard label="Impresiones" value={fmtNum(totals.impressions)} raw={totals.impressions} />
          <SummaryCard label="Clicks" value={fmtNum(totals.clicks)} raw={totals.clicks} />
          <SummaryCard label="CTR" value={fmtPct(ctr)} raw={ctr} />
          <SummaryCard label="Conversiones" value={fmtNum(totals.conversions)} raw={totals.conversions} />
          <SummaryCard label="ROAS" value={`${roas.toFixed(2)}x`} raw={roas} />
        </div>
      </TooltipProvider>

      <Card>
        <CardHeader>
          <CardTitle>Gasto vs Conversiones</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="cost" stroke="hsl(var(--primary))" name="Gasto ($)" />
              <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="hsl(var(--accent-foreground))" name="Conversiones" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <PeriodComparisonCard metrics={metrics} days={parseInt(range, 10)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SpendByPlatformCard metrics={filtered} campaigns={campaigns} />
        <PlatformComparisonCard metrics={filtered} campaigns={campaigns} />
      </div>

      <TopBottomCampaignsCard metrics={filtered} campaigns={campaigns} />

      <BudgetPacingCard metrics={filtered} campaigns={campaigns} daysSelected={parseInt(range, 10)} />

      <Card>
        <CardHeader>
          <CardTitle>Campañas activas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Conv.</TableHead>
                <TableHead className="text-right">CPA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perCampaign.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{
                        background:
                          c.light === "green" ? "hsl(142 70% 45%)" :
                          c.light === "yellow" ? "hsl(38 90% 55%)" : "hsl(0 75% 55%)",
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{c.campaign_name}</TableCell>
                  <TableCell><Badge variant="secondary">{PLATFORM_LABELS[c.platform]}</Badge></TableCell>
                  <TableCell className="text-right">{fmtMoney(c.cost)}</TableCell>
                  <TableCell className="text-right">{fmtNum(c.clicks)}</TableCell>
                  <TableCell className="text-right">{fmtNum(c.conv)}</TableCell>
                  <TableCell className="text-right">{c.cpa > 0 ? fmtMoney(c.cpa) : "—"}</TableCell>
                </TableRow>
              ))}
              {perCampaign.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin campañas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, raw }: { label: string; value: string; raw?: number }) {
  const info = KPI_INFO[label];
  const interpretation = info && raw !== undefined ? info.interpret(raw) : null;
  const toneClass = interpretation
    ? interpretation.tone === "good"
      ? "text-green-600 dark:text-green-400"
      : interpretation.tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : interpretation.tone === "bad"
      ? "text-destructive"
      : "text-foreground"
    : "";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          {info && (
            <UITooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-semibold mb-1">{label}</p>
                <p className="text-xs mb-2">{info.desc}</p>
                {interpretation && (
                  <p className={`text-xs font-medium ${toneClass}`}>{interpretation.text}</p>
                )}
              </TooltipContent>
            </UITooltip>
          )}
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function CampanasTab() {
  const { data: campaigns = [] } = useCampaigns();
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = campaigns.filter((c) =>
    (platformFilter === "all" || c.platform === platformFilter) &&
    (statusFilter === "all" || c.status === statusFilter)
  );

  const selected = campaigns.find((c) => c.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las plataformas</SelectItem>
            <SelectItem value="google_ads">Google Ads</SelectItem>
            <SelectItem value="meta_ads">Meta Ads</SelectItem>
            <SelectItem value="tiktok_ads">TikTok Ads</SelectItem>
            <SelectItem value="linkedin_ads">LinkedIn Ads</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="paused">Pausadas</SelectItem>
            <SelectItem value="ended">Finalizadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaña</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Presup. diario</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Última sync</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedId(c.id)}>
                  <TableCell className="font-medium">{c.campaign_name}</TableCell>
                  <TableCell><Badge variant="secondary">{PLATFORM_LABELS[c.platform]}</Badge></TableCell>
                  <TableCell><Badge variant={c.status === "active" ? "default" : "outline"}>{c.status}</Badge></TableCell>
                  <TableCell className="text-right">{fmtMoney(c.daily_budget)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(c.total_budget)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell><Button size="sm" variant="ghost">Ver</Button></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin campañas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CampaignDetailDialog
        campaign={selected}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function CampaignDetailDialog({ campaign, open, onClose }: any) {
  const { data: metrics = [] } = useCampaignMetrics(campaign?.id, 30);
  const { data: keywords = [] } = useCampaignKeywords(campaign?.id);

  if (!campaign) return null;

  const trend = metrics.map((m) => ({
    date: m.date,
    cost: Number(m.cost),
    clicks: Number(m.clicks),
    conv: Number(m.conversions),
    ctr: Number(m.ctr),
  }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign.campaign_name}</DialogTitle>
          <DialogDescriptionLine campaign={campaign} />
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Rendimiento (30 días)</CardTitle></CardHeader>
            <CardContent style={{ height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="cost" stroke="hsl(var(--primary))" name="Gasto" />
                  <Line type="monotone" dataKey="clicks" stroke="hsl(217 91% 60%)" name="Clicks" />
                  <Line type="monotone" dataKey="conv" stroke="hsl(142 70% 45%)" name="Conversiones" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EfficiencyChart metrics={metrics} />
            <CampaignFunnel
              impressions={metrics.reduce((s, m) => s + Number(m.impressions), 0)}
              clicks={metrics.reduce((s, m) => s + Number(m.clicks), 0)}
              conversions={metrics.reduce((s, m) => s + Number(m.conversions), 0)}
            />
          </div>

          {campaign.platform === "google_ads" && keywords.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Keywords (Top 20)</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>QS</TableHead>
                      <TableHead className="text-right">Impr.</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">CPC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...keywords]
                      .sort((a, b) => (a.quality_score ?? 99) - (b.quality_score ?? 99))
                      .slice(0, 20)
                      .map((k) => {
                      const qs = k.quality_score ?? 0;
                      const qsCls =
                        qs >= 7 ? "bg-green-600 text-white"
                        : qs >= 4 ? "bg-amber-500 text-white"
                        : qs > 0 ? "bg-destructive text-destructive-foreground"
                        : "bg-muted";
                      return (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.keyword}</TableCell>
                        <TableCell><Badge variant="outline">{k.match_type}</Badge></TableCell>
                        <TableCell>
                          {k.quality_score
                            ? <Badge className={qsCls}>{qs}</Badge>
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">{fmtNum(k.impressions)}</TableCell>
                        <TableCell className="text-right">{fmtNum(k.clicks)}</TableCell>
                        <TableCell className="text-right">{fmtPct(Number(k.ctr))}</TableCell>
                        <TableCell className="text-right">{fmtMoney(Number(k.cpc))}</TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogDescriptionLine({ campaign }: any) {
  return (
    <p className="text-sm text-muted-foreground">
      {PLATFORM_LABELS[campaign.platform as Platform]} · Estado: {campaign.status} ·
      Presupuesto diario: {fmtMoney(campaign.daily_budget)}
    </p>
  );
}

function AlertasTab() {
  const { data: campaigns = [] } = useCampaigns();
  const { data: alerts = [], save, toggle, remove } = useCampaignAlerts();
  const { data: history = [], acknowledge } = useAlertHistory();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    campaign_sync_id: "all",
    metric: "ctr",
    condition: "drops_below" as const,
    threshold: 1,
    window_minutes: 60,
  });

  const submit = async () => {
    await save.mutateAsync({
      campaign_sync_id: form.campaign_sync_id === "all" ? null : form.campaign_sync_id,
      metric: form.metric,
      condition: form.condition,
      threshold: Number(form.threshold),
      window_minutes: Number(form.window_minutes),
      is_active: true,
      notify_channels: ["in_app"],
    } as any);
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Alertas configuradas</CardTitle>
            <CardDescription>{alerts.length} reglas activas</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="gradient"><Zap className="h-4 w-4 mr-1" /> Nueva alerta</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Configurar alerta</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Campaña</Label>
                  <Select value={form.campaign_sync_id} onValueChange={(v) => setForm({ ...form, campaign_sync_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las campañas</SelectItem>
                      {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.campaign_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Métrica</Label>
                    <Select value={form.metric} onValueChange={(v) => setForm({ ...form, metric: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ctr">CTR</SelectItem>
                        <SelectItem value="cpc">CPC</SelectItem>
                        <SelectItem value="cpa">CPA</SelectItem>
                        <SelectItem value="roas">ROAS</SelectItem>
                        <SelectItem value="cost">Cost</SelectItem>
                        <SelectItem value="conversions">Conversiones</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Condición</Label>
                    <Select value={form.condition} onValueChange={(v: any) => setForm({ ...form, condition: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="drops_below">Cae por debajo</SelectItem>
                        <SelectItem value="exceeds">Supera</SelectItem>
                        <SelectItem value="changes_by_percent">Cambia %</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Umbral</Label>
                    <Input type="number" step="0.01" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Ventana (min)</Label>
                    <Input type="number" value={form.window_minutes} onChange={(e) => setForm({ ...form, window_minutes: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
              <DialogFooter><Button onClick={submit}>Guardar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activa</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead>Condición</TableHead>
                <TableHead className="text-right">Umbral</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((a) => {
                const camp = campaigns.find((c) => c.id === a.campaign_sync_id);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Switch checked={a.is_active} onCheckedChange={(v) => toggle.mutate({ id: a.id, is_active: v })} />
                    </TableCell>
                    <TableCell>{camp?.campaign_name || "Todas"}</TableCell>
                    <TableCell><Badge variant="secondary">{a.metric.toUpperCase()}</Badge></TableCell>
                    <TableCell className="text-sm">{a.condition.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right">{a.threshold}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)}>Eliminar</Button></TableCell>
                  </TableRow>
                );
              })}
              {alerts.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sin alertas configuradas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historial de alertas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && <p className="text-sm text-muted-foreground">Sin alertas disparadas</p>}
          {history.map((h) => (
            <div key={h.id} className="flex items-start justify-between border rounded-md p-3">
              <div className="flex gap-3">
                {h.acknowledged_at
                  ? <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  : <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />}
                <div>
                  <p className="text-sm font-medium">{h.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(h.triggered_at).toLocaleString()} · valor: {h.metric_value} · umbral: {h.threshold_value}
                  </p>
                </div>
              </div>
              {!h.acknowledged_at && (
                <Button size="sm" variant="outline" onClick={() => acknowledge.mutate(h.id)}>Reconocer</Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ConexionesTab() {
  const { data: connections = [] } = useAdConnections();
  const connect = useConnectPlatform();
  const disconnect = useDisconnectPlatform();
  const sync = useSyncCampaigns();

  const platforms: Platform[] = ["google_ads", "meta_ads", "tiktok_ads", "linkedin_ads"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {platforms.map((p) => {
        const conn = connections.find((c) => c.platform === p);
        return (
          <Card key={p}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5" /> {PLATFORM_LABELS[p]}
                </CardTitle>
                {conn ? (
                  <Badge variant={conn.status === "active" ? "default" : "destructive"}>{conn.status}</Badge>
                ) : (
                  <Badge variant="outline">Desconectada</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {conn ? (
                <>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Cuenta:</span> {conn.account_name || conn.account_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Última sync: {conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleString() : "—"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={sync.isPending} onClick={() => sync.mutate(conn.id)}>
                      <RefreshCw className={`h-4 w-4 mr-1 ${sync.isPending ? "animate-spin" : ""}`} /> Sincronizar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => disconnect.mutate(conn.id)}>Desconectar</Button>
                  </div>
                </>
              ) : (
                <Button
                  variant="gradient"
                  disabled={connect.isPending}
                  onClick={() => connect.mutate({ platform: p, account_name: `${PLATFORM_LABELS[p]} demo` })}
                >
                  Conectar
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function CampaignMonitorPage() {
  const { isPremium, plan, loading } = useIsPremium();

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p>Cargando...</p></div>;
  }
  if (!isPremium) return <UpgradeScreen plan={plan} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Campaign Monitor</h1>
          <p className="text-sm text-muted-foreground">Monitoreo en tiempo real de campañas publicitarias</p>
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="campanas">Campañas</TabsTrigger>
          <TabsTrigger value="analisis">Análisis</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="conexiones">Conexiones</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen" className="mt-4"><ResumenTab /></TabsContent>
        <TabsContent value="campanas" className="mt-4"><CampanasTab /></TabsContent>
        <TabsContent value="analisis" className="mt-4"><AnalisisTab /></TabsContent>
        <TabsContent value="alertas" className="mt-4"><AlertasTab /></TabsContent>
        <TabsContent value="conexiones" className="mt-4"><ConexionesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function AnalisisTab() {
  const { data: campaigns = [], isLoading: loadingCampaigns } = useCampaigns();
  const { data: metrics = [], isLoading: loadingMetrics } = useCampaignMetrics(undefined, 30);
  const { data: keywords = [], isLoading: loadingKeywords } = useCampaignKeywords();
  const [range, setRange] = useState("30");
  const isLoading = loadingCampaigns || loadingMetrics || loadingKeywords;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">Cargando análisis...</div>;
  }

  const filtered = useMemo(() => {
    const days = parseInt(range, 10);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const cutoff = since.toISOString().slice(0, 10);
    return metrics.filter((m) => m.date >= cutoff);
  }, [metrics, range]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Label>Rango:</Label>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 días</SelectItem>
            <SelectItem value="14">Últimos 14 días</SelectItem>
            <SelectItem value="30">Últimos 30 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <CpaEfficiencyChart metrics={filtered} campaigns={campaigns} />
      <HourlyHeatmap metrics={filtered} />
      <AutoInsights metrics={filtered} campaigns={campaigns} keywords={keywords} />
    </div>
  );
}
