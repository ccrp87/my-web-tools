# Spec: Calculadora de vacaciones
 
## Objetivo
Ayudar al usuario a planificar sus vacaciones: saber en qué fecha se
reincorpora, ver cuántos días realmente le descuentan aprovechando fines
de semana y festivos, conocer si su periodo cae en temporada alta, y
generar el texto de la solicitud para recursos humanos.
 
Es una herramienta pública: sin cuentas, sin backend y sin
almacenamiento de ningún tipo.
 
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
   - Cuántos días del periodo caen en temporada alta y cuántos en baja,
     y cuál predomina (o "mixto" si están repartidos por igual).
   - Un aviso si el periodo coincide con alguna feria o fiesta regional,
     nombrándola y diciendo en qué ciudad ocurre.
3. Un calendario visual (uno o más meses) resalta en oro fuerte los días
   que se descuentan y en oro claro los días de descanso gratis, marcando
   los festivos con un punto. Bajo las filas de semana que caen en
   temporada alta, una banda continua lo indica.
4. Una tabla de "mejores fechas para empezar" sugiere hasta 5 fechas de
   inicio alternativas (buscando hacia adelante desde la fecha elegida)
   que consiguen igual o más descanso seguido gastando los mismos días
   hábiles. Cada fila muestra además la temporada predominante de esa
   fecha, y permite aplicarla con un botón "Usar esta".
5. La temporada es informativa por defecto: no altera el orden de las
   sugerencias ni descarta ninguna fecha. El usuario puede cambiarlo con
   un control de tres estados:
   - **Indiferente** (por defecto): la temporada solo se muestra.
   - **Excluir temporada alta**: las fechas de temporada alta salen de
     las sugerencias. Debajo de la tabla se indica cuántas se ocultaron y
     cuánto descanso daba la mejor de ellas, para que el usuario sepa a
     qué renunció y pueda revertirlo.
   - **Preferir temporada alta**: para quien viaja con hijos en
     vacaciones escolares. Las fechas de temporada alta se ordenan
     primero; las demás siguen visibles debajo.
6. Se genera un texto plano listo para copiar (fecha de inicio, último
   día, reintegro, días hábiles/calendario solicitados y festivos
   incluidos) con un botón "Copiar texto".
7. Una sección plegable permite revisar los festivos de Colombia
   vigentes para el año de la fecha elegida (y el siguiente), quitar los
   que no apliquen en la empresa del usuario, y agregar días adicionales
   (p. ej. cierres de fin de año).
8. Otra sección plegable permite revisar los periodos de temporada alta
   vigentes, quitar los que no apliquen al sector del usuario y agregar
   propios. Muestra también las ferias regionales del periodo consultado,
   como referencia. Debe advertir que la temporada alta no es una
   definición legal sino una convención comercial del sector turístico.
9. La clasificación por temporada se puede desactivar por completo. Al
   hacerlo desaparecen la banda del calendario, la columna de la tabla,
   el desglose de los resultados y el control del punto 5, y la
   herramienta se comporta exactamente como antes de existir esta
   funcionalidad.
## Requisitos técnicos
- Procesamiento 100% en el navegador (sin backend); toda la lógica de
  fechas vive en `app/vacaciones/lib/` como funciones puras y
  testeables, separadas de los componentes de UI ("use client").
- No hay persistencia de ningún tipo. Las ediciones de festivos y
  temporadas viven en memoria y se pierden al recargar. Es deliberado:
  siendo una herramienta pública sin cuentas, no guardar nada es la
  forma más simple de garantizar que ningún dato del usuario queda en
  el dispositivo. La interfaz debe dejarlo claro para que no se lea
  como un fallo.
- El selector de fecha de inicio es un componente propio
  (`DatePicker.tsx`), no el `<input type="date">` nativo, para que el
  calendario sea consistente entre navegadores y pueda resaltar los
  festivos colombianos directamente al elegir la fecha. Se cierra al
  hacer clic afuera o al presionar Escape.
- Los festivos de Colombia se calculan (no se hardcodean año a año):
  festivos fijos, Semana Santa a partir del cálculo de la Pascua
  (algoritmo de Meeus/Jones/Butcher), y festivos móviles trasladados al
  lunes siguiente según la Ley Emiliani.
- La temporada es binaria: alta o baja. No hay niveles intermedios. Una
  fecha es alta si cae en alguno de los periodos definidos, y baja en
  cualquier otro caso.
- Las temporadas también se calculan, no se hardcodean. Viven en
  `lib/temporadas.ts` y dependen solo de `easter` y del traslado al
  lunes, no del mapa de festivos ya resuelto. Eso las hace
  independientes de las ediciones que el usuario haga en los festivos, y
  permite calcularlas en cualquier orden.
- Los puentes festivos no son temporada. Ya son visibles en el
  calendario por su punto de festivo, y marcarlos además con banda sería
  decir dos veces lo mismo ocupando dos canales.
- Festivos y temporadas usan estructuras distintas a propósito: un
  festivo es un punto (`Map<ISO, nombre>`), una temporada es un rango
  (lista de intervalos con nombre). Expandir un mes de temporada alta a
  treinta claves sería desperdicio e impediría mostrarle al usuario el
  periodo como unidad con su nombre.
- Los periodos de temporada alta pueden solaparse entre sí sin
  consecuencia: la pertenencia es la unión de todos ellos. Al listarlos
  en el aviso o en la sección plegable se nombran todos los que
  apliquen.
- Las ferias regionales son puramente informativas: no son temporada, no
  entran en el desglose por días, no alteran el orden de las sugerencias
  y el control del punto 5 las ignora. Solo generan el aviso del punto 2.
  La razón es que su efecto es local: la Feria de las Flores no encarece
  nada en Cartagena, así que clasificarlas como temporada alta nacional
  sería falso.
- La temporada nunca filtra por su cuenta. Solo se descartan fechas
  cuando el usuario elige explícitamente "excluir temporada alta", y aun
  entonces se le dice qué quedó fuera. El sistema informa; el usuario
  decide.
- La herramienta no modela restricciones de la empresa del usuario
  (cierres contables, temporadas de inventario, periodos sin vacaciones).
  No hay forma de conocerlas ni de verificarlas, y fingir que sí las
  contempla daría una falsa sensación de que las sugerencias ya están
  aprobadas.
- No se combinan descanso y temporada en un puntaje único: exigiría un
  peso arbitrario y produciría un orden que el usuario no puede
  explicarse. Con el control activo se parte en dos grupos y se ordena
  por descanso dentro de cada uno.
- La separación mínima entre fechas sugeridas (para no ofrecer cinco
  lunes de la misma semana) se aplica dentro de cada grupo, no sobre el
  conjunto completo.
- La temporada no se pinta en las celdas del calendario. El oro ya
  significa consumo de saldo y un segundo significado sobre el mismo
  canal arruinaría la lectura inmediata. Va como banda bajo la semana:
  es un canal independiente, binario, y sobrevive a la escala de grises.
- Las fechas se manejan siempre al mediodía hora local para evitar
  desfaces por zona horaria o horario de verano.
- El modo "días hábiles" es el que corresponde a las vacaciones legales
  en Colombia (15 días hábiles por año trabajado, sin descontar
  sábados); el modo "días calendario" es una alternativa para contratos
  que cuenten distinto.
- Con la temporada desactivada la ruta de ejecución debe ser la
  original, no una versión con condicionales inertes. Es lo que hace
  verificable la no regresión con los tests existentes, sin tocarlos.
## Definición de temporada alta
Valores por defecto, editables por el usuario. Recogen el uso del sector
turístico y el calendario escolar oficial; no tienen respaldo normativo.
Todo lo que no caiga en estos periodos es temporada baja.
 
| Periodo                        | Definición                            |
|--------------------------------|---------------------------------------|
| Vacaciones de fin de año       | 15 dic – 15 ene                       |
| Semana Santa                   | Sábado previo a Ramos → Resurrección  |
| Vacaciones escolares mitad año | 15 jun – 15 jul                       |
| Receso escolar de octubre      | Semana del lunes al que se traslada el 12 de octubre |
 
## Ferias regionales
Solo informativas, según el requisito técnico correspondiente. Afectan
precios y ocupación únicamente en su ciudad.
 
| Feria                          | Ciudad       | Fechas                          |
|--------------------------------|--------------|---------------------------------|
| Carnaval de Negros y Blancos   | Pasto        | 2 – 7 de enero                  |
| Feria de Manizales             | Manizales    | Primera semana de enero         |
| Carnaval de Barranquilla       | Barranquilla | Sábado a martes previos al Miércoles de Ceniza |
| Festival Vallenato             | Valledupar   | Finales de abril                |
| Feria de las Flores            | Medellín     | Primeros días de agosto         |
| Feria de Cali                  | Cali         | 25 – 30 de diciembre            |
 
Solo el Carnaval de Barranquilla y las de fecha fija son exactas. Las
demás las fijan sus organizadores cada año y aquí van aproximadas. El
aviso del punto 2 debe decirlo, porque es una referencia, no un dato
verificable.
 
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
- Periodo repartido entre temporada alta y baja → se muestra el desglose
  por días, no una etiqueta única.
- Periodo partido exactamente por mitades → se declara "mixto" en vez de
  forzar una predominante.
- Periodo de fin de año que cruza el cambio de año → la temporada alta
  se lee de corrido, sin corte artificial en enero.
- El usuario excluye la temporada alta y no queda ninguna fecha
  conforme en el horizonte de búsqueda → no se muestra una tabla vacía;
  se dice explícitamente y se ofrece volver al modo indiferente.
- El usuario excluye la temporada alta y su propia fecha elegida cae en
  ella → la fecha elegida sigue mostrándose como referencia, marcada.
  El control filtra sugerencias, no impide elegir.
- El usuario borra todos los periodos de temporada alta → todo queda en
  temporada baja y el control del punto 5 deja de tener efecto; se
  indica en vez de fallar en silencio.
- El periodo coincide con varias ferias regionales a la vez → se listan
  todas; no hay jerarquía entre ellas.
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
- [ ] Veo cuántos días de mi periodo caen en temporada alta y cuántos en
      baja.
- [ ] Si mi periodo coincide con una feria regional, se me dice cuál y
      en qué ciudad, sin que eso cambie la clasificación ni el orden de
      las sugerencias.
- [ ] El calendario muestra la temporada alta sin que pierda legibilidad
      lo que ya mostraba.
- [ ] La tabla de sugerencias indica la temporada de cada fecha, y se ve
      que las de más descanso suelen ser las de temporada alta.
- [ ] Por defecto la temporada no cambia el orden ni oculta nada.
- [ ] Si activo "excluir temporada alta", esas fechas desaparecen de las
      sugerencias y se me dice cuántas y qué me perdí.
- [ ] Puedo desactivar la temporada por completo y la herramienta queda
      igual que antes.
## Decisiones pendientes
Ninguna.
 