import { NextResponse } from "next/server";
import { reportPlayback, type PlaybackEvent } from "@/lib/jellyfin";

export const dynamic = "force-dynamic";

type Body = {
  event?: PlaybackEvent;
  itemId?: string;
  mediaSourceId?: string;
  playSessionId?: string;
  positionTicks?: number;
  isPaused?: boolean;
};

const EVENTS: PlaybackEvent[] = ["start", "progress", "stop"];

/**
 * Same-origin playback reporter.
 *
 * The browser talks to this route instead of Jellyfin directly so that the
 * final "stop" report can leave through navigator.sendBeacon() on phones
 * (no CORS preflight, no lost keepalive request when the tab is killed).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.itemId || !body.event || !EVENTS.includes(body.event)) {
    return NextResponse.json({ error: "event and itemId are required" }, { status: 400 });
  }

  try {
    await reportPlayback(body.event, {
      ItemId: body.itemId,
      MediaSourceId: body.mediaSourceId || body.itemId,
      PlaySessionId: body.playSessionId || crypto.randomUUID(),
      PositionTicks: Math.max(0, Math.floor(Number(body.positionTicks ?? 0))),
      IsPaused: Boolean(body.isPaused),
      CanSeek: true,
      PlayMethod: "Transcode",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  return new NextResponse(null, { status: 204 });
}
