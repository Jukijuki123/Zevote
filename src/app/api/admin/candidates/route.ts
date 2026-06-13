import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function isAdmin(request: NextRequest): boolean {
  const token = request.cookies.get("zevote_session")?.value || null;
  return verifyToken(token) === "admin";
}

export async function GET(request: NextRequest) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const candidates = await prisma.candidate.findMany({
      orderBy: { nomor_urut: "asc" },
    });

    return NextResponse.json(candidates);
  } catch (error) {
    console.error("GET candidates error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { nomor_urut, nama, foto_url } = await request.json();

    if (!nomor_urut || !nama) {
      return NextResponse.json(
        { message: "Nomor urut dan Nama wajib diisi!" },
        { status: 400 }
      );
    }

    // Cek apakah nomor urut sudah ada
    const existing = await prisma.candidate.findUnique({
      where: { nomor_urut: parseInt(nomor_urut, 10) },
    });

    if (existing) {
      return NextResponse.json(
        { message: `Kandidat nomor urut ${nomor_urut} sudah ada!` },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.create({
      data: {
        nomor_urut: parseInt(nomor_urut, 10),
        nama,
        foto_url: foto_url || "",
      },
    });

    // Logging audit
    await prisma.auditLog.create({
      data: {
        actor: "Admin",
        action: `Menambahkan kandidat ${nama} (No. Urut ${nomor_urut})`,
      },
    });

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error("POST candidate error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
