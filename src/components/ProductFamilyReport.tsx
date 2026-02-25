import { useState, useEffect, useMemo } from "react";
import { Acuerdo } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pin, PinOff, Filter, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const GRADIENT_PAIRS = [
  { start: "#7030A0", end: "#4318FF" },
  { start: "#5B21B6", end: "#6366F1" },
  { start: "#8B5CF6", end: "#3B82F6" },
  { start: "#A855F7", end: "#2563EB" },
  { start: "#7C3AED", end: "#0EA5E9" },
  { start: "#6D28D9", end: "#7C3AED" },
  { start: "#9333EA", end: "#4F46E5" },
  { start: "#581C87", end: "#6366F1" },
];

const COLORS = GRADIENT_PAIRS.map((_, i) => `url(#pfr-grad-${i})`);

const GradientDefs = () => (
  <defs>
    {GRADIENT_PAIRS.map((g, i) => (
      <linearGradient key={i} id={`pfr-grad-${i}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={g.start} />
        <stop offset="100%" stopColor={g.end} />
      </linearGradient>
    ))}
  </defs>
);

const fmtCurrency = (v: number) => {
  if (v >= 1_000_000) return `$${Math.round(v / 1_000_000)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v).toLocaleString()}`;
};

type SavedView = {
  id: string;
  familias: string[];
  influencers: string[];
  redes: string[];
  label: string;
};

const STORAGE_KEY = "dashboard_pinned_familia_views";

function loadPinnedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePinnedViews(views: SavedView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

interface Props {
  acuerdos: Acuerdo[];
}

export default function ProductFamilyReport({ acuerdos }: Props) {
  const [selectedFamilias, setSelectedFamilias] = useState<string[]>([]);
  const [selectedInfluencers, setSelectedInfluencers] = useState<string[]>([]);
  const [selectedRedes, setSelectedRedes] = useState<string[]>([]);
  const [pinnedViews, setPinnedViews] = useState<SavedView[]>(loadPinnedViews);

  useEffect(() => { savePinnedViews(pinnedViews); }, [pinnedViews]);

  // Extract unique values
  const ALL_FAMILIAS = ["Lubricantes", "Llantas", "Transmisión", "Frenos", "Luces/Iluminación", "Baterías"];
  const allFamilias = useMemo(() => {
    const fromData = new Set<string>();
    acuerdos.forEach(a => (a.familiaProducto || []).forEach(f => fromData.add(f)));
    const merged = new Set([...ALL_FAMILIAS, ...fromData]);
    return Array.from(merged).sort();
  }, [acuerdos]);

  const allInfluencers = useMemo(() => {
    return Array.from(new Set(acuerdos.map(a => a.influencer))).filter(Boolean).sort();
  }, [acuerdos]);

  const allRedes = useMemo(() => {
    const set = new Set<string>();
    acuerdos.forEach(a => (a.redSocial || []).forEach(r => set.add(r)));
    return Array.from(set).sort();
  }, [acuerdos]);

  const toggleChip = (value: string, selected: string[], setter: (v: string[]) => void) => {
    setter(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  const getFilteredAcuerdos = (familias: string[], influencers: string[], redes: string[]) => {
    return acuerdos.filter(a => {
      const matchFam = familias.length === 0 || (a.familiaProducto || []).some(f => familias.includes(f));
      const matchInf = influencers.length === 0 || influencers.includes(a.influencer);
      const matchRed = redes.length === 0 || (a.redSocial || []).some(r => redes.includes(r));
      return matchFam && matchInf && matchRed;
    });
  };

  const filteredAcuerdos = useMemo(
    () => getFilteredAcuerdos(selectedFamilias, selectedInfluencers, selectedRedes),
    [acuerdos, selectedFamilias, selectedInfluencers, selectedRedes]
  );

  // Build chart data: investment by familia
  const buildChartData = (filtered: Acuerdo[]) => {
    const byFamilia: Record<string, { valor: number; count: number }> = {};
    filtered.forEach(a => {
      const fams = (a.familiaProducto || []);
      const share = fams.length > 0 ? a.valorTotal / fams.length : 0;
      fams.forEach(f => {
        if (!byFamilia[f]) byFamilia[f] = { valor: 0, count: 0 };
        byFamilia[f].valor += share;
        byFamilia[f].count += 1;
      });
    });
    return Object.entries(byFamilia)
      .map(([name, d]) => ({ name, valor: Math.round(d.valor), count: d.count }))
      .sort((a, b) => b.valor - a.valor);
  };

  const chartData = useMemo(() => buildChartData(filteredAcuerdos), [filteredAcuerdos]);

  const hasActiveFilter = selectedFamilias.length > 0 || selectedInfluencers.length > 0 || selectedRedes.length > 0;

  const handlePin = () => {
    if (!hasActiveFilter) return;
    const label = [
      selectedFamilias.length > 0 ? selectedFamilias.join(", ") : null,
      selectedInfluencers.length > 0 ? `👤 ${selectedInfluencers.join(", ")}` : null,
      selectedRedes.length > 0 ? `📱 ${selectedRedes.join(", ")}` : null,
    ].filter(Boolean).join(" · ");
    const view: SavedView = {
      id: Date.now().toString(),
      familias: [...selectedFamilias],
      influencers: [...selectedInfluencers],
      redes: [...selectedRedes],
      label,
    };
    setPinnedViews(prev => [...prev, view]);
  };

  const removePin = (id: string) => {
    setPinnedViews(prev => prev.filter(v => v.id !== id));
  };

  const clearFilters = () => {
    setSelectedFamilias([]);
    setSelectedInfluencers([]);
    setSelectedRedes([]);
  };

  const renderChipGroup = (
    label: string,
    items: string[],
    selected: string[],
    setter: (v: string[]) => void
  ) => (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <Badge
            key={item}
            variant={selected.includes(item) ? "default" : "outline"}
            className="cursor-pointer text-xs transition-colors hover:opacity-80"
            onClick={() => toggleChip(item, selected, setter)}
          >
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );

  const renderReport = (data: ReturnType<typeof buildChartData>, title: string, height = 280) => (
    data.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-8">Sin datos para los filtros seleccionados</p>
    ) : (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <GradientDefs />
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" fontSize={11} />
          <YAxis fontSize={11} tickFormatter={fmtCurrency} />
          <Tooltip
            formatter={(v: number, name: string) => [
              name === "valor" ? `$${Math.round(v).toLocaleString()}` : v,
              name === "valor" ? "Inversión" : "Acuerdos",
            ]}
          />
          <Bar dataKey="valor" name="Inversión" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  );

  return (
    <div className="space-y-4">
      {/* Main interactive report */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Informe por Familia de Productos
            </CardTitle>
            <div className="flex gap-2">
              {hasActiveFilter && (
                <>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
                    <X className="h-3 w-3" /> Limpiar
                  </Button>
                  <Button variant="gradient" size="sm" onClick={handlePin} className="text-xs gap-1">
                    <Pin className="h-3 w-3" /> Fijar vista
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 rounded-lg bg-muted/50 border">
            {renderChipGroup("Familia de Productos", allFamilias, selectedFamilias, setSelectedFamilias)}
            {renderChipGroup("Influencer", allInfluencers, selectedInfluencers, setSelectedInfluencers)}
            {renderChipGroup("Red Social", allRedes, selectedRedes, setSelectedRedes)}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Acuerdos</p>
              <p className="text-xl font-bold">{filteredAcuerdos.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Inversión Total</p>
              <p className="text-xl font-bold">${filteredAcuerdos.reduce((s, a) => s + a.valorTotal, 0).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Familias</p>
              <p className="text-xl font-bold">{chartData.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Influencers</p>
              <p className="text-xl font-bold">
                {new Set(filteredAcuerdos.map(a => a.influencer)).size}
              </p>
            </div>
          </div>

          {renderReport(chartData, "Inversión por Familia")}
        </CardContent>
      </Card>

      {/* Pinned views */}
      {pinnedViews.map(view => {
        const viewData = buildChartData(getFilteredAcuerdos(view.familias, view.influencers, view.redes));
        const viewAcuerdos = getFilteredAcuerdos(view.familias, view.influencers, view.redes);
        return (
          <Card key={view.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Pin className="h-3.5 w-3.5 text-primary" />
                  {view.label}
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePin(view.id)}>
                  <PinOff className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {viewAcuerdos.length} acuerdos · ${viewAcuerdos.reduce((s, a) => s + a.valorTotal, 0).toLocaleString()} inversión
              </p>
            </CardHeader>
            <CardContent>
              {renderReport(viewData, view.label, 220)}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
