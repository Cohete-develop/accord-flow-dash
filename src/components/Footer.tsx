import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t mt-12">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground text-center">
          <span>
            © 2026 InfluXpert by Cohete IT · Propulsión Business Solutions S.A.S. · NIT 901.904.636-2
          </span>
          <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Política de Privacidad
            </Link>
            <span className="hidden md:inline">·</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Términos de Servicio
            </Link>
            <span className="hidden md:inline">·</span>
            <a
              href="mailto:despeguemos@cohete-it.com"
              className="hover:text-foreground transition-colors"
            >
              Contacto
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}