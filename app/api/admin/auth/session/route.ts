import { NextRequest, NextResponse } from "next/server";
import { getAdminUserFromRequest } from "@/lib/server/admin-auth";

export async function GET(request: NextRequest) {
  const user = getAdminUserFromRequest(request);
  if (!user) return NextResponse.json({ admin: null }, { status: 401 });
  return NextResponse.json({ admin: { login: user.login, role: user.role } });
}
