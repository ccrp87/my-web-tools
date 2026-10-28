import Link from "next/link";

export const metadata = {
  title: "Política de privacidad",
};

export default function PoliticaPrivacidad(): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 py-16 px-6 sm:px-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Política de privacidad
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Última actualización: 28 de octubre de 2026.
          </p>
        </div>

        <div className="flex flex-col gap-6 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Qué es esta aplicación
            </h2>
            <p>
              App de Herramientas es un proyecto personal: un conjunto de
              herramientas independientes de uso gratuito. No es un producto
              comercial ni está operado por una empresa; la mantiene una
              sola persona a título individual.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Qué datos procesa cada herramienta
            </h2>
            <p>
              La mayoría de las herramientas (quitar fondo a imagen,
              transcribir audio, procesar video, calculadora de vacaciones,
              editor de diagramas Mermaid y editor de diagramas DBML) se
              ejecutan completamente en tu navegador. Los archivos y textos
              que subes o escribes no se envían a ningún servidor: se
              procesan localmente y, cuando la herramienta guarda algo entre
              visitas (por ejemplo el código de un diagrama), lo hace en el
              almacenamiento local de tu navegador (<code>localStorage</code>
              ), no en un servidor.
            </p>
            <p>
              <strong>Guardar y abrir diagramas desde Google Drive</strong>{" "}
              (editor de diagramas DBML) usa el inicio de sesión de Google
              directamente desde tu navegador, con el permiso limitado{" "}
              <code>drive.file</code>: esta aplicación solo puede acceder a
              los archivos que ella misma crea en tu Drive o a los que tú
              eliges explícitamente mediante el selector de archivos de
              Google (Picker), nunca al resto de tu Drive. La comunicación
              ocurre directamente entre tu navegador y los servidores de
              Google; el contenido de tus diagramas no pasa ni se guarda en
              ningún servidor de esta aplicación.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Cookies
            </h2>
            <p>
              No se usan cookies de seguimiento ni de análisis ni
              publicidad.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Servicios de terceros
            </h2>
            <p>
              Cuando usas la integración con Google Drive, tu información se
              rige también por la{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                política de privacidad de Google
              </a>
              .
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              Contacto
            </h2>
            <p>
              Para preguntas sobre esta política o para solicitar la
              eliminación de datos asociados a tu uso de estas herramientas,
              escribe a{" "}
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
