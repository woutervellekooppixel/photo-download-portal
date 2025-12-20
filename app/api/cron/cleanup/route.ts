import { NextRequest, NextResponse } from "next/server";
import { listFiles, getMetadata, deleteFolder } from "@/lib/r2";

// This runs as a cron job (configured in vercel.json)
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const metadataFiles = await listFiles('metadata/');
    
    const deletedSlugs: string[] = [];
    const errors: string[] = [];

    for (const metadataFile of metadataFiles) {
      try {
        // Extract slug from metadata/slug.json
        const slug = metadataFile.replace('metadata/', '').replace('.json', '');
        const metadata = await getMetadata(slug);
        
        if (metadata && new Date(metadata.expiresAt) < now) {
          console.log(`[Cleanup] Deleting expired upload: ${slug}`);
          
          // Delete all files and folders for this upload
          await deleteFolder(`uploads/${slug}/`);
          await deleteFolder(`thumbnails/${slug}/`);
          await deleteFolder(`zips/${slug}.zip`);
          await deleteFolder(`metadata/${slug}.json`);
          
          deletedSlugs.push(slug);
        }
      } catch (error) {
        console.error(`[Cleanup] Error processing ${metadataFile}:`, error);
        errors.push(`${metadataFile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedSlugs,
      count: deletedSlugs.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Cleanup] Cron job failed:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
