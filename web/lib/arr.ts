import "server-only";
import type { AddedItem, ArrKind, ArrStatus, LibraryItem, LookupItem, QueueItem } from "./arr-types";

export type { AddedItem, ArrKind, ArrStatus, LibraryItem, LookupItem, QueueItem } from "./arr-types";

/**
 * Cliente das APIs v3 do Radarr e do Sonarr.
 *
 * O navegador nunca fala com os *arr: as chaves ficam no servidor e o front usa
 * as rotas `/api/arr/*`. Ver docs/automacao-radarr-sonarr.md.
 */

type Service = {
  kind: ArrKind;
  name: string;
  url: string | null;
  key: string | null;
  root: string;
};

const env = (name: string) => process.env[name]?.trim() || null;

export const SERVICES: Record<ArrKind, Service> = {
  movie: {
    kind: "movie",
    name: "Radarr",
    url: env("RADARR_URL")?.replace(/\/+$/, "") ?? null,
    key: env("RADARR_API_KEY"),
    root: (env("RADARR_ROOT_FOLDER") ?? "/media/Filmes").replace(/\/+$/, ""),
  },
  series: {
    kind: "series",
    name: "Sonarr",
    url: env("SONARR_URL")?.replace(/\/+$/, "") ?? null,
    key: env("SONARR_API_KEY"),
    root: (env("SONARR_ROOT_FOLDER") ?? "/media/Series").replace(/\/+$/, ""),
  },
};

export const arrKind = (value: string | null): ArrKind | null =>
  value === "movie" || value === "series" ? value : null;

export class ArrError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const configured = (kind: ArrKind) => {
  const svc = SERVICES[kind];
  if (!svc.url || !svc.key) {
    throw new ArrError(
      `${svc.name} não configurado. Defina ${kind === "movie" ? "RADARR" : "SONARR"}_URL e _API_KEY no web/.env.local.`,
      503,
    );
  }
  return { url: svc.url, key: svc.key };
};

async function arrFetch<T>(kind: ArrKind, path: string, init?: RequestInit): Promise<T> {
  const { url, key } = configured(kind);
  const res = await fetch(`${url}/api/v3${path}`, {
    ...init,
    headers: {
      "X-Api-Key": key,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(Number(process.env.ARR_TIMEOUT_MS) || 10_000),
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new ArrError(`${SERVICES[kind].name} ${res.status}${detail ? `: ${detail}` : ""}`, 502);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const arrMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
export const arrErrorStatus = (err: unknown) => (err instanceof ArrError ? err.status : 502);

/* ------------------------------------------------------------------ tipos */

type Image = { coverType?: string; remoteUrl?: string; url?: string };

type LookupRow = {
  id?: number;
  tmdbId?: number;
  tvdbId?: number;
  title?: string;
  year?: number;
  overview?: string;
  status?: string;
  runtime?: number;
  remotePoster?: string;
  images?: Image[];
  seasons?: { seasonNumber?: number }[];
};

type Profile = { id: number; name: string };
type RootFolder = { id?: number; path: string; freeSpace?: number };

type MovieRow = {
  id: number;
  tmdbId: number;
  title: string;
  year?: number;
  monitored?: boolean;
  hasFile?: boolean;
  sizeOnDisk?: number;
  status?: string;
  movieFile?: { quality?: { quality?: { name?: string } } };
};

type SeriesRow = {
  id: number;
  tvdbId: number;
  title: string;
  year?: number;
  monitored?: boolean;
  status?: string;
  statistics?: {
    episodeFileCount?: number;
    totalEpisodeCount?: number;
    percentOfEpisodes?: number;
    sizeOnDisk?: number;
  };
};

type QueueRow = {
  id: number;
  movieId?: number;
  seriesId?: number;
  episodeId?: number;
  title?: string;
  status?: string;
  trackedDownloadStatus?: string;
  trackedDownloadState?: string;
  size?: number;
  sizeleft?: number;
  timeleft?: string;
  downloadClient?: string;
  errorMessage?: string;
};

type SystemStatus = { version?: string };
type HealthRow = { source?: string; type?: string; message?: string; wikiUrl?: string };

/* ---------------------------------------------------------------- status */

export async function getArrStatus(kind: ArrKind): Promise<ArrStatus> {
  const svc = SERVICES[kind];
  const base = { kind, name: svc.name, configured: Boolean(svc.url && svc.key) };
  if (!base.configured) {
    return { ...base, ok: false, health: [], error: `Defina ${kind === "movie" ? "RADARR" : "SONARR"}_URL e _API_KEY.` };
  }

  try {
    const [system, health] = await Promise.all([
      arrFetch<SystemStatus>(kind, "/system/status"),
      arrFetch<HealthRow[]>(kind, "/health").catch(() => []),
    ]);
    return {
      ...base,
      ok: true,
      version: system.version,
      health: (health ?? []).map((h) => ({
        level: h.type ?? "notice",
        message: h.message ?? "",
        wikiUrl: h.wikiUrl,
      })),
    };
  } catch (err) {
    return { ...base, ok: false, health: [], error: arrMessage(err) };
  }
}

export const getArrStatusAll = () => Promise.all([getArrStatus("movie"), getArrStatus("series")]);

/* ---------------------------------------------------------------- lookup */

const posterOf = (row: LookupRow) =>
  row.images?.find((i) => i.coverType === "poster")?.remoteUrl ??
  row.remotePoster ??
  row.images?.find((i) => i.coverType === "poster")?.url;

function toLookup(kind: ArrKind, row: LookupRow): LookupItem | null {
  const arrId = kind === "movie" ? row.tmdbId : row.tvdbId;
  if (!arrId || !row.title) return null;
  return {
    kind,
    arrId,
    title: row.title,
    year: row.year,
    overview: row.overview,
    poster: posterOf(row),
    status: row.status,
    runtime: row.runtime,
    seasons: row.seasons?.length,
  };
}

export async function lookup(kind: ArrKind, term: string): Promise<LookupItem[]> {
  const q = term.trim();
  if (!q) return [];
  const path = kind === "movie" ? "/movie/lookup" : "/series/lookup";
  const rows = await arrFetch<LookupRow[]>(kind, `${path}?term=${encodeURIComponent(q)}`);
  return rows.map((row) => toLookup(kind, row)).filter((row): row is LookupItem => Boolean(row));
}

export type CatalogSearch = { results: LookupItem[]; warnings: string[] };

/** Título exato primeiro, depois "começa com", depois "contém". */
const relevance = (term: string, item: LookupItem) => {
  const q = term.toLowerCase().replace(/^the\s+/, "");
  const title = item.title.toLowerCase().replace(/^the\s+/, "");
  if (title === q) return 0;
  if (title.startsWith(q)) return 1;
  if (title.includes(q)) return 2;
  return 3;
};

/**
 * Busca nos dois catálogos de uma vez, para a barra de pesquisa do Streamflix.
 * Intercala filmes/séries e mantém a ordem de cada *arr em caso de empate; se um
 * dos dois falhar, devolve o outro lado e um aviso em vez de derrubar tudo.
 */
export async function searchCatalog(term: string): Promise<CatalogSearch> {
  const q = term.trim();
  if (!q) return { results: [], warnings: [] };

  const settled = await Promise.allSettled([lookup("movie", q), lookup("series", q)]);
  const warnings: string[] = [];

  for (const outcome of settled) {
    if (outcome.status === "rejected") warnings.push(arrMessage(outcome.reason));
  }

  if (settled.every((outcome) => outcome.status === "rejected")) {
    const first = settled[0] as PromiseRejectedResult;
    throw new ArrError(warnings.join(" · "), arrErrorStatus(first.reason));
  }

  const movies = settled[0].status === "fulfilled" ? settled[0].value : [];
  const series = settled[1].status === "fulfilled" ? settled[1].value : [];
  const results: LookupItem[] = [];
  for (let index = 0; index < Math.max(movies.length, series.length); index += 1) {
    if (movies[index]) results.push(movies[index]);
    if (series[index]) results.push(series[index]);
  }

  results.sort((a, b) => relevance(q, a) - relevance(q, b));
  return { results, warnings };
}

/* --------------------------------------------------------------- library */

export async function getLibrary(kind: ArrKind): Promise<LibraryItem[]> {
  if (kind === "movie") {
    const rows = await arrFetch<MovieRow[]>(kind, "/movie");
    return rows.map((row) => ({
      kind,
      id: row.id,
      arrId: row.tmdbId,
      title: row.title,
      year: row.year,
      monitored: Boolean(row.monitored),
      hasContent: Boolean(row.hasFile),
      sizeOnDisk: row.sizeOnDisk ?? 0,
      quality: row.movieFile?.quality?.quality?.name,
      status: row.status,
    }));
  }

  const rows = await arrFetch<SeriesRow[]>(kind, "/series");
  return rows.map((row) => {
    const have = row.statistics?.episodeFileCount ?? 0;
    const total = row.statistics?.totalEpisodeCount ?? 0;
    return {
      kind,
      id: row.id,
      arrId: row.tvdbId,
      title: row.title,
      year: row.year,
      monitored: Boolean(row.monitored),
      hasContent: have > 0,
      sizeOnDisk: row.statistics?.sizeOnDisk ?? 0,
      status: row.status,
      episodes: { have, total, percent: Math.round(row.statistics?.percentOfEpisodes ?? 0) },
    };
  });
}

/* ----------------------------------------------------------------- queue */

export async function getQueue(kind: ArrKind): Promise<QueueItem[]> {
  const unknown = kind === "movie" ? "includeUnknownMovieItems" : "includeUnknownSeriesItems";
  const data = await arrFetch<{ records?: QueueRow[] }>(kind, `/queue?page=1&pageSize=50&${unknown}=true`);
  return (data.records ?? []).map((row) => {
    const size = row.size ?? 0;
    const left = row.sizeleft ?? 0;
    return {
      kind,
      id: row.id,
      title: row.title ?? "",
      status: row.status,
      trackedStatus: row.trackedDownloadStatus,
      trackedState: row.trackedDownloadState,
      progress: size > 0 ? Math.min(100, Math.max(0, Math.round((1 - left / size) * 100))) : 0,
      timeleft: row.timeleft,
      downloadClient: row.downloadClient,
      error: row.errorMessage,
    };
  });
}

/* ------------------------------------------------------------------- add */

async function pickProfile(kind: ArrKind): Promise<Profile> {
  const profiles = await arrFetch<Profile[]>(kind, "/qualityprofile");
  if (!profiles.length) throw new ArrError(`${SERVICES[kind].name} não tem perfil de qualidade configurado.`, 502);

  const wanted = env("ARR_QUALITY_PROFILE");
  if (wanted) {
    const match = profiles.find((p) => String(p.id) === wanted || p.name.toLowerCase() === wanted.toLowerCase());
    if (match) return match;
  }
  return profiles.find((p) => p.name.includes("1080")) ?? profiles[0];
}

async function ensureRoot(kind: ArrKind): Promise<string> {
  const root = SERVICES[kind].root;
  const roots = await arrFetch<RootFolder[]>(kind, "/rootfolder");
  const exists = roots.some((r) => r.path.replace(/\/+$/, "") === root);
  if (!exists) {
    await arrFetch<RootFolder>(kind, "/rootfolder", { method: "POST", body: JSON.stringify({ path: root }) });
  }
  return root;
}

export async function addToLibrary(kind: ArrKind, arrId: number): Promise<AddedItem> {
  if (!Number.isInteger(arrId) || arrId <= 0) throw new ArrError("id inválido", 400);

  const library = await getLibrary(kind);
  const existing = library.find((item) => item.arrId === arrId);
  if (existing) {
    return { kind, id: existing.id, arrId, title: existing.title, existed: true };
  }

  const idTerm = `${kind === "movie" ? "tmdb" : "tvdb"}:${arrId}`;
  const results = await lookup(kind, idTerm);
  const match = results.find((item) => item.arrId === arrId) ?? results[0];
  if (!match) throw new ArrError("Título não encontrado no catálogo.", 404);

  const [profile, root] = await Promise.all([pickProfile(kind), ensureRoot(kind)]);

  const payload =
    kind === "movie"
      ? {
          title: match.title,
          tmdbId: match.arrId,
          year: match.year,
          qualityProfileId: profile.id,
          rootFolderPath: root,
          monitored: true,
          minimumAvailability: "released",
          addOptions: { searchForMovie: true },
        }
      : {
          title: match.title,
          tvdbId: match.arrId,
          year: match.year,
          qualityProfileId: profile.id,
          rootFolderPath: root,
          monitored: true,
          seasonFolder: true,
          seriesType: "standard",
          addOptions: { monitor: "all", searchForMissingEpisodes: true, searchForCutoffUnmetEpisodes: false },
        };

  const created = await arrFetch<{ id: number; title?: string }>(kind, kind === "movie" ? "/movie" : "/series", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { kind, id: created.id, arrId: match.arrId, title: created.title ?? match.title, existed: false };
}

/* ---------------------------------------------------------------- remove */

export async function removeFromLibrary(kind: ArrKind, id: number, deleteFiles = false): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) throw new ArrError("id inválido", 400);
  const path =
    kind === "movie"
      ? `/movie/${id}?deleteFiles=${deleteFiles}&addImportExclusion=false`
      : `/series/${id}?deleteFiles=${deleteFiles}&addImportListExclusion=false`;
  await arrFetch<void>(kind, path, { method: "DELETE" });
}
