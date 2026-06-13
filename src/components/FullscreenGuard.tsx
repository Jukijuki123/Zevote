"use client";

import { useEffect, useRef } from "react";
import { useFullscreen } from "@/hooks/useFullscreen";

interface FullscreenGuardProps {
  /** Apakah guard ini aktif? Set false di halaman admin yang tidak butuh fullscreen */
  enabled?: boolean;
  children: React.ReactNode;
}

/**
 * Komponen pembungkus yang:
 * 1. Meminta fullscreen saat pertama kali dipasang
 * 2. Menampilkan overlay peringatan jika user keluar dari fullscreen
 * 3. Memblokir interaksi UI sampai fullscreen aktif kembali
 */
export default function FullscreenGuard({ enabled = true, children }: FullscreenGuardProps) {
  const { state, isSupported, enterFullscreen } = useFullscreen();
  const hasRequestedRef = useRef(false);

  // Request fullscreen saat pertama mount
  useEffect(() => {
    if (!enabled || !isSupported || hasRequestedRef.current) return;
    hasRequestedRef.current = true;
    // Delay sedikit agar user interaction sudah terjadi (required by browser)
    const timer = setTimeout(() => {
      enterFullscreen();
    }, 500);
    return () => clearTimeout(timer);
  }, [enabled, isSupported, enterFullscreen]);

  const showOverlay = enabled && isSupported && state === "exited";

  return (
    <>
      {children}
      {showOverlay && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm"
          style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
        >
          {/* Animated Warning Icon */}
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full bg-rose-600 border-4 border-white flex items-center justify-center animate-pulse">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-12 h-12 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-full border-4 border-rose-500 animate-ping opacity-40" />
          </div>

          <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-3 text-center">
            ⚠ Fullscreen Keluar!
          </h2>
          <p className="text-rose-300 font-semibold text-center mb-2 max-w-sm">
            Kamu keluar dari mode layar penuh. Sesi votingmu sedang ditangguhkan.
          </p>
          <p className="text-zinc-400 text-sm text-center mb-8 max-w-xs">
            Tindakan ini telah dicatat. Klik tombol di bawah untuk melanjutkan
            dengan masuk kembali ke mode layar penuh.
          </p>

          <button
            onClick={enterFullscreen}
            className="px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-lg uppercase tracking-wider border-4 border-white transition-all hover:scale-105 active:scale-95"
            style={{ boxShadow: "6px 6px 0px 0px rgba(255,255,255,0.3)" }}
          >
            Kembali ke Layar Penuh
          </button>

          <p className="text-zinc-600 text-xs mt-6 text-center">
            Jika terjadi berulang, informasikan kepada panitia
          </p>
        </div>
      )}
    </>
  );
}
