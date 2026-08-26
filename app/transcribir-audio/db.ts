import Dexie, { type EntityTable } from "dexie";

export interface RecordingEntry {
  id: number;
  audio: Blob;
  title: string;
  recordedAt: number;
  transcript: string | null;
}

class RecordingsDatabase extends Dexie {
  recordings!: EntityTable<RecordingEntry, "id">;

  constructor() {
    super("transcribir-audio-recordings");
    this.version(1).stores({
      recordings: "++id, recordedAt",
    });
  }
}

export const db: RecordingsDatabase = new RecordingsDatabase();

export async function saveRecording(
  audio: Blob,
  title: string,
): Promise<number> {
  return db.recordings.add({
    audio,
    title,
    recordedAt: Date.now(),
    transcript: null,
  });
}

export async function updateRecordingTitle(
  id: number,
  title: string,
): Promise<void> {
  await db.recordings.update(id, { title });
}

export async function updateRecordingTranscript(
  id: number,
  transcript: string,
): Promise<void> {
  await db.recordings.update(id, { transcript });
}

export async function deleteRecording(id: number): Promise<void> {
  await db.recordings.delete(id);
}

export async function deleteAllRecordings(): Promise<void> {
  await db.recordings.clear();
}
