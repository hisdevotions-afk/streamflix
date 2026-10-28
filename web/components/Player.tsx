"use client";

import { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";

const TICKS = 10_000_000; // Jellyfin positions are in 100ns ticks
const HEARTBEAT_MS = 10_000; // same cadence the Plex/Jellyfin clients use

// crypto.randomUUID() só existe em contexto seguro (HTTPS ou localhost).
// Na LAN via http://<ip>:3000 ele é undefined e derrubava o player.
const newSessionId = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type Props = { jfUrl: string; token: string; itemId: string; title: string; startTicks: number; poster?: string | null };
type PlaybackEvent = "start" | "progress" | "stop";

export default function Player({ jfUrl, token, itemId, title, startTicks, poster }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Latest server-side position. The server is the source of truth, so a
  // desktop opening an episode watched on a phone resumes at the phone's spot.
  const resumeRef = useRef(startTicks);

  useEffect(() => {
    resumeRef.current = startTicks;
  }, [startTicks]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/progress/${itemId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { positionTicks?: number } | null) => {
        if (!cancelled && d && typeof d.positionTicks === "number" && d.positionTicks > resumeRef.current) {
          resumeRef.current = d.positionTicks;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  useEffect(() => {
    const el = document.createElement("video-js");
    el.classList.add("vjs-fill", "vjs-big-play-centered");
    ref.current!.appendChild(el);

    const playSessionId = newSessionId();
    const player = videojs(el, {
      controls: true,
      autoplay: true,
      poster: poster ?? undefined,
      sources: [{
        src: `${jfUrl}/Videos/${itemId}/master.m3u8?api_key=${token}&mediaSourceId=${itemId}&playSessionId=${playSessionId}&videoCodec=h264&audioCodec=aac`,
        type: "application/x-mpegURL",
      }],
    });

    let started = false;
    let stopped = false;
    let seeked = false;

    const payload = (event: PlaybackEvent) =>
      JSON.stringify({
        event,
        itemId,
        playSessionId,
        positionTicks: Math.max(0, Math.floor((player.currentTime() ?? 0) * TICKS)),
        isPaused: player.paused(),
      });

    // Same-origin route: avoids the CORS preflight that a direct Jellyfin call
    // would need, and lets the last report survive a phone killing the tab.
    const report = (event: PlaybackEvent) => {
      const body = payload(event);
      if (event === "stop" && typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/playback", new Blob([body], { type: "application/json" }));
        return;
      }
      fetch("/api/playback", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {});
    };

    const seekToResume = () => {
      if (seeked) return;
      const target = resumeRef.current / TICKS;
      if (target <= 1) {
        seeked = true;
        return;
      }
      const now = player.currentTime() ?? 0;
      // Only jump when the server position is meaningful and we have not
      // already moved past it (protects a user who started before the fetch landed).
      if (now < target - 2) {
        player.currentTime(target);
      }
      seeked = true;
    };

    player.on("loadedmetadata", seekToResume);
    player.on("canplay", seekToResume);
    // The /api/progress fetch can resolve after metadata; keep checking briefly.
    const resumeTimer = setInterval(() => {
      if (player.readyState() >= 1) {
        seekToResume();
        if (seeked) clearInterval(resumeTimer);
      }
    }, 500);

    player.on("playing", () => {
      if (!started) {
        started = true;
        report("start");
      }
    });
    player.on("pause", () => started && !stopped && report("progress"));
    player.on("seeked", () => started && !stopped && report("progress"));
    player.on("ended", () => {
      if (started && !stopped) {
        stopped = true;
        report("stop");
      }
    });

    const heartbeat = setInterval(() => {
      if (started && !stopped && !player.paused()) report("progress");
    }, HEARTBEAT_MS);

    // Leaving the tab is not "stop": the user may come back. Flush the exact
    // second instead, so the other device picks up from here.
    const onHide = () => {
      if (document.visibilityState === "hidden" && started && !stopped) report("progress");
    };
    const onPageHide = () => {
      if (started && !stopped) {
        stopped = true;
        report("stop");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(heartbeat);
      clearInterval(resumeTimer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      onPageHide();
      player.dispose();
    };
  }, [jfUrl, token, itemId, startTicks, poster]);

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full" />
      <p className="pointer-events-none absolute top-[4.5rem] left-5 text-lg font-bold text-white/85 md:top-20 md:left-7">{title}</p>
    </div>
  );
}
