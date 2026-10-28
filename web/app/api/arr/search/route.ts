import { NextResponse } from "next/server";
import { arrErrorStatus, arrMessage, searchCatalog } from "@/lib/arr";

export const dynamic = "force-dynamic";

/**
 * Busca filmes (Radarr/TMDB) e séries (Sonarr/TVDB) em uma só chamada.
 * É o que a barra de pesquisa do cabeçalho consome; as chaves ficam no servidor.
 */
export async function GET(req: Request) {
  const term = (new URL(req.url).searchParams.get("term") ?? "").trim();
  if (!term) return NextResponse.json({ results: [], warnings: [] });
  if (term.length > 200) return NextResponse.json({ error: "term muito longo" }, { status: 400 });

  try {
    return NextResponse.json(await searchCatalog(term), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: arrMessage(err) }, { status: arrErrorStatus(err) });
  }
}
