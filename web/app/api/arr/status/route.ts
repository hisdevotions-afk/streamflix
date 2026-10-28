import { NextResponse } from "next/server";
import { getArrStatusAll } from "@/lib/arr";

export const dynamic = "force-dynamic";

/** Saúde e versão do Radarr e do Sonarr. Nunca devolve as API keys. */
export async function GET() {
  return NextResponse.json(
    { services: await getArrStatusAll() },
    { headers: { "cache-control": "no-store" } },
  );
}
