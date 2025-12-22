import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { r2Client } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine file extension and content type
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `backgrounds/default-background.${ext}`;
    
    const contentType = file.type || 
      (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
       ext === 'png' ? 'image/png' :
       ext === 'webp' ? 'image/webp' :
       ext === 'svg' ? 'image/svg+xml' :
       'image/jpeg');

    // Upload to R2 in backgrounds folder (same as other uploads)
    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
      })
    );

    // Use the thumbnail API endpoint to serve the image (this works for all R2 files)
    const publicUrl = `/api/background/default-background`;

    return NextResponse.json({ 
      success: true, 
      filename: `default-background.${ext}`,
      url: publicUrl
    });
  } catch (error) {
    console.error("Error uploading background:", error);
    return NextResponse.json(
      { error: "Failed to upload background" },
      { status: 500 }
    );
  }
}
