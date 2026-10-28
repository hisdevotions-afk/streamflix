const TICKS = 10_000_000;

/** 36_000_000_000 ticks -> "1:00:00"; 900_000_000 -> "1:30". */
export function formatTimestamp(ticks: number): string {
  const total = Math.max(0, Math.floor((ticks || 0) / TICKS));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** Netflix-style resume label: "faltam 26 min". */
export const remainingLabel = (ticks: number) => `faltam ${formatRemaining(ticks)}`;

/** Remaining time, rounded for humans: "4 min", "1 h 12 min". */
export function formatRemaining(ticks: number): string {
  const secs = Math.max(0, Math.round((ticks || 0) / TICKS));
  if (secs >= 3600) {
    const h = Math.floor(secs / 3600);
    const m = Math.round((secs % 3600) / 60);
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.max(1, Math.round(secs / 60))} min`;
}

export function episodeLabel(season?: number | null, episode?: number | null): string {
  if (season == null && episode == null) return "";
  return `T${season ?? 0}E${String(episode ?? 0).padStart(2, "0")}`;
}

/** bytes -> "1.4 GB" (base 1024, arredondado para leitura rápida). */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index >= 3 ? 1 : 0)} ${units[index]}`;
}

