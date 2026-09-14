# Spec: Comparador de precios de droguerías

## Objetivo
Portar `app/famacia/farmacia.py` (CLI) a una herramienta web dentro de la
app de herramientas: buscar un medicamento y comparar precio y
disponibilidad entre varias droguerías colombianas (Olímpica, Farmatodo,
Cruz Verde, La Rebaja, Droguería Inglesa) desde el navegador, sin
instalar nada ni usar la terminal.

A diferencia de las demás herramientas del repo, esta **sí necesita
backend y sí requiere iniciar sesión**: las tiendas exponen APIs internas
no pensadas para consumo público (algunas con reglas de WAF, cookies de
sesión, headers específicos) y no es deseable que cualquier visitante
anónimo dispare ese tráfico desde la app.

## Ruta
`/farmacia` (protegida) · `/farmacia/login` (pública)

> Nota: la carpeta actual tiene una errata (`app/famacia/`, sin la
> segunda "r"). Se renombra a `app/farmacia/` al implementar; el
> `.py` original se conserva como referencia de los adaptadores, pero no
> se ejecuta ni se sirve — es solo el punto de partida para la versión
> TypeScript.

## Autenticación
- Usuario y contraseña **fijos**, definidos por variables de entorno
  (`FARMACIA_USER`, `FARMACIA_PASSWORD_HASH`) — no hay panel de usuarios
  ni registro. Alcanza para una sola persona o equipo compartiendo el
  acceso; si más adelante hacen falta varias cuentas, se migra a algo
  como iron-session o next-auth sin romper la interfaz de login.
- `app/api/farmacia/login/route.ts` valida las credenciales recibidas
  (la contraseña se compara contra un hash, nunca en texto plano) y, si
  son correctas, emite una cookie `httpOnly`, `secure`, `sameSite=lax`
  con una sesión firmada (HMAC con `FARMACIA_SESSION_SECRET`) que
  incluye una expiración fija de 12 horas.
- `middleware.ts` (nuevo en la raíz, con `matcher` limitado a
  `/farmacia` y `/api/farmacia`, salvo `/farmacia/login` y
  `/api/farmacia/login`) verifica la cookie en cada request y redirige a
  `/farmacia/login` si falta o expiró.
- `app/api/farmacia/logout/route.ts` borra la cookie.
- Intentos fallidos de login no bloquean la cuenta (no hay múltiples
  usuarios que proteger de fuerza bruta cruzada), pero si la contraseña
  no coincide se responde igual de rápido y con el mismo mensaje
  genérico ("usuario o contraseña incorrectos"), para no filtrar cuál de
  los dos campos fue el que falló.

## Comportamiento
1. El usuario sin sesión que entra a `/farmacia` ve el formulario de
   login (usuario + contraseña). Si falla, se muestra un único mensaje
   de error genérico sin recargar la página.
2. Con sesión activa, `/farmacia` muestra un buscador (input + botón
   "Comparar") y un control con el número de resultados por tienda
   (equivalente a `--limite`, por defecto 3).
3. Al buscar, el cliente llama a `app/api/farmacia/buscar/route.ts`
   (`POST { termino, limite }`), que ejecuta en el servidor, en
   paralelo, la búsqueda contra cada tienda y devuelve un array con la
   forma `{ tienda, resultados: Resultado[], error?: string }` por
   tienda — igual estructura que `RespuestaTienda` en el script Python.
4. Mientras se espera la respuesta, cada tienda muestra un estado de
   carga individual (spinner o skeleton), no un spinner global: como en
   el CLI, las tiendas responden a velocidades distintas y el usuario no
   debería esperar a la más lenta para ver las primeras.
5. Los resultados se agrupan por tienda. Cada resultado muestra nombre,
   precio formateado (`$12.500`, separador de miles con punto),
   disponibilidad ("agotado" si no hay stock) y, si aplica, la etiqueta
   "requiere fórmula". El precio más barato entre disponibles se
   resalta (equivalente a la ★ del CLI) con enlace a la tienda si el
   adaptador trae `url`.
6. Si una tienda falla (timeout, HTTP de error, WAF, etc.) se muestra su
   mensaje de error en el lugar de sus resultados, sin tumbar el resto
   de la búsqueda — igual que el modo tabla del CLI.
7. Un botón de "Cerrar sesión" visible en la propia página de la
   herramienta.

## Tiendas soportadas (adaptadores a portar)
| Tienda | Tipo | Notas de la versión Python a preservar |
|---|---|---|
| Olímpica | VTEX (`/api/catalog_system/pub/products/search`) | Tokeniza el término: el WAF de VTEX rechaza espacios, así que se manda solo la palabra más larga y el resto filtra en servidor sobre el bloque de texto del producto. |
| La Rebaja | VTEX | Mismo adaptador que Olímpica. |
| Dro. Inglesa | VTEX | Mismo adaptador. |
| Farmatodo | Algolia (`api-search.farmatodo.com`) | Acepta la consulta completa (sin tokenizar). Precio = mínimo entre `fullPrice`/`fullPriceByCity` (por ciudad, `CIUDAD = "BOG"`) y `offerPrice` si es > 0; `primePrice` se ignora por no ser comparable. |
| Cruz Verde | REST propia, tres llamadas (`search-suggestions` → `product-summary` → `detail` por producto) | **Sin el fallback de Playwright** (decisión tomada): solo las vías con `requests`/`fetch` puro — sesión de invitado vía `SESION_URL`, reintento tras 401. Si no se logra sesión, la tienda devuelve error "sin sesión" como cualquier otro fallo, en vez de bloquear la búsqueda completa. La URL del producto se arma con `pageURL` (de `product-summary`) más el ID: `https://www.cruzverde.com.co/{pageURL}/{id}.html`. La imagen no viene en `product-summary`; hay que pedirla aparte a `product-service/products/detail/{id}` (la misma ruta que usa la ficha de producto del sitio), que no admite varios IDs a la vez — se pide en paralelo solo para los resultados ya recortados a `limite`, no para todos los candidatos de la búsqueda. |
| Farmavida | Buscador ajax del tema Flatsome (WordPress + WooCommerce), `/wp-admin/admin-ajax.php?action=flatsome_ajax_search_products` | Añadida después de la primera versión; no estaba en el script Python. Acepta la consulta completa (sin tokenizar). El precio viene como HTML: si el producto está en oferta, el vigente está en `<ins>` y el tachado en `<del>`; se toma siempre el de `<ins>` cuando existe. **El endpoint no reporta stock**, así que `disponible` se asume `true` siempre — no hay forma de distinguir "agotado" de "sin dato" con lo que devuelve. Un resultado con `id: -1` y `value: "No se han encontrado productos."` significa cero resultados, no un producto; se filtra por `type === "Product"`. |
| La Economía | Plataforma Instaleap; `GET /search?name={término}` con header `RSC: 1` sobre el propio sitio (no hay API GraphQL pública con precio) | Añadida después de la primera versión. El GraphQL que usa el cliente (`nextgentheadless.instaleap.io`) solo expone sugerencias de autocompletado (sin precio) y analítica; el listado con precio/stock se resuelve enteramente en el servidor y se envía como React Server Component. Pidiendo la misma ruta con el header `RSC: 1` se obtiene ese payload sin sesión ni CORS. Se parsea línea por línea (formato `id:valorJSON` de Next.js) identificando productos por tener a la vez `sku`, `price` y `name`, en vez de reconstruir el árbol completo — más simple y resistente a cambios de estructura. Precio efectivo = `promotionPricePerSubUnit` si hay promoción activa y es menor que `price`. URL del producto: `https://www.droguerialaeconomia.com/p/{slug}`. Es la respuesta más pesada de todas las tiendas (~700 KB por búsqueda), por ser el propio árbol de la página y no un JSON compacto. |

`AdaptadorHTML` (plantilla sin configurar en el script Python) no se
porta: no tiene ninguna tienda real detrás todavía.

## Requisitos técnicos
- **Sí hay backend**, a diferencia de las demás herramientas: la lógica
  de cada adaptador vive en `app/api/farmacia/buscar/route.ts` (o un
  módulo `app/api/farmacia/adaptadores/*.ts` importado desde ahí), no en
  el cliente. Las tiendas no exponen CORS para consumo desde otro
  origen y varias necesitan headers/cookies que no deben quedar
  visibles en el bundle del navegador.
- Un `fetch` por tienda, en paralelo (`Promise.allSettled`), igual que el
  `ThreadPoolExecutor` del CLI — un adaptador lento o caído no debe
  retrasar ni tumbar a los demás.
- Caché: en memoria en el proceso del servidor (`Map<clave, {datos, ts}>`
  con TTL de 3 horas, igual que `CACHE_TTL` en Python), no en disco. Es
  deliberado: en un entorno serverless el disco no persiste entre
  invocaciones, y para el volumen de esta herramienta interna una caché
  de proceso (que se vacía al reiniciar el servidor) es suficiente y
  evita depender de una base de datos solo para esto.
- Tipos TypeScript equivalentes a los `dataclass` de Python (`Resultado`,
  `RespuestaTienda`), reutilizados entre la API route y los componentes
  de UI.
- Componentes cliente (`"use client"`) para el formulario de búsqueda y
  el listado de resultados; el layout de `/farmacia` puede ser un
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
  `/farmacia/login`, en vez de mostrar un error de red genérico.
- Precio no parseable o ausente → se muestra "—" (como `precio_fmt` en
  Python), nunca `NaN` ni `$0`.
- Producto regulado que requiere fórmula médica → se etiqueta, nunca se
  oculta.
- Cruz Verde sin sesión disponible → error "sin sesión" en su bloque,
  búsqueda del resto de tiendas no se afecta.

## Criterios de aceptación
- [ ] Sin sesión, entrar a `/farmacia` muestra el login y no la
      herramienta ni datos de ninguna tienda.
- [ ] Con credenciales correctas, inicio de sesión redirige a la
      herramienta y la sesión persiste 12 horas o hasta cerrar sesión.
- [ ] Con credenciales incorrectas, se ve un mensaje de error genérico.
- [ ] Puedo buscar un término y ver resultados agrupados por tienda con
      precio, disponibilidad y el más barato resaltado.
- [ ] Si una tienda falla, veo su error puntual sin perder los
      resultados de las demás.
- [ ] Cerrar sesión me devuelve al login y una nueva visita a
      `/farmacia` vuelve a pedir credenciales.
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
