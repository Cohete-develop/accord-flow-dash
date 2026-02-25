import { useState, useCallback } from "react";
import { useAcuerdos, usePagos, useEntregables, useKPIs } from "@/hooks/useCrmData";
import ProductFamilyReport from "@/components/ProductFamilyReport";
import { Acuerdo, Pago, Entregable } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import ChartDetailDialog from "@/components/ChartDetailDialog";

const COLORS = [
  "#7030A0", "#4318FF", "#8B5CF6", "#5B21B6",
  "#6366F1", "#A855F7", "#7C3AED", "#9333EA",
];

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
    const key = getMonthKey(p.fechaVencimiento);
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
    showDetail(`Pagos — ${data.activePayload[0].payload.month}`, "pagos", { pagos: pagos.filter((p) => getMonthKey(p.fechaVencimiento) === mk) });
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Resumen general de todos los módulos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Acuerdos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{acuerdos.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Valor Total Acuerdos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">${totalValorAcuerdos.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Pagado</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">${totalPagado.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pagos Pendientes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">${totalPendiente.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Engagement Prom.</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{avgEngagement}%</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderPie(acuerdosByEstado, "Acuerdos por Estado", handlePieClickAcuerdos)}
        {renderPie(pagosByEstado, "Pagos por Estado", handlePieClickPagos)}
        {renderPie(entregablesByTipo, "Entregables por Tipo", handlePieClickEntTipo)}
        {renderPie(entregablesByEstado, "Entregables por Estado", handlePieClickEntEstado)}
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={fmtCurrency} />
                  <Tooltip formatter={(v: number) => fmtTooltip(v)} />
                  <Bar dataKey="value" name="Inversión" radius={[4, 4, 0, 0]} className="cursor-pointer">
                    {moneyByRedData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      <ProductFamilyReport acuerdos={acuerdos} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Alcance Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalAlcance.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Clicks Totales</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Entregables</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{entregables.length}</div></CardContent></Card>
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
