import { useState, useCallback, useMemo } from "react";
import { useAcuerdos, usePagos, useEntregables, useKPIs } from "@/hooks/useCrmData";
import ProductFamilyReport from "@/components/ProductFamilyReport";
import { Acuerdo, Pago, Entregable } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, LineChart, Line, Legend } from "recharts";
import ChartDetailDialog from "@/components/ChartDetailDialog";
import { CHART_COLORS as COLORS } from "@/lib/chart-colors";
import { SocialIcon } from "@/lib/social-icons";
import { useIsPremium } from "@/hooks/useCampaignMonitor";
import { CampaignMonitorWidget } from "@/components/campaign-monitor/CampaignMonitorWidget";

const fmtCurrency = (v: number) => {
  if (v >= 1_000_000) return `$${Math.round(v / 1_000_000)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v).toLocaleString()}`;
};

const fmtTooltip = (v: number) => `$${Math.round(v).toLocaleString()}`;

function getMonthKey(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

type DetailState = {
  open: boolean;
  title: string;
  type: "acuerdos" | "pagos" | "entregables";
  acuerdos?: Acuerdo[];
  pagos?: Pago[];
  entregables?: Entregable[];
};

export default function DashboardPage() {
  const { acuerdos, isLoading: loadingA } = useAcuerdos();
  const { pagos, isLoading: loadingP } = usePagos();
  const { isPremium } = useIsPremium();
  const { entregables, isLoading: loadingE } = useEntregables();
  const { kpis, isLoading: loadingK } = useKPIs();

  const [detail, setDetail] = useState<DetailState>({ open: false, title: "", type: "acuerdos" });

  const isLoading = loadingA || loadingP || loadingE || loadingK;

  const showDetail = useCallback((title: string, type: DetailState["type"], data: { acuerdos?: Acuerdo[]; pagos?: Pago[]; entregables?: Entregable[] }) => {
    setDetail({ open: true, title, type, ...data });
  }, []);

  // ... all the same chart data computation as before
  const acuerdosByEstado = ["Activo", "Pausado", "Finalizado", "Cancelado"].map((estado) => ({
    name: estado, value: acuerdos.filter((a) => a.estado === estado).length,
  })).filter((d) => d.value > 0);

  const pagosByEstado = ["Pendiente", "Pagado", "Vencido", "Cancelado"].map((estado) => ({
    name: estado, value: pagos.filter((p) => p.estado === estado).length,
  })).filter((d) => d.value > 0);

  const entregablesByTipo = ["Reel", "Story", "Collab", "UGC"].map((tipo) => ({
    name: tipo, value: entregables.filter((e) => e.tipoContenido === tipo).length,
  })).filter((d) => d.value > 0);

  const entregablesByEstado = ["Pendiente", "En progreso", "Entregado", "Aprobado", "Rechazado"].map((estado) => ({
    name: estado, value: entregables.filter((e) => e.estado === estado).length,
  })).filter((d) => d.value > 0);

  const moneyByInfluencer: Record<string, number> = {};
  acuerdos.forEach((a) => { moneyByInfluencer[a.influencer] = (moneyByInfluencer[a.influencer] || 0) + a.valorTotal; });
  const moneyBarData = Object.entries(moneyByInfluencer).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const moneyByTipo: Record<string, number> = {};
  acuerdos.forEach((a) => {
    const tipos = a.tipoContenido || [];
    const share = tipos.length > 0 ? a.valorTotal / tipos.length : 0;
    tipos.forEach((t) => { moneyByTipo[t] = (moneyByTipo[t] || 0) + share; });
  });
  const moneyByTipoData = Object.entries(moneyByTipo).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);

  const moneyByRed: Record<string, number> = {};
  acuerdos.forEach((a) => {
    const redes = a.redSocial || [];
    const share = redes.length > 0 ? a.valorTotal / redes.length : 0;
    redes.forEach((r) => { moneyByRed[r] = (moneyByRed[r] || 0) + share; });
  });
  const moneyByRedData = Object.entries(moneyByRed).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);

  const pagosByMonth: Record<string, number> = {};
  pagos.forEach((p) => {
    const key = getMonthKey(p.fechaPago);
    if (key) pagosByMonth[key] = (pagosByMonth[key] || 0) + p.monto;
  });
  const forecastData = Object.entries(pagosByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ month: formatMonth(key), monthKey: key, monto: value }));

  const acuerdosByMonth: Record<string, number> = {};
  acuerdos.forEach((a) => {
    const key = getMonthKey(a.fechaFin);
    if (key) acuerdosByMonth[key] = (acuerdosByMonth[key] || 0) + a.valorTotal;
  });
  const acuerdoForecast = Object.entries(acuerdosByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ month: formatMonth(key), monthKey: key, valor: value }));

  const totalAlcance = kpis.reduce((s, k) => s + k.alcance, 0);
  const totalClicks = kpis.reduce((s, k) => s + k.clicks, 0);
  const avgEngagement = kpis.length > 0 ? (kpis.reduce((s, k) => s + k.engagement, 0) / kpis.length).toFixed(2) : "0";
  const totalValorAcuerdos = acuerdos.reduce((s, a) => s + a.valorTotal, 0);
  const totalPagado = pagos.filter((p) => p.estado === "Pagado").reduce((s, p) => s + p.monto, 0);
  const totalPendiente = pagos.filter((p) => p.estado === "Pendiente").reduce((s, p) => s + p.monto, 0);

  // KPI CPR/CPC averages (only measured/approved KPIs)
  const measuredKpis = kpis.filter(k => k.cpr > 0 || k.cpc > 0);
  const avgCPR = measuredKpis.length > 0 ? measuredKpis.reduce((s, k) => s + k.cpr, 0) / measuredKpis.length : 0;
  const avgCPC = measuredKpis.length > 0 ? measuredKpis.reduce((s, k) => s + k.cpc, 0) / measuredKpis.length : 0;

  // KPI evolution chart data
  const [selectedInfluencerChart, setSelectedInfluencerChart] = useState<string>("all");
  const kpiInfluencers = useMemo(() => [...new Set(kpis.map(k => k.influencer))].filter(Boolean), [kpis]);

  const kpiEvolutionData = useMemo(() => {
    const relevantKpis = selectedInfluencerChart === "all" ? kpis : kpis.filter(k => k.influencer === selectedInfluencerChart);
    const byPeriodo: Record<string, { cpr: number[]; cpc: number[] }> = {};
    relevantKpis.forEach(k => {
      const dateKey = periodoToDate(k.periodo);
      if (!dateKey) return;
      if (!byPeriodo[dateKey]) byPeriodo[dateKey] = { cpr: [], cpc: [] };
      if (k.cpr > 0) byPeriodo[dateKey].cpr.push(k.cpr);
      if (k.cpc > 0) byPeriodo[dateKey].cpc.push(k.cpc);
    });
    return Object.entries(byPeriodo)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({
        month: formatMonth(getMonthKey(key) || key),
        CPR: data.cpr.length > 0 ? Math.round(data.cpr.reduce((a, b) => a + b, 0) / data.cpr.length) : 0,
        CPC: data.cpc.length > 0 ? Math.round(data.cpc.reduce((a, b) => a + b, 0) / data.cpc.length) : 0,
      }))
      .filter(d => d.CPR > 0 || d.CPC > 0);
  }, [kpis, selectedInfluencerChart]);

  function periodoToDate(periodo: string): string {
    const meses: Record<string, string> = { Enero: "01", Febrero: "02", Marzo: "03", Abril: "04", Mayo: "05", Junio: "06", Julio: "07", Agosto: "08", Septiembre: "09", Octubre: "10", Noviembre: "11", Diciembre: "12" };
    const parts = periodo.split(" ");
    if (parts.length === 2 && meses[parts[0]]) return `${parts[1]}-${meses[parts[0]]}-01`;
    return "";
  }

  // Click handlers
  const handlePieClickAcuerdos = (_: any, index: number) => {
    const seg = acuerdosByEstado[index];
    if (!seg) return;
    showDetail(`Acuerdos — ${seg.name}`, "acuerdos", { acuerdos: acuerdos.filter((a) => a.estado === seg.name) });
  };
  const handlePieClickPagos = (_: any, index: number) => {
    const seg = pagosByEstado[index];
    if (!seg) return;
    showDetail(`Pagos — ${seg.name}`, "pagos", { pagos: pagos.filter((p) => p.estado === seg.name) });
  };
  const handlePieClickEntTipo = (_: any, index: number) => {
    const seg = entregablesByTipo[index];
    if (!seg) return;
    showDetail(`Entregables — ${seg.name}`, "entregables", { entregables: entregables.filter((e) => e.tipoContenido === seg.name) });
  };
  const handlePieClickEntEstado = (_: any, index: number) => {
    const seg = entregablesByEstado[index];
    if (!seg) return;
    showDetail(`Entregables — ${seg.name}`, "entregables", { entregables: entregables.filter((e) => e.estado === seg.name) });
  };
  const handleBarClickInfluencer = (data: any) => {
    const name = data?.activePayload?.[0]?.payload?.name;
    if (!name) return;
    showDetail(`Acuerdos — ${name}`, "acuerdos", { acuerdos: acuerdos.filter((a) => a.influencer === name) });
  };
  const handleBarClickTipo = (data: any) => {
    const name = data?.activePayload?.[0]?.payload?.name;
    if (!name) return;
    showDetail(`Acuerdos con tipo ${name}`, "acuerdos", { acuerdos: acuerdos.filter((a) => (a.tipoContenido || []).includes(name)) });
  };
  const handleBarClickRed = (data: any) => {
    const name = data?.activePayload?.[0]?.payload?.name;
    if (!name) return;
    showDetail(`Acuerdos en ${name}`, "acuerdos", { acuerdos: acuerdos.filter((a) => (a.redSocial || []).includes(name)) });
  };
  const handleAreaClickPagos = (data: any) => {
    if (!data?.activePayload?.[0]?.payload?.monthKey) return;
    const mk = data.activePayload[0].payload.monthKey;
    showDetail(`Pagos — ${data.activePayload[0].payload.month}`, "pagos", { pagos: pagos.filter((p) => getMonthKey(p.fechaPago) === mk) });
  };
  const handleAreaClickAcuerdos = (data: any) => {
    if (!data?.activePayload?.[0]?.payload?.monthKey) return;
    const mk = data.activePayload[0].payload.monthKey;
    showDetail(`Acuerdos fin — ${data.activePayload[0].payload.month}`, "acuerdos", { acuerdos: acuerdos.filter((a) => getMonthKey(a.fechaFin) === mk) });
  };

  const renderPie = (data: { name: string; value: number }[], title: string, onClick: (_: any, index: number) => void) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        ) : (
          <div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  outerRadius={65}
                  innerRadius={28}
                  dataKey="value"
                  className="cursor-pointer"
                  onClick={onClick}
                >
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {data.map((d, i) => {
                const total = data.reduce((s, x) => s + x.value, 0);
                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                return (
                  <button key={i} onClick={() => onClick(null, i)} className="flex items-center gap-1.5 text-xs cursor-pointer hover:opacity-70 transition-opacity">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span>{d.name} {pct}%</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Cargando dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Resumen general de todos los módulos</p>
      </div>

      {isPremium && <CampaignMonitorWidget />}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          <Card key="a" className="overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Acuerdos</CardTitle></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold truncate">{acuerdos.length}</div></CardContent></Card>,
          <Card key="b" className="overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Valor Total Acuerdos</CardTitle></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold truncate">${totalValorAcuerdos.toLocaleString()}</div></CardContent></Card>,
          <Card key="c" className="overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Total Pagado</CardTitle></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold text-emerald-600 truncate">${totalPagado.toLocaleString()}</div></CardContent></Card>,
          <Card key="d" className="overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Pagos Pendientes</CardTitle></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold text-amber-600 truncate">${totalPendiente.toLocaleString()}</div></CardContent></Card>,
          <Card key="e" className="overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Engagement Prom.</CardTitle></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold truncate">{avgEngagement}%</div></CardContent></Card>,
        ].map((card, i) => (
          <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}>{card}</div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 [&>*]:animate-scale-in" style={{ '--tw-animate-delay': '0.2s' } as React.CSSProperties}>
        {renderPie(acuerdosByEstado, "Acuerdos por Estado", handlePieClickAcuerdos)}
        {renderPie(pagosByEstado, "Pagos por Estado", handlePieClickPagos)}
        {renderPie(entregablesByTipo, "Entregables por Tipo", handlePieClickEntTipo)}
        {renderPie(entregablesByEstado, "Entregables por Estado", handlePieClickEntEstado)}
      </div>

      <div className="animate-fade-in" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
      <Card>
        <CardHeader><CardTitle className="text-base">Inversión por Influencer</CardTitle></CardHeader>
        <CardContent>
          {moneyBarData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={moneyBarData} onClick={handleBarClickInfluencer}>
                
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={fmtCurrency} />
                <Tooltip formatter={(v: number) => fmtTooltip(v)} />
              <Bar dataKey="value" name="Valor" radius={[4, 4, 0, 0]} className="cursor-pointer">
                {moneyBarData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: '500ms', animationFillMode: 'backwards' }}>
        <Card>
          <CardHeader><CardTitle className="text-base">Inversión por Tipo de Contenido</CardTitle></CardHeader>
          <CardContent>
            {moneyByTipoData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={moneyByTipoData} onClick={handleBarClickTipo}>
                  
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={fmtCurrency} />
                  <Tooltip formatter={(v: number) => fmtTooltip(v)} />
                  <Bar dataKey="value" name="Inversión" radius={[4, 4, 0, 0]} className="cursor-pointer">
                    {moneyByTipoData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Inversión por Red Social</CardTitle></CardHeader>
          <CardContent>
            {moneyByRedData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={moneyByRedData} onClick={handleBarClickRed}>
                  
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    fontSize={12}
                    tick={({ x, y, payload }: any) => (
                      <g transform={`translate(${x},${y + 8})`}>
                        <foreignObject x={-12} y={-6} width={24} height={24}>
                          <SocialIcon name={payload.value} size={22} />
                        </foreignObject>
                      </g>
                    )}
                  />
                  <YAxis fontSize={12} tickFormatter={fmtCurrency} />
                  <Tooltip
                    formatter={(v: number) => fmtTooltip(v)}
                    labelFormatter={(label: string) => label}
                  />
                  <Bar dataKey="value" name="Inversión" radius={[4, 4, 0, 0]} className="cursor-pointer">
                    {moneyByRedData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}>
        <Card>
          <CardHeader><CardTitle className="text-base">Pagos realizados y futuros</CardTitle></CardHeader>
          <CardContent>
            {forecastData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={forecastData} onClick={handleAreaClickPagos}>
                  
                  <defs>
                    <linearGradient id="areaGrad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7030A0" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#4318FF" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={fmtCurrency} />
                  <Tooltip formatter={(v: number) => fmtTooltip(v)} />
                  <Area type="monotone" dataKey="monto" stroke="#7030A0" fill="url(#areaGrad1)" name="Monto" className="cursor-pointer" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Fecha de finalización x monto</CardTitle></CardHeader>
          <CardContent>
            {acuerdoForecast.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={acuerdoForecast} onClick={handleAreaClickAcuerdos}>
                  <defs>
                    <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4318FF" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#7030A0" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={fmtCurrency} />
                  <Tooltip formatter={(v: number) => fmtTooltip(v)} />
                  <Area type="monotone" dataKey="valor" stroke="#4318FF" fill="url(#areaGrad2)" name="Valor" className="cursor-pointer" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Family Report */}
      <div className="animate-fade-in" style={{ animationDelay: '700ms', animationFillMode: 'backwards' }}>
        <ProductFamilyReport acuerdos={acuerdos} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-fade-in" style={{ animationDelay: '800ms', animationFillMode: 'backwards' }}>
        <Card className="overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Alcance Total</CardTitle></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold truncate">{totalAlcance.toLocaleString()}</div></CardContent></Card>
        <Card className="overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Clicks Totales</CardTitle></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold truncate">{totalClicks.toLocaleString()}</div></CardContent></Card>
        <Card className="overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Entregables</CardTitle></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold truncate">{entregables.length}</div></CardContent></Card>
        <Card className="overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">CPR Promedio</CardTitle></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold truncate">{avgCPR > 0 ? fmtCurrency(avgCPR) : "—"}</div></CardContent></Card>
        <Card className="overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">CPC Promedio</CardTitle></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold truncate">{avgCPC > 0 ? fmtCurrency(avgCPC) : "—"}</div></CardContent></Card>
      </div>

      {/* KPI CPR/CPC Evolution Chart */}
      <div className="animate-fade-in" style={{ animationDelay: '900ms', animationFillMode: 'backwards' }}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Evolución CPR y CPC por mes</CardTitle>
              <Select value={selectedInfluencerChart} onValueChange={setSelectedInfluencerChart}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Influencer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los influencers</SelectItem>
                  {kpiInfluencers.map(inf => <SelectItem key={inf} value={inf}>{inf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {kpiEvolutionData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos de CPR/CPC disponibles</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={kpiEvolutionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={fmtCurrency} />
                  <Tooltip formatter={(v: number) => fmtTooltip(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="CPR" stroke="hsl(250, 60%, 52%)" strokeWidth={2} dot={{ r: 4 }} name="CPR" />
                  <Line type="monotone" dataKey="CPC" stroke="hsl(152, 60%, 42%)" strokeWidth={2} dot={{ r: 4 }} name="CPC" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <ChartDetailDialog
        open={detail.open}
        onOpenChange={(o) => setDetail((d) => ({ ...d, open: o }))}
        title={detail.title}
        type={detail.type}
        acuerdos={detail.acuerdos}
        pagos={detail.pagos}
        entregables={detail.entregables}
      />
    </div>
  );
}
