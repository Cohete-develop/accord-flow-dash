import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import Footer from "@/components/Footer";

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b py-6">
        <div className="container mx-auto flex justify-center px-4">
          <img src={logo} alt="InfluXpert by Cohete" className="h-14" />
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        <Link to="/auth">
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>
        </Link>

        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1>Términos de Servicio</h1>

          <h2>1. Aceptación de los términos</h2>
          <p>
            Al acceder o utilizar InfluXpert, el usuario acepta estos Términos de Servicio en su
            totalidad. Si no está de acuerdo, debe abstenerse de usar la plataforma.
          </p>

          <h2>2. Descripción del servicio</h2>
          <p>
            InfluXpert es una plataforma SaaS multi-tenant para la gestión integral de campañas de
            marketing con influencers, incluyendo acuerdos, pagos, entregables, KPIs y monitoreo de
            campañas pagas.
          </p>

          <h2>3. Cuentas de usuario y responsabilidades</h2>
          <ul>
            <li>El usuario es responsable de mantener la confidencialidad de sus credenciales.</li>
            <li>Toda actividad realizada con su cuenta es responsabilidad del titular.</li>
            <li>
              No está permitido usar la plataforma para fines ilícitos o que infrinjan derechos de
              terceros.
            </li>
          </ul>

          <h2>4. Planes y pagos</h2>
          <p>
            InfluXpert ofrece distintos planes de suscripción: <strong>Trial</strong> (período de
            prueba gratuito), <strong>Pro</strong> y <strong>Enterprise</strong>. Las condiciones
            comerciales específicas se pactan al momento de la contratación.
          </p>

          <h2>5. Propiedad intelectual</h2>
          <p>
            Todos los derechos de propiedad intelectual sobre la plataforma, su código, marca,
            logotipos y materiales asociados son propiedad exclusiva de <strong>Cohete IT</strong>.
          </p>

          <h2>6. Limitación de responsabilidad</h2>
          <p>
            InfluXpert se proporciona "tal cual". Cohete IT no será responsable por daños
            indirectos, lucro cesante o pérdidas derivadas del uso o imposibilidad de uso del
            servicio, salvo en los casos expresamente previstos por la ley aplicable.
          </p>

          <h2>7. Cancelación y eliminación de datos</h2>
          <p>
            El usuario puede solicitar la cancelación de su cuenta y la eliminación de sus datos
            escribiendo a <a href="mailto:despeguemos@cohete-it.com">despeguemos@cohete-it.com</a>. Algunos
            registros podrán conservarse por obligaciones legales o contables.
          </p>

          <h2>8. Jurisdicción</h2>
          <p>
            Estos términos se rigen por las leyes de la <strong>República de Colombia</strong>.
            Cualquier controversia será resuelta ante los jueces competentes de la ciudad de{" "}
            <strong>Medellín</strong>.
          </p>

          <h2>9. Contacto</h2>
          <p>
            Para cualquier consulta sobre estos términos, escríbenos a{" "}
            <a href="mailto:despeguemos@cohete-it.com">despeguemos@cohete-it.com</a>.
          </p>

          <p className="text-sm text-muted-foreground mt-10">
            Última actualización: 29 de abril de 2026 · v1.0
          </p>
        </article>
      </main>

      <Footer />
    </div>
  );
}