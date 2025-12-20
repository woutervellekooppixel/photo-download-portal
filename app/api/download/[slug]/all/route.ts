import { NextRequest, NextResponse } from "next/server";
import { getMetadata, getFile, updateDownloadCount } from "@/lib/r2";
import archiver from "archiver";
import { sendDownloadNotification } from "@/lib/email";
import { downloadRateLimit } from "@/lib/rateLimit";

// Configure route for large downloads
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Rate limiting
  const rateLimitResponse = downloadRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { slug } = await params;
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

    // Update download count immediately (before streaming)
    await updateDownloadCount(slug);

    // Send notification email (async, don't wait)
    sendDownloadNotification(slug, metadata.files.length).catch(console.error);

    // Create zip archive with streaming
    const archive = archiver("zip", { zlib: { level: 6 } }); // Reduced compression for faster processing
    
    // Create a readable stream from the archive
    const stream = new ReadableStream({
      start(controller) {
        archive.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });

        archive.on("end", () => {
          controller.close();
        });

        archive.on("error", (err) => {
          controller.error(err);
        });

        // Start adding files to the archive
        (async () => {
          try {
            for (const file of metadata.files) {
              const buffer = await getFile(file.key);
              archive.append(buffer, { name: file.name });
            }
            await archive.finalize();
          } catch (error) {
            archive.destroy();
            controller.error(error);
          }
        })();
      },
    });

    // Return the streaming zip file
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}.zip"`,
        "Cache-Control": "no-cache",
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
