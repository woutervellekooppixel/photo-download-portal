import { NextRequest, NextResponse } from "next/server";
import { getMetadata, getSignedDownloadUrl } from "@/lib/r2";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const fileKey = searchParams.get("key");

    if (!fileKey) {
      return NextResponse.json({ error: "File key required" }, { status: 400 });
    }

    const metadata = await getMetadata(slug);

    if (!metadata) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check expiry
    const now = new Date();
    const expiresAt = new Date(metadata.expiresAt);
    if (now > expiresAt) {
      return NextResponse.json({ error: "Expired" }, { status: 410 });
    }

    // Find the file
    const file = metadata.files.find((f) => f.key === fileKey);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get presigned URL (valid for 1 hour)
    const url = await getSignedDownloadUrl(fileKey, 3600);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Thumbnail error:", error);
    return NextResponse.json(
      { error: "Failed to get thumbnail" },
      { status: 500 }
    );
  }
}
