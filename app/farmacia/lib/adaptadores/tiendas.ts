import type { Adaptador } from "./tipos";
import { crearAdaptadorCruzVerde } from "./cruzverde";
import { crearAdaptadorEconomia } from "./economia";
import { crearAdaptadorFarmatodo } from "./farmatodo";
import { crearAdaptadorFlatsome } from "./flatsome";
import { crearAdaptadorVtex } from "./vtex";

// Verifica los dominios antes de confiar en ellos si una tienda cambia de plataforma.
export const TIENDAS: readonly Adaptador[] = [
  crearAdaptadorVtex("Olímpica", "https://www.olimpica.com"),
  crearAdaptadorFarmatodo(),
  crearAdaptadorCruzVerde(),
  crearAdaptadorVtex("La Rebaja", "https://www.larebajavirtual.com"),
  crearAdaptadorVtex("Dro. Inglesa", "https://www.tudrogueriavirtual.com"),
  crearAdaptadorFlatsome("Farmavida", "https://drogueriasfarmavida.com"),
  crearAdaptadorEconomia(),
];
