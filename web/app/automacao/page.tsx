import ArrSearch from "@/components/ArrSearch";
import { arrMessage, getArrStatusAll, getLibrary, getQueue } from "@/lib/arr";
import type { ArrStatus, LibraryItem, QueueItem } from "@/lib/arr-types";
import { getPipelineStatus, type PipelineStatus } from "@/lib/pipeline";
import { formatBytes } from "@/lib/format";

export const dynamic = "force-dynamic";

type Loaded<T> = { data: T; error?: string };

async function load<T>(fn: () => Promise<T>, fallback: T): Promise<Loaded<T>> {
  try {
    return { data: await fn() };
  } catch (err) {
    return { data: fallback, error: arrMessage(err) };
  }
}

const LEVEL_STYLE: Record<string, string> = {
  error: "text-red-400",
  warning: "text-amber-400",
  notice: "text-sky-300",
};

function StatusCard({ status }: { status: ArrStatus }) {
  const issues = status.health.filter((h) => h.level !== "ok").slice(0, 3);
  return (
    <article className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{status.name}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            status.ok
              ? "bg-emerald-500/15 text-emerald-300"
              : status.configured
                ? "bg-red-500/15 text-red-300"
                : "bg-white/10 text-white/50"
          }`}
        >
          {status.ok ? "online" : status.configured ? "offline" : "não configurado"}
        </span>
      </div>
      <p className="mt-1 text-xs text-white/50">
        {status.ok ? `API v3 · versão ${status.version ?? "?"}` : status.error}
      </p>
      {issues.length > 0 && (
        <ul className="mt-2 space-y-1">
          {issues.map((issue, index) => (
            <li key={index} className={`text-xs ${LEVEL_STYLE[issue.level] ?? "text-white/50"}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function PipelineCard({ status }: { status: PipelineStatus }) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{status.name}</p>
        <p className="truncate text-xs text-white/45">
          {status.ok ? status.detail ?? `versão ${status.version ?? "?"}` : status.error}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
          status.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
        }`}
      >
        {status.ok ? "online" : "offline"}
      </span>
    </article>
  );
}

function LibraryRow({ item }: { item: LibraryItem }) {
  const detail =
    item.kind === "series" && item.episodes
      ? `${item.episodes.have}/${item.episodes.total} episódios`
      : (item.quality ?? "sem arquivo");
  const percent = item.kind === "series" ? (item.episodes?.percent ?? 0) : item.hasContent ? 100 : 0;

  return (
    <li className="border-b border-white/5 py-2 last:border-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {item.title}
            {item.year ? <span className="ml-1 font-normal text-white/40">({item.year})</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-white/45">
            {detail}
            {item.sizeOnDisk ? ` · ${formatBytes(item.sizeOnDisk)}` : ""}
            {item.monitored ? " · monitorado" : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${
            item.hasContent ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/50"
          }`}
        >
          {item.hasContent ? "no disco" : "aguardando"}
        </span>
      </div>
      {percent > 0 && percent < 100 && (
        <div className="mt-2 h-1 overflow-hidden rounded bg-white/10">
          <div className="h-1 rounded bg-red-600" style={{ width: `${percent}%` }} />
        </div>
      )}
    </li>
  );
}

function LibraryPanel({
  title,
  items,
  error,
}: {
  title: string;
  items: LibraryItem[];
  error?: string;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-white/40">{items.length} título(s)</span>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-white/40">Nada monitorado ainda.</p>
      ) : (
        <ul className="mt-2">
          {items.map((item) => (
            <LibraryRow key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function QueuePanel({ items, error }: { items: QueueItem[]; error?: string }) {
  return (
    <section className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Fila de download</h2>
        <span className="text-xs text-white/40">{items.length} item(ns)</span>
      </div>
      {error && <p className="mt-2 text-xs text-amber-400">{error}</p>}
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-white/40">Nada na fila. Sem indexador/cliente de download configurado, a busca não sai do lugar.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm">{item.title}</p>
                <span className="shrink-0 text-xs text-white/50">{item.progress}%</span>
              </div>
              <p className="text-xs text-white/40">
                {[item.trackedState ?? item.status, item.downloadClient, item.timeleft && `${item.timeleft} restantes`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
                <div className="h-1 rounded bg-red-600" style={{ width: `${item.progress}%` }} />
              </div>
              {item.error && <p className="mt-1 text-xs text-red-400">{item.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AutomationPage() {
  const [statuses, pipeline, movies, series, movieQueue, seriesQueue] = await Promise.all([
    getArrStatusAll(),
    getPipelineStatus(),
    load(() => getLibrary("movie"), []),
    load(() => getLibrary("series"), []),
    load(() => getQueue("movie"), []),
    load(() => getQueue("series"), []),
  ]);

  const queue = [...movieQueue.data, ...seriesQueue.data];
  const queueError = [movieQueue.error, seriesQueue.error].filter(Boolean).join(" · ") || undefined;
  const prowlarr = pipeline.find((service) => service.name === "Prowlarr");
  const noIndexers = prowlarr?.ok && (prowlarr.indexers ?? 0) === 0;

  return (
    <main className="min-h-screen px-4 pb-16 pt-24 md:px-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Esteira de automação</p>
          <h1 className="mt-1 text-3xl font-black md:text-4xl">Radarr + Sonarr</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Peça um filme ou série aqui. O Radarr/Sonarr monitora, busca, importa para{" "}
            <code className="rounded bg-white/10 px-1">~/Midia</code> e o Jellyfin indexa o resultado.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {statuses.map((status) => (
            <StatusCard key={status.kind} status={status} />
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {pipeline.map((service) => (
            <PipelineCard key={service.name} status={service} />
          ))}
        </div>

        {statuses.some((status) => !status.configured) && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Rode <code className="rounded bg-black/30 px-1">./scripts/setup-pipeline.sh</code> para gravar as
            credenciais em <code className="rounded bg-black/30 px-1">web/.env.local</code> e reinicie o Next.
          </p>
        )}

        {noIndexers && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Prowlarr está online, mas sem indexer. Cadastre os seus em{" "}
            <code className="rounded bg-black/30 px-1">http://localhost:9696</code> → Indexers; o Radarr e o
            Sonarr recebem tudo por sync.
          </p>
        )}

        <ArrSearch />

        <div className="grid gap-4 lg:grid-cols-2">
          <QueuePanel items={queue} error={queueError} />
          <div className="grid gap-4">
            <LibraryPanel title="Filmes (Radarr)" items={movies.data} error={movies.error} />
            <LibraryPanel title="Séries (Sonarr)" items={series.data} error={series.error} />
          </div>
        </div>

        <p className="text-xs text-white/35">
          As chaves das APIs ficam só no servidor. O navegador fala com <code>/api/arr/*</code> e{" "}
          <code>/api/pipeline/status</code>, nunca com o Radarr/Sonarr/Prowlarr/qBittorrent diretamente.
        </p>
      </div>
    </main>
  );
}
