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

    // Create zip archive
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Uint8Array[] = [];

    // Collect chunks from the archive
    archive.on("data", (chunk: Buffer) => {
      chunks.push(new Uint8Array(chunk));
    });

    // Wait for archive to finish
    const archivePromise = new Promise<void>((resolve, reject) => {
      archive.on("end", resolve);
      archive.on("error", reject);
    });

    // Add all files to the archive
    for (const file of metadata.files) {
      const buffer = await getFile(file.key);
      archive.append(buffer, { name: file.name });
    }

    // Finalize the archive
    await archive.finalize();
    await archivePromise;

    // Combine all chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    // Update download count
    await updateDownloadCount(slug);

    // Send notification email
    sendDownloadNotification(slug, metadata.files.length).catch(console.error);

    // Return the zip file
    return new NextResponse(combined, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}.zip"`,
        "Content-Length": combined.length.toString(),
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
