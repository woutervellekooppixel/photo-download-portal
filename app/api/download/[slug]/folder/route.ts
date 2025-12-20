import { NextRequest, NextResponse } from 'next/server';
import { getMetadata, getFile, updateDownloadCount } from '@/lib/r2';
import archiver from 'archiver';
import { downloadRateLimit } from '@/lib/rateLimit';

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
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('path');

    if (!folderPath) {
      return NextResponse.json(
        { error: 'Folder path is required' },
        { status: 400 }
      );
    }

    // Get metadata
    const metadata = await getMetadata(slug);
    if (!metadata) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date(metadata.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Upload has expired' },
        { status: 410 }
      );
    }

    // Filter files that belong to this folder
    const folderFiles = metadata.files.filter(file => {
      const fileFolderPath = file.name.includes('/') 
        ? file.name.substring(0, file.name.lastIndexOf('/'))
        : '';
      return fileFolderPath === folderPath;
    });

    if (folderFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files found in this folder' },
        { status: 404 }
      );
    }

    // Create archive
    const archive = archiver('zip', {
      zlib: { level: 6 }
    });

    const chunks: Uint8Array[] = [];
    
    archive.on('data', (chunk: Buffer) => {
      chunks.push(new Uint8Array(chunk));
    });

    const archivePromise = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', (err: Error) => reject(err));
    });

    // Add files to archive
    for (const file of folderFiles) {
      try {
        const fileData = await getFile(file.key);
        if (fileData) {
          // Get just the filename without folder path
          const fileName = file.name.split('/').pop() || file.name;
          archive.append(fileData, { name: fileName });
        }
      } catch (error) {
        console.error(`Failed to add file ${file.key}:`, error);
      }
    }

    // Finalize archive
    await archive.finalize();
    await archivePromise;

    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Track download
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    await updateDownloadCount(slug, 'selected', folderFiles.map(f => f.key), ip, userAgent);

    // Sanitize folder name for filename
    const safeFolderName = folderPath.replace(/[^a-zA-Z0-9-_]/g, '-');
    const fileName = `${safeFolderName}.zip`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error('Error creating folder ZIP:', error);
    return NextResponse.json(
      { error: 'Failed to create folder download' },
      { status: 500 }
    );
  }
}
