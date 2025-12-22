import { NextRequest, NextResponse } from "next/server";
import { r2Client } from "@/lib/r2";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const params = await context.params;
    const filename = params.filename;
    
    // List files in backgrounds folder to find the exact file
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME!,
      Prefix: "backgrounds/",
    });
    
    const listResponse = await r2Client.send(listCommand);
    const backgroundFile = listResponse.Contents?.find(obj => 
      obj.Key?.includes(filename)
    );
    
    if (!backgroundFile?.Key) {
      return new NextResponse("Background not found", { status: 404 });
    }

    // Get the file from R2
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: backgroundFile.Key,
    });

    const response = await r2Client.send(command);
    const imageBuffer = await response.Body?.transformToByteArray();

    if (!imageBuffer) {
      return new NextResponse("Failed to load background", { status: 500 });
    }

    // Convert to Buffer for NextResponse
    const buffer = Buffer.from(imageBuffer);

    // Determine content type from file extension
    const ext = backgroundFile.Key.split('.').pop()?.toLowerCase();
    const contentType = 
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      ext === 'svg' ? 'image/svg+xml' :
      'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error loading background:", error);
    return new NextResponse("Failed to load background", { status: 500 });
  }
}
