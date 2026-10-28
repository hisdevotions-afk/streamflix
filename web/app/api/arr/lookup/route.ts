import { NextResponse } from "next/server";
import { arrErrorStatus, arrKind, arrMessage, lookup } from "@/lib/arr";

export const dynamic = "force-dynamic";

/** Busca títulos no catálogo do Radarr/Sonarr (TMDB/TVDB) para pedir. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = arrKind(url.searchParams.get("kind"));
  const term = (url.searchParams.get("term") ?? "").trim();

  if (!kind) return NextResponse.json({ error: "kind deve ser movie ou series" }, { status: 400 });
  if (!term) return NextResponse.json({ results: [] });
  if (term.length > 200) return NextResponse.json({ error: "term muito longo" }, { status: 400 });

  try {
    return NextResponse.json({ results: await lookup(kind, term) }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: arrMessage(err) }, { status: arrErrorStatus(err) });
  }
}
