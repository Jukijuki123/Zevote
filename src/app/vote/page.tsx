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
  const [timeLeft, setTimeLeft] = useState(120); // 120 detik (2 menit)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [redirectCount, setRedirectCount] = useState(3);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLocalTimeout, setIsLocalTimeout] = useState(false);

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
      if (data.status !== "APPROVED" && data.status !== "TIMED_OUT") {
        router.replace("/");
        return;
      }
      if (data.status === "TIMED_OUT") {
        setIsLocalTimeout(true);
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
    setIsLocalTimeout(true);
    try {
      // Panggil API untuk kunci sesi di DB
      await fetch("/api/vote/timeout", { method: "POST" });
    } catch (err) {
      console.error("Gagal mengirim status timeout", err);
    }
  }, []);

  useEffect(() => {
    if (loading || isSuccess || isLocalTimeout) return;

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
  }, [loading, isSuccess, isLocalTimeout, handleTimeout]);

  // 3b. Polling status untuk mendeteksi reset terpusat oleh panitia
  useEffect(() => {
    if (loading || !student || isSuccess) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/vote/status");
        if (!res.ok) {
          clearInterval(pollInterval);
          await fetch("/api/vote/status", { method: "DELETE" });
          router.replace("/");
          return;
        }
        const data = await res.json();
        if (data.status === "TIMED_OUT") {
          setIsLocalTimeout(true);
        } else if (data.status !== "APPROVED" && data.status !== "TIMED_OUT") {
          clearInterval(pollInterval);
          await fetch("/api/vote/status", { method: "DELETE" });
          router.replace("/");
        }
      } catch {
        // Abaikan error jaringan sementara
      }
    }, 4000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [loading, student, isSuccess, router]);

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

        // Timer hitung mundur sukses redirect (hanya mengurangkan hitungan)
        redirectTimerRef.current = setInterval(() => {
          setRedirectCount((prev) => {
            if (prev <= 1) {
              if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
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

  // 4b. Handler efek samping navigasi setelah sukses voting
  useEffect(() => {
    if (isSuccess && redirectCount === 0) {
      router.replace("/");
    }
  }, [isSuccess, redirectCount, router]);



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
    if (timeLeft > 60) return "bg-emerald-500";
    if (timeLeft > 24) return "bg-amber-500";
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
        <div className="w-full h-2.5 bg-slate-200">
          <div
            className={`h-full transition-all duration-1000 ${getProgressBarColor()}`}
            style={{ width: `${(timeLeft / 120) * 100}%` }}
          />
        </div>

        {/* Header Bilik */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-sm shadow-rose-200">
              Z
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide text-slate-900">Bilik Suara Digital</h1>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Pemilih: <span className="text-rose-600 font-bold">{student.nama}</span> · Kelas: {student.kelas}
              </p>
            </div>
          </div>

          {/* Sisa Waktu */}
          <div className="flex items-center gap-3 self-start md:self-auto bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400 leading-none">Sisa Waktu</p>
              <p className={`text-xl font-bold font-mono tracking-wider ${timeLeft <= 24 ? "text-rose-600 animate-pulse" : "text-slate-800"}`}>
                {formatTime(timeLeft)}
              </p>
            </div>
          </div>
        </header>

        {/* Petunjuk Memilih */}
        <div className="max-w-7xl mx-auto w-full px-6 pt-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-wide text-slate-900">
            PILIH SALAH SATU KANDIDAT KETUA OSIS
          </h2>
          <p className="text-slate-500 font-medium text-sm md:text-base mt-2">
            Klik tombol &quot;PILIH SEKARANG&quot; di bawah foto kandidat pilihanmu untuk memberikan suara
          </p>
        </div>

        {/* Grid Kartu Kandidat */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex items-center justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-5xl justify-center">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col items-center transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-md"
              >
                {/* Nomor Urut */}
                <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center text-lg font-bold rounded-xl mb-4 shadow-sm">
                  {candidate.nomor_urut.toString().padStart(2, "0")}
                </div>

                {/* Foto Kandidat */}
                <div className="w-full aspect-[4/5] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mb-5 relative flex items-center justify-center">
                  {candidate.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={candidate.foto_url}
                      alt={candidate.nama}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50/50 text-rose-300">
                      <span className="text-5xl font-bold">{getInitials(candidate.nama)}</span>
                      <span className="text-xs font-semibold uppercase mt-2 text-rose-400">Tidak ada foto</span>
                    </div>
                  )}
                </div>

                {/* Nama Kandidat */}
                <div className="text-center w-full mb-6">
                  <h3 className="text-xl font-bold text-slate-800 line-clamp-2 min-h-[3.5rem] flex items-center justify-center px-2 uppercase">
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
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-rose-100 cursor-pointer"
                >
                  PILIH SEKARANG
                </button>
              </div>
            ))}
          </div>
        </main>

        {/* Footer Bilik */}
        <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center">
          <p className="text-xs font-semibold text-slate-500">
            Pilihan Anda bersifat Rahasia, Aman, dan Langsung terekam ke sistem database panitia.
          </p>
        </footer>

        {/* ========================
        // DIALOG KONFIRMASI (MODAL)
        // ======================== */}
        {isConfirmOpen && selectedCandidate && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 relative shadow-xl animate-scale-up">
              <h3 className="text-2xl font-bold tracking-wide text-slate-900 mb-4">
                Konfirmasi Pilihan Anda
              </h3>

              {errorMsg && (
                <div className="mb-4 p-3 border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-sm rounded-xl">
                  ⚠ {errorMsg}
                </div>
              )}

              <p className="text-slate-600 font-medium text-sm mb-4">
                Apakah Anda yakin ingin memberikan suara Anda kepada kandidat berikut? Pilihan ini bersifat final dan tidak dapat diubah lagi.
              </p>

              {/* Detail Kandidat Pilihan */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-slate-900 text-white flex items-center justify-center text-lg font-bold rounded-lg shrink-0">
                  {selectedCandidate.nomor_urut.toString().padStart(2, "0")}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kandidat Terpilih</p>
                  <p className="font-bold text-lg text-slate-800 uppercase leading-tight">{selectedCandidate.nama}</p>
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  disabled={isSubmitting}
                  onClick={() => setIsConfirmOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={handleSubmitVote}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all shadow-md shadow-green-100 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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

        {/* ========================
        // LAYAR KUNCI (TIMEOUT OVERLAY)
        // ======================== */}
        {isLocalTimeout && (
          <div className="fixed inset-0 z-50 bg-rose-600 flex items-center justify-center p-6 select-none animate-fade-in">
            <div className="w-full max-w-md bg-white border border-slate-200 p-8 rounded-2xl text-center shadow-xl animate-scale-up">
              <div className="w-20 h-20 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-rose-600 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold tracking-wider text-rose-600 mb-3">Waktu Memilih Habis!</h1>
              <p className="text-slate-700 font-bold mb-6 text-sm uppercase tracking-wide">
                Layar Bilik Suara Anda Telah Dikunci.
              </p>
              <p className="text-slate-600 font-semibold mb-6">
                Sesi Anda telah berakhir. Silakan panggil panitia di meja registrasi untuk mengaktifkan kembali bilik suara Anda.
              </p>
              <div className="inline-block px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs uppercase text-slate-500 tracking-wider">
                Menunggu tindakan panitia...
              </div>
            </div>
          </div>
        )}
      </div>
    </FullscreenGuard>
  );
}
