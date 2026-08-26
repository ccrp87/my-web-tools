import type { Metadata } from "next";
import { AudioTranscriber } from "./AudioTranscriber";

export const metadata: Metadata = {
  title: "Transcribir audio a texto",
  description:
    "Transcribe un audio subido o grabado desde el micrófono a texto editable, directamente en el navegador.",
};

export default function TranscribirAudioPage() {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-8 py-16 px-6 sm:px-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Transcribir audio a texto
          </h1>
          <p className="max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Sube un audio o grábalo con tu micrófono y obtén su transcripción
            en texto editable. Todo el procesamiento ocurre en tu navegador.
          </p>
        </div>
        <AudioTranscriber />
      </main>
    </div>
  );
}
