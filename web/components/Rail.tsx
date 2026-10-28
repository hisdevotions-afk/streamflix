"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import Icon, { type IconName } from "@/components/Icon";
import { springs } from "@/lib/motion";

const ITEMS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Início", icon: "home", match: (p) => p === "/" },
  { href: "/#continuar", label: "Continuar", icon: "history", match: () => false },
  { href: "/#series", label: "Séries", icon: "tv", match: (p) => p.startsWith("/series") },
  { href: "/#filmes", label: "Filmes", icon: "film", match: () => false },
  { href: "/automacao", label: "Automação", icon: "bolt", match: (p) => p.startsWith("/automacao") },
];

/** Left icon rail on desktop, bottom bar on phones. The lit disc slides between items. */
export default function Rail() {
  const path = usePathname();
  if (path.startsWith("/watch")) return null;

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-glass-line bg-night/80 px-2 py-2 backdrop-blur-xl md:inset-y-0 md:left-0 md:right-auto md:w-[76px] md:flex-col md:justify-start md:gap-4 md:border-t-0 md:border-r md:bg-night/40 md:py-7"
    >
      <Link href="/" aria-label="Streamflix" className="mb-6 hidden grid-cols-2 gap-1 md:grid">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`size-2 rounded-[3px] ${i === 3 ? "bg-iris" : "bg-white"}`} />
        ))}
      </Link>
      {ITEMS.map((it) => {
        const active = it.match(path);
        return (
          <Link
            key={it.label}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className="group relative grid size-11 place-items-center rounded-full text-mist transition-colors duration-150 hover:text-white"
          >
            {active && (
              <motion.span
                layoutId="rail-active"
                transition={springs.snappy}
                className="absolute inset-0 rounded-full bg-white/18 shadow-[0_6px_20px_-6px_rgb(139_124_255/0.7)] ring-1 ring-white/25"
              />
            )}
            <span className={`absolute inset-0 rounded-full bg-glass transition-transform duration-200 ease-reel group-hover:scale-110 ${active ? "opacity-0" : ""}`} />
            <Icon name={it.icon} className={`relative size-[18px] ${active ? "text-white" : ""}`} />
            <span className="pointer-events-none absolute left-14 hidden -translate-x-1 whitespace-nowrap rounded-full bg-dusk px-3 py-1 text-xs font-semibold opacity-0 ring-1 ring-glass-line transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 md:block">
              {it.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
