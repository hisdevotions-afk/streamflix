import { NextResponse } from "next/server";
import { addToLibrary, arrErrorStatus, arrKind, arrMessage } from "@/lib/arr";

export const dynamic = "force-dynamic";

type Body = { kind?: string; arrId?: number };

/**
 * Adiciona um filme (TMDB) ou série (TVDB) monitorado, já com busca automática.
 * Idempotente: se o título já está na biblioteca, devolve o item existente.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const kind = arrKind(body?.kind ?? null);
  const arrId = Number(body?.arrId);

  if (!kind) return NextResponse.json({ error: "kind deve ser movie ou series" }, { status: 400 });
  if (!Number.isInteger(arrId) || arrId <= 0) {
    return NextResponse.json({ error: "arrId (TMDB/TVDB) inválido" }, { status: 400 });
  }

  try {
    const item = await addToLibrary(kind, arrId);
    return NextResponse.json(item, { status: item.existed ? 200 : 201 });
  } catch (err) {
    return NextResponse.json({ error: arrMessage(err) }, { status: arrErrorStatus(err) });
  }
}
