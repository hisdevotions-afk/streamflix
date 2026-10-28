import Link from "next/link";
import { headers } from "next/headers";
import Icon from "@/components/Icon";
import Player from "@/components/Player";
import { displayTitle } from "@/lib/feature";
import { getItem, imageUrl, JF_TOKEN, publicJfUrl } from "@/lib/jellyfin";

export default async function Watch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  const jf = publicJfUrl((await headers()).get("host"));
  const back = item.SeriesId ? `/series/${item.SeriesId}` : "/";
  return (
    <main className="fixed inset-0 z-50 bg-black">
      <Player
        jfUrl={jf}
        token={JF_TOKEN}
        itemId={id}
        title={item.SeriesName ? `${item.SeriesName} · ${item.Name}` : displayTitle(item.Name)}
        startTicks={item.UserData?.PlaybackPositionTicks ?? 0}
        poster={imageUrl(item, "Backdrop", jf) ?? imageUrl(item, "Primary", jf)}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-night/80 to-transparent" />
      <Link
        href={back}
        className="absolute top-4 left-4 z-10 inline-flex h-11 items-center gap-2 rounded-full bg-night/50 pr-5 pl-4 text-sm font-semibold ring-1 ring-glass-line backdrop-blur-md transition hover:bg-night/80 md:top-6 md:left-6"
      >
        <Icon name="back" className="size-4" /> {item.SeriesName ? "Episódios" : "Início"}
      </Link>
    </main>
  );
}
