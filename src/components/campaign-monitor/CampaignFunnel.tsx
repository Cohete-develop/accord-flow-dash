import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum } from "./utils";

interface Props {
  impressions: number;
  clicks: number;
  conversions: number;
}

export function CampaignFunnel({ impressions, clicks, conversions }: Props) {
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

  const max = Math.max(impressions, 1);
  const stages = [
    { label: "Impresiones", value: impressions, w: 100, color: "hsl(217 91% 60%)" },
    { label: "Clicks", value: clicks, w: (clicks / max) * 100, color: "hsl(262 83% 58%)" },
    { label: "Conversiones", value: conversions, w: (conversions / max) * 100, color: "hsl(142 70% 45%)" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Funnel de conversión</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((s, i) => (
          <div key={s.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium">{s.label}</span>
              <span className="font-mono">{fmtNum(s.value)}</span>
            </div>
            <div className="relative h-8 bg-muted/30 rounded">
              <div
                className="absolute inset-y-0 left-0 rounded flex items-center justify-end px-2 text-xs font-medium text-white"
                style={{ width: `${Math.max(s.w, 4)}%`, background: s.color }}
              >
                {s.w > 15 ? `${s.w.toFixed(1)}%` : ""}
              </div>
            </div>
            {i === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                ↓ <span className="font-semibold">{ctr.toFixed(2)}%</span> CTR
              </p>
            )}
            {i === 1 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                ↓ <span className="font-semibold">{convRate.toFixed(2)}%</span> conversion rate
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}