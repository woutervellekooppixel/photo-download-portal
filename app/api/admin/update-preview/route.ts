import { NextRequest, NextResponse } from "next/server";
import { getMetadata, saveMetadata } from "@/lib/r2";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  // Check authentication
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("admin-auth");

  if (!authCookie || authCookie.value !== "authenticated") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { slug, previewImageKey } = await req.json();

    console.log('Update preview request:', { slug, previewImageKey });

    // Get existing metadata
    const metadata = await getMetadata(slug);
    if (!metadata) {
      console.error('Metadata not found for slug:', slug);
      return NextResponse.json(
        { error: "Upload not found" },
        { status: 404 }
      );
    }

    console.log('Current metadata:', metadata);

    // Update preview image
    metadata.previewImageKey = previewImageKey;

    // Save updated metadata
    await saveMetadata(metadata);

    console.log('Preview image updated successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update preview error:", error);
    return NextResponse.json(
      { error: "Failed to update preview image", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
