import type { Metadata } from "next";
import { VacationCalculator } from "./VacationCalculator";

export const metadata: Metadata = {
  title: "Calculadora de vacaciones",
  description:
    "Calcula tu fecha de reintegro, aprovecha los festivos de Colombia y genera el texto para tu solicitud de vacaciones.",
};

export default function VacacionesPage(): React.JSX.Element {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-8 py-16 px-6 sm:px-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Calculadora de vacaciones
          </h1>
          <p className="max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Calcula tu fecha de reintegro, aprovecha los festivos de Colombia
            y genera el texto para tu solicitud de vacaciones. Los festivos
            son editables.
          </p>
        </div>
        <VacationCalculator />
      </main>
    </div>
  );
}
