import type { Item } from "@/lib/jellyfin";
import { episodeLabel, formatRemaining, remainingLabel } from "@/lib/format";

/** Hero/search payload: everything the client needs, nothing secret beyond the stream URL the page already ships. */
export type Feature = {
  id: string;
  title: string;
  kind: "Série" | "Filme";
  year?: number;
  genres: string[];
  line: string;
  overview?: string;
  image: string | null;
  video?: string;
  /** YouTube id of the official trailer; the hero prefers it over looping the content. */
  trailer?: string;
  playHref: string;
  detailsHref?: string;
  favorite: boolean;
  progress?: number;
};

// Jellyfin names unmatched files "Title (2024)"; the year already shows in the meta line.
export const displayTitle = (name: string) => name.replace(/\s*\(\d{4}\)\s*$/, "");

export function lineFor(item: Item, episodes: Item[] = []): { line: string; progress?: number; resume?: Item } {
  if (item.Type === "Series") {
    const resume = episodes.find((e) => (e.UserData?.PlaybackPositionTicks ?? 0) > 0 && !e.UserData?.Played);
    if (resume) {
      const pos = resume.UserData!.PlaybackPositionTicks;
      const run = resume.RunTimeTicks ?? 0;
      return {
        line: [episodeLabel(resume.ParentIndexNumber, resume.IndexNumber), run > pos ? remainingLabel(run - pos) : ""].filter(Boolean).join(" · "),
        progress: resume.RunTimeTicks ? pos / resume.RunTimeTicks : undefined,
        resume,
      };
    }
    return { line: `${episodes.length} ${episodes.length === 1 ? "episódio" : "episódios"}` };
  }
  const pos = item.UserData?.PlaybackPositionTicks ?? 0;
  const run = item.RunTimeTicks ?? 0;
  if (pos > 0 && run > pos) {
    return { line: remainingLabel(run - pos), progress: pos / run };
  }
  return { line: run ? formatRemaining(run) : "" };
}

const YT = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
export const trailerId = (item: Item) => item.RemoteTrailers?.map((t) => YT.exec(t.Url)?.[1]).find(Boolean);
