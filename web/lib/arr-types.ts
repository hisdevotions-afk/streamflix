/** Tipos compartilhados entre servidor e UI (sem importar o cliente server-only). */

export type ArrKind = "movie" | "series";

export type ArrStatus = {
  kind: ArrKind;
  name: string;
  configured: boolean;
  ok: boolean;
  version?: string;
  health: { level: string; message: string; wikiUrl?: string }[];
  error?: string;
};

export type LookupItem = {
  kind: ArrKind;
  arrId: number;
  title: string;
  year?: number;
  overview?: string;
  poster?: string;
  status?: string;
  runtime?: number;
  seasons?: number;
};

export type LibraryItem = {
  kind: ArrKind;
  id: number;
  arrId: number;
  title: string;
  year?: number;
  monitored: boolean;
  hasContent: boolean;
  sizeOnDisk: number;
  quality?: string;
  status?: string;
  episodes?: { have: number; total: number; percent: number };
};

export type QueueItem = {
  kind: ArrKind;
  id: number;
  title: string;
  status?: string;
  trackedStatus?: string;
  trackedState?: string;
  progress: number;
  timeleft?: string;
  downloadClient?: string;
  error?: string;
};

export type AddedItem = {
  kind: ArrKind;
  id: number;
  arrId: number;
  title: string;
  existed: boolean;
};
