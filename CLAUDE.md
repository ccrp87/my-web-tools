@AGENTS.md
# Proyecto: App de Herramientas

## Descripción
Aplicación web de herramientas independientes (quitar fondo a imágenes,
traducir documentos, etc). Cada herramienta es una ruta propia.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Estructura: cada herramienta = carpeta en app/<nombre>/

## Convenciones
- Componentes interactivos usan "use client"
- La lógica de backend va en app/api/<nombre>/route.ts
- Las specs viven en /specs/<nombre>.md

## Reglas
- Escribe siempre en TypeScript con tipado explícito.
- Sigue la estructura de carpetas existente al añadir herramientas.
- Respeta principios solid.
- Las lineas de typescripts deben terminar con punto y coma. 