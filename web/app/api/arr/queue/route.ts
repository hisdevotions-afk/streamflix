import { NextResponse } from "next/server";
import { arrErrorStatus, arrKind, arrMessage, getQueue, type ArrKind, type QueueItem } from "@/lib/arr";

export const dynamic = "force-dynamic";

/** Fila de download do Radarr/Sonarr, com progresso normalizado em %. */
export async function GET(req: Request) {
  const kind = arrKind(new URL(req.url).searchParams.get("kind"));

  try {
    if (kind) {
      return NextResponse.json(
        { kind, items: await getQueue(kind) },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const kinds: ArrKind[] = ["movie", "series"];
    const settled = await Promise.allSettled(kinds.map(getQueue));
    const items: Record<ArrKind, QueueItem[]> = { movie: [], series: [] };
    const errors: Partial<Record<ArrKind, string>> = {};

    settled.forEach((result, index) => {
      if (result.status === "fulfilled") items[kinds[index]] = result.value;
      else errors[kinds[index]] = arrMessage(result.reason);
    });

    return NextResponse.json(
      { items, errors },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json({ error: arrMessage(err) }, { status: arrErrorStatus(err) });
  }
}
