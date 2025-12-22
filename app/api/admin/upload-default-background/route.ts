import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { writeFile } from "fs/promises";
import path from "path";

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

    // Determine file extension
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `default-background.${ext}`;

    // Save to public directory
    const publicPath = path.join(process.cwd(), "public", filename);
    await writeFile(publicPath, buffer);

    return NextResponse.json({ 
      success: true, 
      filename,
      url: `/${filename}`
    });
  } catch (error) {
    console.error("Error uploading background:", error);
    return NextResponse.json(
      { error: "Failed to upload background" },
      { status: 500 }
    );
  }
}
