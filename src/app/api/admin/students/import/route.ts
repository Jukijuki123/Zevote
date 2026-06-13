import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/client/client";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// Tipe transaction client yang aman di Prisma 7
type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

interface RawStudent {
  nama?: string;
  kelas?: string;
}

function isAdmin(request: NextRequest): boolean {
  const token = request.cookies.get("zevote_session")?.value || null;
  return verifyToken(token) === "admin";
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { students, overwrite } = await request.json();

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { message: "Data siswa kosong atau tidak valid!" },
        { status: 400 }
      );
    }

    // Filter data yang tidak memiliki nama atau kelas
    const validStudents = (students as RawStudent[])
      .filter((s): s is { nama: string; kelas: string } => 
        typeof s?.nama === "string" && typeof s?.kelas === "string"
      )
      .map((s) => ({
        nama: s.nama.trim(),
        kelas: s.kelas.trim(),
        hadir: false,
        sudah_memilih: false,
      }));

    if (validStudents.length === 0) {
      return NextResponse.json(
        { message: "Format data siswa tidak valid (wajib ada Nama dan Kelas)!" },
        { status: 400 }
      );
    }

    // Lakukan proses dengan Transaction
    await prisma.$transaction(async (tx: TransactionClient) => {
      if (overwrite) {
        // Hapus semua data yang berhubungan terlebih dahulu
        await tx.vote.deleteMany();
        await tx.loginRequest.deleteMany();
        await tx.student.deleteMany();
      }

      // Masukkan data siswa secara massal (createMany sangat efisien untuk 1490+ baris)
      await tx.student.createMany({
        data: validStudents,
      });

      // Simpan log audit
      await tx.auditLog.create({
        data: {
          actor: "Admin",
          action: `Mengimpor ${validStudents.length} siswa secara massal (${
            overwrite ? "Overwrite" : "Append"
          })`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      count: validStudents.length,
    });
  } catch (error: unknown) {
    console.error("POST students import error:", error);
    const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan server saat mengimpor data.";
    return NextResponse.json(
      { message: errorMessage },
      { status: 500 }
    );
  }
}
