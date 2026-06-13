"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import FullscreenGuard from "@/components/FullscreenGuard";

interface Candidate {
  id: string;
  nomor_urut: number;
  nama: string;
  foto_url: string;
}

interface StudentSession {
  id: string;
  nama: string;
  kelas: string;
}

export default function VotePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentSession | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [timeLeft, setTimeLeft] = useState(180); // 180 detik (3 menit)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [redirectCount, setRedirectCount] = useState(3);
  const [errorMsg, setErrorMsg] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Verifikasi Akses dan Sesi Siswa
  const verifyAccess = useCallback(async () => {
    try {
      const res = await fetch("/api/vote/status");
      if (!res.ok) {
        router.replace("/");
        return;
      }
      const data = await res.json();
      if (data.status !== "APPROVED") {
        router.replace("/");
        return;
      }
      setStudent(data.student);
    } catch {
      router.replace("/");
    }
  }, [router]);

  // 2. Ambil Daftar Kandidat
  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch("/api/vote/candidates");
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
      }
    } catch (err) {
      console.error("Gagal mengambil data kandidat", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await verifyAccess();
      await fetchCandidates();
    };
    init();
  }, [verifyAccess, fetchCandidates]);

  // 3. Kelola Timer 180 Detik
  const handleTimeout = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      // Panggil API untuk hapus sesi
      await fetch("/api/vote/status", { method: "DELETE" });
    } catch {
      // abaikan error pembersihan
    }
    router.replace("/");
  }, [router]);

  useEffect(() => {
    if (loading || isSuccess) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, isSuccess, handleTimeout]);

  // 4. Submit Pilihan Kandidat
  const handleSubmitVote = async () => {
    if (!selectedCandidate) return;
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/vote/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: selectedCandidate.id }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsConfirmOpen(false);
        setIsSuccess(true);

        // Timer hitung mundur sukses redirect
        redirectTimerRef.current = setInterval(() => {
          setRedirectCount((prev) => {
            if (prev <= 1) {
              clearInterval(redirectTimerRef.current!);
              router.replace("/");
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setErrorMsg(data.message || "Gagal merekam suara Anda.");
      }
    } catch {
      setErrorMsg("Terjadi kesalahan koneksi saat mengirim suara.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelVote = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await fetch("/api/vote/status", { method: "DELETE" });
    } catch {
      // ignore
    }
    router.replace("/");
  };

  // 5. Hitung Format Waktu MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Ambil inisial nama jika foto tidak ada
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Warna Progress Bar berdasarkan Sisa Waktu
  const getProgressBarColor = () => {
    if (timeLeft > 90) return "bg-emerald-500";
    if (timeLeft > 36) return "bg-amber-500";
    return "bg-rose-600 animate-pulse";
  };

  if (loading || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold">Mengecek sesi dan memuat bilik suara...</p>
        </div>
      </div>
    );
  }

  // ========================
  // RENDER: LAYAR SUKSES
  // ========================
  if (isSuccess) {
    return (
      <FullscreenGuard enabled={true}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6">
          <div className="w-full max-w-md bg-white border-4 border-black p-8 text-center" style={{ boxShadow: "8px 8px 0px 0px #000" }}>
            <div className="w-20 h-20 bg-green-100 border-3 border-black flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-wider text-black mb-3">Suara Direkam!</h1>
            <p className="text-slate-600 font-semibold mb-6">
              Terima kasih, **{student.nama}**. Hak suara Anda telah berhasil dicatat oleh sistem secara aman.
            </p>
            <div className="inline-block px-4 py-2 bg-slate-100 border-2 border-black font-bold text-sm">
              Mengarahkan kembali dalam {redirectCount} detik...
            </div>
          </div>
        </div>
      </FullscreenGuard>
    );
  }

  // ========================
  // RENDER: UTAMA (LIGHT MODE)
  // ========================
  return (
    <FullscreenGuard enabled={true}>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
        {/* Progress Bar Hitung Mundur */}
        <div className="w-full h-3 bg-slate-200 border-b border-black">
          <div
            className={`h-full transition-all duration-1000 ${getProgressBarColor()}`}
            style={{ width: `${(timeLeft / 180) * 100}%` }}
          />
        </div>

        {/* Header Bilik */}
        <header className="bg-white border-b-4 border-black px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-600 border-2 border-black flex items-center justify-center font-black text-white text-lg">
              Z
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-wider text-black">Bilik Suara Digital</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                Pemilih: <span className="text-rose-600">{student.nama}</span> · Kelas: {student.kelas}
              </p>
            </div>
          </div>

          {/* Sisa Waktu */}
          <div className="flex items-center gap-3 self-start md:self-auto bg-slate-100 border-2 border-black px-4 py-2" style={{ boxShadow: "3px 3px 0px 0px #000" }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 leading-none">Sisa Waktu</p>
              <p className={`text-xl font-black font-mono tracking-wider ${timeLeft <= 36 ? "text-rose-600 animate-pulse" : "text-black"}`}>
                {formatTime(timeLeft)}
              </p>
            </div>
          </div>
        </header>

        {/* Petunjuk Memilih */}
        <div className="max-w-7xl mx-auto w-full px-6 pt-8 text-center">
          <h2 className="text-2xl md:text-3xl font-black uppercase text-black tracking-wide">
            PILIH SALAH SATU KANDIDAT KETUA OSIS
          </h2>
          <p className="text-slate-500 font-medium text-sm md:text-base mt-2">
            Klik tombol "PILIH" di bawah foto kandidat pilihanmu untuk memberikan suara
          </p>
        </div>

        {/* Grid Kartu Kandidat */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex items-center justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-5xl justify-center">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="bg-white border-4 border-black p-5 flex flex-col items-center transition-all duration-300 hover:-translate-y-2"
                style={{ boxShadow: "8px 8px 0px 0px #000" }}
              >
                {/* Nomor Urut */}
                <div className="w-14 h-14 bg-black border-2 border-white text-white flex items-center justify-center text-2xl font-black mb-4">
                  {candidate.nomor_urut.toString().padStart(2, "0")}
                </div>

                {/* Foto Kandidat */}
                <div className="w-full aspect-[4/5] bg-slate-100 border-3 border-black mb-5 overflow-hidden relative flex items-center justify-center">
                  {candidate.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={candidate.foto_url}
                      alt={candidate.nama}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 text-rose-300">
                      <span className="text-5xl font-black">{getInitials(candidate.nama)}</span>
                      <span className="text-xs font-bold uppercase mt-2 text-rose-400">Tidak ada foto</span>
                    </div>
                  )}
                </div>

                {/* Nama Kandidat */}
                <div className="text-center w-full mb-6">
                  <h3 className="text-xl font-black uppercase text-black line-clamp-2 min-h-[3.5rem] flex items-center justify-center px-2">
                    {candidate.nama}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">KANDIDAT KETUA OSIS</p>
                </div>

                {/* Tombol Pilih */}
                <button
                  onClick={() => {
                    setSelectedCandidate(candidate);
                    setIsConfirmOpen(true);
                  }}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest border-3 border-black transition-colors"
                  style={{ boxShadow: "4px 4px 0px 0px #000" }}
                >
                  PILIH SEKARANG
                </button>
              </div>
            ))}
          </div>
        </main>

        {/* Footer Bilik */}
        <footer className="bg-white border-t-4 border-black py-4 px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs font-semibold text-slate-500 text-center sm:text-left">
            Pilihan Anda bersifat Rahasia, Aman, dan Langsung terekam ke sistem database panitia.
          </p>
          <button
            onClick={handleCancelVote}
            className="text-xs font-bold uppercase tracking-wider text-rose-600 hover:text-rose-800 underline underline-offset-4 self-center sm:self-auto"
          >
            Batal & Keluar Bilik
          </button>
        </footer>

        {/* ========================
        // DIALOG KONFIRMASI (MODAL)
        // ======================== */}
        {isConfirmOpen && selectedCandidate && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="bg-white border-4 border-black w-full max-w-md p-6 relative"
              style={{ boxShadow: "8px 8px 0px 0px #000" }}
            >
              <h3 className="text-2xl font-black uppercase tracking-wide text-black mb-4">
                Konfirmasi Pilihan Anda
              </h3>

              {errorMsg && (
                <div className="mb-4 p-3 border-2 border-black bg-rose-50 text-rose-700 font-bold text-sm">
                  ⚠ {errorMsg}
                </div>
              )}

              <p className="text-slate-600 font-medium text-sm mb-4">
                Apakah Anda yakin ingin memberikan suara Anda kepada kandidat berikut? Pilihan ini bersifat final dan tidak dapat diubah lagi.
              </p>

              {/* Detail Kandidat Pilihan */}
              <div className="border-3 border-black p-4 bg-slate-50 flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-black text-white flex items-center justify-center text-xl font-black shrink-0">
                  {selectedCandidate.nomor_urut.toString().padStart(2, "0")}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kandidat Terpilih</p>
                  <p className="font-black text-lg text-black uppercase leading-tight">{selectedCandidate.nama}</p>
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  disabled={isSubmitting}
                  onClick={() => setIsConfirmOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-black border-2 border-black font-black uppercase text-sm tracking-wider transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={handleSubmitVote}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white border-2 border-black font-black uppercase text-sm tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    "YA, YAKIN"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FullscreenGuard>
  );
}
