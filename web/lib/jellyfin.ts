import "server-only";

export const JF_URL = process.env.JELLYFIN_URL!;
// ponytail: single shared token passed to the browser for playback; fine on a home LAN, per-user login if this ever leaves it
export const JF_TOKEN = process.env.JELLYFIN_TOKEN!;
export const USER_ID = process.env.JELLYFIN_USER_ID!;

/**
 * URL the *browser* should use for images/video.
 *
 * Server-side calls use JELLYFIN_URL (often http://localhost:8096). A phone
 * opening http://<pc-ip>:3000 cannot resolve that localhost, so when the
 * configured host is loopback we swap in the hostname the request arrived on.
 * Set JELLYFIN_PUBLIC_URL to override (remote Jellyfin, reverse proxy, etc.).
 */
export function publicJfUrl(host?: string | null): string {
  const override = process.env.JELLYFIN_PUBLIC_URL?.replace(/\/$/, "");
  if (override) return override;

  const url = new URL(JF_URL);
  const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  if (!loopback || !host) return url.origin;

  try {
    url.hostname = new URL(`http://${host}`).hostname;
  } catch {
    return url.origin;
  }
  return url.origin;
}

export type Item = {
  Id: string;
  Name: string;
  Type: "Series" | "Movie" | "Episode" | "Season";
  Overview?: string;
  SeriesName?: string;
  SeriesId?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  RunTimeTicks?: number;
  ProductionYear?: number;
  Genres?: string[];
  RemoteTrailers?: { Url: string }[];
  ImageTags?: { Primary?: string };
  BackdropImageTags?: string[];
  UserData?: {
    PlaybackPositionTicks: number;
    PlayedPercentage?: number;
    Played?: boolean;
    LastPlayedDate?: string;
    UnplayedItemCount?: number;
    IsFavorite?: boolean;
  };
};

async function jf<T>(path: string): Promise<T> {
  const res = await fetch(`${JF_URL}${path}`, {
    headers: { Authorization: `MediaBrowser Token="${JF_TOKEN}"` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Jellyfin ${res.status} ${path}`);
  return res.json();
}

const FIELDS = "fields=Overview,Genres,RemoteTrailers&enableUserData=true";

// Jellyfin stores positions in 100ns ticks; one second is 10_000_000 ticks.
export const TICKS = 10_000_000;

export type PlaybackEvent = "start" | "progress" | "stop";

/**
 * Writes a playback event to Jellyfin. Jellyfin is the source of truth for
 * progress, so every device reports here and every device resumes from here.
 * See docs/progresso-entre-dispositivos.md.
 */
export async function reportPlayback(event: PlaybackEvent, info: Record<string, unknown>) {
  const path =
    event === "start" ? "/Sessions/Playing" : event === "progress" ? "/Sessions/Playing/Progress" : "/Sessions/Playing/Stopped";
  const res = await fetch(`${JF_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `MediaBrowser Token="${JF_TOKEN}"`, "Content-Type": "application/json" },
    body: JSON.stringify(info),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Jellyfin ${res.status} ${path}`);
}

export type Progress = {
  itemId: string;
  positionTicks: number;
  playedPercentage: number;
  played: boolean;
  runtimeTicks: number;
  name: string;
  seriesName: string | null;
  season: number | null;
  episode: number | null;
};

/** Current per-user progress for one item, as saved on the server. */
export async function getProgress(itemId: string): Promise<Progress> {
  const item = await getItem(itemId);
  return {
    itemId,
    positionTicks: item.UserData?.PlaybackPositionTicks ?? 0,
    playedPercentage: item.UserData?.PlayedPercentage ?? 0,
    played: item.UserData?.Played ?? false,
    runtimeTicks: item.RunTimeTicks ?? 0,
    name: item.Name,
    seriesName: item.SeriesName ?? null,
    season: item.ParentIndexNumber ?? null,
    episode: item.IndexNumber ?? null,
  };
}

export const getResume = () =>
  jf<{ Items: Item[] }>(`/UserItems/Resume?userId=${USER_ID}&mediaTypes=Video&${FIELDS}`).then((r) => r.Items);

export const getByType = (type: "Series" | "Movie") =>
  jf<{ Items: Item[] }>(
    `/Items?userId=${USER_ID}&recursive=true&includeItemTypes=${type}&sortBy=DateCreated&sortOrder=Descending&${FIELDS}`,
  ).then((r) => r.Items);

export const getItem = (id: string) => jf<Item>(`/Items/${id}?userId=${USER_ID}`);

export const getEpisodes = (seriesId: string) =>
  jf<{ Items: Item[] }>(`/Shows/${seriesId}/Episodes?userId=${USER_ID}&${FIELDS}`).then((r) => r.Items);

export async function setFavorite(itemId: string, favorite: boolean) {
  const res = await fetch(`${JF_URL}/UserFavoriteItems/${itemId}?userId=${USER_ID}`, {
    method: favorite ? "POST" : "DELETE",
    headers: { Authorization: `MediaBrowser Token="${JF_TOKEN}"` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Jellyfin ${res.status} favorite`);
}

export const imageUrl = (item: Item, type: "Primary" | "Backdrop" = "Primary", base = JF_URL) => {
  const has = type === "Primary" ? item.ImageTags?.Primary : item.BackdropImageTags?.[0];
  return has ? `${base}/Items/${item.Id}/Images/${type}?maxWidth=${type === "Primary" ? 400 : 1920}` : null;
};

// Progressive mp4 transcode: a plain <video> plays it without an HLS lib, good enough for the muted hero loop.
export const previewUrl = (id: string, base = JF_URL) =>
  `${base}/Videos/${id}/stream.mp4?videoCodec=h264&audioCodec=aac&maxWidth=1280&api_key=${JF_TOKEN}`;
