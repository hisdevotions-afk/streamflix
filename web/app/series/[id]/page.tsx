import Link from "next/link";
import { headers } from "next/headers";
import EpisodeList from "@/components/EpisodeList";
import { RiseTitle } from "@/components/Hero";
import Icon from "@/components/Icon";
import { displayTitle } from "@/lib/feature";
import { getEpisodes, getItem, imageUrl, publicJfUrl } from "@/lib/jellyfin";
import { episodeLabel, formatRemaining, remainingLabel } from "@/lib/format";

export default async function Series({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [series, episodes] = await Promise.all([getItem(id), getEpisodes(id)]);
  const jf = publicJfUrl((await headers()).get("host"));

  const ordered = [...episodes].sort(
    (a, b) =>
      (a.ParentIndexNumber ?? 0) - (b.ParentIndexNumber ?? 0) || (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0),
  );

  // Pick the most recently touched unfinished episode, otherwise the next
  // unwatched one. This is the "continue on the computer" entry point.
  const inProgress = ordered
    .filter((e) => (e.UserData?.PlaybackPositionTicks ?? 0) > 0 && !e.UserData?.Played)
    .sort((a, b) => Date.parse(b.UserData?.LastPlayedDate ?? "") - Date.parse(a.UserData?.LastPlayedDate ?? ""));
  const resume = inProgress[0] ?? ordered.find((e) => !e.UserData?.Played) ?? ordered[0];
  const resumePos = resume?.UserData?.PlaybackPositionTicks ?? 0;
  const resumeRuntime = resume?.RunTimeTicks ?? 0;

  const backdrop =
    imageUrl(series, "Backdrop", jf) ?? imageUrl(series, "Primary", jf) ?? (resume ? imageUrl(resume, "Primary", jf) : null);
  const seasons = new Set(ordered.map((e) => e.ParentIndexNumber ?? 0)).size;

  return (
    <main className="pb-20">
      <section className="relative isolate min-h-[62svh] overflow-hidden bg-[linear-gradient(160deg,#1c1640_0%,#121033_45%,var(--color-night)_100%)]">
        {backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover md:left-[28%] md:w-[72%]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#141136] via-[#141136]/60 to-transparent md:via-[#141136]/30" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-night to-transparent" />
        <div className="relative flex min-h-[62svh] max-w-3xl flex-col justify-end px-5 pt-24 pb-10 md:px-14">
          <Link
            href="/"
            className="absolute top-6 left-5 inline-flex h-11 items-center gap-2 rounded-full bg-glass pr-5 pl-4 text-sm font-semibold ring-1 ring-glass-line backdrop-blur-md transition hover:bg-white/15 md:top-8 md:left-14"
          >
            <Icon name="back" className="size-4" /> Início
          </Link>
          <RiseTitle text={displayTitle(series.Name)} className="text-[clamp(2.5rem,6vw,5rem)]" />
          <p className="mt-4 text-lg font-medium text-mist">
            série · {ordered.length} {ordered.length === 1 ? "episódio" : "episódios"}
            {seasons > 1 ? ` · ${seasons} temporadas` : ""}
          </p>
          {series.Overview && <p className="mt-4 max-w-[60ch] text-mist">{series.Overview}</p>}
          {resume && (
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href={`/watch/${resume.Id}`}
                className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-white pr-7 pl-5 font-bold text-night shadow-[0_10px_30px_-10px_rgb(255_255_255/0.45)] transition-shadow duration-200 hover:shadow-[0_14px_40px_-8px_rgb(255_255_255/0.6)] active:scale-[0.97]"
              >
                <Icon name="play" filled className="size-4 transition-transform duration-200 ease-reel group-hover:translate-x-0.5" />
                {resumePos > 0 ? "Retomar" : "Assistir"} {episodeLabel(resume.ParentIndexNumber, resume.IndexNumber)}
              </Link>
              <span className="text-sm text-mist">
                {resumePos > 0 && resumeRuntime > resumePos ? remainingLabel(resumeRuntime - resumePos) : "do começo"}
              </span>
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="eps" className="max-w-4xl px-3 md:px-12">
        <h2 id="eps" className="mb-4 px-2 text-2xl font-bold tracking-tight">Episódios</h2>
        <EpisodeList
          episodes={ordered.map((e) => {
            const pos = e.UserData?.PlaybackPositionTicks ?? 0;
            const runtime = e.RunTimeTicks ?? 0;
            const played = e.UserData?.Played ?? false;
            return {
              id: e.Id,
              code: episodeLabel(e.ParentIndexNumber, e.IndexNumber),
              name: e.Name,
              image: imageUrl(e, "Primary", jf),
              played,
              resume: resume?.Id === e.Id && pos > 0,
              progress: runtime ? Math.min(100, Math.round((pos / runtime) * 100)) : Math.round(e.UserData?.PlayedPercentage ?? 0),
              status: played
                ? "assistido"
                : pos > 0
                  ? runtime > pos
                    ? remainingLabel(runtime - pos)
                    : "em andamento"
                  : runtime
                    ? formatRemaining(runtime)
                    : "não assistido",
            };
          })}
        />
      </section>
    </main>
  );
}
