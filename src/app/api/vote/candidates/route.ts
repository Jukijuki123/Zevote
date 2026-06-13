// API endpoint untuk mengambil daftar kandidat ketua OSIS (akses bilik/siswa)
// GET /api/vote/candidates
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const candidates = await prisma.candidate.findMany({
      orderBy: { nomor_urut: "asc" },
    });

    return NextResponse.json(candidates);
  } catch (error) {
    console.error("GET vote candidates error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server saat mengambil data kandidat." },
      { status: 500 }
    );
  }
}
