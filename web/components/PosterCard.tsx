"use client";

import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import Icon from "@/components/Icon";
import { Art } from "@/components/Hero";
import type { Feature } from "@/lib/feature";
import { motionTokens, springs } from "@/lib/motion";

const TILT = 7; // degrees at the card's edge

/** A frame you can lean into: it tilts toward the pointer, lifts, and the play disc rises out of it. */
export default function PosterCard({ feature: f, wide }: { feature: Feature; wide: boolean }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(px, [0, 1], [-TILT, TILT]), springs.tilt);
  const rotateX = useSpring(useTransform(py, [0, 1], [TILT, -TILT]), springs.tilt);
  const glareX = useTransform(px, [0, 1], ["0%", "100%"]);

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileFocus="hover"
      whileTap={{ scale: motionTokens.scale.press }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
      variants={{ rest: { y: 0, scale: 1 }, hover: reduce ? {} : { y: -6, scale: motionTokens.scale.lift } }}
      transition={springs.gentle}
      className={`group relative ${wide ? "w-[78vw] max-w-[26rem] md:w-[26rem]" : "w-[62vw] max-w-[19rem] md:w-[19rem]"}`}
    >
      <Link
        href={f.detailsHref ?? f.playHref}
        className="relative block aspect-[16/10] overflow-hidden rounded-2xl bg-dusk shadow-[0_18px_40px_-24px_rgb(0_0_0/0.9)] ring-1 ring-glass-line transition-shadow duration-300 group-hover:shadow-[0_28px_60px_-20px_rgb(0_0_0/0.95)]"
      >
        <motion.span
          className="absolute inset-0 block"
          variants={{ rest: { scale: 1 }, hover: reduce ? {} : { scale: 1.08 } }}
          transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth }}
        >
          <Art feature={f} />
        </motion.span>
        {!reduce && (
          <motion.span
            aria-hidden
            style={{ left: glareX }}
            className="pointer-events-none absolute -top-1/2 h-[200%] w-1/2 -translate-x-1/2 bg-[radial-gradient(closest-side,rgb(255_255_255/0.16),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-night via-night/30 to-transparent" />
        <motion.span
          variants={{ rest: { opacity: 0, scale: 0.6 }, hover: { opacity: 1, scale: 1 } }}
          transition={springs.snappy}
          className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-white text-night"
        >
          <Icon name="play" filled className="size-4" />
        </motion.span>
        <span className="absolute inset-x-0 bottom-0 p-4">
          <span className="block truncate text-lg font-bold">{f.title}</span>
          {f.line && <span className="mt-0.5 block truncate text-sm text-mist">{f.line}</span>}
          {f.progress ? (
            <span className="mt-3 block h-1 overflow-hidden rounded-full bg-white/20">
              <motion.span
                className="block h-full origin-left rounded-full bg-iris"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: f.progress }}
                viewport={{ once: true }}
                transition={{ duration: motionTokens.duration.reel, ease: motionTokens.easing.smooth, delay: 0.2 }}
              />
            </span>
          ) : null}
        </span>
      </Link>
    </motion.div>
  );
}
