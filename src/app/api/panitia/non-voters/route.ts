import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";

async function checkPanitiaAuth() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("zevote_session")?.value;
  if (!authToken) return false;
  const payload = verifyAdminToken(authToken);
  return !!payload;
}

export async function GET(request: NextRequest) {
  const isAuth = await checkPanitiaAuth();
  if (!isAuth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const kelas = searchParams.get("kelas") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "15", 10);
    const skip = (page - 1) * limit;

    // Filter kondisi: belum memilih
    const whereCondition: any = {
      sudah_memilih: false,
    };

    const andConditions: any[] = [];

    if (search) {
      andConditions.push({
        nama: {
          contains: search,
          mode: "insensitive",
        },
      });
    }

    if (kelas) {
      andConditions.push({
        kelas: {
          contains: kelas,
          mode: "insensitive",
        },
      });
    }

    if (andConditions.length > 0) {
      whereCondition.AND = andConditions;
    }

    // Query data dan total count secara paralel
    const [nonVoters, totalCount] = await prisma.$transaction([
      prisma.student.findMany({
        where: whereCondition,
        orderBy: [{ kelas: "asc" }, { nama: "asc" }],
        skip,
        take: limit,
        select: {
          id: true,
          nama: true,
          kelas: true,
          hadir: true,
          sudah_memilih: true,
        },
      }),
      prisma.student.count({
        where: whereCondition,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      students: nonVoters,
      total: totalCount,
      totalPages,
      page,
      limit,
    });
  } catch (error) {
    console.error("GET non-voters error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
