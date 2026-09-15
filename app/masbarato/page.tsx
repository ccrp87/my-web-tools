import type { Metadata } from "next";
import { CerrarSesionBoton } from "./CerrarSesionBoton";
import { ComparadorPrecios } from "./ComparadorPrecios";

export const metadata: Metadata = {
  title: "MásBarato",
  description:
    "Compara precio y disponibilidad de un producto entre varias droguerías y supermercados colombianos.",
};

export default function MasBaratoPage(): React.JSX.Element {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-6xl flex-col items-center gap-8 py-16 px-6 sm:px-16">
        <div className="flex w-full flex-col items-center gap-2 text-center">
          <div className="flex w-full items-center justify-end">
            <CerrarSesionBoton />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            MásBarato
          </h1>
          <p className="w-full text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Busca un producto y compara precio y disponibilidad entre
            Olímpica, Farmatodo, Cruz Verde, La Rebaja, Droguería Inglesa,
            Farmavida, La Economía, Carulla, Makro, Alkosto, Éxito y Jumbo.
          </p>
        </div>
        <ComparadorPrecios />
      </main>
    </div>
  );
}
