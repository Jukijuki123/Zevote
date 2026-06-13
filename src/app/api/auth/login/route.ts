import { NextRequest, NextResponse } from "next/server";
import { signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    const adminPassword = process.env.ADMIN_PASSWORD || "admin_26";
    const panitiaPassword = process.env.PANITIA_PASSWORD || "mpksmkn26";

    let role: "admin" | "panitia" | null = null;

    if (password === adminPassword) {
      role = "admin";
    } else if (password === panitiaPassword) {
      role = "panitia";
    }

    if (!role) {
      return NextResponse.json(
        { message: "Password salah!" },
        { status: 401 }
      );
    }

    const token = signToken(role);
    const response = NextResponse.json({ success: true, role });

    // Set HTTP-only cookie
    response.cookies.set("zevote_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 12 * 60 * 60, // 12 jam
    });

    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
