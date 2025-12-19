"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Copy, Trash2, LogOut, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface FileWithPreview extends File {
  preview?: string;
}

interface Upload {
  slug: string;
  createdAt: string;
  expiresAt: string;
  files: { name: string; size: number }[];
  downloads: number;
}

export default function AdminDashboard() {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [slug, setSlug] = useState("");
  const [expiryDays, setExpiryDays] = useState(7);
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
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    loadUploads();
    checkOrphanedUploads();
    loadMonthlyCost();
  }, []);

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
        description: "Vul een slug in en selecteer bestanden",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("slug", slug);
      formData.append("expiryDays", expiryDays.toString());
      files.forEach((file) => formData.append("files", file));

      // Use XMLHttpRequest to track upload progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error(xhr.responseText || 'Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('POST', '/api/admin/upload');
        xhr.send(formData);
      });

      toast({
        title: "Succes!",
        description: `Upload succesvol: ${slug}`,
      });
      setFiles([]);
      setSlug("");
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
                  Custom URL
                </label>
                <Input
                  placeholder="klant-opdracht"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    setSlugSuggestions([]);
                  }}
                />
                {slugSuggestions.length > 0 && !slug && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500">Suggesties:</span>
                    {slugSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setSlug(suggestion);
                          setSlugSuggestions([]);
                        }}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
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
                      className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out flex items-center justify-center"
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
                  uploads.map((upload) => (
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
                        <div>
                          <h3 className="font-semibold">{upload.slug}</h3>
                          <p className="text-xs text-gray-500">
                            {upload.files.length} foto's •{" "}
                            {formatBytes(
                              upload.files.reduce((acc, f) => acc + f.size, 0)
                            )}
                          </p>
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
                      </div>
                    </div>
                  ))
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
    </div>
  );
}
