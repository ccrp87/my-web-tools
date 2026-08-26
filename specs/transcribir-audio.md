# Spec: Transcribir audio a texto

## Objetivo
Permitir al usuario obtener la transcripción en texto de un audio,
ya sea subiendo un archivo o grabando su voz en vivo desde el micrófono.

## Ruta
/transcribir-audio

## Comportamiento
1. El usuario puede elegir entre dos modos:
   - Subir un archivo de audio.
   - Grabar audio en vivo desde el micrófono.
2. En modo grabación: botón para iniciar/detener; se indica
   visualmente que está grabando.
3. Al confirmar el audio (subido o grabado), se transcribe en el
   navegador usando Whisper vía @xenova/transformers (transformers.js),
   modelo tamaño "base".
4. Durante la descarga del modelo y durante el procesamiento se muestra un indicador de carga con progreso.
5. El texto resultante se muestra en un área editable.
6. El usuario puede copiar el texto y descargarlo como archivo .txt.
7. Un botón "Limpiar" reinicia la herramienta (quita audio y texto).

## Requisitos técnicos
- Procesamiento 100% en el navegador (sin backend).
- Componente de cliente ("use client").
- Modelo Whisper tamaño "base" (dejar fácil cambiar a "small").
- Mostrar progreso de descarga del modelo la primera vez.
- Formatos de audio aceptados: mp3, wav, m4a, ogg, webm.
- Detección automática de idioma.
- Convertir tanto el archivo subido como el audio grabado al formato que Whisper espera (audio mono a 16kHz) antes de transcribir.

## Casos límite
- Archivo que no es audio → mensaje de error.
- Permiso de micrófono denegado → mensaje claro pidiendo habilitarlo.
- Audio muy largo → avisar que puede tardar, pero procesar.
- Sin audio (ni subido ni grabado) y se pulsa transcribir → aviso.

## Criterios de aceptación
- [ ] Puedo subir un archivo de audio y obtener su transcripción.
- [ ] Puedo grabar mi voz y obtener la transcripción.
- [ ] Veo progreso durante la descarga del modelo y el proceso.
- [ ] El texto aparece en un área editable.
- [ ] Puedo copiar y descargar el texto como .txt.
- [ ] El botón "Limpiar" reinicia la herramienta.

## Biblioteca de grabaciones (persistencia)

Las grabaciones hechas con el micrófono se guardan en una biblioteca
persistente que sobrevive a recargas y cierres del navegador.

### Almacenamiento
- Se usa IndexedDB (mediante la librería Dexie.js) para persistir los
  audios, ya que son datos binarios grandes no aptos para localStorage.

### Datos por grabación
- id único
- audio (Blob)
- título/nota (texto editable por el usuario)
- fecha de grabación
- transcripción asociada (si existe)

### Comportamiento
1. Al terminar una grabación, se guarda automáticamente en la
   biblioteca.
2. Se muestra una lista de las grabaciones guardadas.
3. El usuario puede asignar o editar un título/nota a cada grabación.
4. Cada grabación puede reproducirse.
5. El usuario puede eliminar una grabación puntual.
6. El usuario puede borrar todas las grabaciones (con confirmación).
7. La lista persiste tras recargar la página.

### Casos límite
- Borrar todas → pedir confirmación antes de ejecutar.
- Almacenamiento lleno del navegador → mostrar aviso.

## Selector de modelo

El usuario puede elegir el modelo de Whisper según el balance
velocidad/calidad que prefiera:
- tiny  (~muy rápido, calidad básica)
- base  (rápido, calidad aceptable) — opción por defecto
- small (más lento, mejor calidad)

### Comportamiento
- El selector muestra el nombre del modelo y una indicación de su
  peso de descarga y su balance velocidad/calidad.
- Al elegir un modelo no descargado previamente, se descarga la
  primera vez (mostrando progreso). Los ya descargados quedan
  cacheados y no se vuelven a bajar.
- El modelo por defecto es "base".
- Se avisa al usuario de que un modelo más grande da mejor calidad
  pero tarda más y pesa más.