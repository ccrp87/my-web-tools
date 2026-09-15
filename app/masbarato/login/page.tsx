import type { Metadata } from "next";
import { LoginForm } from "../LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión — MásBarato",
  description:
    "Inicia sesión para comparar precios entre droguerías y supermercados.",
};

export default function MasBaratoLoginPage(): React.JSX.Element {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-8 py-16 px-6 sm:px-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            MásBarato
          </h1>
          <p className="max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Esta herramienta requiere inicio de sesión.
          </p>
        </div>
        <LoginForm />
      </main>
    </div>
  );
}
