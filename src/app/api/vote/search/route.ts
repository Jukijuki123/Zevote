// API endpoint untuk mencari siswa berdasarkan nama (untuk autocomplete)
// GET /api/vote/search?q=namasiswa
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const students = await prisma.student.findMany({
      where: {
        nama: {
          contains: query,
          mode: "insensitive",
        },
        // Hanya tampilkan siswa yang belum memilih
        sudah_memilih: false,
      },
      select: {
        id: true,
        nama: true,
        kelas: true,
        hadir: true,
        sudah_memilih: true,
      },
      take: 10,
      orderBy: { nama: "asc" },
    });

    return NextResponse.json(students);
  } catch (error) {
    console.error("Search students error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
