import { NextResponse } from "next/server";
import { getProgress } from "@/lib/jellyfin";

export const dynamic = "force-dynamic";

const ID = /^[a-f0-9]{32}$/i;

/** Latest saved position for one item, read fresh so a device resumes where another stopped. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID.test(id)) return NextResponse.json({ error: "invalid item id" }, { status: 400 });

  try {
    return NextResponse.json(await getProgress(id), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
