# Spec: Quitar fondo a imagen

## Objetivo
Permitir al usuario subir una imagen y descargar la misma imagen
con el fondo eliminado (PNG transparente).

## Ruta
/quitar-fondo-imagen

## Comportamiento
1. El usuario ve un área para subir/arrastrar una imagen.
2. Al seleccionar una imagen, se muestra una vista previa.
3. Al pulsar "Quitar fondo", se procesa la imagen en el navegador
   usando la librería @imgly/background-removal.
4. Durante el procesamiento, el área de previsualización muestra
   un indicador de carga (loading), no un texto.
5. El resultado se muestra mediante un slider Before/After que
   permite comparar la imagen original con la de fondo eliminado
   arrastrando un divisor.
6. El usuario puede descargar el resultado como PNG.
7. Un botón "Limpiar" elimina la imagen cargada y la vista previa,
   dejando la herramienta lista para una nueva imagen.

## Requisitos técnicos
- Procesamiento 100% en el navegador (sin backend).
- Componente de cliente ("use client").
- Mostrar estado de progreso durante el procesamiento.
- Formatos aceptados: JPG, PNG, WEBP.
- El archivo descargado conserva el nombre del original y le añade
  el sufijo "_sin_fondo" antes de la extensión.
  Ejemplo: "foto.jpg" → "foto_sin_fondo.png".

## Casos límite
- Archivo que no es imagen → mostrar mensaje de error.
- Imagen muy grande → mostrar aviso pero intentar procesar.
- Mientras procesa → deshabilitar el botón.

## Criterios de aceptación
- [ ] Puedo subir una imagen y ver la vista previa.
- [ ] Al procesar, veo un indicador de progreso.
- [ ] Obtengo un PNG con fondo transparente.
- [ ] Puedo descargar el resultado.