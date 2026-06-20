"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import FullscreenGuard from "@/components/FullscreenGuard";

interface StudentResult {
  id: string;
  nama: string;
  kelas: string;
  hadir: boolean;
  sudah_memilih: boolean;
}

type PageState = "login" | "submitting" | "waiting" | "rejected" | "already_voted";

export default function VotingBoothPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("login");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [electionOpen, setElectionOpen] = useState<boolean | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/vote/status");
        if (!res.ok) {
          clearInterval(pollRef.current!);
          return;
        }
        const data = await res.json();

        if (data.status === "APPROVED" || data.status === "TIMED_OUT") {
          clearInterval(pollRef.current!);
          router.push("/vote");
        } else if (data.status === "REJECTED") {
          clearInterval(pollRef.current!);
          setPageState("rejected");
        } else if (data.status === "VOTED") {
          clearInterval(pollRef.current!);
          setPageState("already_voted");
        }
      } catch {
        // Tetap polling
      }
    }, 4000); // Poll setiap 4 detik
  }, [router]);

  // Cek apakah pemilihan sedang OPEN
  useEffect(() => {
    const checkElection = async () => {
      try {
        const res = await fetch("/api/vote/election-status");
        if (res.ok) {
          const data = await res.json();
          setElectionOpen(data.status === "OPEN");
        } else {
          setElectionOpen(false);
        }
      } catch {
        setElectionOpen(false);
      }
    };
    checkElection();
  }, []);

  // Cek apakah sudah ada sesi aktif (dari cookie sebelumnya)
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const res = await fetch("/api/vote/status");
        if (res.ok) {
          const data = await res.json();
          if (data.status === "APPROVED" || data.status === "TIMED_OUT") {
            router.push("/vote");
          } else if (data.status === "PENDING") {
            setPageState("waiting");
            startPolling();
          }
        }
      } catch {
        // Tidak ada sesi aktif, tetap di login
      }
    };
    checkExistingSession();
  }, [startPolling, router]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/vote/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // silently fail autocomplete
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSelectStudent = (student: StudentResult) => {
    setSelectedStudent(student);
    setQuery(student.nama);
    setResults([]);
    setErrorMsg("");
  };

  const handleSubmitRequest = async () => {
    if (!selectedStudent) return;
    setPageState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/vote/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: selectedStudent.id }),
      });

      const data = await res.json();

      if (res.ok) {
        setPageState("waiting");
        startPolling();
      } else {
        setPageState("login");
        setErrorMsg(data.message || "Terjadi kesalahan. Coba lagi.");
      }
    } catch {
      setPageState("login");
      setErrorMsg("Terjadi kesalahan koneksi. Coba lagi.");
    }
  };

  const handleReset = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      await fetch("/api/vote/status", { method: "DELETE" });
    } catch {
      // ignore
    }
    setPageState("login");
    setSelectedStudent(null);
    setQuery("");
    setResults([]);
    setErrorMsg("");
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  // ========================
  // RENDER: Election Closed
  // ========================
  if (electionOpen === false) {
    return (
      <FullscreenGuard enabled={false}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 px-6">
          <div className="text-center">
            <div className="inline-flex w-24 h-24 items-center justify-center rounded-full bg-zinc-800 border-4 border-zinc-600 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-4xl font-black text-white uppercase tracking-widest mb-3">ZEVOTE</h1>
            <p className="text-zinc-400 font-semibold mb-2">Sistem E-Voting OSIS</p>
            <div className="inline-block px-4 py-2 bg-zinc-800 border-2 border-zinc-600 mt-4">
              <p className="text-zinc-300 font-bold text-sm">
                {electionOpen === null ? "Mengecek status pemilihan..." : "Pemilihan belum dibuka atau sudah ditutup."}
              </p>
            </div>
          </div>
        </div>
      </FullscreenGuard>
    );
  }

  if (electionOpen === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ========================
  // RENDER: Main Login Form
  // ========================
  return (
    <FullscreenGuard enabled={true}>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 overflow-hidden">
        {/* Header */}
        <header className="relative border-b border-slate-200 bg-white py-6 px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-sm shadow-rose-200">
              Z
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide text-slate-900">ZEVOTE</h1>
              <p className="text-rose-600 text-[10px] font-bold tracking-wider uppercase">E-VOTING OSIS TPS DIGITAL</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-600 font-bold text-xs uppercase tracking-wider">Pemilihan Aktif</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">

          {/* STATE: Login (search + confirm) */}
          {(pageState === "login" || pageState === "submitting") && (
            <div className="w-full max-w-lg bg-white border border-slate-200 p-8 rounded-2xl shadow-md">
              {/* Title Card */}
              <div className="text-center mb-8">
                <div className="inline-flex p-4 bg-rose-50 rounded-2xl mb-4 border border-rose-100 shadow-sm text-rose-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold tracking-wide text-slate-900 uppercase">Identifikasi Pemilih</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Cari nama kamu untuk memulai proses voting</p>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-semibold text-sm">
                  ⚠ {errorMsg}
                </div>
              )}

              {/* Search Box */}
              <div className="relative mb-6">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Ketik Nama Kamu
                </label>
                <div className="relative">
                  <input
                    ref={searchRef}
                    id="student-search"
                    type="text"
                    value={query}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQuery(val);
                      setSelectedStudent(null);
                      if (val.length < 2) {
                        setResults([]);
                      }
                    }}
                    className="w-full bg-white border border-slate-200 focus:border-rose-500 text-slate-800 placeholder-slate-400 px-5 py-4 text-base font-semibold rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:outline-none transition-all shadow-sm"
                    placeholder="Contoh: Budi Santoso..."
                    autoComplete="off"
                    disabled={pageState === "submitting"}
                    autoFocus
                  />
                  {isSearching && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {results.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto p-1.5">
                    {results.map((student) => (
                      <button
                        key={student.id}
                        onClick={() => handleSelectStudent(student)}
                        className="w-full px-5 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 flex items-center justify-between rounded-lg"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{student.nama}</p>
                          <p className="text-slate-400 text-sm">{student.kelas}</p>
                        </div>
                        {student.sudah_memilih ? (
                          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">VOTED</span>
                        ) : (
                          <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full">BELUM</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {query.length >= 2 && results.length === 0 && !isSearching && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl p-4 text-center text-slate-400 font-medium text-sm shadow-md">
                    Nama tidak ditemukan. Hubungi panitia.
                  </div>
                )}
              </div>

              {/* Selected Student Confirmation Card */}
              {selectedStudent && (
                <div className="mb-6 p-5 bg-emerald-50/50 border border-emerald-200 rounded-xl shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">✓ Siswa Ditemukan</p>
                  <p className="text-slate-800 font-bold text-lg">{selectedStudent.nama}</p>
                  <p className="text-slate-500 font-medium text-sm">{selectedStudent.kelas}</p>
                  {selectedStudent.sudah_memilih && (
                    <p className="text-rose-600 font-bold text-sm mt-2">⚠ Kamu sudah pernah memilih.</p>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmitRequest}
                disabled={!selectedStudent || selectedStudent.sudah_memilih || pageState === "submitting"}
                className={`w-full py-4 font-bold text-base uppercase tracking-widest transition-all rounded-xl shadow-sm ${
                  selectedStudent && !selectedStudent.sudah_memilih
                    ? "bg-rose-600 hover:bg-rose-700 text-white hover:scale-[1.01] active:scale-[0.99] shadow-md shadow-rose-100 cursor-pointer"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                }`}
              >
                {pageState === "submitting" ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Mengirim Permintaan...
                  </span>
                ) : (
                  "Daftar & Minta Persetujuan →"
                )}
              </button>

              <p className="text-center text-slate-400 text-xs mt-4 font-medium">
                Pastikan nama yang dipilih adalah namamu sendiri
              </p>
            </div>
          )}

          {/* STATE: Waiting for Approval */}
          {pageState === "waiting" && (
            <div className="w-full max-w-md bg-white border border-slate-200 p-8 rounded-2xl shadow-md text-center">
              {/* Animated Waiting Visual */}
              <div className="relative w-28 h-28 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                <div className="absolute inset-0 rounded-full border-4 border-t-rose-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                <div className="absolute inset-3 rounded-full border-4 border-t-transparent border-r-rose-400 border-b-transparent border-l-transparent animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-rose-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl font-bold uppercase tracking-wider text-slate-900 mb-2">
                Menunggu Persetujuan
              </h2>
              <p className="text-slate-600 font-medium mb-1 text-sm">
                Permintaanmu sudah diterima oleh sistem.
              </p>
              <p className="text-slate-400 text-xs mb-6">
                Panitia akan memverifikasi dan menyetujui akses votingmu. Jangan tinggalkan halaman ini.
              </p>

              {selectedStudent && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Menunggu untuk:</p>
                  <p className="text-slate-800 font-bold">{selectedStudent.nama}</p>
                  <p className="text-slate-500 text-sm">{selectedStudent.kelas}</p>
                </div>
              )}

              {/* Pulsing dots indicator */}
              <div className="flex justify-center gap-1.5 mb-6">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-rose-600"
                    style={{ animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>

              <button
                onClick={handleReset}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold underline underline-offset-4 transition-colors cursor-pointer"
              >
                Batal & Kembali
              </button>
            </div>
          )}

          {/* STATE: Rejected */}
          {pageState === "rejected" && (
            <div className="w-full max-w-md bg-white border border-slate-200 p-8 rounded-2xl shadow-md text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold uppercase tracking-wider text-rose-600 mb-2">Daftar Ditolak</h2>
              <p className="text-slate-600 font-medium mb-1 text-sm">Permintaanmu ditolak oleh panitia.</p>
              <p className="text-slate-400 text-xs mb-6">Hubungi panitia jika kamu merasa ini adalah kesalahan.</p>
              <button
                onClick={handleReset}
                className="px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase text-xs tracking-wider rounded-xl transition-all shadow-md shadow-rose-100 cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* STATE: Already Voted */}
          {pageState === "already_voted" && (
            <div className="w-full max-w-md bg-white border border-slate-200 p-8 rounded-2xl shadow-md text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold uppercase tracking-wider text-slate-800 mb-2">Sudah Memilih</h2>
              <p className="text-slate-500 font-medium mb-6 text-sm">Hak suaramu sudah digunakan. Terima kasih telah berpartisipasi!</p>
              <button
                onClick={handleReset}
                className="px-8 py-3 bg-black hover:bg-zinc-800 text-white font-bold uppercase text-xs tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
              >
                Kembali
              </button>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 px-8 text-center">
          <p className="text-slate-400 text-xs font-semibold">
            ZEVOTE — Sistem E-Voting OSIS Digital · Aman & Transparan
          </p>
        </footer>
      </div>
    </FullscreenGuard>
  );
}
