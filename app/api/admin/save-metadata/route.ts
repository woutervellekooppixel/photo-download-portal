import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { saveMetadata, type UploadMetadata } from "@/lib/r2";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  try {
    const { slug, title, files, expiryDays, clientEmail, customMessage, ratingsEnabled } = await request.json();

    if (!slug || !files || files.length === 0) {
      return NextResponse.json(
        { error: "Slug and files are required" },
        { status: 400 }
      );
    }

    // Save metadata
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (expiryDays || 7) * 24 * 60 * 60 * 1000);

    const metadata: UploadMetadata = {
      slug,
      ...(title && { title }),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      files: files,
      downloads: 0,
      ...(clientEmail && { clientEmail }),
      ...(customMessage && { customMessage }),
      ...(ratingsEnabled && { ratingsEnabled }),
    };

    await saveMetadata(metadata);

    return NextResponse.json({
      success: true,
      url: `/${slug}`,
    });
  } catch (error) {
    console.error("Error saving metadata:", error);
    return NextResponse.json(
      { error: "Failed to save upload metadata" },
      { status: 500 }
    );
  }
}
