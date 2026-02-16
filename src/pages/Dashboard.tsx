import { getAcuerdos, getPagos, getEntregables, getKPIs } from "@/data/crm-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area } from "recharts";

const COLORS = [
  "hsl(250, 60%, 52%)", "hsl(152, 60%, 42%)", "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)", "hsl(220, 60%, 50%)", "hsl(280, 60%, 50%)",
];

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

export default function DashboardPage() {
  const acuerdos = getAcuerdos();
  const pagos = getPagos();
  const entregables = getEntregables();
  const kpis = getKPIs();

  // Acuerdos by estado
  const acuerdosByEstado = ["Activo", "Pausado", "Finalizado", "Cancelado"].map((estado) => ({
    name: estado, value: acuerdos.filter((a) => a.estado === estado).length,
  })).filter((d) => d.value > 0);

  // Pagos by estado
  const pagosByEstado = ["Pendiente", "Pagado", "Vencido", "Cancelado"].map((estado) => ({
    name: estado, value: pagos.filter((p) => p.estado === estado).length,
  })).filter((d) => d.value > 0);

  // Entregables by tipo
  const entregablesByTipo = ["Reel", "Story", "Collab", "UGC"].map((tipo) => ({
    name: tipo, value: entregables.filter((e) => e.tipoContenido === tipo).length,
  })).filter((d) => d.value > 0);

  // Entregables by estado
  const entregablesByEstado = ["Pendiente", "En progreso", "Entregado", "Aprobado", "Rechazado"].map((estado) => ({
    name: estado, value: entregables.filter((e) => e.estado === estado).length,
  })).filter((d) => d.value > 0);

  // Money by influencer (acuerdos)
  const moneyByInfluencer: Record<string, number> = {};
  acuerdos.forEach((a) => { moneyByInfluencer[a.influencer] = (moneyByInfluencer[a.influencer] || 0) + a.valorTotal; });
  const moneyBarData = Object.entries(moneyByInfluencer).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Inversión por tipo de contenido
  const moneyByTipo: Record<string, number> = {};
  acuerdos.forEach((a) => {
    const tipos = a.tipoContenido || [];
    const share = tipos.length > 0 ? a.valorTotal / tipos.length : 0;
    tipos.forEach((t) => { moneyByTipo[t] = (moneyByTipo[t] || 0) + share; });
  });
  const moneyByTipoData = Object.entries(moneyByTipo).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);

  // Inversión por red social
  const moneyByRed: Record<string, number> = {};
  acuerdos.forEach((a) => {
    const redes = a.redSocial || [];
    const share = redes.length > 0 ? a.valorTotal / redes.length : 0;
    redes.forEach((r) => { moneyByRed[r] = (moneyByRed[r] || 0) + share; });
  });
  const moneyByRedData = Object.entries(moneyByRed).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);

  // Forecast: pagos by month
  const pagosByMonth: Record<string, number> = {};
  pagos.forEach((p) => {
    const key = getMonthKey(p.fechaVencimiento);
    if (key) pagosByMonth[key] = (pagosByMonth[key] || 0) + p.monto;
  });
  const forecastData = Object.entries(pagosByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ month: formatMonth(key), monto: value }));

  // Forecast: acuerdos value by end month
  const acuerdosByMonth: Record<string, number> = {};
  acuerdos.forEach((a) => {
    const key = getMonthKey(a.fechaFin);
    if (key) acuerdosByMonth[key] = (acuerdosByMonth[key] || 0) + a.valorTotal;
  });
  const acuerdoForecast = Object.entries(acuerdosByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ month: formatMonth(key), valor: value }));

  // KPIs summary
  const totalAlcance = kpis.reduce((s, k) => s + k.alcance, 0);
  const totalClicks = kpis.reduce((s, k) => s + k.clicks, 0);
  const avgEngagement = kpis.length > 0 ? (kpis.reduce((s, k) => s + k.engagement, 0) / kpis.length).toFixed(2) : "0";

  const totalValorAcuerdos = acuerdos.reduce((s, a) => s + a.valorTotal, 0);
  const totalPagado = pagos.filter((p) => p.estado === "Pagado").reduce((s, p) => s + p.monto, 0);
  const totalPendiente = pagos.filter((p) => p.estado === "Pendiente").reduce((s, p) => s + p.monto, 0);

  const renderPie = (data: { name: string; value: number }[], title: string) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Resumen general de todos los módulos</p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Acuerdos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{acuerdos.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Valor Total Acuerdos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">${totalValorAcuerdos.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Pagado</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">${totalPagado.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pagos Pendientes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">${totalPendiente.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Engagement Prom.</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{avgEngagement}%</div></CardContent></Card>
      </div>

      {/* Pie charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderPie(acuerdosByEstado, "Acuerdos por Estado")}
        {renderPie(pagosByEstado, "Pagos por Estado")}
        {renderPie(entregablesByTipo, "Entregables por Tipo")}
        {renderPie(entregablesByEstado, "Entregables por Estado")}
      </div>

      {/* Bar: money by influencer */}
      <Card>
        <CardHeader><CardTitle className="text-base">Inversión por Influencer</CardTitle></CardHeader>
        <CardContent>
          {moneyBarData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={moneyBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="value" fill="hsl(250, 60%, 52%)" name="Valor" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Inversión por Tipo de Contenido y Red Social */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Inversión por Tipo de Contenido</CardTitle></CardHeader>
          <CardContent>
            {moneyByTipoData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={moneyByTipoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="value" fill="hsl(38, 92%, 50%)" name="Inversión" radius={[4, 4, 0, 0]} />
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
                <BarChart data={moneyByRedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="value" fill="hsl(220, 60%, 50%)" name="Inversión" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Forecast charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Forecast Pagos por Mes</CardTitle></CardHeader>
          <CardContent>
            {forecastData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Area type="monotone" dataKey="monto" stroke="hsl(250, 60%, 52%)" fill="hsl(250, 60%, 52%)" fillOpacity={0.2} name="Monto" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Forecast Acuerdos por Mes (Fin)</CardTitle></CardHeader>
          <CardContent>
            {acuerdoForecast.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={acuerdoForecast}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Area type="monotone" dataKey="valor" stroke="hsl(152, 60%, 42%)" fill="hsl(152, 60%, 42%)" fillOpacity={0.2} name="Valor" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPIs summary bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Alcance Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalAlcance.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Clicks Totales</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Entregables</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{entregables.length}</div></CardContent></Card>
      </div>
    </div>
  );
}
