# Spec: MásBarato (comparador de precios)

## Objetivo
Portar `app/famacia/masbarato.py` (CLI) a una herramienta web dentro de la
app de herramientas: buscar un producto y comparar precio y
disponibilidad entre varias droguerías y supermercados colombianos
(Olímpica, Farmatodo, Cruz Verde, La Rebaja, Droguería Inglesa, Farmavida,
La Economía, Carulla, Makro, Alkosto, Éxito, Jumbo) desde el navegador,
sin instalar nada ni usar la terminal.

A diferencia de las demás herramientas del repo, esta **sí necesita
backend y sí requiere iniciar sesión**: las tiendas exponen APIs internas
no pensadas para consumo público (algunas con reglas de WAF, cookies de
sesión, headers específicos) y no es deseable que cualquier visitante
anónimo dispare ese tráfico desde la app.

## Ruta
`/masbarato` (protegida) · `/masbarato/login` (pública)

> Nota: la carpeta original tenía una errata (`app/famacia/`, sin la
> segunda "r"). Se renombró a `app/farmacia/` al implementar la versión
> TypeScript, y más tarde, junto con el rebrand a "MásBarato", a
> `app/masbarato/`. El `.py` original se conserva como referencia de los
> adaptadores, pero no se ejecuta ni se sirve.
>
> La ruta pública también cambió de `/farmacia` a `/masbarato`; `next.config.ts`
> redirige `/farmacia` y `/farmacia/*` a la ruta nueva (redirect permanente)
> para no romper marcadores existentes.

## Autenticación
- Usuario y contraseña **fijos**, definidos por variables de entorno
  (`FARMACIA_USER`, `FARMACIA_PASSWORD_HASH`) — no hay panel de usuarios
  ni registro. Alcanza para una sola persona o equipo compartiendo el
  acceso; si más adelante hacen falta varias cuentas, se migra a algo
  como iron-session o next-auth sin romper la interfaz de login.
- `app/api/masbarato/login/route.ts` valida las credenciales recibidas
  (la contraseña se compara contra un hash, nunca en texto plano) y, si
  son correctas, emite una cookie `httpOnly`, `secure`, `sameSite=lax`
  con una sesión firmada (HMAC con `FARMACIA_SESSION_SECRET`) que
  incluye una expiración fija de 12 horas.
- `middleware.ts` (nuevo en la raíz, con `matcher` limitado a
  `/masbarato` y `/api/masbarato`, salvo `/masbarato/login` y
  `/api/masbarato/login`) verifica la cookie en cada request y redirige a
  `/masbarato/login` si falta o expiró.
- `app/api/masbarato/logout/route.ts` borra la cookie.
- Intentos fallidos de login no bloquean la cuenta (no hay múltiples
  usuarios que proteger de fuerza bruta cruzada), pero si la contraseña
  no coincide se responde igual de rápido y con el mismo mensaje
  genérico ("usuario o contraseña incorrectos"), para no filtrar cuál de
  los dos campos fue el que falló.

## Comportamiento
1. El usuario sin sesión que entra a `/masbarato` ve el formulario de
   login (usuario + contraseña). Si falla, se muestra un único mensaje
   de error genérico sin recargar la página.
2. Con sesión activa, `/masbarato` muestra un panel lateral con el
   buscador, un control segmentado con el número de resultados por
   tienda (equivalente a `--limite`, por defecto 3) y una casilla por
   tienda (`GET /api/masbarato/tiendas`) para incluirla o excluirla de
   la búsqueda; todas empiezan seleccionadas y el botón "Comparar" se
   deshabilita si se deseleccionan todas.
3. Al buscar, el cliente llama a `app/api/masbarato/buscar/route.ts`
   (`POST { termino, limite, tiendas? }`, donde `tiendas` es la lista de
   nombres seleccionados — si viene vacía o ausente se busca en todas),
   que ejecuta en el servidor, en paralelo, la búsqueda contra cada
   tienda filtrada y devuelve un array con la forma `{ tienda,
   resultados: Resultado[], error?: string }` por tienda — igual
   estructura que `RespuestaTienda` en el script Python. Nombres de
   tienda desconocidos en `tiendas` se ignoran (no fallan la petición);
   si el filtro no deja ninguna tienda válida, se responde `400`.
4. Mientras se espera la respuesta, un indicador de progreso muestra
   cuántas de las tiendas seleccionadas ya respondieron (no un spinner
   por tienda): los resultados se acumulan en una sola lista conforme
   llegan, no en tarjetas separadas por tienda, así que un spinner por
   tienda ya no tiene un lugar propio donde vivir.
5. Layout tipo "consola": un panel lateral fijo (buscador, resultados
   por tienda, filtro de tiendas) junto a un panel de resultados con
   una barra de estadísticas (total de resultados, precio mínimo,
   precio máximo, agotados) y una **tabla única con todos los
   resultados de todas las tiendas mezclados**, ordenados de más
   barato a más caro (`ordenarPorPrecio` en `lib/resultados.ts` — mismo
   criterio que decide el "★ más barato": por precio por unidad cuando
   todos los resultados mostrados son comparables, si no por precio
   total). Cada fila muestra imagen del producto, nombre, tienda,
   presentación (cuando es reconocible), precio, precio por unidad y
   disponibilidad, con enlace a la tienda si el adaptador trae `url`;
   la primera fila (la más barata) se resalta. Un checkbox "Solo
   disponibles" (activado por defecto) filtra los agotados. En
   pantallas angostas la tabla se reemplaza por una lista vertical de
   tarjetas compactas con la misma información. Aparte de la tabla, un
   bloque final resalta el "★ más barato" global con enlace directo a
   la tienda.
6. Si una tienda falla (timeout, HTTP de error, WAF, etc.), su mensaje
   de error se muestra en un bloque de avisos separado (no tumba la
   tabla ni el resto de resultados) — igual que el modo tabla del CLI.
6. Si una tienda falla (timeout, HTTP de error, WAF, etc.) se muestra su
   mensaje de error en el lugar de sus resultados, sin tumbar el resto
   de la búsqueda — igual que el modo tabla del CLI.
7. Un botón de "Cerrar sesión" visible en la propia página de la
   herramienta.

## Búsqueda mejorada con IA (opt-in, beta)
Cada adaptador filtra localmente los resultados que no contienen todas las
palabras significativas del término (`esRelevante` en cada adaptador,
ver tabla de tiendas), porque el buscador remoto (Algolia, autocompletado,
etc.) puede aflojar la búsqueda y devolver productos sin relación real —
pero ese filtro exige coincidencia de texto **literal**, así que también
descarta coincidencias genuinas con otra forma (género/número/sinónimo:
"paños húmedos" en el término vs. "Toallitas Húmedas" en el nombre real
del producto — bug confirmado en vivo contra Farmatodo). El modo IA
reemplaza ese filtro de texto por uno de similitud semántica, corrido
enteramente en el navegador del usuario, no en el servidor.

- **Opt-in, apagado por defecto**: un switch "Búsqueda mejorada con IA
  (beta)" en el panel de búsqueda. El usuario decide activarlo; la
  elección se guarda en `localStorage` (`masbarato:modoIA`) y persiste
  entre visitas (`ComparadorPrecios.tsx`, con `useSyncExternalStore` para
  evitar parpadeo de hidratación — mismo patrón que `ThemeToggle`).
- **Servidor**: cuando el cliente manda `modoIA: true` en el body de
  `POST /api/masbarato/buscar`, la ruta ignora el `limite` pedido y usa
  uno fijo más grande (`LIMITE_MAXIMO_IA = 20`) y pasa `{ crudo: true }`
  a `crearFlujoBusqueda` → cada adaptador. Con `crudo: true`, el
  adaptador se salta su filtro de texto literal y devuelve los
  candidatos tal cual los ordenó la tienda (`Adaptador.buscar` acepta un
  tercer parámetro opcional `OpcionesBusqueda`, ver
  `adaptadores/tipos.ts`). Excepción: en Cruz Verde el tope de
  candidatos sale del propio `limite` (no hay un tope fijo aparte), así
  que ahí el modo IA también implica más llamadas HTTP para traer la
  imagen de cada candidato adicional — un tradeoff conocido, no un bug.
  La caché de cada tienda distingue modo crudo de modo filtrado (mismo
  término/límite, resultados distintos) para no pisarse entre sí.
- **Cliente**: por cada evento NDJSON que llega (uno por tienda), si
  `modoIA` está activo, `rerankearPorSimilitud` (`lib/ia/similitud.ts`)
  calcula un embedding del término buscado y de cada candidato
  (`marca + nombre`) con un modelo que corre en el propio navegador vía
  `@xenova/transformers` (ya usado en `transcribir-audio`), descarta los
  que no llegan a un umbral mínimo de similitud coseno y ordena de mayor
  a menor antes de recortar a los `limite` que el usuario pidió — ese
  recorte final sigue siendo el número que el usuario eligió en
  "Resultados por tienda" (3/5/10), no el `LIMITE_MAXIMO_IA` interno.
- **Modelo**: `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (~120 MB,
  incluye español), se descarga una sola vez por sesión del navegador y
  queda en caché del propio `@xenova/transformers` entre búsquedas y
  visitas — no se re-descarga a menos que el usuario limpie datos del
  sitio. Mientras descarga, se muestra una barra de progreso (mismo
  patrón visual que `AudioTranscriber.tsx`).
- **Por qué no todas las tiendas se benefician igual**: en adaptadores
  cuyo índice está ordenado por precio y no por relevancia (Alkosto), un
  término sin coincidencias reales puede devolver productos baratos de
  cualquier categoría — antes se descartaban por el filtro literal
  (correcto ahí, ver comentario en `alkosto.ts`); en modo IA ese filtro
  se salta, pero el propio umbral de similitud semántica del cliente
  cumple ese mismo rol de filtro, así que sigue siendo seguro saltarlo.

## Tiendas soportadas (adaptadores a portar)
| Tienda | Tipo | Notas de la versión Python a preservar |
|---|---|---|
| Olímpica | VTEX (`/api/catalog_system/pub/products/search`) | Tokeniza el término: el WAF de VTEX rechaza espacios, pero sí acepta un guion como separador, y el propio buscador de VTEX lo trata como palabra-a-palabra igual que un espacio — así que se manda el término completo (sin palabras vacías como "de"/"y"/"para") unido por guiones, en vez de solo la palabra más larga. Mandar solo una palabra era un bug real: para "aceite de oliva" se buscaba nada más "aceite" y salían resultados sin relación (dispensadores, aceite para bebé, freidoras); con `aceite-oliva` VTEX aplica su propio *AND* de relevancia sobre ambas palabras. El mismo conjunto de palabras se usa además como verificación extra en servidor sobre el texto del producto. Además de precio/stock, VTEX trae especificaciones nativas de precio-por-unidad-de-medida (`Factor Neto PUM`, `Unidad de Medida PUM Calculado`) por regulación de metrología legal colombiana; se leen cuando la unidad es "Mililitro"/"Litro"/"Gramo"/"Kilogramo" (si es "Unidad" u otra no listada, el producto no se mide por volumen/peso y no se reporta presentación). Aplica igual a los otros adaptadores VTEX (La Rebaja, Dro. Inglesa, Carulla, Éxito). El request incluye además `O=OrderByPriceASC`: sin esto, VTEX devuelve por relevancia y el producto más barato del catálogo puede quedar fuera del lote pedido (`_to`) antes incluso de llegar al recorte por `limite` — verificado en vivo contra Éxito, donde el más barato real no aparecía en absoluto en el top 5 por relevancia. |
| La Rebaja | VTEX | Mismo adaptador que Olímpica. |
| Dro. Inglesa | VTEX | Mismo adaptador. |
| Farmatodo | Algolia (`api-search.farmatodo.com`) | Acepta la consulta completa (sin tokenizar). Precio = mínimo entre `fullPrice`/`fullPriceByCity` (por ciudad, `CIUDAD = "BOG"`) y `offerPrice` si es > 0; `primePrice` se ignora por no ser comparable. |
| Cruz Verde | REST propia, tres llamadas (`search-suggestions` → `product-summary` → `detail` por producto) | **Sin el fallback de Playwright** (decisión tomada): solo las vías con `requests`/`fetch` puro — sesión de invitado vía `SESION_URL`, reintento tras 401. Si no se logra sesión, la tienda devuelve error "sin sesión" como cualquier otro fallo, en vez de bloquear la búsqueda completa. La URL del producto se arma con `pageURL` (de `product-summary`) más el ID: `https://www.cruzverde.com.co/{pageURL}/{id}.html`. La imagen no viene en `product-summary`; hay que pedirla aparte a `product-service/products/detail/{id}` (la misma ruta que usa la ficha de producto del sitio), que no admite varios IDs a la vez — se pide en paralelo solo para los resultados ya recortados a `limite`, no para todos los candidatos de la búsqueda. `search-suggestions` es un endpoint de autocompletado (pensado para texto parcial), no de búsqueda de texto completo: con términos de varias palabras aplica su propia corrección ortográfica y puede sugerir productos sin ninguna relación real (confirmado en vivo: "aceite de oliva" corrige "aceite" a "active" y sugiere un protector solar). Por eso, tras `product-summary`, se descartan localmente las sugerencias cuyo nombre+marca no contengan todas las palabras significativas del término (`palabrasSignificativas` en `adaptadores/tokenizar.ts`); si ninguna sobrevive, la tienda responde "sin resultados" en vez de mostrar algo sin relación. |
| Farmavida | Buscador ajax del tema Flatsome (WordPress + WooCommerce), `/wp-admin/admin-ajax.php?action=flatsome_ajax_search_products` | Añadida después de la primera versión; no estaba en el script Python. Acepta la consulta completa (sin tokenizar). El precio viene como HTML: si el producto está en oferta, el vigente está en `<ins>` y el tachado en `<del>`; se toma siempre el de `<ins>` cuando existe. **El endpoint no reporta stock**, así que `disponible` se asume `true` siempre — no hay forma de distinguir "agotado" de "sin dato" con lo que devuelve. Un resultado con `id: -1` y `value: "No se han encontrado productos."` significa cero resultados, no un producto; se filtra por `type === "Product"`. |
| La Economía | Plataforma Instaleap; `GET /search?name={término}` con header `RSC: 1` sobre el propio sitio (no hay API GraphQL pública con precio) | Añadida después de la primera versión. El GraphQL que usa el cliente (`nextgentheadless.instaleap.io`) solo expone sugerencias de autocompletado (sin precio) y analítica; el listado con precio/stock se resuelve enteramente en el servidor y se envía como React Server Component. Pidiendo la misma ruta con el header `RSC: 1` se obtiene ese payload sin sesión ni CORS. Se parsea línea por línea (formato `id:valorJSON` de Next.js) identificando productos por tener a la vez `sku`, `price` y `name`, en vez de reconstruir el árbol completo — más simple y resistente a cambios de estructura. Precio efectivo = `promotionPricePerSubUnit` si hay promoción activa y es menor que `price`. URL del producto: `https://www.droguerialaeconomia.com/p/{slug}`. Es la respuesta más pesada de todas las tiendas (~700 KB por búsqueda), por ser el propio árbol de la página y no un JSON compacto. La lógica de parseo del formato flight es compartida (`adaptadores/instaleap.ts`, `crearAdaptadorInstaleap`); este adaptador solo aporta el fetch con el certificado intermedio faltante. |
| Carulla | VTEX, igual que Olímpica | Primer supermercado añadido al comparador (antes solo droguerías). Mismo adaptador VTEX, con `baseUrl` `https://www.carulla.com/io` (el catálogo está proxyado bajo ese prefijo, a diferencia de Olímpica que lo expone en la raíz). No se detectó variación de precio/stock por ciudad o sales channel en el endpoint de búsqueda. |
| Éxito | VTEX, igual que Carulla | Mismo grupo empresarial que Carulla (Grupo Éxito) y misma plataforma: la raíz responde `308` redirigiendo a `/io/api/catalog_system/...`, así que `baseUrl` es `https://www.exito.com/io`. Sin variación de precio/stock detectada por ciudad. |
| Jumbo | VTEX | Cencosud (grupo distinto a Éxito/Carulla), pero misma plataforma. A diferencia de Éxito/Carulla, el catálogo responde directo en la raíz (sin redirección ni prefijo `/io`): `baseUrl` es `https://www.jumbocolombia.com`. |
| Makro | Plataforma Instaleap, igual que La Economía | Mismo esquema de producto y mismo truco `RSC: 1` que La Economía (`GET https://tienda.makro.com.co/search?name={término}`), reutilizando `crearAdaptadorInstaleap`. A diferencia de La Economía, este dominio sí envía su cadena TLS completa, así que usa el `fetch` compartido (`fetchConTimeout`) en vez del workaround de certificado. No se detectó variación por ciudad en el endpoint (el campo `location` que trae cada producto parece fijo por tenant, no seleccionable vía query param). |
| Alkosto | SAP Hybris + Algolia (`https://{appId}-dsn.algolia.net/1/indexes/{indice}/query`) | Segundo supermercado/gran superficie añadido. `appId`, `indexName` y una API key de solo-búsqueda están expuestos en el bundle público del sitio (`ACC.config.algolia`) — igual de legítimo consumirlos directo que lo que ya hacía el adaptador de Farmatodo con su propio Algolia. Precio efectivo: `discountprice_double` si el producto tiene descuento activo (el campo no viene en el hit cuando no hay oferta), si no `pricevalue_cop_double` (precio de lista). Disponibilidad: `instockflag_boolean`. URL del producto: `https://www.alkosto.com{url_es_string}` (ruta relativa que ya trae el propio hit). No se detectó variación de precio/stock por ciudad en la consulta de Algolia. Se consulta la réplica `{indexName}_price_asc` (mismos registros, orden por precio ascendente) en vez del índice normal (por relevancia) — mismo motivo que el `O=OrderByPriceASC` de VTEX: confirmado en vivo que sin esto se pierden productos más baratos que no rankean alto por relevancia. Farmatodo también es Algolia pero no tiene una réplica equivalente (no localizada); Cruz Verde, Instaleap (La Economía/Makro) y Farmavida tampoco ofrecen un mecanismo de orden por precio en su API (confirmado con pruebas directas, no solo ausencia de documentación) — para esas tiendas el orden por precio depende enteramente del reordenamiento del lado del cliente (`ordenarPorPrecio` en `lib/resultados.ts`). |

`AdaptadorHTML` (plantilla sin configurar en el script Python) no se
porta: no tiene ninguna tienda real detrás todavía.

## Requisitos técnicos
- **Sí hay backend**, a diferencia de las demás herramientas: la lógica
  de cada adaptador vive en `app/api/masbarato/buscar/route.ts` (o un
  módulo `app/api/masbarato/adaptadores/*.ts` importado desde ahí), no en
  el cliente. Las tiendas no exponen CORS para consumo desde otro
  origen y varias necesitan headers/cookies que no deben quedar
  visibles en el bundle del navegador.
- Un `fetch` por tienda, en paralelo (`Promise.allSettled`), igual que el
  `ThreadPoolExecutor` del CLI — un adaptador lento o caído no debe
  retrasar ni tumbar a los demás.
- Caché: en memoria en el proceso del servidor (`Map<clave, {datos, ts}>`
  con TTL de 30 minutos — el Python original usaba 3 horas, se acortó a
  propósito para que los precios se sientan más frescos), no en disco. Es
  deliberado: en un entorno serverless el disco no persiste entre
  invocaciones, y para el volumen de esta herramienta interna una caché
  de proceso (que se vacía al reiniciar el servidor) es suficiente y
  evita depender de una base de datos solo para esto. Solo se cachean
  respuestas exitosas: una con `error` (timeout, WAF, red) no se guarda,
  para que la siguiente búsqueda reintente en vez de quedar mostrando
  "sin resultados" hasta que expire el TTL.
- Tipos TypeScript equivalentes a los `dataclass` de Python (`Resultado`,
  `RespuestaTienda`), reutilizados entre la API route y los componentes
  de UI.
- Componentes cliente (`"use client"`) para el formulario de búsqueda y
  el listado de resultados; el layout de `/masbarato` puede ser un
  Server Component que solo decide si mostrar el login o la herramienta
  (aunque el filtro real de acceso vive en el middleware).
- Variables de entorno nuevas, documentadas en un `.env.example` (no
  committear `.env` real): `FARMACIA_USER`, `FARMACIA_PASSWORD_HASH`,
  `FARMACIA_SESSION_SECRET`.
- La página de inicio (`app/page.tsx`) suma esta herramienta a la lista,
  pero su descripción debe dejar claro que requiere inicio de sesión, ya
  que las demás no lo requieren.

## Casos límite
- Término de búsqueda vacío → el botón "Comparar" no dispara nada (sin
  error), igual que el CLI exige `termino` o muestra ayuda.
- Ninguna tienda devuelve resultados ni error (término inexistente) →
  se muestra "sin resultados" por tienda, no una pantalla vacía sin
  explicación.
- Todas las tiendas fallan → se muestra el error de cada una; no se
  interpreta como fallo de la propia herramienta.
- Cookie de sesión expirada mientras el usuario tiene la pestaña
  abierta → la siguiente búsqueda responde 401 y el cliente redirige a
  `/masbarato/login`, en vez de mostrar un error de red genérico.
- Precio no parseable o ausente → se muestra "—" (como `precio_fmt` en
  Python), nunca `NaN` ni `$0`.
- Producto regulado que requiere fórmula médica → se etiqueta, nunca se
  oculta.
- Cruz Verde sin sesión disponible → error "sin sesión" en su bloque,
  búsqueda del resto de tiendas no se afecta.

## Criterios de aceptación
- [ ] Sin sesión, entrar a `/masbarato` muestra el login y no la
      herramienta ni datos de ninguna tienda.
- [ ] Con credenciales correctas, inicio de sesión redirige a la
      herramienta y la sesión persiste 12 horas o hasta cerrar sesión.
- [ ] Con credenciales incorrectas, se ve un mensaje de error genérico.
- [ ] Puedo buscar un término y ver todos los resultados en una sola
      tabla ordenada por precio, con tienda, disponibilidad y el más
      barato resaltado.
- [ ] Si una tienda falla, veo su error puntual sin perder los
      resultados de las demás.
- [ ] Cerrar sesión me devuelve al login y una nueva visita a
      `/masbarato` vuelve a pedir credenciales.
- [ ] Repetir la misma búsqueda dentro de 3 horas responde desde caché
      (más rápido, sin nuevas llamadas a las tiendas).

## Decisiones pendientes
- Valor exacto de expiración de sesión (propuesto: 12 horas fijas) y si
  debe renovarse con actividad ("sliding") o no.
- Si el número de resultados por tienda (`--limite` en el CLI) debe ser
  configurable en la UI o queda fijo en 3.
- Si conviene loguear (server-side, sin exponerlo al cliente) los
  errores de cada adaptador para detectar cuándo una tienda cambia su
  API, igual que el modo `--descubrir` del CLI ayudaba a diagnosticar.
