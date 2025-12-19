import { NextRequest, NextResponse } from "next/server";
import { getMetadata, getSignedDownloadUrl } from "@/lib/r2";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const fileKey = searchParams.get("key");

    if (!slug || !fileKey) {
      return NextResponse.json(
        { error: "Slug and key required" },
        { status: 400 }
      );
    }

    const metadata = await getMetadata(slug);

    if (!metadata) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Find the file
    const file = metadata.files.find((f) => f.key === fileKey);
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get presigned URL (valid for 1 hour) - no expiry check for admin
    const url = await getSignedDownloadUrl(fileKey, 3600);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Admin thumbnail error:", error);
    return NextResponse.json(
      { error: "Failed to get thumbnail" },
      { status: 500 }
    );
  }
}
