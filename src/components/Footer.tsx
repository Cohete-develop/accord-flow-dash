import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t mt-12">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 text-sm text-muted-foreground">
          <span>© 2026 Cohete IT · InfluXpert</span>
          <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Política de Privacidad
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Términos de Servicio
            </Link>
            <a
              href="mailto:soporte@cohete-it.com"
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