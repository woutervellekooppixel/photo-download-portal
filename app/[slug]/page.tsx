import { notFound } from "next/navigation";
import { getMetadata } from "@/lib/r2";
import DownloadGallery from "./download-gallery";

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const metadata = await getMetadata(slug);

  if (!metadata) {
    notFound();
  }

  // Check if expired
  const now = new Date();
  const expiresAt = new Date(metadata.expiresAt);
  
  if (now > expiresAt) {
    notFound();
  }

  return <DownloadGallery metadata={metadata} />;
}
