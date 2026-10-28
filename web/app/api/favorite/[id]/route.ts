import { NextResponse } from "next/server";
import { setFavorite } from "@/lib/jellyfin";

export const dynamic = "force-dynamic";

const ID = /^[a-f0-9]{32}$/i;

/** Toggles the heart on the hero. Jellyfin keeps favorites per user. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID.test(id)) return NextResponse.json({ error: "invalid item id" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { favorite?: unknown } | null;
  if (typeof body?.favorite !== "boolean") return NextResponse.json({ error: "favorite must be boolean" }, { status: 400 });

  try {
    await setFavorite(id, body.favorite);
    return NextResponse.json({ favorite: body.favorite });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
