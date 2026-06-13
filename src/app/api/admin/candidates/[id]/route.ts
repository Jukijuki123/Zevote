import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function isAdmin(request: NextRequest): boolean {
  const token = request.cookies.get("zevote_session")?.value || null;
  return verifyToken(token) === "admin";
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { nomor_urut, nama, foto_url } = await request.json();

    if (!nomor_urut || !nama) {
      return NextResponse.json(
        { message: "Nomor urut dan Nama wajib diisi!" },
        { status: 400 }
      );
    }

    // Cek apakah nomor urut sudah digunakan oleh kandidat lain
    const existing = await prisma.candidate.findFirst({
      where: {
        nomor_urut: parseInt(nomor_urut, 10),
        NOT: { id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: `Nomor urut ${nomor_urut} sudah digunakan kandidat lain!` },
        { status: 400 }
      );
    }

    const updatedCandidate = await prisma.candidate.update({
      where: { id },
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
        action: `Mengubah data kandidat (ID: ${id}) menjadi ${nama} (No. Urut ${nomor_urut})`,
      },
    });

    return NextResponse.json(updatedCandidate);
  } catch (error) {
    console.error("PUT candidate error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Ambil data untuk logging
    const target = await prisma.candidate.findUnique({
      where: { id },
    });

    if (!target) {
      return NextResponse.json(
        { message: "Kandidat tidak ditemukan!" },
        { status: 404 }
      );
    }

    await prisma.candidate.delete({
      where: { id },
    });

    // Logging audit
    await prisma.auditLog.create({
      data: {
        actor: "Admin",
        action: `Menghapus kandidat ${target.nama} (No. Urut ${target.nomor_urut})`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE candidate error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
