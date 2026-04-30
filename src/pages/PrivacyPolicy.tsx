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
          <p>
            <strong>Última actualización:</strong> 30 de abril de 2026 · v1.1
          </p>

          <h2>1. Responsable del tratamiento</h2>
          <p>
            Esta Política de Privacidad se aplica a <strong>InfluXpert</strong>, un servicio operado
            por <strong>Propulsión Business Solutions S.A.S.</strong>, sociedad legalmente
            constituida en Colombia, identificada con NIT <strong>901.904.636-2</strong>, con
            domicilio en Medellín, Colombia. Propulsión Business Solutions S.A.S. opera
            comercialmente bajo el nombre <strong>"Cohete IT"</strong> (en adelante "Cohete",
            "nosotros" o "la empresa").
          </p>
          <p><strong>Datos de contacto:</strong></p>
          <ul>
            <li>Razón social: Propulsión Business Solutions S.A.S.</li>
            <li>Nombre comercial: Cohete IT</li>
            <li>NIT: 901.904.636-2</li>
            <li>Domicilio: Medellín, Colombia</li>
            <li>Email: <a href="mailto:despeguemos@cohete-it.com">despeguemos@cohete-it.com</a></li>
          </ul>

          <h2>2. Datos que recopilamos</h2>
          <p>Para prestar el servicio de InfluXpert recopilamos las siguientes categorías de datos:</p>
          <p><strong>Datos de identificación de usuarios:</strong></p>
          <ul>
            <li>Nombre completo</li>
            <li>Dirección de correo electrónico</li>
            <li>Empresa a la que pertenece el usuario (tenant)</li>
            <li>Rol asignado dentro del sistema</li>
          </ul>
          <p><strong>Datos operativos del servicio:</strong></p>
          <ul>
            <li>Información de acuerdos comerciales con influencers (nombres, plataformas, valores, fechas)</li>
            <li>Datos de pagos a influencers (montos, fechas, estados)</li>
            <li>Métricas de entregables y KPIs de campañas</li>
          </ul>
          <p><strong>Datos de plataformas externas conectadas (cuando el usuario lo autoriza):</strong></p>
          <ul>
            <li>Información de cuentas y campañas de Google Ads, Meta Ads, TikTok Ads, LinkedIn Ads</li>
            <li>Métricas de rendimiento publicitario (impresiones, clics, conversiones, costo, etc.)</li>
            <li>Tokens de acceso OAuth (almacenados de forma cifrada)</li>
          </ul>

          <h2>3. Finalidad del tratamiento</h2>
          <p>Utilizamos los datos recopilados para:</p>
          <ul>
            <li>Permitir el funcionamiento de InfluXpert como plataforma de gestión de campañas con influencers.</li>
            <li>Generar reportes y dashboards que cruzan inversión en influencers con inversión en publicidad paga.</li>
            <li>Calcular cumplimiento de metas vs. resultados reales de las campañas.</li>
            <li>Generar alertas configurables sobre el rendimiento de campañas.</li>
            <li>Brindar un asistente de inteligencia artificial (EngineXpert) que responde preguntas sobre los datos del CRM y Campaign Monitor del usuario.</li>
            <li>Mantener la seguridad y trazabilidad del sistema mediante registros de auditoría.</li>
          </ul>

          <h2>4. Compartición con terceros</h2>
          <p>
            Los datos son compartidos exclusivamente con los siguientes proveedores de
            infraestructura, necesarios para la operación del servicio:
          </p>
          <ul>
            <li><strong>Supabase Inc.</strong> (Estados Unidos): provee la base de datos PostgreSQL, autenticación, almacenamiento de archivos y ejecución de Edge Functions. Aislamos los datos de cada cliente mediante Row-Level Security (RLS).</li>
            <li><strong>Lovable AI Gateway</strong>: provee acceso al modelo de IA Google Gemini 2.5 Flash que potencia el asistente conversacional EngineXpert.</li>
            <li><strong>Google LLC</strong>: cuando el usuario conecta su cuenta de Google Ads vía OAuth, leemos métricas de campañas de la cuenta autorizada.</li>
            <li><strong>Meta Platforms Inc., TikTok Inc., LinkedIn Corporation</strong>: cuando el usuario conecta sus respectivas cuentas publicitarias, leemos métricas de campañas de las cuentas autorizadas.</li>
          </ul>
          <p>
            <strong>No vendemos, alquilamos ni compartimos datos personales con terceros para
            fines publicitarios o comerciales propios.</strong>
          </p>

          <h2>5. Cumplimiento con políticas de Google</h2>
          <p>
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
          </p>
          <p>Específicamente:</p>
          <ul>
            <li>Solo solicitamos los permisos mínimos necesarios para la funcionalidad ofrecida.</li>
            <li>Solo usamos datos de Google Ads para mostrar al usuario información sobre sus propias campañas dentro de InfluXpert.</li>
            <li>No transferimos datos de Google APIs a otras aplicaciones o terceros, salvo cuando sea necesario para proveer el servicio que el usuario solicita o cuando lo exija la ley.</li>
            <li>No utilizamos datos de Google APIs para servir publicidad.</li>
            <li>No permitimos a humanos leer los datos de Google APIs, salvo en casos excepcionales donde el usuario lo autorice expresamente, sea necesario por razones de seguridad, o lo requiera la ley.</li>
          </ul>

          <h2>6. Seguridad de los datos</h2>
          <p>Implementamos las siguientes medidas técnicas y organizativas para proteger sus datos:</p>
          <ul>
            <li>Cifrado de tokens OAuth en base de datos.</li>
            <li>Aislamiento estricto entre tenants mediante Row-Level Security (RLS) de PostgreSQL.</li>
            <li>Autenticación con verificación en dos pasos (2FA) obligatoria para usuarios administradores.</li>
            <li>Auditoría inmutable de operaciones críticas.</li>
            <li>Comunicación cifrada vía HTTPS/TLS en todas las interacciones.</li>
            <li>Acceso restringido a datos por roles y permisos granulares.</li>
          </ul>

          <h2>7. Derechos del titular de los datos</h2>
          <p>
            De acuerdo con la <strong>Ley 1581 de 2012</strong> (Régimen General de Protección de
            Datos Personales de Colombia), usted tiene derecho a:
          </p>
          <ul>
            <li>Conocer, actualizar y rectificar sus datos personales.</li>
            <li>Solicitar prueba de la autorización otorgada para el tratamiento.</li>
            <li>Ser informado sobre el uso que se ha dado a sus datos.</li>
            <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
            <li>Revocar la autorización y/o solicitar la supresión de sus datos.</li>
            <li>Acceder gratuitamente a sus datos personales que hayan sido objeto de tratamiento.</li>
          </ul>
          <p>
            Para ejercer estos derechos, puede escribirnos a{" "}
            <strong><a href="mailto:despeguemos@cohete-it.com">despeguemos@cohete-it.com</a></strong>{" "}
            indicando su solicitud y el correo asociado a su cuenta.
          </p>

          <h2>8. Conservación de datos</h2>
          <p>
            Conservamos los datos personales durante el tiempo necesario para prestar el servicio.
            Cuando un usuario o tenant solicita la eliminación de su cuenta, todos los datos
            asociados son borrados de la base de datos en un plazo máximo de 30 días, salvo
            aquellos que debamos conservar por obligación legal.
          </p>

          <h2>9. Cambios a esta política</h2>
          <p>
            Podemos actualizar esta Política de Privacidad ocasionalmente para reflejar cambios en
            nuestras prácticas o en la legislación aplicable. La fecha de última actualización
            siempre estará visible al inicio del documento.
          </p>

          <h2>10. Contacto</h2>
          <p>
            Si tiene preguntas sobre esta Política de Privacidad o sobre el tratamiento de sus
            datos, contáctenos en:
          </p>
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