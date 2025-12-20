"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Copy, Trash2, LogOut, Check, ExternalLink, Mail, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { useAutoLogout } from "@/lib/useAutoLogout";

interface FileWithPreview extends File {
  preview?: string;
}

interface Upload {
  slug: string;
  title?: string;
  createdAt: string;
  expiresAt: string;
  files: { key: string; name: string; size: number; type: string }[];
  downloads: number;
  previewImageKey?: string;
  clientEmail?: string;
  customMessage?: string;
  ratings?: Record<string, boolean>;
  ratingsEnabled?: boolean;
}

export default function AdminDashboard() {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [expiryDays, setExpiryDays] = useState(7);
  const [clientEmail, setClientEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("Hi,\n\nHierbij de foto's van afgelopen avond.");
  const [ratingsEnabled, setRatingsEnabled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [orphanedUploads, setOrphanedUploads] = useState<string[]>([]);
  const [showOrphaned, setShowOrphaned] = useState(false);
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [selectedUploads, setSelectedUploads] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [monthlyCost, setMonthlyCost] = useState<any>(null);
  const [expandedUpload, setExpandedUpload] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedUploadForEmail, setSelectedUploadForEmail] = useState<Upload | null>(null);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Auto logout after 5 hours of inactivity
  useAutoLogout({ 
    timeout: 5 * 60 * 60 * 1000, // 5 hours
    onLogout: () => {
      toast({
        title: "Automatisch uitgelogd",
        description: "Je bent automatisch uitgelogd vanwege inactiviteit.",
      });
    }
  });

  useEffect(() => {
    loadUploads();
    checkOrphanedUploads();
    loadMonthlyCost();
  }, []);

  // Load thumbnails when upload is expanded
  useEffect(() => {
    const loadThumbnailsForUpload = async () => {
      if (!expandedUpload) return;
      
      const upload = uploads.find(u => u.slug === expandedUpload);
      if (!upload) return;
      
      const imageFiles = upload.files.filter(f => isImage(f.name));
      
      for (const file of imageFiles) {
        // Skip if already loaded
        if (thumbnailUrls[file.key]) continue;
        
        try {
          const res = await fetch(`/api/thumbnail/${upload.slug}?key=${encodeURIComponent(file.key)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              setThumbnailUrls(prev => ({ ...prev, [file.key]: data.url }));
            }
          }
        } catch (error) {
          console.error('Failed to load thumbnail:', error);
        }
      }
    };
    
    loadThumbnailsForUpload();
  }, [expandedUpload, uploads]);

  const loadUploads = async () => {
    const res = await fetch("/api/admin/uploads");
    if (res.ok) {
      const data = await res.json();
      setUploads(data);
    }
  };

  const checkOrphanedUploads = async () => {
    try {
      const res = await fetch("/api/admin/cleanup");
      if (res.ok) {
        const data = await res.json();
        setOrphanedUploads(data.orphaned);
      }
    } catch (error) {
      console.error("Failed to check orphaned uploads:", error);
    }
  };

  const loadMonthlyCost = async () => {
    try {
      const res = await fetch("/api/admin/costs");
      if (res.ok) {
        const data = await res.json();
        setMonthlyCost(data);
      }
    } catch (error) {
      console.error("Failed to load monthly costs:", error);
    }
  };

  const cleanupOrphanedUpload = async (slug: string) => {
    try {
      const res = await fetch(`/api/admin/cleanup?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Opgeruimd!",
          description: `Incomplete upload "${slug}" is verwijderd`,
        });
        await checkOrphanedUploads();
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Cleanup failed:', errorData);
        toast({
          title: "Fout",
          description: errorData.error || "Opruimen mislukt",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : "Opruimen mislukt",
        variant: "destructive",
      });
    }
  };

  const isSystemFile = (fileName: string): boolean => {
    const systemFiles = ['.DS_Store', 'Thumbs.db', 'desktop.ini', '.gitkeep'];
    const fileName_lower = fileName.toLowerCase();
    
    // Check exact matches
    if (systemFiles.some(sf => fileName.endsWith(sf))) return true;
    
    // Check for hidden files starting with .
    const name = fileName.split('/').pop() || '';
    if (name.startsWith('.') && name !== '.gitignore') return true;
    
    return false;
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const filesArray = Array.from(fileList);
    const allFiles: File[] = [];

    for (const file of filesArray) {
      // webkitRelativePath bevat het volledige pad vanaf de geselecteerde folder
      const relativePath = (file as any).webkitRelativePath || file.name;
      
      // Skip system files
      if (isSystemFile(relativePath) || isSystemFile(file.name)) {
        continue;
      }
      
      // Verwijder de root folder naam om alleen subfolders te behouden
      const pathParts = relativePath.split('/');
      const nameWithoutRoot = pathParts.length > 1 ? pathParts.slice(1).join('/') : pathParts[0];
      
      const newFile = new File([file], nameWithoutRoot, { type: file.type });
      allFiles.push(newFile);
    }

    setFiles((prev) => {
      const existing = new Set(prev.map(f => `${f.name}-${f.size}`));
      const newFiles = allFiles.filter(f => !existing.has(`${f.name}-${f.size}`));
      return [...prev, ...newFiles];
    });

    // Reset input
    e.target.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const filesArray = Array.from(fileList).filter(f => !isSystemFile(f.name));

    setFiles((prev) => {
      const existing = new Set(prev.map(f => `${f.name}-${f.size}`));
      const newFiles = filesArray.filter(f => !existing.has(`${f.name}-${f.size}`));
      return [...prev, ...newFiles];
    });

    // Generate slug suggestions from first file
    if (filesArray.length > 0 && !slug) {
      generateSlugSuggestions(filesArray[0].name);
    }

    // Reset input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!slug || files.length === 0) {
      toast({
        title: "Fout",
        description: "Vul een titel/slug in en selecteer bestanden",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadedFiles: Array<{key: string; name: string; size: number; type: string}> = [];
      let totalBytes = 0;
      let uploadedBytes = 0;

      // Calculate total bytes
      files.forEach(file => totalBytes += file.size);

      // Upload each file directly to R2
      for (const file of files) {
        // Get presigned URL
        const presignedRes = await fetch('/api/admin/presigned-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            fileName: file.name,
            fileType: file.type,
          }),
        });

        if (!presignedRes.ok) {
          throw new Error('Failed to get upload URL');
        }

        const { presignedUrl, key } = await presignedRes.json();

        // Upload file directly to R2 with progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const fileProgress = uploadedBytes + e.loaded;
              const percentComplete = Math.round((fileProgress / totalBytes) * 100);
              setUploadProgress(percentComplete);
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
              uploadedBytes += file.size;
              resolve();
            } else {
              reject(new Error(`Upload failed for ${file.name}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error(`Upload failed for ${file.name}`));
          });

          xhr.open('PUT', presignedUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        uploadedFiles.push({
          key,
          name: file.name,
          size: file.size,
          type: file.type,
        });
      }

      // Save metadata
      const metadataRes = await fetch('/api/admin/save-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          title: title.trim() || undefined,
          files: uploadedFiles,
          expiryDays,
          clientEmail: clientEmail.trim() || undefined,
          customMessage: customMessage.trim() || undefined,
          ratingsEnabled,
        }),
      });

      if (!metadataRes.ok) {
        throw new Error('Failed to save metadata');
      }

      // Send email if client email is provided
      if (clientEmail.trim()) {
        try {
          const emailRes = await fetch("/api/admin/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slug,
              recipientEmail: clientEmail.trim(),
              customMessage: customMessage.trim() || undefined,
            }),
          });

          if (!emailRes.ok) {
            const emailData = await emailRes.json();
            console.error("Email send error:", emailData);
            throw new Error("Email verzenden mislukt");
          }

          toast({
            title: "Succes!",
            description: `Upload succesvol en email verzonden naar ${clientEmail}`,
          });
        } catch (emailError) {
          console.error("Email error:", emailError);
          toast({
            title: "Upload succesvol",
            description: "Maar email verzenden is mislukt. Je kunt het opnieuw proberen via het envelopje.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Succes!",
          description: `Upload succesvol: ${title || slug}`,
        });
      }

      setFiles([]);
      setTitle("");
      setSlug("");
      setClientEmail("");
      setCustomMessage("Hi,\n\nHierbij de foto's van afgelopen avond.");
      setRatingsEnabled(false);
      setUploadProgress(0);
      loadUploads();
    } catch (error) {
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : "Upload mislukt",
        variant: "destructive",
      });
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const copyLink = (uploadSlug: string) => {
    const link = `${window.location.origin}/${uploadSlug}`;
    navigator.clipboard.writeText(link);
    setCopiedSlug(uploadSlug);
    setTimeout(() => setCopiedSlug(null), 2000);
    toast({
      title: "Gekopieerd!",
      description: "Link staat in je klembord",
    });
  };

  const updatePreviewImage = async (uploadSlug: string, fileKey: string) => {
    try {
      const res = await fetch('/api/admin/update-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: uploadSlug, previewImageKey: fileKey }),
      });

      if (res.ok) {
        toast({
          title: "Preview ingesteld!",
          description: "De preview foto is bijgewerkt",
        });
        loadUploads();
      } else {
        throw new Error('Failed to update preview');
      }
    } catch (error) {
      toast({
        title: "Fout",
        description: "Preview bijwerken mislukt",
        variant: "destructive",
      });
    }
  };
  
  // Helper function to check if file is an image
  const isImage = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'].includes(ext || '');
  };

  const deleteUpload = async (uploadSlug: string) => {
    if (!confirm(`Weet je zeker dat je ${uploadSlug} wilt verwijderen?`)) return;

    const res = await fetch(`/api/admin/uploads/${uploadSlug}`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast({
        title: "Verwijderd",
        description: `${uploadSlug} is verwijderd`,
      });
      loadUploads();
    }
  };

  const toggleSelectUpload = (uploadSlug: string) => {
    setSelectedUploads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uploadSlug)) {
        newSet.delete(uploadSlug);
      } else {
        newSet.add(uploadSlug);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUploads.size === uploads.length) {
      setSelectedUploads(new Set());
    } else {
      setSelectedUploads(new Set(uploads.map(u => u.slug)));
    }
  };

  const deleteSelected = async () => {
    if (selectedUploads.size === 0) return;

    if (!confirm(`Weet je zeker dat je ${selectedUploads.size} uploads wilt verwijderen?`)) {
      return;
    }

    setDeleting(true);
    let successCount = 0;

    for (const uploadSlug of selectedUploads) {
      try {
        const res = await fetch(`/api/admin/uploads/${uploadSlug}`, {
          method: "DELETE",
        });
        if (res.ok) successCount++;
      } catch (error) {
        console.error(`Failed to delete ${uploadSlug}:`, error);
      }
    }

    setDeleting(false);
    setSelectedUploads(new Set());
    
    toast({
      title: "Batch verwijderd",
      description: `${successCount} van ${selectedUploads.size} uploads verwijderd`,
    });

    loadUploads();
  };

  const openEmailDialog = (upload: Upload) => {
    setSelectedUploadForEmail(upload);
    setEmailRecipient(upload.clientEmail || "");
    setEmailMessage(upload.customMessage || "");
    setEmailDialogOpen(true);
  };

  const sendEmail = async () => {
    if (!selectedUploadForEmail || !emailRecipient) {
      toast({
        title: "Fout",
        description: "Email adres is verplicht",
        variant: "destructive",
      });
      return;
    }

    setSendingEmail(true);

    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedUploadForEmail.slug,
          recipientEmail: emailRecipient,
          customMessage: emailMessage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Email send error:", data);
        const errorMsg = typeof data.details === 'string' 
          ? data.details 
          : JSON.stringify(data.details || data.error || "Email verzenden mislukt");
        throw new Error(errorMsg);
      }

      toast({
        title: "Email verzonden!",
        description: `Email succesvol verzonden naar ${emailRecipient}`,
      });

      setEmailDialogOpen(false);
      setSelectedUploadForEmail(null);
      setEmailRecipient("");
      setEmailMessage("");
    } catch (error) {
      console.error("Email error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'object' 
          ? JSON.stringify(error) 
          : String(error);
      toast({
        title: "Fout",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const generateSlugSuggestions = (fileName: string) => {
    const name = fileName.toLowerCase()
      .replace(/\.(jpg|jpeg|png|gif|webp|pdf|zip|mp4|mov)$/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    const now = new Date();
    const month = now.toLocaleDateString('nl-NL', { month: 'short' });
    const year = now.getFullYear();
    
    const suggestions = [
      name,
      `${name}-${month}-${year}`,
      `${name}-${year}`,
      `${name}-${now.getDate()}-${month}`,
    ].filter(s => s.length > 0 && s !== '-');
    
    setSlugSuggestions(suggestions.slice(0, 3));
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
  };

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Upload en beheer je foto downloads</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Uitloggen
          </Button>
        </div>

        {/* Statistics Summary */}
        {uploads.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-4 mb-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{uploads.length}</div>
                  <p className="text-xs text-gray-500">Actieve Uploads</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {uploads.reduce((acc, u) => acc + u.files.length, 0)}
                  </div>
                  <p className="text-xs text-gray-500">Totaal Bestanden</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {uploads.reduce((acc, u) => acc + u.downloads, 0)}
                  </div>
                  <p className="text-xs text-gray-500">Totaal Downloads</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {formatBytes(uploads.reduce((acc, u) => 
                      acc + u.files.reduce((sum, f) => sum + f.size, 0), 0
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">Totale Storage</p>
                </CardContent>
              </Card>
            </div>

            {monthlyCost && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    💰 Maandelijkse Kosten
                    <span className="text-sm font-normal text-gray-600">
                      ({monthlyCost.month})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        ${monthlyCost.total.toFixed(4)}
                      </div>
                      <p className="text-xs text-gray-500">Totaal deze maand</p>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-800">
                        {monthlyCost.storage.toFixed(2)} GB
                      </div>
                      <p className="text-xs text-gray-500">Storage (${(monthlyCost.storage * 0.015).toFixed(4)})</p>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-800">
                        {(monthlyCost.operations.listFiles + monthlyCost.operations.putFile + monthlyCost.operations.deleteFile).toLocaleString()}
                      </div>
                      <p className="text-xs text-gray-500">Class A Operations</p>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-800">
                        {formatBytes(monthlyCost.bandwidth)}
                      </div>
                      <p className="text-xs text-gray-500">Bandwidth (gratis!)</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    💡 Kosten resetten automatisch elke maand
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Nieuwe Upload</CardTitle>
              <CardDescription>Upload foto's voor een nieuwe klant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Transfer titel *
                </label>
                <Input
                  placeholder="Fotoshoot Emma & Tom"
                  value={title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setTitle(newTitle);
                    // Auto-generate slug from title
                    if (newTitle) {
                      const autoSlug = newTitle
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '');
                      setSlug(autoSlug);
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deze titel zie je terug in de email en het onderwerp
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Custom URL (automatisch gegenereerd)
                </label>
                <Input
                  placeholder="fotoshoot-emma-tom"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                />
                {slug && (
                  <p className="text-xs text-gray-500 mt-1">
                    Link: download.wouter.photo/{slug}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Verloopt over
                </label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 60)))}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">dagen</span>
                  <div className="flex gap-1 ml-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setExpiryDays(7)}
                    >
                      7d
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setExpiryDays(30)}
                    >
                      30d
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setExpiryDays(60)}
                    >
                      60d
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Vervaldatum: {new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString('nl-NL', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Client email (optioneel)</label>
                  <Input
                    type="email"
                    placeholder="naam@voorbeeld.nl"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Voor het verzenden van de download link naar je klant
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Persoonlijk bericht</label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Dit bericht wordt toegevoegd aan de email. Hieronder komt automatisch de download link, sociale media en handtekening.
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ratingsEnabled}
                      onChange={(e) => setRatingsEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Foto waardering inschakelen</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Laat klanten foto's beoordelen met een sterretje
                  </p>
                </div>
              </div>

              <div className="border-2 border-dashed rounded-lg p-8 text-center border-gray-300 bg-white">
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm text-gray-600 mb-4">
                  Selecteer bestanden om te uploaden
                </p>
                <div className="flex gap-3 justify-center">
                  <input
                    type="file"
                    id="file-input"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById('file-input')?.click();
                    }}
                  >
                    � Selecteer Bestanden
                  </Button>
                  <input
                    type="file"
                    id="folder-input"
                    {...({ webkitdirectory: "", mozdirectory: "", directory: "" } as any)}
                    multiple
                    onChange={handleFolderSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById('folder-input')?.click();
                    }}
                  >
                    📁 Selecteer Folder
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Selecteer een folder om de mappenstructuur te behouden. Alle bestandstypes worden ondersteund.
                </p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{files.length} bestanden</span>
                    <span className="text-gray-600">{formatBytes(totalSize)}</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm"
                      >
                        <span className="truncate flex-1">{file.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs">
                            {formatBytes(file.size)}
                          </span>
                          <button
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Button with Progress Bar */}
              {!uploading ? (
                <Button
                  onClick={handleUpload}
                  disabled={!slug || files.length === 0}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Bestanden
                </Button>
              ) : (
                <div className="w-full space-y-2">
                  <div className="relative w-full h-10 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 transition-all duration-300 ease-out flex items-center justify-center"
                      style={{ width: `${uploadProgress}%` }}
                    >
                      {uploadProgress > 10 && (
                        <span className="text-white text-sm font-semibold">
                          {uploadProgress}%
                        </span>
                      )}
                    </div>
                    {uploadProgress <= 10 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-gray-600 text-sm font-semibold">
                          {uploadProgress}%
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-center text-gray-500">
                    Bestanden uploaden...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Uploads List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Actieve Downloads</CardTitle>
                <CardDescription>Beheer bestaande uploads</CardDescription>
              </div>
              {uploads.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggleSelectAll}
                  >
                    {selectedUploads.size === uploads.length ? "Deselecteer alles" : "Selecteer alles"}
                  </Button>
                  {selectedUploads.size > 0 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={deleteSelected}
                      disabled={deleting}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleting ? "Bezig..." : `Verwijder (${selectedUploads.size})`}
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {uploads.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    Nog geen uploads
                  </p>
                ) : (
                  uploads.map((upload) => {
                    const imageFiles = upload.files.filter(f => isImage(f.name));
                    const isExpanded = expandedUpload === upload.slug;
                    
                    return (
                    <div
                      key={upload.slug}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedUploads.has(upload.slug)}
                          onChange={() => toggleSelectUpload(upload.slug)}
                          className="mt-1 h-4 w-4 rounded border-gray-300"
                        />
                        <div className="flex-1">
                          {upload.title && (
                            <h3 className="font-semibold text-base">{upload.title}</h3>
                          )}
                          <p className={`text-sm ${upload.title ? 'text-gray-500' : 'font-semibold'}`}>
                            {upload.slug}
                          </p>
                          <p className="text-xs text-gray-500">
                            {upload.files.length} bestand(en) •{" "}
                            {formatBytes(
                              upload.files.reduce((acc, f) => acc + f.size, 0)
                            )}
                          </p>
                          {imageFiles.length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedUpload(isExpanded ? null : upload.slug)}
                              className="mt-1 h-6 text-xs px-2"
                            >
                              {isExpanded ? '▼' : '▶'} {imageFiles.length} foto's - Kies preview
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/${upload.slug}`, '_blank')}
                            title="Bekijk download pagina"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEmailDialog(upload)}
                            title="Verstuur email"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyLink(upload.slug)}
                            title="Kopieer link"
                          >
                            {copiedSlug === upload.slug ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteUpload(upload.slug)}
                            title="Verwijder"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>Aangemaakt: {formatDate(new Date(upload.createdAt))}</p>
                        <p>Verloopt: {formatDate(new Date(upload.expiresAt))}</p>
                        <p>Downloads: {upload.downloads}×</p>
                        {upload.ratings && Object.keys(upload.ratings).length > 0 && (
                          <p className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            Gewaardeerd: {Object.keys(upload.ratings).length} foto's
                          </p>
                        )}
                      </div>
                      
                      {/* Photo grid for preview selection */}
                      {isExpanded && imageFiles.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm font-medium mb-3">Selecteer een preview foto voor het loading screen:</p>
                          <div className="grid grid-cols-4 gap-2">
                            {imageFiles.map((file) => {
                              const isPreview = upload.previewImageKey === file.key;
                              const isRated = upload.ratings?.[file.key];
                              const thumbnailUrl = thumbnailUrls[file.key];
                              
                              return (
                                <button
                                  key={file.key}
                                  onClick={() => updatePreviewImage(upload.slug, file.key)}
                                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                    isPreview 
                                      ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-2' 
                                      : 'border-gray-200 hover:border-blue-300'
                                  }`}
                                  title={file.name}
                                >
                                  {isRated && (
                                    <div className="absolute top-1 right-1 z-10">
                                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 drop-shadow" />
                                    </div>
                                  )}
                                  {thumbnailUrl ? (
                                    <img
                                      src={thumbnailUrl}
                                      alt={file.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        // Hide broken images
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                                    </div>
                                  )}
                                  {isPreview && (
                                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                      <Check className="h-8 w-8 text-white drop-shadow" />
                                    </div>
                                  )}
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                    <p className="text-white text-xs truncate">{file.name.split('/').pop()}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orphaned Uploads Warning */}
        {orphanedUploads.length > 0 && (
          <Card className="mt-6 border-orange-200 bg-orange-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-orange-900">
                    ⚠️ Incomplete Uploads ({orphanedUploads.length})
                  </CardTitle>
                  <CardDescription className="text-orange-700">
                    Deze uploads zijn niet afgerond maar staan wel op de server
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowOrphaned(!showOrphaned)}
                >
                  {showOrphaned ? "Verberg" : "Bekijk"}
                </Button>
              </div>
            </CardHeader>
            {showOrphaned && (
              <CardContent>
                <div className="space-y-2">
                  {orphanedUploads.map((slug) => (
                    <div
                      key={slug}
                      className="flex items-center justify-between bg-white p-3 rounded border border-orange-200"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{slug}</p>
                        <p className="text-xs text-gray-500">
                          Upload gestopt voordat metadata kon worden opgeslagen
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => cleanupOrphanedUpload(slug)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Opruimen
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>

      {/* Email Dialog */}
      {emailDialogOpen && selectedUploadForEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Verstuur Email</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Upload: {selectedUploadForEmail.slug}
                  </p>
                </div>
                <button
                  onClick={() => setEmailDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">
                  Ontvanger email *
                </label>
                <Input
                  type="email"
                  placeholder="naam@voorbeeld.nl"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  disabled={sendingEmail}
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  Persoonlijk bericht (optioneel)
                </label>
                <textarea
                  placeholder="Hoi! Hier zijn de foto's van onze fotoshoot..."
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={6}
                  disabled={sendingEmail}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Dit bericht wordt toegevoegd aan de email
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                <h3 className="font-medium text-gray-900">Email bevat:</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>✓ Preview foto als header</li>
                  <li>✓ Persoonlijk bericht (als ingevuld)</li>
                  <li>✓ {selectedUploadForEmail.files.length} foto's • {formatBytes(
                    selectedUploadForEmail.files.reduce((acc, f) => acc + f.size, 0)
                  )}</li>
                  <li>✓ Download link met grote knop</li>
                  <li>✓ Vervaldatum: {formatDate(new Date(selectedUploadForEmail.expiresAt))}</li>
                  <li>✓ WOUTER.PHOTO branding</li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setEmailDialogOpen(false)}
                disabled={sendingEmail}
                className="flex-1"
              >
                Annuleren
              </Button>
              <Button
                onClick={sendEmail}
                disabled={sendingEmail || !emailRecipient}
                className="flex-1"
              >
                {sendingEmail ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Bezig...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Verstuur Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
