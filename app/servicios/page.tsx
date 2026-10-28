import Link from "next/link";

export const metadata = {
  title: "Condiciones del servicio",
};

export default function CondicionesServicio(): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 py-16 px-6 sm:px-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Condiciones del servicio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Última actualización: 28 de octubre de 2026.
          </p>
        </div>

        <div className="flex flex-col gap-6 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Aceptación
            </h2>
            <p>
              Al usar cualquiera de las herramientas de esta aplicación
              aceptas estas condiciones. Si no estás de acuerdo, no uses el
              sitio.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Qué es este sitio
            </h2>
            <p>
              App de Herramientas es un proyecto personal, de uso gratuito,
              mantenido por una sola persona a título individual, no por una
              empresa. No ofrece ningún nivel de servicio garantizado ni
              soporte formal.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              El servicio se ofrece «tal cual»
            </h2>
            <p>
              Las herramientas se proveen sin garantías de ningún tipo,
              explícitas o implícitas, incluyendo disponibilidad continua,
              ausencia de errores o idoneidad para un propósito particular.
              El uso es bajo tu propio riesgo.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Uso aceptable
            </h2>
            <p>
              No debes usar estas herramientas para actividades ilegales, ni
              intentar vulnerar su seguridad, ni abusar de ellas de forma que
              afecte su disponibilidad para otras personas.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Integración con Google Drive
            </h2>
            <p>
              Si eliges conectar tu cuenta de Google en el editor de
              diagramas DBML, lo haces de forma voluntaria y puedes revocar
              el acceso en cualquier momento desde la{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                configuración de tu cuenta de Google
              </a>
              . Eres responsable del contenido que guardes en tu propio
              Drive a través de esta función.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Limitación de responsabilidad
            </h2>
            <p>
              En la medida permitida por la ley, quien mantiene este sitio no
              será responsable por pérdidas o daños derivados del uso de
              estas herramientas, incluyendo pérdida de datos o archivos.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Cambios
            </h2>
            <p>
              Estas condiciones y las herramientas disponibles pueden
              cambiar en cualquier momento, sin aviso previo.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Contacto
            </h2>
            <p>
              Para preguntas sobre estas condiciones, escribe a{" "}
              <a
                href="mailto:info@ccrp87.dev"
                className="underline hover:no-underline"
              >
                info@ccrp87.dev
              </a>
              .
            </p>
          </section>
        </div>

        <Link
          href="/"
          className="text-sm text-zinc-500 underline hover:no-underline dark:text-zinc-400"
        >
          Volver al inicio
        </Link>
      </main>
    </div>
  );
}
