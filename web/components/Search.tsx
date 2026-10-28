"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Icon from "@/components/Icon";
import { Art } from "@/components/Hero";
import type { LookupItem } from "@/lib/arr-types";
import type { Feature } from "@/lib/feature";
import { motionTokens } from "@/lib/motion";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const MIN_CHARS = 2;
const DEBOUNCE_MS = 350;

type Payload = { results?: LookupItem[]; warnings?: string[]; error?: string };
type AddPayload = { existed?: boolean; error?: string };

const keyOf = (item: LookupItem) => `${item.kind}:${item.arrId}`;
const kindLabel = (kind: LookupItem["kind"]) => (kind === "movie" ? "Filme" : "Série");

/**
 * Uma busca só: primeiro o que já está na biblioteca (abre o título), depois o
 * catálogo do Radarr/Sonarr com o botão de pedir. O navegador fala apenas com
 * `/api/arr/*`; as API keys ficam no servidor.
 */
export default function Search({ library }: { library: Feature[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [catalog, setCatalog] = useState<LookupItem[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [catalogError, setCatalogError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const term = norm(q.trim());
    return term ? library.filter((f) => norm(f.title).includes(term)).slice(0, 6) : [];
  }, [q, library]);

  // Catálogo: debounce + cancelamento, sem travar a busca local.
  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN_CHARS) {
      setCatalog([]);
      setWarnings([]);
      setCatalogState("idle");
      setCatalogError("");
      setNotice("");
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCatalogState("loading");
      setCatalogError("");
      setNotice("");
      try {
        const res = await fetch(`/api/arr/search?term=${encodeURIComponent(term)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = (await res.json()) as Payload;
        if (!res.ok) throw new Error(data.error ?? "falha na busca");
        setCatalog(data.results ?? []);
        setWarnings(data.warnings ?? []);
        setCatalogState("done");
      } catch (err) {
        if (controller.signal.aborted) return;
        setCatalog([]);
        setWarnings([]);
        setCatalogState("error");
        setCatalogError(err instanceof Error ? err.message : String(err));
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q]);

  const pending = useMemo(() => {
    const term = norm(q.trim());
    if (term.length < MIN_CHARS) return [];
    return catalog
      .filter((item) => !library.some((f) => norm(f.title) === norm(item.title) && (!f.year || !item.year || f.year === item.year)))
      .slice(0, 6);
  }, [q, catalog, library]);

  const go = (f: Feature) => {
    setOpen(false);
    router.push(f.detailsHref ?? f.playHref);
  };

  async function request(item: LookupItem) {
    const key = keyOf(item);
    setAdding(key);
    setCatalogError("");
    setNotice("");
    try {
      const res = await fetch("/api/arr/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, arrId: item.arrId }),
      });
      const data = (await res.json().catch(() => ({}))) as AddPayload;
      if (!res.ok) throw new Error(data.error ?? "falha ao pedir");

      setAdded((prev) => ({ ...prev, [key]: true }));
      setNotice(
        data.existed
          ? `"${item.title}" já estava na biblioteca.`
          : `"${item.title}" pedido. O ${item.kind === "movie" ? "Radarr" : "Sonarr"} já está buscando.`,
      );
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="relative w-full max-w-sm md:w-[22rem]">
      <label className="flex h-12 items-center gap-3 rounded-full bg-night/60 pr-4 pl-4 ring-1 ring-glass-line backdrop-blur-xl transition duration-200 focus-within:bg-night/75 focus-within:ring-white/40">
        <Icon name="search" className="size-[18px] shrink-0 text-mist" />
        <span className="sr-only">Buscar ou pedir filme e série</span>
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, results.length - 1));
            else if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
            else if (e.key === "Enter" && results[cursor]) go(results[cursor]);
            else if (e.key === "Escape") input.current?.blur();
            else return;
            e.preventDefault();
          }}
          role="combobox"
          aria-expanded={open && q.trim().length > 0}
          aria-controls={listId}
          aria-activedescendant={results[cursor] ? `${listId}-${results[cursor].id}` : undefined}
          placeholder="Buscar filme ou série"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white placeholder:text-mist focus:outline-none"
        />
      </label>

      <AnimatePresence>
        {open && q.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -motionTokens.distance.xs, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -motionTokens.distance.xs, transition: { duration: motionTokens.duration.fast } }}
            transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth }}
            className="absolute inset-x-0 top-14 origin-top max-h-[min(72vh,36rem)] overflow-y-auto rounded-3xl bg-dusk/95 p-2 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)] ring-1 ring-glass-line backdrop-blur-xl"
          >
            {results.length > 0 && (
              <>
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-mist uppercase">Na biblioteca</p>
                <ul id={listId} role="listbox">
                  {results.map((f, i) => (
                    <li
                      key={f.id}
                      id={`${listId}-${f.id}`}
                      role="option"
                      aria-selected={i === cursor}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(f)}
                      onMouseEnter={() => setCursor(i)}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl p-2 transition-colors duration-100 ${i === cursor ? "bg-white/10" : ""}`}
                    >
                      <span className="block h-12 w-10 shrink-0 overflow-hidden rounded-md">
                        <Art feature={f} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{f.title}</span>
                        <span className="block text-xs text-mist">{[f.kind, f.year].filter(Boolean).join(" · ")}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {pending.length > 0 && (
              <>
                <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-mist uppercase">Pedir</p>
                <ul>
                  {pending.map((item) => {
                    const key = keyOf(item);
                    const isAdded = added[key];
                    return (
                      <li key={key} className="flex items-center gap-3 rounded-2xl p-2">
                        <span className="block h-12 w-10 shrink-0 overflow-hidden rounded-md bg-white/5">
                          {item.poster ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.poster} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="grid h-full w-full place-items-center text-[9px] text-mist">—</span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{item.title}</span>
                          <span className="block text-xs text-mist">
                            {[kindLabel(item.kind), item.year].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => request(item)}
                          disabled={isAdded || adding === key}
                          className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-night transition hover:bg-white/85 disabled:cursor-default disabled:opacity-50"
                        >
                          {isAdded ? "Pedido ✓" : adding === key ? "Pedindo…" : "Pedir"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {catalogState === "loading" && <p className="px-3 py-3 text-xs text-mist">Buscando no catálogo…</p>}
            {catalogState === "error" && <p className="px-3 py-3 text-xs text-amber-300">{catalogError}</p>}
            {warnings.map((warning) => (
              <p key={warning} className="px-3 py-1 text-xs text-amber-300">
                {warning}
              </p>
            ))}
            {notice && <p className="px-3 py-2 text-xs text-emerald-300">{notice}</p>}

            {!results.length && !pending.length && catalogState === "idle" && q.trim().length < MIN_CHARS && (
              <p className="px-3 py-4 text-sm text-mist">Digite ao menos 2 letras para buscar no catálogo.</p>
            )}
            {!results.length && !pending.length && catalogState === "done" && (
              <p className="px-3 py-4 text-sm text-mist">Nada com “{q.trim()}” na biblioteca nem no catálogo.</p>
            )}

            <Link
              href="/automacao"
              className="mt-1 block rounded-2xl px-3 py-2 text-xs font-semibold text-mist transition hover:bg-white/5 hover:text-white"
            >
              Ver fila e biblioteca →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
