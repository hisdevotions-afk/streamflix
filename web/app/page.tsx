import { headers } from "next/headers";
import Hero from "@/components/Hero";
import Row from "@/components/Row";
import { displayTitle, lineFor, trailerId, type Feature } from "@/lib/feature";
import { episodeLabel, remainingLabel } from "@/lib/format";
import { getByType, getEpisodes, getResume, imageUrl, previewUrl, publicJfUrl, type Item } from "@/lib/jellyfin";

export default async function Home() {
  const [resume, series, movies] = await Promise.all([getResume(), getByType("Series"), getByType("Movie")]);
  // Browser-facing media must use the host the client reached us on, not server-side localhost.
  const jf = publicJfUrl((await headers()).get("host"));
  const episodesBySeries = new Map(
    await Promise.all(series.map(async (s) => [s.Id, await getEpisodes(s.Id)] as const)),
  );

  const toFeature = (item: Item): Feature => {
    const episodes = episodesBySeries.get(item.Id) ?? [];
    const { line, progress, resume: next } = lineFor(item, episodes);
    // Jellyfin has no local trailer for most items, so the hero loops the content itself (first episode for series).
    const videoId = item.Type === "Series" ? (next ?? episodes[0])?.Id : item.Id;
    // Unmatched series have no art of their own; their first episode's frame stands in.
    const image =
      imageUrl(item, "Backdrop", jf) ?? imageUrl(item, "Primary", jf) ?? (episodes[0] ? imageUrl(episodes[0], "Primary", jf) : null);
    return {
      id: item.Id,
      title: displayTitle(item.Name),
      kind: item.Type === "Series" ? "Série" : "Filme",
      year: item.ProductionYear,
      genres: item.Genres ?? [],
      line,
      overview: item.Overview,
      image,
      video: videoId ? previewUrl(videoId, jf) : undefined,
      trailer: trailerId(item),
      playHref: videoId ? `/watch/${videoId}` : `/series/${item.Id}`,
      detailsHref: item.Type === "Series" ? `/series/${item.Id}` : undefined,
      favorite: item.UserData?.IsFavorite ?? false,
      progress,
    };
  };

  const seriesF = series.map(toFeature);
  const moviesF = movies.map(toFeature);
  const library = [...seriesF, ...moviesF];
  // Titles with real artwork lead the reel; bare files only fill in when nothing else exists.
  const withArt = [...series, ...movies].filter((i) => i.BackdropImageTags?.length).map((i) => i.Id);
  const featured = (withArt.length ? library.filter((f) => withArt.includes(f.id)) : library).slice(0, 6);
  // Like a billboard, only the lead highlight plays its trailer; the rest loop their own picture.
  featured.forEach((f, i) => {
    if (i > 0) f.trailer = undefined;
  });

  const continuing: Feature[] = resume.map((i) => {
    const pos = i.UserData?.PlaybackPositionTicks ?? 0;
    const run = i.RunTimeTicks ?? 0;
    const where = run > pos ? remainingLabel(run - pos) : "";
    return {
      id: i.Id,
      title: displayTitle(i.SeriesName ?? i.Name),
      kind: i.SeriesName ? "Série" : "Filme",
      genres: [],
      line: [i.SeriesName && episodeLabel(i.ParentIndexNumber, i.IndexNumber), where].filter(Boolean).join(" · "),
      image: imageUrl(i, "Backdrop", jf) ?? imageUrl(i, "Primary", jf),
      playHref: `/watch/${i.Id}`,
      favorite: false,
      progress: run ? pos / run : (i.UserData?.PlayedPercentage ?? 0) / 100,
    };
  });

  return (
    <main className="pb-20">
      {featured.length ? (
        <Hero features={featured} library={library} />
      ) : (
        <section className="grid min-h-[70svh] place-items-center px-6 text-center">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">A biblioteca está vazia</h1>
            <p className="mt-3 text-mist">Coloque filmes em ~/Midia/Filmes ou séries em ~/Midia/Series e atualize a biblioteca no Jellyfin.</p>
          </div>
        </section>
      )}
      <div className="relative z-10 space-y-10 pt-6">
        <Row id="continuar" title="Continuar assistindo" items={continuing} wide />
        <Row id="series" title="Séries" items={seriesF} />
        <Row id="filmes" title="Filmes" items={moviesF} />
      </div>
    </main>
  );
}
