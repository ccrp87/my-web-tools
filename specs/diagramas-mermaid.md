# Spec: Editor de diagramas Mermaid

## Objetivo
Permitir al usuario escribir código Mermaid y ver el diagrama
renderizado en tiempo real, con ejemplos de partida y exportación del
resultado.

## Ruta
/diagramas-mermaid

## Comportamiento
1. El usuario ve un editor de código (izquierda) y una vista previa del
   diagrama renderizado (derecha); en pantallas angostas se apilan.
2. El diagrama se vuelve a renderizar automáticamente mientras el
   usuario escribe, con un pequeño retraso (debounce) para no renderizar
   en cada pulsación.
3. Si el código tiene un error de sintaxis, la vista previa muestra un
   mensaje de error (no el último diagrama válido ni una pantalla en
   blanco), y el editor sigue siendo editable.
4. Un selector de ejemplos permite cargar una plantilla de partida por
   tipo de diagrama (flowchart, secuencia, clases, estados, ER, Gantt,
   pie). Si el editor ya tiene contenido distinto del ejemplo actual, se
   pide confirmación antes de reemplazarlo.
5. El usuario puede:
   - Copiar el código fuente al portapapeles.
   - Descargar el diagrama como archivo `.svg`.
   - Descargar el diagrama como archivo `.png`.
6. Controles de zoom (acercar, alejar, restablecer) sobre la vista
   previa; el contenedor permite desplazamiento (scroll) cuando el
   diagrama no cabe.
7. Cuando el diagrama es de tipo flowchart, al hacer clic sobre un nodo
   aparece un panel junto a él para cambiar su texto y su color. Al
   aplicar el cambio, se actualiza el código fuente (el texto del nodo y
   una línea `style <id> fill:<color>`), y el diagrama se vuelve a
   renderizar reflejándolo. Para otros tipos de diagrama, la vista previa
   sigue siendo de solo lectura: Mermaid calcula el layout
   automáticamente y no permite fijar la posición de los nodos, así que
   mover componentes libremente no es una funcionalidad ofrecida.
7. El diagrama se renderiza con el tema claro u oscuro según el tema
   activo de la aplicación, y cambia automáticamente si el usuario
   cambia el tema mientras la herramienta está abierta.
8. El código del editor se guarda en `localStorage` y se restaura al
   volver a abrir la herramienta, para no perder el trabajo al recargar.

## Requisitos técnicos
- Procesamiento 100% en el navegador (sin backend), usando la librería
  `mermaid`.
- Componente de cliente ("use client"); `mermaid` solo se importa en el
  navegador (import dinámico), nunca en el render de servidor.
- Funciones puras y testeables (nombre de archivo de descarga, lectura
  de dimensiones de un SVG, conversión de color, edición de nodos de un
  flowchart en el código fuente) viven en `app/diagramas-mermaid/lib/`,
  separadas de los componentes de UI.
- El PNG se genera dibujando el SVG resultante sobre un `<canvas>` y
  exportando con fondo blanco u oscuro acorde al tema activo, ya que un
  PNG con fondo transparente sobre texto oscuro sería ilegible.

## Casos límite
- Código vacío → se muestra un estado vacío, no un error.
- Error de sintaxis → mensaje de error legible, sin romper el editor ni
  dejar la última vista previa válida (podría confundirse con el
  resultado del código actual).
- Cambia el tipo de diagrama en el selector de ejemplos habiendo texto
  propio sin guardar → se pide confirmación.
- Falla el portapapeles o la descarga → se indica en vez de fallar en
  silencio.
- `localStorage` no disponible (modo privado estricto) → la herramienta
  funciona igual, simplemente sin persistencia entre recargas.
- Se hace clic en un nodo cuyo id o forma no se reconoce (sintaxis poco
  común) → el color igual se aplica (vía línea `style`), pero se avisa
  que el texto no pudo actualizarse automáticamente, en vez de corromper
  el código en silencio.
- Se hace clic fuera de cualquier nodo, o el diagrama no es un flowchart
  → no pasa nada (no se abre ningún panel).

## Criterios de aceptación
- [ ] Puedo escribir código Mermaid y ver el diagrama actualizarse.
- [ ] Un error de sintaxis muestra un mensaje claro sin romper el editor.
- [ ] Puedo cargar un ejemplo por tipo de diagrama.
- [ ] Puedo copiar el código y descargar el diagrama en SVG y PNG.
- [ ] Puedo acercar, alejar y restablecer el zoom de la vista previa.
- [ ] El diagrama respeta el tema claro/oscuro activo de la app.
- [ ] Al recargar la página, recupero el último código editado.
- [ ] En un flowchart, puedo hacer clic en un nodo y cambiar su texto y
      color desde la vista previa, y el código se actualiza.

## Decisiones pendientes
Ninguna.
