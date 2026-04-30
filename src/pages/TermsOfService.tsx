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
          <p>
            <strong>Última actualización:</strong> 30 de abril de 2026 · v1.1
          </p>

          <h2>1. Aceptación de los Términos</h2>
          <p>
            Estos Términos de Servicio (los "Términos") rigen el acceso y uso de{" "}
            <strong>InfluXpert</strong>, software como servicio (SaaS) desarrollado y operado por{" "}
            <strong>Propulsión Business Solutions S.A.S.</strong>, sociedad legalmente constituida
            en Colombia, identificada con NIT <strong>901.904.636-2</strong>, con domicilio en
            Medellín, Colombia, que opera comercialmente bajo el nombre <strong>"Cohete IT"</strong>{" "}
            (en adelante "Cohete", "nosotros" o "la empresa").
          </p>
          <p>
            Al utilizar InfluXpert, usted acuerda estos Términos con Propulsión Business Solutions
            S.A.S. Si no está de acuerdo, debe abstenerse de usar el servicio.
          </p>

          <h2>2. Descripción del servicio</h2>
          <p>
            InfluXpert es una plataforma multi-tenant que permite a agencias de marketing y marcas
            gestionar campañas con influencers, integrando información de:
          </p>
          <ul>
            <li>Acuerdos comerciales con influencers</li>
            <li>Pagos asociados a esos acuerdos</li>
            <li>Entregables de contenido (Reels, Stories, UGC, etc.)</li>
            <li>Resultados (KPIs) de las publicaciones</li>
            <li>Datos de campañas pagas en plataformas externas (Google Ads, Meta Ads, TikTok Ads, LinkedIn Ads), si el usuario las conecta vía OAuth</li>
            <li>Asistente conversacional de IA (EngineXpert) que responde preguntas sobre los datos</li>
          </ul>

          <h2>3. Cuentas de usuario</h2>
          <p>
            Cada usuario debe registrarse con un correo electrónico válido y mantener la
            confidencialidad de sus credenciales. El usuario es responsable de toda actividad que
            ocurra bajo su cuenta. Cualquier uso no autorizado debe ser reportado inmediatamente a{" "}
            <a href="mailto:despeguemos@cohete-it.com">despeguemos@cohete-it.com</a>.
          </p>

          <h2>4. Planes de suscripción</h2>
          <p>
            InfluXpert se ofrece en distintos planes (Trial, Pro, Enterprise), cada uno con sus
            propias características y límites de usuarios, conexiones a plataformas y capacidades
            adicionales. Las condiciones específicas de cada plan se acuerdan comercialmente entre
            Cohete y cada cliente.
          </p>

          <h2>5. Propiedad intelectual</h2>
          <p>
            Todos los derechos de propiedad intelectual sobre el software InfluXpert, incluyendo
            código fuente, diseño, marcas, logos y documentación, son propiedad exclusiva de{" "}
            <strong>Propulsión Business Solutions S.A.S.</strong>. El uso del servicio no transfiere
            ningún derecho de propiedad intelectual al usuario.
          </p>
          <p>
            Los datos cargados por el usuario (acuerdos, pagos, métricas, etc.) son propiedad del
            usuario o del tenant correspondiente. Cohete IT solo procesa estos datos para prestar
            el servicio según se describe en la Política de Privacidad.
          </p>

          <h2>6. Conducta del usuario</h2>
          <p>El usuario se compromete a:</p>
          <ul>
            <li>No utilizar InfluXpert para fines ilegales o no autorizados.</li>
            <li>No intentar acceder a datos de otros tenants o usuarios.</li>
            <li>No realizar ingeniería inversa, descompilación o intentos de extraer el código fuente.</li>
            <li>No usar el servicio para enviar spam, contenido fraudulento o malicioso.</li>
            <li>No sobrecargar la infraestructura con uso automatizado abusivo.</li>
          </ul>
          <p>
            El incumplimiento puede resultar en suspensión o terminación inmediata de la cuenta sin
            reembolso.
          </p>

          <h2>7. Integraciones con terceros</h2>
          <p>
            InfluXpert permite conectar cuentas de Google Ads, Meta Ads, TikTok Ads y LinkedIn Ads
            vía OAuth. El usuario es responsable de:
          </p>
          <ul>
            <li>Tener autorización para conectar dichas cuentas (si pertenecen a un tercero).</li>
            <li>Cumplir con los términos de servicio de cada plataforma externa.</li>
            <li>Revocar la conexión si ya no autoriza el acceso (función disponible en Campaign Monitor).</li>
          </ul>
          <p>
            Cohete IT no es responsable de cambios en las APIs de terceros que afecten la
            funcionalidad de las integraciones.
          </p>

          <h2>8. Limitación de responsabilidad</h2>
          <p>
            InfluXpert se proporciona "tal cual" (as-is). En la máxima medida permitida por la ley:
          </p>
          <ul>
            <li>Cohete IT no garantiza que el servicio esté libre de errores o interrupciones.</li>
            <li>Cohete IT no será responsable por daños indirectos, lucro cesante, pérdida de datos o decisiones de negocio tomadas con base en la información mostrada en la plataforma.</li>
            <li>La responsabilidad total de Cohete IT, en cualquier caso, no excederá el monto pagado por el cliente en los últimos 12 meses.</li>
          </ul>

          <h2>9. Cancelación y eliminación de datos</h2>
          <p>
            El usuario o tenant puede solicitar la cancelación del servicio en cualquier momento
            escribiendo a <a href="mailto:despeguemos@cohete-it.com">despeguemos@cohete-it.com</a>.
            Los datos asociados serán eliminados en un plazo máximo de 30 días, salvo aquellos que
            debamos conservar por obligación legal.
          </p>

          <h2>10. Modificaciones a los Términos</h2>
          <p>
            Cohete IT puede modificar estos Términos ocasionalmente. Los cambios significativos se
            notificarán con al menos 30 días de anticipación al email registrado de cada usuario.
            El uso continuado del servicio después de la fecha de entrada en vigor implica
            aceptación de los nuevos Términos.
          </p>

          <h2>11. Ley aplicable y jurisdicción</h2>
          <p>
            Estos Términos se rigen por las leyes de la <strong>República de Colombia</strong>.
            Cualquier controversia derivada de los mismos será resuelta por los jueces de{" "}
            <strong>Medellín, Colombia</strong>, renunciando expresamente las partes a cualquier
            otro fuero que pudiera corresponderles.
          </p>

          <h2>12. Contacto</h2>
          <p>Para cualquier consulta sobre estos Términos:</p>
          <ul>
            <li><strong>Email:</strong> <a href="mailto:despeguemos@cohete-it.com">despeguemos@cohete-it.com</a></li>
            <li><strong>Empresa:</strong> Propulsión Business Solutions S.A.S.</li>
            <li><strong>NIT:</strong> 901.904.636-2</li>
            <li><strong>Domicilio:</strong> Medellín, Colombia</li>
          </ul>
        </article>
      </main>

      <Footer />
    </div>
  );
}