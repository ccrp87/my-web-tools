import type { Metadata } from "next";
import { DbmlEditor } from "./DbmlEditor";

export const metadata: Metadata = {
  title: "Editor de diagramas DBML",
  description:
    "Escribe un esquema en DBML y visualiza su diagrama entidad-relación en tiempo real, con exportación a SVG o PNG.",
};

export default function DiagramasDbmlPage(): React.JSX.Element {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-0 flex-1 flex-col p-3">
        <DbmlEditor />
      </main>
    </div>
  );
}
