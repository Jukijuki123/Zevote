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

    const search = request.nextUrl.searchParams.get("search") || "";
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (search) {
      where.OR = [
        { nama: { contains: search, mode: "insensitive" } },
        { kelas: { contains: search, mode: "insensitive" } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        orderBy: [{ kelas: "asc" }, { nama: "asc" }],
        skip,
        take: limit,
      }),
      prisma.student.count({ where }),
    ]);

    return NextResponse.json({
      students,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET students error:", error);
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

    const body = await request.json();
    const { nama, kelas } = body;

    if (!nama || typeof nama !== "string" || !kelas || typeof kelas !== "string") {
      return NextResponse.json(
        { message: "Nama dan Kelas wajib diisi." },
        { status: 400 }
      );
    }

    const student = await prisma.student.create({
      data: {
        nama: nama.trim(),
        kelas: kelas.trim(),
      },
    });

    // Logging audit
    await prisma.auditLog.create({
      data: {
        actor: "Admin",
        action: `Menambahkan siswa secara manual: ${nama.trim()} (${kelas.trim()})`,
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error("POST student error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server saat menyimpan data siswa." },
      { status: 500 }
    );
  }
}
