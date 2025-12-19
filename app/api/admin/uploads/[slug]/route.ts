import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { deleteUpload } from "@/lib/r2";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  try {
    const { slug } = await params;
    await deleteUpload(slug);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting upload:", error);
    return NextResponse.json(
      { error: "Failed to delete upload" },
      { status: 500 }
    );
  }
}
