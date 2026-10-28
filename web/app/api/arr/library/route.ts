import { NextResponse } from "next/server";
import {
  arrErrorStatus,
  arrKind,
  arrMessage,
  getLibrary,
  removeFromLibrary,
  type ArrKind,
  type LibraryItem,
} from "@/lib/arr";

export const dynamic = "force-dynamic";

/** Biblioteca gerenciada: `?kind=movie|series` filtra; sem kind devolve os dois. */
export async function GET(req: Request) {
  const kind = arrKind(new URL(req.url).searchParams.get("kind"));

  try {
    if (kind) {
      return NextResponse.json(
        { kind, items: await getLibrary(kind) },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const kinds: ArrKind[] = ["movie", "series"];
    const settled = await Promise.allSettled(kinds.map(getLibrary));
    const items: Record<ArrKind, LibraryItem[]> = { movie: [], series: [] };
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

/**
 * Remove da biblioteca do *arr. Por padrão preserva os arquivos: apagar mídia é
 * uma decisão explícita (`deleteFiles=true`).
 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const kind = arrKind(url.searchParams.get("kind"));
  const id = Number(url.searchParams.get("id"));
  const deleteFiles = url.searchParams.get("deleteFiles") === "true";

  if (!kind) return NextResponse.json({ error: "kind deve ser movie ou series" }, { status: 400 });
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  try {
    await removeFromLibrary(kind, id, deleteFiles);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: arrMessage(err) }, { status: arrErrorStatus(err) });
  }
}
