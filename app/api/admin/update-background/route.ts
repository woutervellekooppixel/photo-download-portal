import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { getMetadata, saveMetadata } from "@/lib/r2";

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  try {
    const { slug, backgroundImageKey } = await req.json();

    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const metadata = await getMetadata(slug);
    if (!metadata) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    metadata.backgroundImageKey = backgroundImageKey;
    await saveMetadata(metadata);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating background:", error);
    return NextResponse.json(
      { error: "Failed to update background" },
      { status: 500 }
    );
  }
}
