# Spec: Procesar video

## Objetivo
Herramienta única que permite al usuario procesar sus propios
archivos de video localmente: extraer audio, convertir formato y
recortar. Todo en el navegador, sin subir el archivo a ningún servidor.

## Ruta
/procesar-video

## Base común (todas las operaciones)
- El usuario sube un archivo de video que ya posee.
- El procesamiento ocurre 100% en el navegador con FFmpeg.wasm
  (@ffmpeg/ffmpeg).
- Componente de cliente ("use client").
- Se muestra progreso durante la carga de FFmpeg y durante cada
  operación.
- Botón "Limpiar" para quitar el video y reiniciar.
- El resultado de cada operación se puede descargar.

## Operación 1: Extraer audio
- El usuario elige:
  - Formato de salida: mp3, wav, m4a, ogg.
  - Calidad de audio (bitrate): por ejemplo 128, 192, 256, 320 kbps
    (aplicable a formatos con compresión).
- Se extrae la pista de audio del video en el formato y calidad
  elegidos.
- El resultado se descarga conservando el nombre del original con
  la nueva extensión.

## Operación 2: Convertir formato
- El usuario elige el formato de salida del video: mp4, webm, mov, avi.
- Se convierte el video al formato elegido.
- El resultado se descarga conservando el nombre del original con
  la nueva extensión.

## Operación 3: Recortar video
- Se muestra un reproductor con previsualización del video.
- El usuario define un punto de inicio y un punto de fin del recorte
  (con controles sobre la línea de tiempo).
- Puede previsualizar el fragmento seleccionado antes de exportar.
- Se genera el fragmento recortado y se descarga.

## Requisitos técnicos
- FFmpeg.wasm cargado una sola vez y reutilizado entre operaciones.
- Formatos de entrada aceptados: mp4, mov, webm, avi, mkv.
- Nombres de descarga: nombre original + operación + extensión
  (ej: "video.mp4" → "video_audio.mp3", "video_recortado.mp4").

## Casos límite
- Archivo que no es video → mensaje de error.
- Video muy grande → avisar que puede tardar o agotar memoria, pero
  intentar.
- Operación en curso → deshabilitar controles y mostrar progreso.
- Fin del recorte anterior o igual al inicio → mensaje de validación.

## Criterios de aceptación
- [ ] Puedo subir un video y ver la interfaz de operaciones.
- [ ] Extraer audio: elijo formato y calidad, y descargo el audio.
- [ ] Convertir: elijo formato de salida y descargo el video convertido.
- [ ] Recortar: defino inicio/fin, previsualizo y descargo el fragmento.
- [ ] Veo progreso en la carga de FFmpeg y en cada operación.
- [ ] El botón "Limpiar" reinicia la herramienta.

## Fases de implementación
- Fase 1: Base común + Operación 1 (extraer audio).
- Fase 2: Operación 2 (convertir formato).
- Fase 3: Operación 3 (recortar con previsualización).