"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent } from "react";
import { CodeEditor } from "./CodeEditor";
import { DiagramLibraryPanel } from "./DiagramLibraryPanel";
import { DiagramToolbar } from "./DiagramToolbar";
import type { AutoSyncState, CopyState, DriveActionState } from "./DiagramToolbar";
import type { AreaEditPatch, ColumnEditPatch, TableEditPatch } from "./EditPopover";
import { ErDiagramPreview } from "./ErDiagramPreview";
import type { ErDiagramPreviewHandle } from "./ErDiagramPreview";
import {
  copyTextToClipboard,
  downloadPngFromSvg,
  downloadSvgMarkup,
  downloadTextFile,
} from "./exportDiagram";
import { ImportSqlModal } from "./ImportSqlModal";
import { buildDiagramFileName, buildSqlFileName } from "./lib/download";
import { DEFAULT_DBML_EXAMPLE } from "./lib/examples";
import {
  clearGoogleDriveAccessToken,
  createDbmlFileInDrive,
  downloadDriveFileContent,
  getGoogleDriveAccessToken,
  openGoogleDrivePicker,
  updateDbmlFileInDrive,
} from "./lib/googleDrive";
import type { DrivePickedFile } from "./lib/googleDrive";
import type { SavedDiagram } from "./lib/library";
import { parseDbml } from "./lib/parser/parseDbml";
import type { DbmlSchema } from "./lib/parser/types";
import { serializeDbml } from "./lib/serializer/serializeDbml";
import { generateSql } from "./lib/sql/generateSql";
import type { SqlDialect } from "./lib/sql/generateSql";
import { parseSqlImport } from "./lib/sqlImport/parseSqlImport";
import type { SqlImportDialect } from "./lib/sqlImport/types";

const STORAGE_KEY: string = "diagramas-dbml:code";
const CODE_CHANGE_EVENT: string = "diagramas-dbml-code-change";
const LIBRARY_STORAGE_KEY: string = "diagramas-dbml:library";
const PARSE_DEBOUNCE_MS: number = 350;
const COPY_FEEDBACK_MS: number = 1600;
const DRIVE_FEEDBACK_MS: number = 2000;
const DRIVE_AUTO_SYNC_DEBOUNCE_MS: number = 1500;

function readSavedDiagrams(): SavedDiagram[] {
  try {
    const raw: string | null = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedDiagram[]) : [];
  } catch {
    return [];
  }
}

function writeSavedDiagrams(diagrams: SavedDiagram[]): void {
  try {
    window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(diagrams));
  } catch {
    // Almacenamiento no disponible: los diagramas guardados no persisten entre recargas.
  }
}

function readStoredCode(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Escribe el código y avisa a este mismo hook (vía evento) de que el valor cambió. */
function writeStoredCode(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Almacenamiento no disponible (p. ej. modo privado): se pierde la
    // persistencia entre recargas, pero la herramienta sigue funcionando.
  }
  window.dispatchEvent(new Event(CODE_CHANGE_EVENT));
}

/** Reacciona a cambios propios (evento local) y a cambios desde otras pestañas (storage). */
function subscribeToStoredCode(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CODE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CODE_CHANGE_EVENT, onStoreChange);
  };
}

function getStoredCodeSnapshot(): string {
  const stored: string | null = readStoredCode();
  // `stored === ""` significa que el usuario vació el editor a propósito: debe
  // respetarse (estado vacío), no confundirse con "nunca se guardó nada".
  return stored !== null ? stored : DEFAULT_DBML_EXAMPLE.code;
}

function getServerCodeSnapshot(): string {
  return DEFAULT_DBML_EXAMPLE.code;
}

export function DbmlEditor(): React.JSX.Element {
  const code = useSyncExternalStore(
    subscribeToStoredCode,
    getStoredCodeSnapshot,
    getServerCodeSnapshot,
  );
  const [debouncedCode, setDebouncedCode] = useState<string>(code);
  const [lastLoadedExampleCode, setLastLoadedExampleCode] = useState<string>(
    DEFAULT_DBML_EXAMPLE.code,
  );
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState<boolean>(false);
  const [savedDiagrams, setSavedDiagrams] = useState<SavedDiagram[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isImportSqlOpen, setIsImportSqlOpen] = useState<boolean>(false);
  const [importSqlError, setImportSqlError] = useState<string | null>(null);
  const [saveToDriveState, setSaveToDriveState] = useState<DriveActionState>("idle");
  const [openFromDriveState, setOpenFromDriveState] = useState<DriveActionState>("idle");
  const [openDriveFile, setOpenDriveFile] = useState<DrivePickedFile | null>(null);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(false);
  const [autoSyncState, setAutoSyncState] = useState<AutoSyncState>("idle");
  const [driveSyncDebouncedCode, setDriveSyncDebouncedCode] = useState<string>(code);
  const lastSyncedCodeRef = useRef<string>(code);

  const previewRef = useRef<ErDiagramPreviewHandle>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driveFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      setDebouncedCode(code);
    }, PARSE_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [code]);

  useEffect(() => {
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      setDriveSyncDebouncedCode(code);
    }, DRIVE_AUTO_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [code]);

  useEffect(() => {
    if (!openDriveFile) {
      setIsAutoSyncEnabled(false);
    }
  }, [openDriveFile]);

  useEffect(() => {
    if (!isAutoSyncEnabled || !openDriveFile) return;
    if (driveSyncDebouncedCode === lastSyncedCodeRef.current) return;

    const codeToSync: string = driveSyncDebouncedCode;
    const fileId: string = openDriveFile.id;
    setAutoSyncState("syncing");

    void (async () => {
      try {
        const accessToken = await getGoogleDriveAccessToken();
        await updateDbmlFileInDrive(accessToken, fileId, codeToSync);
        lastSyncedCodeRef.current = codeToSync;
        setAutoSyncState("synced");
      } catch {
        clearGoogleDriveAccessToken();
        setAutoSyncState("error");
      }
    })();
  }, [driveSyncDebouncedCode, isAutoSyncEnabled, openDriveFile]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }
      if (driveFeedbackTimeoutRef.current) {
        clearTimeout(driveFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const hasLoadedLibraryRef = useRef<boolean>(false);

  useEffect(() => {
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      setSavedDiagrams(readSavedDiagrams());
      hasLoadedLibraryRef.current = true;
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hasLoadedLibraryRef.current) return;
    writeSavedDiagrams(savedDiagrams);
  }, [savedDiagrams]);

  const parseResult = useMemo(() => parseDbml(debouncedCode), [debouncedCode]);
  const schema: DbmlSchema | null =
    debouncedCode.trim() === "" ? null : parseResult.ok ? parseResult.schema : null;
  const errorMessage: string | null =
    debouncedCode.trim() === "" || parseResult.ok
      ? null
      : `Línea ${parseResult.error.line}: ${parseResult.error.message}`;
  const errorLine: number | null =
    debouncedCode.trim() === "" || parseResult.ok ? null : parseResult.error.line;
  const warnings: readonly string[] = parseResult.ok ? parseResult.schema.warnings : [];

  const handleCodeChange = useCallback(
    (nextCode: string): void => {
      writeStoredCode(nextCode);
    },
    [],
  );

  const handleRequestFileUpload = useCallback((): void => {
    fileInputRef.current?.click();
  }, []);

  const handleOpenImportSql = useCallback((): void => {
    setImportSqlError(null);
    setIsImportSqlOpen(true);
  }, []);

  const handleCloseImportSql = useCallback((): void => {
    setIsImportSqlOpen(false);
    setImportSqlError(null);
  }, []);

  const handleImportSql = useCallback(
    (sql: string, dialect: SqlImportDialect): void => {
      const result = parseSqlImport(sql, dialect);
      if (!result.ok) {
        setImportSqlError(result.error);
        return;
      }

      const isDirty: boolean = code !== lastLoadedExampleCode;
      if (isDirty) {
        const confirmed: boolean = window.confirm(
          "Esto reemplazará el código actual por el esquema importado. ¿Continuar?",
        );
        if (!confirmed) return;
      }

      const nextCode: string = serializeDbml(result.schema);
      writeStoredCode(nextCode);
      setLastLoadedExampleCode(nextCode);
      setOpenDriveFile(null);
      setExportError(null);
      setIsImportSqlOpen(false);
      setImportSqlError(null);

      if (result.schema.warnings.length > 0) {
        window.alert(`Se importó con algunos avisos:\n\n${result.schema.warnings.join("\n")}`);
      }
    },
    [code, lastLoadedExampleCode],
  );

  const handleFileSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      const isDirty: boolean = code !== lastLoadedExampleCode;
      if (isDirty) {
        const confirmed: boolean = window.confirm(
          "Esto reemplazará el código actual por el contenido del archivo. ¿Continuar?",
        );
        if (!confirmed) return;
      }

      const reader = new FileReader();
      reader.onload = (): void => {
        const content = typeof reader.result === "string" ? reader.result : "";
        writeStoredCode(content);
        setLastLoadedExampleCode(content);
        setOpenDriveFile(null);
      };
      reader.onerror = (): void => setExportError("No se pudo leer el archivo.");
      reader.readAsText(file);
    },
    [code, lastLoadedExampleCode],
  );

  const handleSaveCurrentAsNew = useCallback((): void => {
    const name: string | null = window.prompt("Nombre para este diagrama:", "");
    if (!name || !name.trim()) return;

    const diagram: SavedDiagram = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      code,
      updatedAt: Date.now(),
    };
    setSavedDiagrams((current) => [...current, diagram]);
  }, [code]);

  const handleOpenSavedDiagram = useCallback(
    (id: string): void => {
      const diagram = savedDiagrams.find((candidate) => candidate.id === id);
      if (!diagram) return;

      const isDirty: boolean = code !== lastLoadedExampleCode;
      if (isDirty) {
        const confirmed: boolean = window.confirm(
          "Esto reemplazará el código actual por el diagrama guardado. ¿Continuar?",
        );
        if (!confirmed) return;
      }

      writeStoredCode(diagram.code);
      setLastLoadedExampleCode(diagram.code);
      setOpenDriveFile(null);
      setIsLibraryOpen(false);
    },
    [savedDiagrams, code, lastLoadedExampleCode],
  );

  const handleDeleteSavedDiagram = useCallback((id: string): void => {
    setSavedDiagrams((current) => current.filter((diagram) => diagram.id !== id));
  }, []);

  const handleCopyCode = useCallback((): void => {
    if (copyFeedbackTimeoutRef.current) {
      clearTimeout(copyFeedbackTimeoutRef.current);
    }

    void copyTextToClipboard(code).then((didCopy) => {
      setCopyState(didCopy ? "copied" : "error");
      copyFeedbackTimeoutRef.current = setTimeout(() => setCopyState("idle"), COPY_FEEDBACK_MS);
    });
  }, [code]);

  const handleDownloadDbml = useCallback((): void => {
    try {
      downloadTextFile(code, buildDiagramFileName("dbml"), "text/plain;charset=utf-8");
      setExportError(null);
    } catch {
      setExportError("No se pudo descargar el archivo DBML.");
    }
  }, [code]);

  const handleSaveToDrive = useCallback((): void => {
    if (driveFeedbackTimeoutRef.current) {
      clearTimeout(driveFeedbackTimeoutRef.current);
    }
    setSaveToDriveState("working");

    void (async () => {
      try {
        const accessToken = await getGoogleDriveAccessToken();
        if (openDriveFile) {
          await updateDbmlFileInDrive(accessToken, openDriveFile.id, code);
        } else {
          const createdFile = await createDbmlFileInDrive(
            accessToken,
            buildDiagramFileName("dbml"),
            code,
          );
          setOpenDriveFile(createdFile);
        }
        lastSyncedCodeRef.current = code;
        setExportError(null);
        setSaveToDriveState("done");
      } catch (error) {
        clearGoogleDriveAccessToken();
        setExportError(
          error instanceof Error
            ? error.message
            : "No se pudo guardar el diagrama en Google Drive.",
        );
        setSaveToDriveState("error");
      } finally {
        driveFeedbackTimeoutRef.current = setTimeout(
          () => setSaveToDriveState("idle"),
          DRIVE_FEEDBACK_MS,
        );
      }
    })();
  }, [code, openDriveFile]);

  const handleOpenFromDrive = useCallback((): void => {
    if (driveFeedbackTimeoutRef.current) {
      clearTimeout(driveFeedbackTimeoutRef.current);
    }
    setOpenFromDriveState("working");

    void (async () => {
      try {
        const accessToken = await getGoogleDriveAccessToken();
        const pickedFile = await openGoogleDrivePicker(accessToken);
        if (!pickedFile) {
          setOpenFromDriveState("idle");
          return;
        }

        const isDirty: boolean = code !== lastLoadedExampleCode;
        if (isDirty) {
          const confirmed: boolean = window.confirm(
            "Esto reemplazará el código actual por el diagrama elegido en Drive. ¿Continuar?",
          );
          if (!confirmed) {
            setOpenFromDriveState("idle");
            return;
          }
        }

        const content = await downloadDriveFileContent(accessToken, pickedFile.id);
        writeStoredCode(content);
        setLastLoadedExampleCode(content);
        setOpenDriveFile(pickedFile);
        lastSyncedCodeRef.current = content;
        setExportError(null);
        setOpenFromDriveState("done");
      } catch (error) {
        clearGoogleDriveAccessToken();
        setExportError(
          error instanceof Error
            ? error.message
            : "No se pudo abrir el diagrama desde Google Drive.",
        );
        setOpenFromDriveState("error");
      } finally {
        driveFeedbackTimeoutRef.current = setTimeout(
          () => setOpenFromDriveState("idle"),
          DRIVE_FEEDBACK_MS,
        );
      }
    })();
  }, [code, lastLoadedExampleCode]);

  const handleDisconnectDriveFile = useCallback((): void => {
    setOpenDriveFile(null);
  }, []);

  const handleToggleAutoSync = useCallback((): void => {
    setIsAutoSyncEnabled((current) => !current);
  }, []);

  const handleDownloadSvg = useCallback((): void => {
    const svgMarkup = previewRef.current?.getSvgMarkup();
    if (!svgMarkup) return;

    try {
      downloadSvgMarkup(svgMarkup, buildDiagramFileName("svg"));
      setExportError(null);
    } catch {
      setExportError("No se pudo descargar el SVG.");
    }
  }, []);

  const handleDownloadPng = useCallback((): void => {
    const svgMarkup = previewRef.current?.getSvgMarkup();
    const dimensions = previewRef.current?.getDimensions();
    if (!svgMarkup || !dimensions) return;

    const isDarkTheme: boolean = document.documentElement.classList.contains("dark");
    const backgroundColor: string = isDarkTheme ? "#09090b" : "#ffffff";

    downloadPngFromSvg(
      svgMarkup,
      buildDiagramFileName("png"),
      dimensions.width,
      dimensions.height,
      backgroundColor,
    )
      .then(() => setExportError(null))
      .catch(() => setExportError("No se pudo generar el PNG."));
  }, []);

  const handleDownloadSql = useCallback(
    (dialect: SqlDialect): void => {
      if (!schema) return;
      try {
        downloadTextFile(generateSql(schema, dialect), buildSqlFileName(dialect), "text/plain;charset=utf-8");
        setExportError(null);
      } catch {
        setExportError("No se pudo generar el SQL.");
      }
    },
    [schema],
  );

  const handleCreateArea = useCallback((): void => {
    if (!parseResult.ok) return;

    const existingNames = new Set(parseResult.schema.tableGroups.map((group) => group.name));
    let counter = 1;
    let name = "Área 1";
    while (existingNames.has(name)) {
      counter += 1;
      name = `Área ${counter}`;
    }

    const nextSchema: DbmlSchema = {
      ...parseResult.schema,
      tableGroups: [...parseResult.schema.tableGroups, { name, color: null, tables: [] }],
    };
    writeStoredCode(serializeDbml(nextSchema));
  }, [parseResult]);

  /**
   * Las ediciones desde la vista previa (renombrar, cambiar tipo, etc.) no
   * parchean el texto: mutan el esquema ya parseado y lo vuelven a
   * serializar como la nueva fuente de verdad, que pasa por el mismo
   * flujo normal de guardado/parseo/render que cualquier edición manual.
   */
  const handleUpdateTable = useCallback(
    (originalName: string, patch: TableEditPatch): void => {
      if (!parseResult.ok) return;
      const nextSchema: DbmlSchema = {
        ...parseResult.schema,
        tables: parseResult.schema.tables.map((table) =>
          table.name === originalName
            ? { ...table, name: patch.name, note: patch.note, headerColor: patch.headerColor }
            : table,
        ),
        refs: parseResult.schema.refs.map((ref) => ({
          left: ref.left.table === originalName ? { ...ref.left, table: patch.name } : ref.left,
          right: ref.right.table === originalName ? { ...ref.right, table: patch.name } : ref.right,
        })),
        tableGroups: parseResult.schema.tableGroups.map((group) => {
          const withoutTable = group.tables.filter((tableName) => tableName !== originalName);
          if (group.name === patch.areaName) {
            return { ...group, tables: [...withoutTable, patch.name] };
          }
          return group.tables.length === withoutTable.length
            ? group
            : { ...group, tables: withoutTable };
        }),
      };
      writeStoredCode(serializeDbml(nextSchema));
    },
    [parseResult],
  );

  const handleUpdateColumn = useCallback(
    (tableName: string, originalColumnName: string, patch: ColumnEditPatch): void => {
      if (!parseResult.ok) return;
      const nextSchema: DbmlSchema = {
        ...parseResult.schema,
        tables: parseResult.schema.tables.map((table) => {
          if (table.name !== tableName) return table;
          return {
            ...table,
            columns: table.columns.map((column) =>
              column.name === originalColumnName
                ? {
                    ...column,
                    name: patch.name,
                    type: patch.type,
                    note: patch.note,
                    isPrimaryKey: patch.isPrimaryKey,
                    isNotNull: patch.isNotNull,
                    isUnique: patch.isUnique,
                  }
                : column,
            ),
          };
        }),
        refs: parseResult.schema.refs.map((ref) => ({
          left:
            ref.left.table === tableName && ref.left.column === originalColumnName
              ? { ...ref.left, column: patch.name }
              : ref.left,
          right:
            ref.right.table === tableName && ref.right.column === originalColumnName
              ? { ...ref.right, column: patch.name }
              : ref.right,
        })),
      };
      writeStoredCode(serializeDbml(nextSchema));
    },
    [parseResult],
  );

  const handleUpdateArea = useCallback(
    (originalAreaName: string, patch: AreaEditPatch): void => {
      if (!parseResult.ok) return;
      const nextSchema: DbmlSchema = {
        ...parseResult.schema,
        tableGroups: parseResult.schema.tableGroups.map((group) =>
          group.name === originalAreaName
            ? { name: patch.name, color: patch.color, tables: patch.tables }
            : group,
        ),
      };
      writeStoredCode(serializeDbml(nextSchema));
    },
    [parseResult],
  );

  const handleDeleteArea = useCallback(
    (areaName: string): void => {
      if (!parseResult.ok) return;
      const nextSchema: DbmlSchema = {
        ...parseResult.schema,
        tableGroups: parseResult.schema.tableGroups.filter((group) => group.name !== areaName),
      };
      writeStoredCode(serializeDbml(nextSchema));
    },
    [parseResult],
  );

  const handleCreateRef = useCallback(
    (sourceTable: string, sourceColumn: string, targetTable: string, targetColumn: string): void => {
      if (!parseResult.ok) return;
      const nextSchema: DbmlSchema = {
        ...parseResult.schema,
        refs: [
          ...parseResult.schema.refs,
          {
            left: { table: sourceTable, column: sourceColumn, cardinality: "many" },
            right: { table: targetTable, column: targetColumn, cardinality: "one" },
          },
        ],
      };
      writeStoredCode(serializeDbml(nextSchema));
    },
    [parseResult],
  );

  const canExport: boolean = !!schema && schema.tables.length > 0;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
      <DiagramToolbar
        isEditorCollapsed={isEditorCollapsed}
        onToggleEditor={() => setIsEditorCollapsed((current) => !current)}
        onRequestFileUpload={handleRequestFileUpload}
        onOpenImportSql={handleOpenImportSql}
        onCopyCode={handleCopyCode}
        copyState={copyState}
        onDownloadDbml={handleDownloadDbml}
        onDownloadSql={handleDownloadSql}
        onDownloadSvg={handleDownloadSvg}
        onDownloadPng={handleDownloadPng}
        onCreateArea={handleCreateArea}
        onToggleLibrary={() => setIsLibraryOpen((current) => !current)}
        libraryPanel={
          isLibraryOpen ? (
            <DiagramLibraryPanel
              diagrams={savedDiagrams}
              onSaveCurrentAsNew={handleSaveCurrentAsNew}
              onOpen={handleOpenSavedDiagram}
              onDelete={handleDeleteSavedDiagram}
              onClose={() => setIsLibraryOpen(false)}
            />
          ) : undefined
        }
        canExport={canExport}
        exportError={exportError}
        onSaveToDrive={handleSaveToDrive}
        saveToDriveState={saveToDriveState}
        onOpenFromDrive={handleOpenFromDrive}
        openFromDriveState={openFromDriveState}
        openDriveFile={openDriveFile}
        onDisconnectDriveFile={handleDisconnectDriveFile}
        isAutoSyncEnabled={isAutoSyncEnabled}
        onToggleAutoSync={handleToggleAutoSync}
        autoSyncState={autoSyncState}
      />

      {isImportSqlOpen && (
        <ImportSqlModal onClose={handleCloseImportSql} onImport={handleImportSql} error={importSqlError} />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".dbml,.txt,text/plain"
        onChange={handleFileSelected}
        className="hidden"
      />

      {warnings.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-600 dark:text-amber-400">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <div
        className={`grid min-h-0 w-full flex-1 gap-4 ${
          isEditorCollapsed ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[minmax(280px,420px)_1fr]"
        }`}
      >
        {!isEditorCollapsed && (
          <CodeEditor
            value={code}
            onChange={handleCodeChange}
            errorLine={errorLine}
            className="h-full min-h-40 w-full overflow-hidden rounded-xl border border-black/[.08] bg-white dark:border-white/[.145] dark:bg-zinc-950"
          />
        )}

        <ErDiagramPreview
          ref={previewRef}
          schema={schema}
          errorMessage={errorMessage}
          onUpdateTable={handleUpdateTable}
          onUpdateColumn={handleUpdateColumn}
          onUpdateArea={handleUpdateArea}
          onDeleteArea={handleDeleteArea}
          onCreateRef={handleCreateRef}
        />
      </div>
    </div>
  );
}
