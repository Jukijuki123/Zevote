"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export type FullscreenState = "active" | "exited" | "unsupported";

/**
 * Custom hook untuk mengelola fullscreen mode.
 * - Meminta fullscreen secara programatik
 * - Mendeteksi jika user keluar dari fullscreen (Esc, F11, dll)
 * - Menyediakan state dan fungsi untuk re-enter fullscreen
 */
export function useFullscreen() {
  const [state, setState] = useState<FullscreenState>("active");
  const [isSupported, setIsSupported] = useState(false);
  const requestRef = useRef(false);

  // Cek dukungan fullscreen API
  useEffect(() => {
    const supported =
      document.fullscreenEnabled ||
      // @ts-expect-error vendor prefix
      document.webkitFullscreenEnabled ||
      // @ts-expect-error vendor prefix
      document.mozFullScreenEnabled;
    setIsSupported(!!supported);
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (requestRef.current) return;
    requestRef.current = true;
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      // @ts-expect-error vendor prefix
      } else if (el.webkitRequestFullscreen) {
        // @ts-expect-error vendor prefix
        await el.webkitRequestFullscreen();
      // @ts-expect-error vendor prefix
      } else if (el.mozRequestFullScreen) {
        // @ts-expect-error vendor prefix
        await el.mozRequestFullScreen();
      }
      setState("active");
    } catch (err) {
      console.warn("Tidak bisa masuk fullscreen:", err);
      setState("unsupported");
    } finally {
      requestRef.current = false;
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Tidak bisa keluar fullscreen:", err);
    }
  }, []);

  // Listener perubahan state fullscreen
  useEffect(() => {
    const handleChange = () => {
      const isFullscreen = !!(
        document.fullscreenElement ||
        // @ts-expect-error vendor prefix
        document.webkitFullscreenElement ||
        // @ts-expect-error vendor prefix
        document.mozFullScreenElement
      );

      if (!isFullscreen) {
        setState("exited");
      } else {
        setState("active");
      }
    };

    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);
    document.addEventListener("mozfullscreenchange", handleChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
      document.removeEventListener("mozfullscreenchange", handleChange);
    };
  }, []);

  // Cegah shortcut keyboard berbahaya saat fullscreen aktif
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Blokir Ctrl+W, Ctrl+T, Ctrl+N (tutup/buka tab baru)
      if (e.ctrlKey && (e.key === "w" || e.key === "t" || e.key === "n" || e.key === "r")) {
        e.preventDefault();
        e.stopPropagation();
      }
      // Blokir F11 agar tidak toggle fullscreen
      if (e.key === "F11") {
        e.preventDefault();
      }
      // Blokir Alt+F4
      if (e.altKey && e.key === "F4") {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  return {
    state,
    isSupported,
    enterFullscreen,
    exitFullscreen,
    isFullscreen: state === "active",
    isExited: state === "exited",
  };
}
