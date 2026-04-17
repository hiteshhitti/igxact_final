"use client";

import { motion, AnimatePresence } from "framer-motion";

const variants = {
  initial:  { opacity: 0, y: 18, filter: "blur(4px)" },
  animate:  { opacity: 1, y: 0,  filter: "blur(0px)" },
  exit:     { opacity: 0, y: -10, filter: "blur(2px)" },
};

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          duration: 0.38,
          ease: [0.4, 0, 0.2, 1],
        }}
        className="min-h-screen"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
