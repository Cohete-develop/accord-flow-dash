import { useImpersonation } from "@/hooks/useImpersonation";
import { Button } from "@/components/ui/button";
import { LogOut, Eye } from "lucide-react";

export default function ImpersonationBanner() {
  const { active, stop, loading } = useImpersonation();
  if (!active) return null;
  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-amber-950 border-b border-amber-700 shadow-md">
      <div className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="font-semibold truncate">
            Impersonando: {active.company_name}
          </span>
          <span className="hidden sm:inline text-amber-900/80 truncate">
            · Estás viendo y operando como un usuario de este tenant
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="bg-white hover:bg-amber-50 border-amber-700 text-amber-950 gap-1.5 shrink-0"
          onClick={stop}
          disabled={loading}
        >
          <LogOut className="h-3.5 w-3.5" /> Salir
        </Button>
      </div>
    </div>
  );
}
