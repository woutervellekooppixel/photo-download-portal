import { NextRequest, NextResponse } from "next/server";
import { getMetadata } from "@/lib/r2";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  
  try {
    const metadata = await getMetadata(slug);
    
    if (!metadata) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Return the raw metadata for debugging
    return NextResponse.json({
      slug: metadata.slug,
      fileCount: metadata.files.length,
      files: metadata.files.map(f => ({
        name: f.name,
        key: f.key,
        size: f.size
      }))
    }, { status: 200 });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
