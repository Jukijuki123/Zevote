import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

function isAdmin(request: NextRequest): boolean {
  const token = request.cookies.get("zevote_session")?.value || null;
  return verifyToken(token) === "admin";
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { message: "Tidak ada file yang diunggah." },
        { status: 400 }
      );
    }

    // Validasi tipe file (hanya gambar)
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "File harus berupa gambar (png, jpg, jpeg)." },
        { status: 400 }
      );
    }

    // Batasi ukuran file (misal 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { message: "Ukuran file terlalu besar. Maksimal adalah 5 MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Dapatkan ekstensi file asli
    const originalExt = path.extname(file.name) || ".jpg";
    const uniqueName = `${crypto.randomUUID()}${originalExt}`;

    // Pastikan folder public/uploads ada
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    // Tulis file ke folder lokal public/uploads/
    const filePath = path.join(uploadDir, uniqueName);
    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/${uniqueName}`,
      message: "File berhasil diunggah.",
    });
  } catch (error) {
    console.error("Candidate file upload error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server saat mengunggah berkas." },
      { status: 500 }
    );
  }
}
