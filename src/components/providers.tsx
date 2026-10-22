"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
        <TooltipProvider>
          {children}
          <Toaster position="bottom-right" theme="light" mobileOffset={{ bottom: 88 }} />
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
