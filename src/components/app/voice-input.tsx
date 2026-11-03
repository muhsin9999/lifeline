"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Voice typing with the browser's own speech recognition: free, no key, nothing sent to our servers. Chrome and
// Edge support it (Safari partly, Firefox not), so the button only appears where it works. Words land in the box
// as you speak and are never sent on their own: the user reads them and presses Send.

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

const recognitionCtor = () => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const ERRORS: Record<string, string> = {
  "not-allowed": "Allow the microphone in your browser to use voice typing.",
  "service-not-allowed": "Allow the microphone in your browser to use voice typing.",
  "no-speech": "Didn’t catch anything. Tap the mic and try again.",
  "audio-capture": "No microphone found.",
  network: "Voice typing needs a connection. Try again, or type instead.",
};

/** Dictation into a text box. `value` is the box's current text; spoken words are added after it. */
export function useDictation(value: string, onChange: (text: string) => void, maxLength = 1000) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });

  // Checked after mount, so the server render and the first client render agree.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability is only knowable after mount
    setSupported(!!recognitionCtor());
    return () => rec.current?.stop();
  }, []);

  const start = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    const before = latest.current.value.trimEnd();
    r.onresult = (e) => {
      const spoken = Array.from(e.results, (res) => res[0]?.transcript ?? "").join("").trim();
      latest.current.onChange(`${before}${before && spoken ? " " : ""}${spoken}`.slice(0, maxLength));
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") toast.error(ERRORS[e.error] ?? "Voice typing stopped. Try again, or type instead.");
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
    };
    rec.current = r;
    r.start();
    setListening(true);
  };

  const toggle = () => (listening ? rec.current?.stop() : start());
  /** Call before sending, so words still arriving don't refill the cleared box. */
  const stop = () => {
    if (!rec.current) return;
    rec.current.onresult = null;
    rec.current.stop();
  };
  return { supported, listening, toggle, stop };
}

export function VoiceButton({ listening, onToggle, small = false, className }: { listening: boolean; onToggle: () => void; small?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={listening}
      aria-label={listening ? "Stop voice typing" : "Voice typing"}
      title={listening ? "Stop" : "Speak instead of typing"}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-lg transition-colors",
        small ? "size-7" : "size-10",
        listening ? "bg-risk-tint text-risk" : "text-muted-foreground hover:bg-muted",
        className,
      )}
    >
      {listening ? <span aria-hidden className="absolute inset-1 animate-ping rounded-lg bg-risk/15" /> : null}
      {listening ? <Square className={cn("relative fill-current", small ? "size-3" : "size-4")} /> : <Mic className={small ? "size-4" : "size-5"} />}
    </button>
  );
}
