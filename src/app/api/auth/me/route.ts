import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const tokenCookie = request.cookies.get("zevote_session");
  const token = tokenCookie ? tokenCookie.value : null;
  const role = verifyToken(token);

  if (!role) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, role });
}
