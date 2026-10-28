# Spec: Editor de diagramas DBML

## Objetivo
Permitir al usuario escribir un esquema en DBML (Database Markup
Language, el lenguaje de dbdiagram.io) y ver su diagrama
entidad-relación renderizado en tiempo real, al estilo visual de
dbdiagram.io: cajas por tabla con sus columnas, líneas que conectan
columna con columna, y notación de "pata de cuervo" para la
cardinalidad.

## Ruta
/dbml

## Comportamiento
1. El usuario ve un editor de código (izquierda) y una vista previa del
   diagrama ER renderizado (derecha); en pantallas angostas se apilan.
2. El diagrama se vuelve a renderizar automáticamente mientras el
   usuario escribe, con un pequeño retraso (debounce).
3. Si el código tiene un error de sintaxis, la vista previa muestra un
   mensaje de error (no el último diagrama válido), y el editor sigue
   siendo editable.
4. Un selector de ejemplos permite cargar una plantilla de partida
   (p. ej. un esquema de blog, uno de e-commerce). Si el editor ya
   tiene contenido distinto del ejemplo actual, se pide confirmación
   antes de reemplazarlo.
5. Cada tabla se dibuja como una caja con encabezado (nombre de la
   tabla) y una fila por columna (nombre y tipo). Las columnas que son
   llave primaria se marcan con un ícono de llave; las que participan
   en una relación (llave foránea) se marcan con un ícono distinto.
6. Cada relación (`Ref`) se dibuja como una línea que conecta la fila
   de la columna de origen con la fila de la columna de destino,
   terminada en notación de "pata de cuervo": un trazo simple en el
   extremo "uno" y una pata de cuervo en el extremo "muchos".
7. El usuario puede:
   - Copiar el código fuente al portapapeles.
   - Descargar el diagrama como archivo `.svg`.
   - Descargar el diagrama como archivo `.png`.
8. Controles de zoom (acercar, alejar, restablecer) sobre la vista
   previa; el contenedor permite desplazamiento (scroll) cuando el
   diagrama no cabe.
9. El diagrama se adapta al tema claro u oscuro activo de la
   aplicación.
10. El código del editor se guarda en `localStorage` y se restaura al
    volver a abrir la herramienta.

## Requisitos técnicos
- Procesamiento 100% en el navegador (sin backend). El parser de DBML
  es propio (`app/dbml/lib/parser/`), no se usa la librería
  oficial `@dbml/core`: esta embebe parsers SQL (MySQL/Postgres/...)
  basados en ANTLR que pesan ~35MB sin tree-shaking fiable en un
  bundler de navegador, y su alternativa ligera (`@dbml/parse`) expone
  una API de bajo nivel pensada para integraciones tipo editor/LSP
  (Monaco), no para un parseo puntual de un string. Dado que solo se
  necesita un subconjunto bien delimitado del lenguaje (Table, Ref,
  Enum), un parser propio da control total sobre la forma del modelo
  de datos y evita esa complejidad.
- El parser cubre: `Table` (con columnas, tipos, `pk`/`not null`/
  `unique`/`increment`/`default`/`note`, alias `as`, color de
  encabezado `[headercolor: #xxx]`), `Ref` (forma corta `Ref: a.x > b.y`
  y forma de bloque `Ref nombre { a.x > b.y }`, con las cuatro
  cardinalidades `<`, `>`, `-`, `<>`), relaciones inline en la columna
  (`ref: > tabla.columna`), y `Enum`. Comentarios `//` y `/* */` se
  ignoran. Fuera de alcance explícito: `Indexes`, `Note` como bloque
  independiente, `Project`, `TableGroup`, y referencias compuestas
  (`(col1, col2)`); si aparecen, se ignoran sin romper el parseo del
  resto del esquema.
- El layout de las tablas es propio: un empaquetado tipo "mampostería"
  (cada tabla nueva va a la columna visual más corta hasta el momento),
  no un layout de grafo con fuerzas. Es determinístico y suficiente
  para esquemas de tamaño típico; no busca minimizar cruces de líneas.
- El ancho de cada caja de tabla se estima a partir de la longitud de
  sus textos (nombre + tipo de columna más largos), no de una medición
  real en el DOM, para que el cálculo de layout sea una función pura y
  testeable independiente de React/el navegador.
- Funciones puras y testeables (parser, estimación de ancho de texto,
  layout, generación de los paths SVG) viven en
  `app/dbml/lib/`, separadas de los componentes de UI.
- Exportación a SVG/PNG y copiar al portapapeles reutilizan el mismo
  enfoque que la herramienta de diagramas Mermaid (un archivo propio
  dentro de esta carpeta, no una librería compartida entre
  herramientas, siguiendo la convención del proyecto de que cada
  herramienta es una carpeta independiente).

## Casos límite
- Código vacío → estado vacío, no error.
- Error de sintaxis (tabla sin cerrar, columna sin tipo, etc.) →
  mensaje de error legible con el número de línea aproximado.
- `Ref` que apunta a una tabla o columna que no existe → se ignora esa
  relación (no se dibuja la línea) sin romper el resto del diagrama; se
  avisa cuántas relaciones no se pudieron dibujar.
- Dos tablas con el mismo nombre → la segunda declaración se ignora, se
  avisa.
- `localStorage` no disponible → la herramienta funciona igual, sin
  persistencia entre recargas.
- Falla el portapapeles o la descarga → se indica en vez de fallar en
  silencio.
- Esquema sin ninguna relación → se dibujan solo las cajas de tabla,
  sin líneas.

## Criterios de aceptación
- [ ] Puedo escribir DBML y ver el diagrama ER actualizarse.
- [ ] Un error de sintaxis muestra un mensaje claro sin romper el
      editor.
- [ ] Puedo cargar un ejemplo de partida.
- [ ] Veo las columnas de cada tabla con su tipo, y las llaves primarias
      y foráneas marcadas visualmente.
- [ ] Las relaciones se dibujan como líneas columna-a-columna con
      notación de pata de cuervo según la cardinalidad declarada.
- [ ] Puedo copiar el código y descargar el diagrama en SVG y PNG.
- [ ] Puedo acercar, alejar y restablecer el zoom de la vista previa.
- [ ] El diagrama respeta el tema claro/oscuro de la app.
- [ ] Al recargar la página, recupero el último código editado.

## Decisiones pendientes
Ninguna.
