import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { listAllUploads } from "@/lib/r2";

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  try {
    const uploads = await listAllUploads();
    return NextResponse.json(uploads);
  } catch (error) {
    console.error("Error listing uploads:", error);
    return NextResponse.json(
      { error: "Failed to list uploads" },
      { status: 500 }
    );
  }
}
