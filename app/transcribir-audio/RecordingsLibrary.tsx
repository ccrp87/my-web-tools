"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import {
  db,
  deleteAllRecordings,
  deleteRecording,
  updateRecordingTitle,
  type RecordingEntry,
} from "./db";

const DELETE_ALL_CONFIRMATION_TIMEOUT_MS: number = 4000;

interface RecordingRowProps {
  recording: RecordingEntry;
  onTitleChange: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  onView: (recording: RecordingEntry) => void;
}

function RecordingRow({
  recording,
  onTitleChange,
  onDelete,
  onView,
}: RecordingRowProps): React.JSX.Element {
  const audioUrl: string = useMemo(
    () => URL.createObjectURL(recording.audio),
    [recording.audio],
  );

  useEffect(() => {
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const [title, setTitle] = useState<string>(recording.title);

  const handleTitleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      setTitle(event.target.value);
    },
    [],
  );

  const handleTitleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>): void => {
      if (event.target.value !== recording.title) {
        onTitleChange(recording.id, event.target.value);
      }
    },
    [recording.id, recording.title, onTitleChange],
  );

  const handleDeleteClick = useCallback((): void => {
    onDelete(recording.id);
  }, [recording.id, onDelete]);

  const handleViewClick = useCallback((): void => {
    onView(recording);
  }, [recording, onView]);

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-black/[.08] p-3 dark:border-white/[.145]">
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={title}
          onChange={handleTitleInputChange}
          onBlur={handleTitleBlur}
          className="flex-1 rounded-md border border-transparent bg-transparent px-1 text-sm font-medium text-black focus:border-black/[.15] focus:outline-none dark:text-zinc-50 dark:focus:border-white/[.2]"
        />
        <button
          type="button"
          onClick={handleDeleteClick}
          className="text-xs text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
        >
          Eliminar
        </button>
      </div>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {new Date(recording.recordedAt).toLocaleString()}
      </span>
      <audio controls src={audioUrl} className="w-full" />
      {recording.transcript && (
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
            {recording.transcript}
          </p>
          <button
            type="button"
            onClick={handleViewClick}
            className="shrink-0 text-xs font-medium text-black underline transition-colors hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
          >
            Ver transcripción
          </button>
        </div>
      )}
    </li>
  );
}

interface RecordingsLibraryProps {
  onView: (recording: RecordingEntry) => void;
}

export function RecordingsLibrary({
  onView,
}: RecordingsLibraryProps): React.JSX.Element | null {
  const recordings: RecordingEntry[] | undefined = useLiveQuery(
    () => db.recordings.orderBy("recordedAt").reverse().toArray(),
    [],
  );
  const [confirmingDeleteAll, setConfirmingDeleteAll] =
    useState<boolean>(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteAllClick = useCallback((): void => {
    if (!confirmingDeleteAll) {
      setConfirmingDeleteAll(true);
      confirmTimeoutRef.current = setTimeout(
        () => setConfirmingDeleteAll(false),
        DELETE_ALL_CONFIRMATION_TIMEOUT_MS,
      );
      return;
    }
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }
    setConfirmingDeleteAll(false);
    void deleteAllRecordings();
  }, [confirmingDeleteAll]);

  const handleTitleChange = useCallback(
    (id: number, title: string): void => {
      void updateRecordingTitle(id, title);
    },
    [],
  );

  const handleDelete = useCallback((id: number): void => {
    void deleteRecording(id);
  }, []);

  if (!recordings || recordings.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Grabaciones guardadas
        </span>
        <button
          type="button"
          onClick={handleDeleteAllClick}
          className="text-xs font-medium text-red-600 transition-colors hover:underline dark:text-red-400"
        >
          {confirmingDeleteAll ? "¿Seguro? Confirmar borrado" : "Borrar todas"}
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {recordings.map((recording) => (
          <RecordingRow
            key={recording.id}
            recording={recording}
            onTitleChange={handleTitleChange}
            onDelete={handleDelete}
            onView={onView}
          />
        ))}
      </ul>
    </div>
  );
}
