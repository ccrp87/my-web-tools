# Spec: Calculadora de vacaciones

## Objetivo
Ayudar al usuario a planificar sus vacaciones: saber en qué fecha se
reincorpora, ver cuántos días realmente le descuentan aprovechando fines
de semana y festivos, y generar el texto de la solicitud para recursos
humanos.

## Ruta
/vacaciones

## Comportamiento
1. El usuario indica el primer día de vacaciones mediante un selector
   de fecha propio (calendario desplegable, no el input nativo del
   navegador), con semanas de lunes a domingo, festivos de Colombia
   marcados con un punto y el día elegido resaltado. También indica
   cuántos días quiere tomar y si esos días se cuentan como "días
   hábiles" (lunes a viernes no festivos) o como "días calendario"
   (todos los días corridos).
2. La herramienta calcula y muestra:
   - La fecha de reintegro (primer día hábil después del periodo).
   - Días hábiles realmente descontados, días calendario totales, días
     seguidos sin trabajar y cuántos de esos son "gratis" (fines de
     semana/festivos pegados al periodo).
   - Un aviso si el primer día elegido ya es un día no hábil.
   - Un aviso listando los festivos que caen dentro del periodo.
3. Un calendario visual (uno o más meses) resalta en oro fuerte los días
   que se descuentan y en oro claro los días de descanso gratis, marcando
   los festivos con un punto.
4. Una tabla de "mejores fechas para empezar" sugiere hasta 5 fechas de
   inicio alternativas (buscando hacia adelante desde la fecha elegida)
   que consiguen igual o más descanso seguido gastando los mismos días
   hábiles. Cada fila permite aplicar esa fecha con un botón "Usar esta".
5. Se genera un texto plano listo para copiar (fecha de inicio, último
   día, reintegro, días hábiles/calendario solicitados y festivos
   incluidos) con un botón "Copiar texto".
6. Una sección plegable permite revisar los festivos de Colombia
   vigentes para el año de la fecha elegida (y el siguiente), quitar los
   que no apliquen en la empresa del usuario, y agregar días adicionales
   (p. ej. cierres de fin de año).

## Requisitos técnicos
- Procesamiento 100% en el navegador (sin backend); toda la lógica de
  fechas vive en `app/vacaciones/lib/` como funciones puras y
  testeables, separadas de los componentes de UI ("use client").
- El selector de fecha de inicio es un componente propio
  (`DatePicker.tsx`), no el `<input type="date">` nativo, para que el
  calendario sea consistente entre navegadores y pueda resaltar los
  festivos colombianos directamente al elegir la fecha. Se cierra al
  hacer clic afuera o al presionar Escape.
- Los festivos de Colombia se calculan (no se hardcodean año a año):
  festivos fijos, Semana Santa a partir del cálculo de la Pascua
  (algoritmo de Meeus/Jones/Butcher), y festivos móviles trasladados al
  lunes siguiente según la Ley Emiliani.
- Las fechas se manejan siempre al mediodía hora local para evitar
  desfaces por zona horaria o horario de verano.
- El modo "días hábiles" es el que corresponde a las vacaciones legales
  en Colombia (15 días hábiles por año trabajado, sin descontar
  sábados); el modo "días calendario" es una alternativa para contratos
  que cuenten distinto.

## Casos límite
- Número de días no numérico o fuera de 1–365 → no se calcula nada
  (estado vacío, sin errores en consola).
- Número de días absurdamente grande que no converge en una búsqueda
  razonable → el cálculo se aborta de forma segura (no se cuelga el
  navegador).
- Fecha de inicio en fin de semana o festivo → se avisa que ese día no
  descuenta y cuál sería el primer día hábil real.
- Festivo que cae justo en el rango de vacaciones → se lista en los
  avisos y en el texto de la solicitud.
- Festivo eliminado por el usuario y luego vuelto a agregar como
  festivo personalizado con el mismo día → el agregado manual tiene
  prioridad.
- Falla el portapapeles del navegador → el botón de copiar lo indica en
  vez de fallar silenciosamente.

## Criterios de aceptación
- [ ] Puedo elegir fecha de inicio, número de días y modo de conteo, y
      veo la fecha de reintegro actualizarse.
- [ ] Veo cuántos días hábiles se descuentan y cuántos días de descanso
      son gratis.
- [ ] El calendario visual resalta correctamente los días gastados,
      gratis y festivos.
- [ ] Puedo aplicar una fecha sugerida y el resto de la herramienta se
      recalcula con ella.
- [ ] Puedo copiar el texto de la solicitud.
- [ ] Puedo quitar un festivo que no aplique y agregar uno propio, y el
      cálculo los respeta.
