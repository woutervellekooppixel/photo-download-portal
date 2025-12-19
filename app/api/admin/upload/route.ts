import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { uploadFile, saveMetadata, deleteFolder, type UploadMetadata } from "@/lib/r2";

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  let slug: string | null = null;

  try {
    const formData = await request.formData();
    slug = formData.get("slug") as string;
    const expiryDaysStr = formData.get("expiryDays") as string;
    const expiryDays = parseInt(expiryDaysStr) || 7;
    const files = formData.getAll("files") as File[];

    if (!slug || files.length === 0) {
      return NextResponse.json(
        { error: "Slug and files are required" },
        { status: 400 }
      );
    }

    const uploadedFiles: UploadMetadata["files"] = [];

    // Upload each file
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const key = `uploads/${slug}/${file.name}`;
      
      await uploadFile(buffer, key, file.type);
      
      uploadedFiles.push({
        key,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }

    // Save metadata
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    const metadata: UploadMetadata = {
      slug,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      files: uploadedFiles,
      downloads: 0,
    };

    await saveMetadata(metadata);

    return NextResponse.json({ success: true, slug });
  } catch (error) {
    console.error("Upload error:", error);
    
    // Cleanup: delete uploaded files if metadata save failed
    if (slug) {
      try {
        await deleteFolder(`uploads/${slug}/`);
        console.log(`Cleaned up orphaned upload folder: ${slug}`);
      } catch (cleanupError) {
        console.error("Cleanup failed:", cleanupError);
      }
    }
    
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
