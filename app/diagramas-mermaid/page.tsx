import type { Metadata } from "next";
import { MermaidEditor } from "./MermaidEditor";

export const metadata: Metadata = {
  title: "Editor de diagramas Mermaid",
  description:
    "Escribe código Mermaid y visualiza el diagrama en tiempo real, con ejemplos de partida y exportación a SVG o PNG.",
};

export default function DiagramasMermaidPage(): React.JSX.Element {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-6xl flex-col items-center gap-8 py-16 px-6 sm:px-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Editor de diagramas Mermaid
          </h1>
          <p className="max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Escribe código Mermaid y visualiza el diagrama en tiempo real.
            Todo el procesamiento ocurre en tu navegador.
          </p>
        </div>
        <MermaidEditor />
      </main>
    </div>
  );
}
