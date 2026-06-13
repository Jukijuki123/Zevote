"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, BarChart3, Users, RefreshCw, Trophy, ArrowLeft } from "lucide-react";

interface CandidateResult {
  id: string;
  nomor_urut: number;
  nama: string;
  foto_url: string;
  votes_count: number;
  percentage: number;
}

interface SummaryStats {
  total_siswa: number;
  total_hadir: number;
  total_suara_sah: number;
  total_golput: number;
  persen_kehadiran: number;
  persen_golput: number;
}

export default function ResultsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [status, setStatus] = useState<string>("OPEN");
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [results, setResults] = useState<CandidateResult[]>([]);

  // Mengambil Data Hasil
  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vote/results");
      if (res.status === 403) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setAuthorized(true);
        setStatus(data.status);
        setSummary(data.summary);
        setResults(data.results);
      }
    } catch (err) {
      console.error("Gagal memuat hasil quick count", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Cari Kandidat dengan Suara Terbanyak (Pemenang Sementara)
  const getWinnerId = () => {
    if (results.length === 0) return null;
    // Cek jika seluruh suara masih 0
    const allZero = results.every((r) => r.votes_count === 0);
    if (allZero) return null;

    let maxVotes = -1;
    let winnerId: string | null = null;
    let isTie = false;

    for (const r of results) {
      if (r.votes_count > maxVotes) {
        maxVotes = r.votes_count;
        winnerId = r.id;
        isTie = false;
      } else if (r.votes_count === maxVotes) {
        isTie = true;
      }
    }

    // Jika terjadi seri, tidak menampilkan lencana pemenang tunggal
    return isTie ? null : winnerId;
  };

  const winnerId = getWinnerId();

  // Inisial nama jika foto kosong
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold">Memuat hasil perhitungan suara...</p>
        </div>
      </div>
    );
  }

  // ========================
  // RENDER: LAYAR TERKUNCI (PEMILU MASIH OPEN/DRAFT)
  // ========================
  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6">
        <div className="w-full max-w-md bg-white border-4 border-black p-8 text-center" style={{ boxShadow: "8px 8px 0px 0px #000" }}>
          <div className="w-20 h-20 bg-rose-100 border-3 border-black flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-rose-600" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-black mb-3">Quick Count Terkunci</h1>
          <p className="text-slate-600 font-semibold mb-6">
            Hasil perhitungan suara (Quick Count) saat ini disegel demi menjaga kerahasiaan dan integritas pemilihan.
          </p>
          <p className="text-xs text-slate-400 font-bold uppercase mb-8">
            Hasil akan dibuka otomatis setelah pemungutan suara resmi ditutup oleh panitia.
          </p>
          <button
            onClick={() => router.replace("/")}
            className="w-full py-4 bg-black hover:bg-zinc-800 text-white font-black uppercase tracking-widest border-3 border-black transition-colors flex items-center justify-center gap-2"
            style={{ boxShadow: "4px 4px 0px 0px #e11d48" }}
          >
            <ArrowLeft className="w-5 h-5" />
            Kembali ke Booth
          </button>
        </div>
      </div>
    );
  }

  // ========================
  // RENDER: HASIL QUICK COUNT
  // ========================
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Header Halaman */}
      <header className="bg-white border-b-4 border-black px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-black border-2 border-white text-white flex items-center justify-center font-black text-lg">
            Q
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-black">Hasil Pemilihan (Quick Count)</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Status Pemilihan: <span className="text-rose-600 font-black">{status}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-3 self-start sm:self-auto">
          <button
            onClick={fetchResults}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-black font-bold border-2 border-black tracking-wider uppercase text-xs transition-colors"
            style={{ boxShadow: "2px 2px 0px 0px #000" }}
          >
            <RefreshCw className="w-4 h-4" />
            Segarkan
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-black hover:bg-zinc-800 text-white font-bold border-2 border-black tracking-wider uppercase text-xs transition-colors"
            style={{ boxShadow: "2px 2px 0px 0px #e11d48" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </button>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-8">
        
        {/* Metrik Statistik Utama */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border-3 border-black p-4" style={{ boxShadow: "4px 4px 0px 0px #000" }}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Suara Sah</p>
              <p className="text-2xl font-black text-black leading-none">{summary.total_suara_sah}</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Hak Suara Terpakai</p>
            </div>

            <div className="bg-white border-3 border-black p-4" style={{ boxShadow: "4px 4px 0px 0px #000" }}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Daftar Pemilih (DPT)</p>
              <p className="text-2xl font-black text-black leading-none">{summary.total_siswa}</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Siswa Terdaftar</p>
            </div>

            <div className="bg-white border-3 border-black p-4" style={{ boxShadow: "4px 4px 0px 0px #000" }}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Tingkat Kehadiran</p>
              <p className="text-2xl font-black text-emerald-600 leading-none">{summary.persen_kehadiran}%</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Siswa Hadir di TPS</p>
            </div>

            <div className="bg-white border-3 border-black p-4" style={{ boxShadow: "4px 4px 0px 0px #000" }}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Tidak Memilih (Golput)</p>
              <p className="text-2xl font-black text-rose-600 leading-none">{summary.total_golput}</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Persentase: **{summary.persen_golput}%**</p>
            </div>
          </div>
        )}

        {/* Layout Visual Perolehan Suara */}
        <div className="bg-white border-4 border-black p-6" style={{ boxShadow: "6px 6px 0px 0px #000" }}>
          <h2 className="text-xl font-black uppercase text-black border-b-2 border-black pb-4 mb-8">
            Rekapitulasi Perolehan Suara Kandidat
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto justify-center">
            {results.map((candidate) => {
              const isWinner = candidate.id === winnerId;
              return (
                <div
                  key={candidate.id}
                  className={`bg-white border-4 border-black p-6 flex flex-col items-center relative transition-transform duration-300 ${
                    isWinner ? "ring-4 ring-yellow-400 -translate-y-2" : ""
                  }`}
                  style={{ boxShadow: "8px 8px 0px 0px #000" }}
                >
                  {/* Badge Pemenang Terbanyak */}
                  {isWinner && (
                    <div className="absolute -top-5 bg-yellow-400 border-2 border-black px-4 py-1 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-black" style={{ boxShadow: "2px 2px 0px 0px #000" }}>
                      <Trophy className="w-3.5 h-3.5" />
                      Suara Terbanyak
                    </div>
                  )}

                  {/* Nomor Urut */}
                  <div className="w-12 h-12 bg-black border-2 border-white text-white flex items-center justify-center text-xl font-black mb-4">
                    {candidate.nomor_urut.toString().padStart(2, "0")}
                  </div>

                  {/* Foto Kandidat */}
                  <div className="w-36 h-44 bg-slate-100 border-3 border-black mb-4 overflow-hidden relative flex items-center justify-center">
                    {candidate.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={candidate.foto_url}
                        alt={candidate.nama}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 text-rose-300">
                        <span className="text-3xl font-black">{getInitials(candidate.nama)}</span>
                      </div>
                    )}
                  </div>

                  {/* Info Kandidat */}
                  <div className="text-center w-full mb-4">
                    <h3 className="font-black text-black uppercase tracking-wide truncate">{candidate.nama}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Kandidat Ketua OSIS</p>
                  </div>

                  {/* Visual Grafik Perolehan Suara */}
                  <div className="w-full border-t-2 border-black pt-4 text-center">
                    <p className="text-4xl font-black text-black leading-none">{candidate.percentage}%</p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                      {candidate.votes_count} Suara
                    </p>

                    {/* Progress Bar Persentase */}
                    <div className="w-full h-3 bg-slate-100 border border-black overflow-hidden mt-3">
                      <div
                        className={`h-full transition-all duration-1000 ${isWinner ? "bg-emerald-600" : "bg-black"}`}
                        style={{ width: `${candidate.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* Footer Halaman */}
      <footer className="border-t-2 border-slate-200 py-4 px-6 text-center bg-white mt-8">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          ZEVOTE © 2026 · Hasil Rekapitulasi Suara Mandiri & Transparan
        </p>
      </footer>
    </div>
  );
}
