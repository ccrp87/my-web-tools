export interface DiagramExample {
  key: string;
  label: string;
  code: string;
}

export const DIAGRAM_EXAMPLES: readonly DiagramExample[] = [
  {
    key: "flowchart",
    label: "Diagrama de flujo",
    code: `flowchart TD
    A[Inicio] --> B{¿Hay datos?}
    B -->|Sí| C[Procesar datos]
    B -->|No| D[Mostrar error]
    C --> E[Guardar resultado]
    E --> F[Fin]
    D --> F`,
  },
  {
    key: "sequence",
    label: "Secuencia",
    code: `sequenceDiagram
    participant U as Usuario
    participant A as App
    participant S as Servidor
    U->>A: Escribe código Mermaid
    A->>A: Renderiza vista previa
    U->>A: Pulsa "Descargar"
    A->>S: (sin backend, todo local)
    A-->>U: Entrega el archivo`,
  },
  {
    key: "class",
    label: "Clases",
    code: `classDiagram
    class Herramienta {
      +String nombre
      +renderizar()
    }
    class DiagramaMermaid {
      +String codigo
      +exportarSVG()
      +exportarPNG()
    }
    Herramienta <|-- DiagramaMermaid`,
  },
  {
    key: "state",
    label: "Estados",
    code: `stateDiagram-v2
    [*] --> Editando
    Editando --> Renderizando: cambia el código
    Renderizando --> Editando: diagrama válido
    Renderizando --> Error: error de sintaxis
    Error --> Editando: corrige el código`,
  },
  {
    key: "er",
    label: "Entidad-relación",
    code: `erDiagram
    USUARIO ||--o{ DIAGRAMA : crea
    DIAGRAMA ||--|| EJEMPLO : "parte de"
    USUARIO {
      string nombre
    }
    DIAGRAMA {
      string codigo
      string tipo
    }`,
  },
  {
    key: "gantt",
    label: "Gantt",
    code: `gantt
    title Plan de la herramienta
    dateFormat YYYY-MM-DD
    section Diseño
    Definir spec       :done, a1, 2026-10-01, 3d
    section Desarrollo
    Editor y vista previa :active, a2, after a1, 5d
    Exportación SVG/PNG   : a3, after a2, 2d`,
  },
  {
    key: "pie",
    label: "Circular (pie)",
    code: `pie title Tipos de diagrama más usados
    "Flowchart" : 45
    "Secuencia" : 25
    "Clases" : 15
    "Estados" : 15`,
  },
] as const;

export const DEFAULT_DIAGRAM_EXAMPLE: DiagramExample = DIAGRAM_EXAMPLES[0];
