import "server-only";

/** Status dos serviços auxiliares da esteira (Prowlarr e qBittorrent). */

export type PipelineStatus = {
  name: "Prowlarr" | "qBittorrent";
  ok: boolean;
  version?: string;
  detail?: string;
  indexers?: number;
  torrents?: number;
  error?: string;
};

const clean = (value?: string) => value?.trim().replace(/\/+$/, "") || null;
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function getProwlarrStatus(): Promise<PipelineStatus> {
  const url = clean(process.env.PROWLARR_URL);
  const key = process.env.PROWLARR_API_KEY?.trim();
  if (!url || !key) {
    return { name: "Prowlarr", ok: false, error: "Defina PROWLARR_URL e PROWLARR_API_KEY." };
  }

  try {
    const headers = { "X-Api-Key": key, Accept: "application/json" };
    const [system, indexers] = await Promise.all([
      fetch(`${url}/api/v1/system/status`, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
      fetch(`${url}/api/v1/indexer`, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
    ]);
    if (!system.ok) throw new Error(`Prowlarr ${system.status}`);

    const info = (await system.json()) as { version?: string };
    const list = indexers.ok ? ((await indexers.json()) as { enable?: boolean }[]) : [];
    const enabled = list.filter((indexer) => indexer.enable).length;

    return {
      name: "Prowlarr",
      ok: true,
      version: info.version,
      indexers: enabled,
      detail: `${enabled} indexer(s) ativo(s)`,
    };
  } catch (err) {
    return { name: "Prowlarr", ok: false, error: message(err) };
  }
}

export async function getQbittorrentStatus(): Promise<PipelineStatus> {
  const url = clean(process.env.QBITTORRENT_URL);
  const username = process.env.QBITTORRENT_USERNAME?.trim() || "admin";
  const password = process.env.QBITTORRENT_PASSWORD;
  if (!url || !password) {
    return { name: "qBittorrent", ok: false, error: "Defina QBITTORRENT_URL e QBITTORRENT_PASSWORD." };
  }

  try {
    const login = await fetch(`${url}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: url },
      body: new URLSearchParams({ username, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await login.text();
    if (!login.ok || (login.status !== 204 && !body.toLowerCase().includes("ok"))) {
      throw new Error(`qBittorrent ${login.status}`);
    }

    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("qBittorrent não devolveu sessão");

    const headers = { Cookie: cookie, Referer: url, Accept: "application/json" };
    const [versionRes, torrentsRes] = await Promise.all([
      fetch(`${url}/api/v2/app/version`, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
      fetch(`${url}/api/v2/torrents/info`, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
    ]);
    if (!versionRes.ok) throw new Error(`qBittorrent ${versionRes.status}`);

    const version = (await versionRes.text()).trim();
    const torrents = torrentsRes.ok ? ((await torrentsRes.json()) as unknown[]).length : 0;

    return {
      name: "qBittorrent",
      ok: true,
      version,
      torrents,
      detail: `${torrents} torrent(s)`,
    };
  } catch (err) {
    return { name: "qBittorrent", ok: false, error: message(err) };
  }
}

export const getPipelineStatus = () => Promise.all([getProwlarrStatus(), getQbittorrentStatus()]);
