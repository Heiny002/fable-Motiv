"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const AUTO_KEY = "motiv_voice_autospeak";

/**
 * Wraps the browser's built-in SpeechSynthesis (works on iOS Safari — free,
 * no API key). Coach replies can be read aloud on tap, or automatically when
 * auto-speak is on. `speakingId` tracks which message is currently voiced so
 * the UI can show a stop/active state.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const speakingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setSupported(true);
      setAutoSpeak(localStorage.getItem(AUTO_KEY) === "1");
    }
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    speakingIdRef.current = null;
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (text: string, id: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const clean = text.trim();
      if (!clean) return;
      // Tapping the currently-speaking message stops it (toggle).
      window.speechSynthesis.cancel();
      if (speakingIdRef.current === id) {
        speakingIdRef.current = null;
        setSpeakingId(null);
        return;
      }
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = 1.02;
      u.pitch = 1;
      u.onend = () => {
        if (speakingIdRef.current === id) {
          speakingIdRef.current = null;
          setSpeakingId(null);
        }
      };
      u.onerror = () => {
        if (speakingIdRef.current === id) {
          speakingIdRef.current = null;
          setSpeakingId(null);
        }
      };
      speakingIdRef.current = id;
      setSpeakingId(id);
      window.speechSynthesis.speak(u);
    },
    []
  );

  const toggleAutoSpeak = useCallback(() => {
    setAutoSpeak((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(AUTO_KEY, next ? "1" : "0");
        if (!next) window.speechSynthesis?.cancel();
      }
      return next;
    });
  }, []);

  // Stop any speech when the component unmounts / tab closes.
  useEffect(() => cancel, [cancel]);

  return { supported, speak, cancel, speakingId, autoSpeak, toggleAutoSpeak };
}
