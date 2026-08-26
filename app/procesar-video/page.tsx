import type { Metadata } from "next";
import { VideoProcessor } from "./VideoProcessor";

export const metadata: Metadata = {
  title: "Procesar video",
  description:
    "Extrae el audio de un video directamente en el navegador, eligiendo formato y calidad.",
};

export default function ProcesarVideoPage() {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-8 py-16 px-6 sm:px-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Procesar video
          </h1>
          <p className="max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Sube un video y extrae su audio en el formato y calidad que
            elijas. Todo el procesamiento ocurre en tu navegador.
          </p>
        </div>
        <VideoProcessor />
      </main>
    </div>
  );
}
