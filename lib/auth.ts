import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function checkAdminAuth() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("admin-auth");
  return authCookie?.value === "true";
}

export async function requireAdminAuth() {
  const isAuthed = await checkAdminAuth();
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
