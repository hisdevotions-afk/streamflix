// Shared motion vocabulary (motion-foundations). Components never inline durations or springs.
export const motionTokens = {
  duration: { instant: 0.08, fast: 0.18, normal: 0.35, slow: 0.6, reel: 0.9 },
  easing: {
    // Signature curve: confident arrival, no overshoot.
    smooth: [0.16, 1, 0.3, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
  },
  distance: { xs: 4, sm: 8, md: 16, lg: 24 },
  scale: { press: 0.96, lift: 1.035 },
};

export const springs = {
  snappy: { type: "spring", stiffness: 300, damping: 30 },
  gentle: { type: "spring", stiffness: 160, damping: 20 },
  pop: { type: "spring", stiffness: 500, damping: 12 },
  tilt: { type: "spring", stiffness: 220, damping: 18, mass: 0.6 },
} as const;

// Set once the app has hydrated: from then on, content arriving is new and may animate in.
// The first server paint always stays visible, even if scripts never run.
let hydrated = false;
export function markHydrated() {
  hydrated = true;
}
export const useAfterHydration = () => hydrated;

// How long each highlight stays before the reel advances.
export const REEL_MS = 9000;
