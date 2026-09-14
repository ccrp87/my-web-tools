import type { Metadata } from "next";
import { CerrarSesionBoton } from "./CerrarSesionBoton";
import { ComparadorPrecios } from "./ComparadorPrecios";

export const metadata: Metadata = {
  title: "Comparador de precios de droguerías",
  description:
    "Compara precio y disponibilidad de un medicamento entre varias droguerías colombianas.",
};

export default function FarmaciaPage(): React.JSX.Element {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-8 py-16 px-6 sm:px-16">
        <div className="flex w-full flex-col items-center gap-2 text-center">
          <div className="flex w-full items-center justify-end">
            <CerrarSesionBoton />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Comparador de precios de droguerías
          </h1>
          <p className="max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Busca un medicamento y compara precio y disponibilidad entre
            Olímpica, Farmatodo, Cruz Verde, La Rebaja, Droguería Inglesa,
            Farmavida y La Economía.
          </p>
        </div>
        <ComparadorPrecios />
      </main>
    </div>
  );
}
