// API endpoint untuk mengambil hasil suara (Quick Count)
// GET /api/vote/results
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// Helper: Cek apakah caller adalah Admin
function isAdmin(request: NextRequest): boolean {
  const token = request.cookies.get("zevote_session")?.value || null;
  return verifyToken(token) === "admin";
}

export async function GET(request: NextRequest) {
  try {
    // 1. Cek status pemilihan di database
    const setting = await prisma.electionSetting.findFirst();
    const status = setting ? setting.election_status : "DRAFT";

    // 2. Batasan Keamanan: Jika pemilu belum ditutup, hanya Admin yang boleh mengakses hasil
    if (status !== "CLOSED") {
      if (!isAdmin(request)) {
        return NextResponse.json(
          { message: "Hasil perhitungan suara dikunci hingga pemungutan suara resmi ditutup oleh panitia." },
          { status: 403 }
        );
      }
    }

    // 3. Ambil data kandidat beserta jumlah perolehan suara masing-masing
    const candidates = await prisma.candidate.findMany({
      include: {
        _count: {
          select: { votes: true },
        },
      },
      orderBy: { nomor_urut: "asc" },
    });

    // 4. Hitung ringkasan statistik
    const totalStudents = await prisma.student.count();
    const totalPresent = await prisma.student.count({ where: { hadir: true } });
    const totalVotes = await prisma.vote.count();
    const totalGolput = totalStudents - totalVotes;

    // Format data kandidat untuk mempermudah konsumsi di frontend
    const resultsData = candidates.map((c) => ({
      id: c.id,
      nomor_urut: c.nomor_urut,
      nama: c.nama,
      foto_url: c.foto_url,
      votes_count: c._count.votes,
      percentage: totalVotes > 0 ? parseFloat(((c._count.votes / totalVotes) * 100).toFixed(1)) : 0,
    }));

    return NextResponse.json({
      status,
      summary: {
        total_siswa: totalStudents,
        total_hadir: totalPresent,
        total_suara_sah: totalVotes,
        total_golput: totalGolput,
        persen_kehadiran: totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0,
        persen_golput: totalStudents > 0 ? Math.round((totalGolput / totalStudents) * 100) : 0,
      },
      results: resultsData,
    });
  } catch (error) {
    console.error("GET results API error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server saat memproses hasil pemilihan." },
      { status: 500 }
    );
  }
}
