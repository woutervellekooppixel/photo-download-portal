import { NextRequest, NextResponse } from "next/server";
import { getMetadata, saveMetadata } from "@/lib/r2";
import { requireAdminAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Check authentication
  const authError = await requireAdminAuth();
  if (authError) return authError;

  try {
    const { slug, previewImageKey } = await req.json();

    // Get existing metadata
    const metadata = await getMetadata(slug);
    if (!metadata) {
      return NextResponse.json(
        { error: "Upload not found" },
        { status: 404 }
      );
    }

    // Update preview image
    metadata.previewImageKey = previewImageKey;

    // Save updated metadata
    await saveMetadata(metadata);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update preview error:", error);
    return NextResponse.json(
      { error: "Failed to update preview image" },
      { status: 500 }
    );
  }
}
