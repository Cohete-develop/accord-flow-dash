import { useMemo } from "react";
import { Acuerdo } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Package } from "lucide-react";
import { CHART_COLORS } from "@/lib/chart-colors";

const fmtCurrency = (v: number) => {
  if (v >= 1_000_000) return `$${Math.round(v / 1_000_000)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v).toLocaleString()}`;
};

interface Props {
  acuerdos: Acuerdo[];
}

export default function ProductFamilyReport({ acuerdos }: Props) {
  const chartData = useMemo(() => {
    const byFamilia: Record<string, { valor: number; count: number }> = {};
    acuerdos.forEach(a => {
      const fams = (a.familiaProducto || []).filter(f => f && f.trim() !== '');
      if (fams.length === 0) {
        if (!byFamilia['Sin asignar']) byFamilia['Sin asignar'] = { valor: 0, count: 0 };
        byFamilia['Sin asignar'].valor += a.valorTotal;
        byFamilia['Sin asignar'].count += 1;
      } else {
        const share = a.valorTotal / fams.length;
        fams.forEach(f => {
          if (!byFamilia[f]) byFamilia[f] = { valor: 0, count: 0 };
          byFamilia[f].valor += share;
          byFamilia[f].count += 1;
        });
      }
    });
    return Object.entries(byFamilia)
      .map(([name, d]) => ({ name, valor: Math.round(d.valor), count: d.count }))
      .sort((a, b) => b.valor - a.valor);
  }, [acuerdos]);

  const totalInversion = chartData.reduce((s, d) => s + d.valor, 0);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Inversión por Familia de Productos</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground text-center py-8">Sin datos de familias de productos</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Inversión por Familia de Productos
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Inversión total: ${totalInversion.toLocaleString()} · {chartData.length} familias · {chartData.reduce((s, d) => s + d.count, 0)} acuerdos
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Donut chart */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Distribución porcentual</p>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  dataKey="valor"
                  className="cursor-pointer"
                >
                  {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `$${Math.round(v).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
              {chartData.map((d, i) => {
                const pct = totalInversion > 0 ? Math.round((d.valor / totalInversion) * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span>{d.name} {pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bar chart */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Inversión por familia</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={11} tickFormatter={fmtCurrency} />
                <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                <Tooltip formatter={(v: number) => `$${Math.round(v).toLocaleString()}`} />
                <Bar dataKey="valor" name="Inversión" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
