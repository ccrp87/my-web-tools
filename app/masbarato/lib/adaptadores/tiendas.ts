import type { Adaptador } from "./tipos";
import { crearAdaptadorAlkosto } from "./alkosto";
import { crearAdaptadorCruzVerde } from "./cruzverde";
import { crearAdaptadorEconomia } from "./economia";
import { crearAdaptadorFarmatodo } from "./farmatodo";
import { crearAdaptadorFlatsome } from "./flatsome";
import { crearAdaptadorMakro } from "./makro";
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
  crearAdaptadorVtex("Carulla", "https://www.carulla.com/io"),
  crearAdaptadorMakro(),
  crearAdaptadorAlkosto(),
  crearAdaptadorVtex("Éxito", "https://www.exito.com/io"),
  crearAdaptadorVtex("Jumbo", "https://www.jumbocolombia.com"),
];
