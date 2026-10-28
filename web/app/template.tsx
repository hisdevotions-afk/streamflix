"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { markHydrated, motionTokens, useAfterHydration } from "@/lib/motion";

export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const animate = useAfterHydration();
  useEffect(markHydrated, []);
  return (
    <motion.div
      initial={animate ? { opacity: 0, filter: reduce ? "none" : "blur(8px)" } : false}
      animate={{ opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth }}
    >
      {children}
    </motion.div>
  );
}
