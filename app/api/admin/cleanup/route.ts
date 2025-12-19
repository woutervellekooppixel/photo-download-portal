import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { findOrphanedUploads, deleteFolder } from "@/lib/r2";

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  try {
    const orphaned = await findOrphanedUploads();
    return NextResponse.json({ orphaned });
  } catch (error) {
    console.error("Error finding orphaned uploads:", error);
    return NextResponse.json(
      { error: "Failed to find orphaned uploads" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    console.log('[Cleanup] Received DELETE request for slug:', slug);

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    const folderPath = `uploads/${slug}/`;
    console.log('[Cleanup] Deleting folder:', folderPath);
    
    await deleteFolder(folderPath);
    
    console.log('[Cleanup] Successfully deleted folder:', folderPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Cleanup] Error cleaning up orphaned upload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
