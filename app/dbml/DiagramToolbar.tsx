"use client";

import type { ReactNode } from "react";
import { ExportMenu } from "./ExportMenu";
import {
  CloudDownloadIcon,
  CloudIcon,
  CloudUploadIcon,
  DatabaseImportIcon,
  FramePlusIcon,
  LibraryIcon,
  PanelIcon,
  UploadIcon,
} from "./Icons";
import type { DrivePickedFile } from "./lib/googleDrive";
import type { SqlDialect } from "./lib/sql/generateSql";

export type CopyState = "idle" | "copied" | "error";
export type DriveActionState = "idle" | "working" | "done" | "error";
export type AutoSyncState = "idle" | "syncing" | "synced" | "error";

interface DiagramToolbarProps {
  isEditorCollapsed: boolean;
  onToggleEditor: () => void;
  onRequestFileUpload: () => void;
  onOpenImportSql: () => void;
  onCopyCode: () => void;
  copyState: CopyState;
  onDownloadSvg: () => void;
  onDownloadPng: () => void;
  onDownloadDbml: () => void;
  onDownloadSql: (dialect: SqlDialect) => void;
  onCreateArea: () => void;
  onToggleLibrary: () => void;
  libraryPanel?: ReactNode;
  canExport: boolean;
  exportError: string | null;
  onSaveToDrive: () => void;
  saveToDriveState: DriveActionState;
  onOpenFromDrive: () => void;
  openFromDriveState: DriveActionState;
  openDriveFile: DrivePickedFile | null;
  onDisconnectDriveFile: () => void;
  isAutoSyncEnabled: boolean;
  onToggleAutoSync: () => void;
  autoSyncState: AutoSyncState;
}

const ICON_BUTTON_CLASSES: string =
  "flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-black/[.05] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 dark:text-zinc-300 dark:hover:bg-white/[.1]";

const SAVE_TO_DRIVE_WORKING_LABEL: Record<Exclude<DriveActionState, "idle">, string> = {
  working: "Guardando...",
  done: "¡Guardado!",
  error: "Error",
};

function getSaveToDriveLabel(state: DriveActionState, hasOpenDriveFile: boolean): string {
  if (state === "idle") {
    return hasOpenDriveFile ? "Actualizar en Drive" : "Guardar en Drive";
  }
  return SAVE_TO_DRIVE_WORKING_LABEL[state];
}

const OPEN_FROM_DRIVE_LABEL: Record<DriveActionState, string> = {
  idle: "Abrir desde Drive",
  working: "Abriendo...",
  done: "Abrir desde Drive",
  error: "Error",
};

function IconButton({
  icon,
  label,
  title,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={ICON_BUTTON_CLASSES}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Divider(): React.JSX.Element {
  return <div className="mx-1.5 h-5 w-px shrink-0 bg-black/[.08] dark:bg-white/[.145]" />;
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
        checked ? "justify-end bg-indigo-600" : "justify-start bg-zinc-300 dark:bg-zinc-700"
      }`}
    >
      <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
    </button>
  );
}

const AUTO_SYNC_STATUS_TEXT: Partial<Record<AutoSyncState, string>> = {
  syncing: "Sincronizando...",
  error: "Error al sincronizar",
};

export function DiagramToolbar({
  isEditorCollapsed,
  onToggleEditor,
  onRequestFileUpload,
  onOpenImportSql,
  onCopyCode,
  copyState,
  onDownloadSvg,
  onDownloadPng,
  onDownloadDbml,
  onDownloadSql,
  onCreateArea,
  onToggleLibrary,
  libraryPanel,
  canExport,
  exportError,
  onSaveToDrive,
  saveToDriveState,
  onOpenFromDrive,
  openFromDriveState,
  openDriveFile,
  onDisconnectDriveFile,
  isAutoSyncEnabled,
  onToggleAutoSync,
  autoSyncState,
}: DiagramToolbarProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-black/[.08] bg-white px-2 py-1.5 shadow-sm dark:border-white/[.145] dark:bg-zinc-950">
        <IconButton
          icon={<PanelIcon />}
          label={isEditorCollapsed ? "Mostrar código" : "Ocultar código"}
          title="Mostrar u ocultar el editor de código"
          onClick={onToggleEditor}
        />

        <Divider />

        <IconButton
          icon={<UploadIcon />}
          label="Cargar archivo"
          title="Cargar un archivo .dbml desde tu computador"
          onClick={onRequestFileUpload}
        />

        <div className="relative">
          <IconButton
            icon={<LibraryIcon />}
            label="Mis diagramas"
            title="Abrir tus diagramas guardados"
            onClick={onToggleLibrary}
          />
          {libraryPanel}
        </div>

        <IconButton
          icon={<DatabaseImportIcon />}
          label="Importar SQL"
          title="Importar un esquema desde SQL (Postgres, MySQL, MariaDB o SQL Server)"
          onClick={onOpenImportSql}
        />

        <Divider />

        <IconButton
          icon={<CloudDownloadIcon />}
          label={OPEN_FROM_DRIVE_LABEL[openFromDriveState]}
          title="Abrir un diagrama desde tu Google Drive"
          onClick={onOpenFromDrive}
          disabled={openFromDriveState === "working"}
        />
        <IconButton
          icon={<CloudUploadIcon />}
          label={getSaveToDriveLabel(saveToDriveState, !!openDriveFile)}
          title={
            openDriveFile
              ? `Actualiza "${openDriveFile.name}" en tu Google Drive`
              : "Guarda una copia nueva en tu Google Drive"
          }
          onClick={onSaveToDrive}
          disabled={!canExport || saveToDriveState === "working"}
        />

        <Divider />

        <ExportMenu
          onCopyCode={onCopyCode}
          copyState={copyState}
          onDownloadDbml={onDownloadDbml}
          onDownloadSvg={onDownloadSvg}
          onDownloadPng={onDownloadPng}
          onDownloadSql={onDownloadSql}
          canExport={canExport}
        />

        <Divider />

        <IconButton
          icon={<FramePlusIcon />}
          label="Nueva área"
          title="Crear un área para agrupar tablas"
          onClick={onCreateArea}
        />
      </div>

      {openDriveFile && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            <CloudIcon />
            <span>
              Editando{" "}
              <strong className="font-medium text-zinc-700 dark:text-zinc-300">
                {openDriveFile.name}
              </strong>{" "}
              desde Google Drive
            </span>
          </div>

          <button
            type="button"
            onClick={onDisconnectDriveFile}
            className="underline hover:no-underline"
          >
            Desvincular
          </button>

          <label className="flex cursor-pointer items-center gap-1.5 select-none">
            <Switch
              checked={isAutoSyncEnabled}
              onChange={onToggleAutoSync}
              label="Sincronización automática con Drive"
            />
            <span>Sincronización automática</span>
          </label>

          {isAutoSyncEnabled && AUTO_SYNC_STATUS_TEXT[autoSyncState] && (
            <span className={autoSyncState === "error" ? "text-red-600 dark:text-red-400" : undefined}>
              {AUTO_SYNC_STATUS_TEXT[autoSyncState]}
            </span>
          )}
        </div>
      )}

      {exportError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {exportError}
        </p>
      )}
    </div>
  );
}
