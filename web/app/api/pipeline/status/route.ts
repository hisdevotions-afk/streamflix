import { NextResponse } from "next/server";
import { getPipelineStatus } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

/** Saúde de Prowlarr e qBittorrent (sem expor credenciais). */
export async function GET() {
  return NextResponse.json(
    { services: await getPipelineStatus() },
    { headers: { "cache-control": "no-store" } },
  );
}
