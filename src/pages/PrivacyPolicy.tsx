import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import Footer from "@/components/Footer";

export default function PrivacyPolicy() {
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
          <h1>Política de Privacidad</h1>

          <h2>1. Introducción</h2>
          <p>
            InfluXpert es un SaaS desarrollado por <strong>Cohete IT</strong> orientado a la gestión
            de campañas de marketing con influencers. Esta política describe cómo recopilamos,
            usamos, compartimos y protegemos la información de nuestros usuarios.
          </p>

          <h2>2. Datos que recopilamos</h2>
          <ul>
            <li>Datos de cuenta: nombre, correo electrónico y rol dentro de la organización.</li>
            <li>Datos de campañas conectadas desde Google Ads (a través de OAuth autorizado).</li>
            <li>Métricas de redes sociales asociadas a influencers.</li>
            <li>Información de pagos y acuerdos con influencers gestionados en la plataforma.</li>
            <li>Datos técnicos de uso (logs, sesiones, dispositivos).</li>
          </ul>

          <h2>3. Para qué los usamos</h2>
          <ul>
            <li>Gestionar campañas, acuerdos, pagos y entregables de influencers.</li>
            <li>Mostrar dashboards cruzando rendimiento de influencers vs. anuncios pagos.</li>
            <li>Generar reportes y exportaciones para nuestros clientes.</li>
            <li>Brindar soporte y mejorar continuamente el servicio.</li>
          </ul>

          <h2>4. Con quién los compartimos</h2>
          <p>Compartimos datos únicamente con proveedores necesarios para operar el servicio:</p>
          <ul>
            <li><strong>Supabase</strong> — proveedor de infraestructura backend (BaaS).</li>
            <li><strong>Lovable AI Gateway</strong> — para potenciar el asistente de IA integrado.</li>
            <li><strong>Google</strong> — para la conexión OAuth con Google Ads autorizada por el usuario.</li>
            <li><strong>Anthropic</strong> — proveedor de modelos de lenguaje utilizados por el asistente.</li>
          </ul>
          <p>No vendemos ni alquilamos datos personales a terceros.</p>

          <h2>5. Cómo los protegemos</h2>
          <ul>
            <li>Cifrado de tokens OAuth en reposo.</li>
            <li>Aislamiento por <em>tenant</em> mediante Row-Level Security (RLS).</li>
            <li>Autenticación robusta con soporte para 2FA.</li>
            <li>Comunicaciones cifradas en tránsito (HTTPS/TLS).</li>
          </ul>

          <h2>6. Derechos del usuario</h2>
          <p>
            De acuerdo con la <strong>Ley 1581 de 2012</strong> de la República de Colombia y demás
            normas aplicables, el usuario tiene derecho a acceder, rectificar, actualizar y solicitar
            la eliminación de sus datos personales. Para ejercer estos derechos puede escribirnos a{" "}
            <a href="mailto:despeguemos@cohete-it.com">despeguemos@cohete-it.com</a>.
          </p>

          <h2>7. Uso de datos de Google APIs</h2>
          <blockquote>
            InfluXpert's use and transfer to any other app of information received from Google APIs
            will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </blockquote>

          <h2>8. Contacto</h2>
          <p>
            Para cualquier consulta relacionada con esta política, contáctanos en{" "}
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