import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import archiver from "archiver";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export interface UploadMetadata {
  slug: string;
  title?: string; // Optional: friendly title for the upload
  createdAt: string;
  expiresAt: string;
  files: {
    key: string;
    name: string;
    size: number;
    type: string;
  }[];
  downloads: number;
  downloadHistory?: {
    timestamp: string;
    type: 'all' | 'single' | 'selected';
    files?: string[]; // File keys that were downloaded
    ip?: string;
    userAgent?: string;
  }[];
  previewImageKey?: string; // Optional: key of the image to show on loading screen
  backgroundImageKey?: string; // Optional: key of the image to use as background
  clientEmail?: string; // Optional: client email for sending notifications
  customMessage?: string; // Optional: custom message to include in email
  ratings?: Record<string, boolean>; // Optional: client ratings for photos (fileKey -> rated)
  ratingsEnabled?: boolean; // Optional: allow clients to rate photos
}

export interface MonthlyStats {
  month: string; // Format: "2025-12"
  operations: {
    listFiles: number;
    getFile: number;
    putFile: number;
    deleteFile: number;
  };
  bandwidth: number; // bytes downloaded
  storage: number; // average bytes stored
}

export async function uploadFile(
  file: Buffer,
  key: string,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await r2Client.send(command);
}

export async function getFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await r2Client.send(command);
  const bytes = await response.Body?.transformToByteArray();
  return Buffer.from(bytes || []);
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

export async function listFiles(prefix: string): Promise<string[]> {
  const allFiles: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await r2Client.send(command);
    const files = response.Contents?.map((item) => item.Key!) || [];
    allFiles.push(...files);
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return allFiles;
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await r2Client.send(command);
  console.log('[R2] Delete response for', key, ':', response.$metadata.httpStatusCode);
  
  if (response.$metadata.httpStatusCode !== 204 && response.$metadata.httpStatusCode !== 200) {
    throw new Error(`Failed to delete ${key}: HTTP ${response.$metadata.httpStatusCode}`);
  }
}

export async function saveMetadata(metadata: UploadMetadata): Promise<void> {
  const key = `metadata/${metadata.slug}.json`;
  await uploadFile(
    Buffer.from(JSON.stringify(metadata, null, 2)),
    key,
    "application/json"
  );
}

export async function getMetadata(slug: string): Promise<UploadMetadata | null> {
  try {
    const key = `metadata/${slug}.json`;
    const buffer = await getFile(key);
    return JSON.parse(buffer.toString("utf-8"));
  } catch (error) {
    return null;
  }
}

export async function createZipFile(slug: string): Promise<void> {
  console.log(`[R2] Creating pre-made zip for ${slug}`);
  const metadata = await getMetadata(slug);
  if (!metadata) {
    throw new Error(`Metadata not found for ${slug}`);
  }

  const archive = archiver("zip", { zlib: { level: 6 } });
  const chunks: Buffer[] = [];

  // Collect chunks from the archive
  archive.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
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

  // Combine all chunks and upload
  const zipBuffer = Buffer.concat(chunks);
  const zipKey = `zips/${slug}.zip`;
  await uploadFile(zipBuffer, zipKey, "application/zip");
  
  console.log(`[R2] Pre-made zip created: ${zipKey} (${zipBuffer.length} bytes)`);
}

export async function getZipFile(slug: string): Promise<Buffer | null> {
  try {
    const zipKey = `zips/${slug}.zip`;
    return await getFile(zipKey);
  } catch (error) {
    return null;
  }
}

export async function updateDownloadCount(
  slug: string,
  type: 'all' | 'single' | 'selected' = 'all',
  files?: string[],
  ip?: string,
  userAgent?: string
): Promise<void> {
  const metadata = await getMetadata(slug);
  if (metadata) {
    metadata.downloads = (metadata.downloads || 0) + 1;
    
    // Add to download history
    if (!metadata.downloadHistory) {
      metadata.downloadHistory = [];
    }
    metadata.downloadHistory.push({
      timestamp: new Date().toISOString(),
      type,
      ...(files && { files }),
      ...(ip && { ip }),
      ...(userAgent && { userAgent }),
    });
    await saveMetadata(metadata);
  }
}

export async function listAllUploads(): Promise<UploadMetadata[]> {
  const metadataKeys = await listFiles("metadata/");
  const uploads: UploadMetadata[] = [];

  for (const key of metadataKeys) {
    if (key.endsWith(".json")) {
      const buffer = await getFile(key);
      const metadata = JSON.parse(buffer.toString("utf-8"));
      uploads.push(metadata);
    }
  }

  return uploads.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function deleteUpload(slug: string): Promise<void> {
  const metadata = await getMetadata(slug);
  if (!metadata) return;

  // Delete all files
  for (const file of metadata.files) {
    await deleteFile(file.key);
  }

  // Delete metadata
  await deleteFile(`metadata/${slug}.json`);
}

export async function deleteFolder(prefix: string): Promise<void> {
  console.log('[R2] Listing files in folder:', prefix);
  const files = await listFiles(prefix);
  console.log('[R2] Found', files.length, 'files to delete:', files);
  
  if (files.length === 0) {
    console.log('[R2] No files found with prefix:', prefix);
    // Try without trailing slash
    const prefixWithoutSlash = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    console.log('[R2] Trying without trailing slash:', prefixWithoutSlash);
    const filesAlt = await listFiles(prefixWithoutSlash);
    console.log('[R2] Found', filesAlt.length, 'files:', filesAlt);
    
    if (filesAlt.length === 0) {
      console.log('[R2] Still no files found. Folder may already be empty or not exist.');
      return;
    }
  }
  
  for (const key of files) {
    console.log('[R2] Deleting file:', key);
    await deleteFile(key);
  }
  
  // Verify deletion
  console.log('[R2] Verifying deletion...');
  const remainingFiles = await listFiles(prefix);
  console.log('[R2] Files remaining after deletion:', remainingFiles.length);
  
  if (remainingFiles.length > 0) {
    console.error('[R2] WARNING: Some files were not deleted:', remainingFiles);
    throw new Error(`Failed to delete all files. ${remainingFiles.length} files remaining.`);
  }
  
  console.log('[R2] Successfully deleted all files in folder:', prefix);
}

export async function findOrphanedUploads(): Promise<string[]> {
  // Get all upload folders
  const allFiles = await listFiles("uploads/");
  const uploadFolders = new Set<string>();
  
  for (const key of allFiles) {
    const parts = key.split('/');
    if (parts.length >= 2) {
      uploadFolders.add(parts[1]); // slug is the second part after "uploads/"
    }
  }

  // Get all metadata slugs
  const metadataKeys = await listFiles("metadata/");
  const metadataSlugs = new Set<string>();
  
  for (const key of metadataKeys) {
    if (key.endsWith(".json")) {
      const slug = key.replace("metadata/", "").replace(".json", "");
      metadataSlugs.add(slug);
    }
  }

  // Find folders without metadata
  const orphaned: string[] = [];
  for (const folder of uploadFolders) {
    if (!metadataSlugs.has(folder)) {
      orphaned.push(folder);
    }
  }

  return orphaned;
}

// Monthly stats tracking
export async function getMonthlyStats(): Promise<MonthlyStats> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  try {
    const key = `stats/${currentMonth}.json`;
    const buffer = await getFile(key);
    return JSON.parse(buffer.toString('utf-8'));
  } catch (error) {
    // Return default stats if not found
    return {
      month: currentMonth,
      operations: {
        listFiles: 0,
        getFile: 0,
        putFile: 0,
        deleteFile: 0,
      },
      bandwidth: 0,
      storage: 0,
    };
  }
}

export async function saveMonthlyStats(stats: MonthlyStats): Promise<void> {
  const key = `stats/${stats.month}.json`;
  await uploadFile(
    Buffer.from(JSON.stringify(stats, null, 2)),
    key,
    'application/json'
  );
}

export async function trackOperation(operation: keyof MonthlyStats['operations'], count: number = 1): Promise<void> {
  const stats = await getMonthlyStats();
  stats.operations[operation] += count;
  await saveMonthlyStats(stats);
}

export async function trackBandwidth(bytes: number): Promise<void> {
  const stats = await getMonthlyStats();
  stats.bandwidth += bytes;
  await saveMonthlyStats(stats);
}

export async function calculateMonthlyCost(): Promise<{
  storage: number;
  operations: number;
  bandwidth: number;
  total: number;
}> {
  const stats = await getMonthlyStats();
  const uploads = await listAllUploads();
  
  // Calculate current storage
  const totalStorage = uploads.reduce((acc, u) => 
    acc + u.files.reduce((sum, f) => sum + f.size, 0), 0
  );
  
  // R2 Pricing (per maand)
  const storageGB = totalStorage / (1024 * 1024 * 1024);
  const storageCost = storageGB * 0.015; // $0.015 per GB/month
  
  // Operations cost
  const classAOps = stats.operations.listFiles + stats.operations.putFile + stats.operations.deleteFile;
  const classBOps = stats.operations.getFile;
  const operationsCost = (classAOps / 1000000) * 4.50 + (classBOps / 1000000) * 0.36;
  
  // Bandwidth cost (egress is free for first 10TB/month with R2!)
  const bandwidthCost = 0;
  
  return {
    storage: storageGB,
    operations: operationsCost,
    bandwidth: bandwidthCost,
    total: storageCost + operationsCost + bandwidthCost,
  };
}
