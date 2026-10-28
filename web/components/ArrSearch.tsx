"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ArrKind, LookupItem } from "@/lib/arr-types";

const KIND_LABEL: Record<ArrKind, string> = { movie: "Filme", series: "Série" };

export default function ArrSearch() {
  const router = useRouter();
  const [kind, setKind] = useState<ArrKind>("movie");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<LookupItem[]>([]);
  const [busy, setBusy] = useState<"search" | number | null>(null);
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searched, setSearched] = useState(false);

  function changeKind(next: ArrKind) {
    setKind(next);
    setResults([]);
    setAdded({});
    setError("");
    setNotice("");
    setSearched(false);
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;

    setBusy("search");
    setError("");
    setNotice("");
    setAdded({});
    try {
      const res = await fetch(`/api/arr/lookup?kind=${kind}&term=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results?: LookupItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "falha na busca");
      setResults(data.results ?? []);
      setSearched(true);
      if (!data.results?.length) setNotice("Nenhum título encontrado.");
    } catch (err) {
      setResults([]);
      setSearched(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function add(item: LookupItem) {
    setBusy(item.arrId);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/arr/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, arrId: item.arrId }),
      });
      const data = (await res.json().catch(() => ({}))) as { existed?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "falha ao adicionar");

      setAdded((prev) => ({ ...prev, [item.arrId]: true }));
      setNotice(
        data.existed
          ? `"${item.title}" já estava na biblioteca.`
          : `"${item.title}" adicionado e monitorado. A busca automática começa quando houver indexador e cliente de download configurados.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-neutral-900/60 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Pedir título</h2>
        <div className="flex rounded-lg border border-white/10 p-1">
          {(["movie", "series"] as ArrKind[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => changeKind(value)}
              aria-pressed={kind === value}
              className={`rounded px-3 py-1 text-sm transition ${
                kind === value ? "bg-white font-semibold text-black" : "text-white/60 hover:text-white"
              }`}
            >
              {value === "movie" ? "Filmes" : "Séries"}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={search} className="mt-4 flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={kind === "movie" ? "Ex.: Interestelar, Cidade de Deus…" : "Ex.: Breaking Bad, Dark…"}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-4 py-2 text-sm outline-none placeholder:text-white/35 focus:border-white/40"
        />
        <button
          type="submit"
          disabled={busy === "search" || !term.trim()}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold transition hover:bg-red-500 disabled:opacity-40"
        >
          {busy === "search" ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {notice && <p className="mt-3 text-sm text-emerald-400">{notice}</p>}

      {searched && results.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.slice(0, 9).map((item) => (
            <article
              key={`${item.kind}-${item.arrId}`}
              className="flex gap-3 rounded-lg border border-white/10 bg-black/30 p-3"
            >
              {item.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.poster}
                  alt={item.title}
                  className="h-28 w-20 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded bg-neutral-800 text-xs text-white/40">
                  sem capa
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-sm font-semibold">
                  {item.title} {item.year ? <span className="text-white/50">({item.year})</span> : null}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-white/50">{item.overview || "Sem sinopse."}</p>
                <div className="mt-auto pt-2">
                  <button
                    type="button"
                    onClick={() => add(item)}
                    disabled={added[item.arrId] || busy === item.arrId}
                    className="rounded bg-white px-3 py-1 text-xs font-semibold text-black transition hover:bg-white/80 disabled:opacity-40"
                  >
                    {added[item.arrId]
                      ? "Na biblioteca"
                      : busy === item.arrId
                        ? "Adicionando…"
                        : `Adicionar ${KIND_LABEL[item.kind].toLowerCase()}`}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
