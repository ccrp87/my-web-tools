import type { Metadata } from "next";
import { BackgroundRemover } from "./BackgroundRemover";

export const metadata: Metadata = {
  title: "Quitar fondo a imagen",
  description:
    "Elimina el fondo de una imagen directamente en el navegador y descárgala en PNG con fondo transparente.",
};

export default function QuitarFondoImagenPage() {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-8 py-16 px-6 sm:px-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Quitar fondo a imagen
          </h1>
          <p className="max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Sube una imagen, elimina su fondo y descarga el resultado en PNG
            con fondo transparente. Todo el procesamiento ocurre en tu
            navegador.
          </p>
        </div>
        <BackgroundRemover />
      </main>
    </div>
  );
}
