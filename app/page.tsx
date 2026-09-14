import Link from "next/link";

interface Tool {
  href: string;
  name: string;
  description: string;
}

const TOOLS: readonly Tool[] = [
  {
    href: "/quitar-fondo-imagen",
    name: "Quitar fondo a imagen",
    description:
      "Sube una imagen y descárgala con el fondo eliminado en PNG transparente.",
  },
  {
    href: "/transcribir-audio",
    name: "Transcribir audio a texto",
    description:
      "Sube un audio o grábalo con tu micrófono y obtén su transcripción en texto editable.",
  },
  {
    href: "/procesar-video",
    name: "Procesar video",
    description:
      "Sube un video y extrae su audio en el formato y calidad que elijas.",
  },
  {
    href: "/vacaciones",
    name: "Calculadora de vacaciones",
    description:
      "Calcula tu fecha de reintegro, aprovecha los festivos de Colombia y genera el texto para tu solicitud.",
  },
  {
    href: "/farmacia",
    name: "Comparador de precios de droguerías",
    description:
      "Compara precio y disponibilidad de un medicamento entre varias droguerías colombianas. Requiere inicio de sesión.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-8 py-16 px-6 sm:px-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            App de Herramientas
          </h1>
          <p className="max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Herramientas independientes que se ejecutan en tu navegador, sin
            backend.
          </p>
        </div>

        <div className="flex w-full flex-col gap-4">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex flex-col gap-1 rounded-2xl border border-black/[.08] px-6 py-5 transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:hover:bg-white/[.04]"
            >
              <span className="text-lg font-medium text-black dark:text-zinc-50">
                {tool.name}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {tool.description}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
