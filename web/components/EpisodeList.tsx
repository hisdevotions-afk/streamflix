"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import Icon from "@/components/Icon";
import { motionTokens } from "@/lib/motion";

export type EpisodeRow = {
  id: string;
  code: string;
  name: string;
  image: string | null;
  status: string;
  progress: number;
  played: boolean;
  resume: boolean;
};

/** Episodes arrive as a list, so they cascade in as one (40ms steps, capped). */
export default function EpisodeList({ episodes }: { episodes: EpisodeRow[] }) {
  const reduce = useReducedMotion();
  return (
    <ol className="space-y-2">
      {episodes.map((e, i) => (
        <motion.li
          key={e.id}
          initial={reduce ? false : { opacity: 0, x: -motionTokens.distance.md }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth, delay: Math.min(i * 0.04, 0.4) }}
        >
          <Link
            href={`/watch/${e.id}`}
            className={`group flex items-center gap-4 rounded-2xl p-2.5 pr-5 transition-colors duration-200 hover:bg-white/[0.06] ${
              e.resume ? "bg-white/[0.07] ring-1 ring-iris/50" : ""
            }`}
          >
            <span className="relative block aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-dusk md:w-44">
              {e.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.image} alt="" className="h-full w-full object-cover transition-transform duration-500 ease-reel group-hover:scale-110" />
              )}
              <span className="absolute inset-0 grid place-items-center bg-night/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <span className="grid size-10 scale-75 place-items-center rounded-full bg-white text-night transition-transform duration-300 ease-reel group-hover:scale-100">
                  <Icon name="play" filled className="size-4" />
                </span>
              </span>
              {e.progress > 0 && !e.played && (
                <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                  <span className="block h-full bg-iris" style={{ width: `${e.progress}%` }} />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-lg font-bold">{e.name}</span>
                {e.resume && <span className="shrink-0 rounded-full bg-iris px-2 py-0.5 text-[11px] font-bold text-night">Retomar</span>}
              </span>
              <span className="mt-0.5 block text-sm text-mist">
                {e.played && <Icon name="check" className="mr-1 inline size-4 align-[-3px] text-iris-soft" />}
                <span className="font-semibold tabular-nums">{e.code}</span> · {e.status}
              </span>
            </span>
          </Link>
        </motion.li>
      ))}
    </ol>
  );
}
