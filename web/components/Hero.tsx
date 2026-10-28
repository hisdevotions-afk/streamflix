"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import Icon from "@/components/Icon";
import Search from "@/components/Search";
import type { Feature } from "@/lib/feature";
import { motionTokens, REEL_MS, springs, useAfterHydration } from "@/lib/motion";

const { duration, easing } = motionTokens;

/**
 * The "now showing" screen. The strip at the bottom is the projector: every
 * REEL_MS it swaps the reel, and the new picture wipes in from the right like
 * a curtain while the title is re-set word by word.
 */
export default function Hero({ features, library }: { features: Feature[]; library: Feature[] }) {
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const elapsed = useMotionValue(0);
  const count = features.length;
  const active = features[index];

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Reduced motion: the reel never advances by itself.
  const running = count > 1 && !reduce && !hovering && !hidden && inView;
  useAnimationFrame((_, delta) => {
    if (!running) return;
    const next = elapsed.get() + delta / REEL_MS;
    if (next >= 1) {
      elapsed.set(0);
      setIndex((i) => (i + 1) % count);
    } else elapsed.set(next);
  });

  const select = (i: number) => {
    elapsed.set(0);
    setIndex(i);
  };

  // Reel timeline: finished reels plus the share of the current one.
  const reelProgress = useTransform(elapsed, (e) => (index + e) / Math.max(count, 1));

  if (!active) return null;

  return (
    <section
      ref={ref}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      className="relative isolate h-[100svh] max-h-[1100px] min-h-[600px] overflow-hidden bg-[linear-gradient(160deg,#1c1640_0%,#121033_45%,var(--color-night)_100%)]"
      aria-roledescription="carrossel"
      aria-label="Em destaque"
    >
      {/* Picture: bleeds off the right edge, curtain-wipes on every change. */}
      <div className="absolute inset-0 md:left-[28%]">
        <AnimatePresence initial={false}>
          <motion.div
            key={active.id}
            className="absolute inset-0"
            initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 0 100%)", scale: 1.12 }}
            animate={reduce ? { opacity: 1 } : { clipPath: "inset(0 0 0 0%)", scale: 1 }}
            exit={{ opacity: 0, transition: { duration: duration.slow, delay: duration.normal } }}
            transition={{ duration: reduce ? duration.fast : duration.reel * 1.4, ease: easing.smooth }}
          >
            <Media feature={active} playing={inView && !hidden} />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-[#141136] via-[#141136]/55 to-transparent md:via-[#141136]/25" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-night via-night/70 to-transparent md:h-1/3" />
      <div
        aria-hidden
        className="haze pointer-events-none absolute -left-[20%] top-[10%] h-[80%] w-[75%] rounded-full bg-[radial-gradient(closest-side,rgb(76_58_190/0.55),rgb(36_29_82/0.35)_55%,transparent)] blur-2xl"
      />

      <div className="absolute inset-x-4 top-4 z-20 flex justify-end md:inset-x-10 md:top-8">
        <Search library={library} />
      </div>

      {/* Copy */}
      <div className="absolute inset-x-5 bottom-[clamp(170px,30vh,250px)] z-10 max-w-[min(40rem,92vw)] md:left-14 md:bottom-[clamp(190px,30vh,280px)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            exit={{ opacity: 0, y: -motionTokens.distance.sm, transition: { duration: duration.fast, ease: easing.exit } }}
          >
            <RiseTitle text={active.title} className="text-[clamp(2.75rem,7vw,6rem)]" />
            <Fade delay={0.4} reduce={reduce}>
              <p className="mt-5 text-lg font-medium text-white/90 md:text-xl">
                {[active.kind.toLowerCase(), active.year, ...active.genres.slice(0, 2).map((g) => g.toLowerCase()), active.line]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Fade>
            {active.overview && (
              <Fade delay={0.45} reduce={reduce}>
                <p className="mt-3 line-clamp-2 max-w-[56ch] text-sm text-mist md:text-base">{active.overview}</p>
              </Fade>
            )}
            <Fade delay={0.5} reduce={reduce}>
              <div className="mt-7 flex flex-wrap gap-3">
                <motion.div whileTap={{ scale: motionTokens.scale.press }} transition={springs.snappy}>
                  <Link
                    href={active.playHref}
                    className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-white pr-7 pl-5 font-bold text-night shadow-[0_10px_30px_-10px_rgb(255_255_255/0.45)] transition-shadow duration-200 hover:shadow-[0_14px_40px_-8px_rgb(255_255_255/0.6)]"
                  >
                    <Icon name="play" filled className="size-4 transition-transform duration-200 ease-reel group-hover:translate-x-0.5" />
                    {active.progress ? "Retomar" : "Assistir"}
                  </Link>
                </motion.div>
                {active.detailsHref && (
                  <motion.div whileTap={{ scale: motionTokens.scale.press }} transition={springs.snappy}>
                    <Link
                      href={active.detailsHref}
                      className="inline-flex h-12 items-center rounded-full px-7 font-semibold text-white ring-1 ring-white/45 transition duration-200 hover:bg-white/10 hover:ring-white"
                    >
                      Episódios
                    </Link>
                  </motion.div>
                )}
              </div>
            </Fade>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Reel strip */}
      {count > 1 && (
        <div className="absolute inset-x-5 bottom-24 z-10 md:left-14 md:bottom-12">
          <ol className="no-scrollbar -ml-1.5 flex gap-2.5 overflow-x-auto px-1.5 py-2">
            {features.map((f, i) => (
              <li key={f.id}>
                <motion.button
                  type="button"
                  onClick={() => select(i)}
                  aria-label={`Destacar ${f.title}`}
                  aria-current={i === index}
                  animate={{ scale: i === index ? 1.06 : 1, opacity: i === index ? 1 : 0.55 }}
                  whileHover={{ opacity: 1, y: -3 }}
                  transition={springs.snappy}
                  className={`relative block h-[72px] w-[60px] overflow-hidden rounded-md bg-dusk md:h-[84px] md:w-[70px] ${
                    i === index ? "ring-2 ring-white" : "ring-1 ring-glass-line"
                  }`}
                >
                  <Art feature={f} />
                </motion.button>
              </li>
            ))}
          </ol>
          <div className="mt-3 h-[3px] w-[min(18rem,60vw)] overflow-hidden rounded-full bg-white/15">
            <motion.div style={{ scaleX: reelProgress }} className="h-full origin-left rounded-full bg-white" />
          </div>
        </div>
      )}

      <div className="absolute right-5 bottom-24 z-10 md:right-10 md:bottom-12">
        <Favorite key={active.id} id={active.id} initial={active.favorite} title={active.title} />
      </div>
    </section>
  );
}

/** Title words rise out of their own masks. Static on the first server paint, animated on every change after it. */
export function RiseTitle({ text, className = "" }: { text: string; className?: string }) {
  const reduce = useReducedMotion();
  const animate = useAfterHydration();
  return (
    <h1 className={`leading-[0.95] font-extrabold tracking-[-0.035em] text-balance text-white uppercase ${className}`}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={animate ? (reduce ? { opacity: 0 } : { y: "105%" }) : false}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            transition={{ duration: duration.slow, ease: easing.smooth, delay: 0.22 + i * 0.07 }}
          >
            {w}
            {"\u00a0"}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

function Fade({ children, delay, reduce }: { children: React.ReactNode; delay: number; reduce: boolean | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : motionTokens.distance.sm }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.normal, ease: easing.smooth, delay }}
    >
      {children}
    </motion.div>
  );
}

function Media({ feature, playing }: { feature: Feature; playing: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  // The loop is decorative: it stops whenever the hero is off-screen or the tab is hidden.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing]);

  if (feature.trailer) return <Trailer id={feature.trailer} poster={feature.image} playing={playing} />;
  if (feature.video) {
    return (
      <video
        ref={video}
        src={feature.video}
        poster={feature.image ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        className="h-full w-full object-cover"
      />
    );
  }
  return <Art feature={feature} />;
}

/**
 * Official trailer through YouTube's own muted embed, scaled to cover the stage
 * (and a little past it, so the embed's title strip stays off-screen). The art
 * holds the frame until the player has had time to start.
 */
function Trailer({ id, poster, playing }: { id: string; poster: string | null; playing: boolean }) {
  const [ready, setReady] = useState(false);
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3`;
  return (
    <div className="absolute inset-0 overflow-hidden [container-type:size]">
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {playing && (
        <iframe
          src={src}
          title="Trailer"
          allow="autoplay; encrypted-media"
          tabIndex={-1}
          onLoad={() => setTimeout(() => setReady(true), 1200)}
          className={`pointer-events-none absolute top-1/2 left-1/2 h-[max(100cqh,56.25cqw)] w-[max(100cqw,177.78cqh)] -translate-x-1/2 -translate-y-1/2 scale-[1.2] border-0 transition-opacity duration-700 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}

export function Art({ feature }: { feature: Pick<Feature, "image" | "title"> }) {
  if (feature.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={feature.image} alt="" className="h-full w-full object-cover" />;
  }
  return (
    <span className="flex h-full w-full items-end bg-haze p-1.5 text-left text-[10px] leading-tight font-bold text-white/80 uppercase">
      {feature.title}
    </span>
  );
}

function Favorite({ id, initial, title }: { id: string; initial: boolean; title: string }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = async () => {
    const next = !on;
    setOn(next);
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/favorite/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setOn(!next);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {failed && <span role="status" className="text-xs text-mist">Não deu para salvar. Tente de novo.</span>}
      <motion.button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        aria-label={on ? `Remover ${title} dos favoritos` : `Favoritar ${title}`}
        whileTap={{ scale: motionTokens.scale.press }}
        className={`grid size-12 place-items-center rounded-full ring-1 backdrop-blur-md transition-colors duration-200 disabled:cursor-wait ${
          on ? "bg-white text-night ring-white" : "bg-glass text-white ring-glass-line hover:bg-white/15"
        }`}
      >
        <motion.span
          key={String(on)}
          initial={{ scale: on ? 0.4 : 1 }}
          animate={{ scale: 1 }}
          transition={on ? springs.pop : { duration: duration.fast }}
        >
          <Icon name="heart" filled={on} className="size-5" />
        </motion.span>
      </motion.button>
    </div>
  );
}
