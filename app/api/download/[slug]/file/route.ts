import { NextRequest, NextResponse } from "next/server";
import { getMetadata, getFile, updateDownloadCount } from "@/lib/r2";
import { sendDownloadNotification } from "@/lib/email";
import { downloadRateLimit } from "@/lib/rateLimit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Rate limiting
  const rateLimitResponse = downloadRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

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

    // Get file from R2
    const buffer = await getFile(fileKey);

    // Update download count with tracking
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    await updateDownloadCount(slug, 'single', [fileKey], ip, userAgent);

    // Send notification email
    sendDownloadNotification(slug, 1).catch(console.error);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.type,
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Download failed" },
      { status: 500 }
    );
  }
}
