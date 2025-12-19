"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Download, 
  Image as ImageIcon, 
  Instagram, 
  Linkedin, 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  File as FileIcon, 
  Folder,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  Video,
  Music
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate } from "@/lib/utils";
import type { UploadMetadata } from "@/lib/r2";

export default function DownloadGallery({
  metadata,
}: {
  metadata: UploadMetadata;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState(true);
  const [thumbnailsLoaded, setThumbnailsLoaded] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Helper function to check if file is an image
  const isImage = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif'].includes(ext || '');
  };

  // Get icon for file type
  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    
    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
      return <FileArchive className="h-5 w-5 text-purple-600 flex-shrink-0" />;
    }
    
    // Code files
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'php', 'py', 'java', 'c', 'cpp', 'json'].includes(ext || '')) {
      return <FileCode className="h-5 w-5 text-green-600 flex-shrink-0" />;
    }
    
    // Document files
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext || '')) {
      return <FileText className="h-5 w-5 text-red-600 flex-shrink-0" />;
    }
    
    // Spreadsheet files
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext || '')) {
      return <FileSpreadsheet className="h-5 w-5 text-green-600 flex-shrink-0" />;
    }
    
    // Video files
    if (['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm'].includes(ext || '')) {
      return <Video className="h-5 w-5 text-pink-600 flex-shrink-0" />;
    }
    
    // Audio files
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext || '')) {
      return <Music className="h-5 w-5 text-blue-600 flex-shrink-0" />;
    }
    
    // Default
    return <FileIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />;
  };

  // Separate images and other files
  const imageFiles = metadata.files.filter(f => isImage(f.name));
  const otherFiles = metadata.files.filter(f => !isImage(f.name));
  
  // Get preview image - use previewImageKey if set, otherwise first image
  const previewImage = metadata.previewImageKey 
    ? metadata.files.find(f => f.key === metadata.previewImageKey)
    : imageFiles[0];

  // Load thumbnail URLs
  useEffect(() => {
    const loadThumbnails = async () => {
      setLoadingThumbnails(true);
      setThumbnailsLoaded(0);
      const urls: Record<string, string> = {};
      
      // Load preview image first for loading screen
      if (previewImage) {
        try {
          const response = await fetch(
            `/api/thumbnail/${metadata.slug}?key=${encodeURIComponent(previewImage.key)}`
          );
          const data = await response.json();
          if (data.url) {
            urls[previewImage.key] = data.url;
            setThumbnailUrls({ ...urls }); // Update state immediately for preview
          }
        } catch (error) {
          console.error("Failed to load preview thumbnail:", error);
        }
      }
      
      // Load all thumbnails in parallel for much faster loading
      const loadPromises = metadata.files.map(async (file) => {
        // Skip preview image if already loaded
        if (previewImage && file.key === previewImage.key) {
          return { key: file.key, url: urls[file.key] };
        }
        
        try {
          const response = await fetch(
            `/api/thumbnail/${metadata.slug}?key=${encodeURIComponent(file.key)}`
          );
          const data = await response.json();
          return { key: file.key, url: data.url };
        } catch (error) {
          console.error("Failed to load thumbnail:", error);
          return { key: file.key, url: null };
        }
      });
      
      // Wait for all thumbnails to load and update progress
      let loaded = 0;
      for (const promise of loadPromises) {
        promise.then(() => {
          loaded++;
          setThumbnailsLoaded(loaded);
        });
      }
      
      const results = await Promise.all(loadPromises);
      
      // Collect all URLs
      results.forEach(result => {
        if (result.url) {
          urls[result.key] = result.url;
        }
      });
      
      setThumbnailUrls(urls);
      
      // Keep loading screen visible for a minimum time to showcase the photo
      setTimeout(() => {
        setLoadingThumbnails(false);
      }, 2500);
    };

    loadThumbnails();
  }, [metadata, previewImage]);

  const downloadAll = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/download/${metadata.slug}/all`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${metadata.slug}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloading(false);
    }
  };

  const downloadSingle = async (fileKey: string, fileName: string) => {
    setDownloadingFile(fileKey);
    try {
      const response = await fetch(
        `/api/download/${metadata.slug}/file?key=${encodeURIComponent(fileKey)}`
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloadingFile(null);
    }
  };

  const toggleSelectFile = (fileKey: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileKey)) {
        newSet.delete(fileKey);
      } else {
        newSet.add(fileKey);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === imageFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(imageFiles.map(f => f.key)));
    }
  };

  const downloadSelected = async () => {
    if (selectedFiles.size === 0) return;
    
    setDownloading(true);
    try {
      // Download individually if only one file
      if (selectedFiles.size === 1) {
        const fileKey = Array.from(selectedFiles)[0];
        const file = metadata.files.find(f => f.key === fileKey);
        if (file) {
          const displayName = file.name.split('/').pop() || file.name;
          await downloadSingle(file.key, displayName);
        }
      } else {
        // Create a temporary metadata with only selected files
        const selectedFilesList = metadata.files.filter(f => selectedFiles.has(f.key));
        
        // Use the all endpoint but we'll need to filter
        const response = await fetch(`/api/download/${metadata.slug}/all`);
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${metadata.slug}-selectie.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      
      setSelectedFiles(new Set());
      setIsSelectMode(false);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloading(false);
    }
  };

  const downloadFolder = async (folderPath: string) => {
    try {
      const response = await fetch(`/api/download/${metadata.slug}/folder?path=${encodeURIComponent(folderPath)}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${folderPath}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Folder download failed:", error);
    }
  };

  const totalSize = metadata.files.reduce((acc, file) => acc + file.size, 0);
  
  // Format expiry date as dd-mm
  const formatExpiryDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}`;
  };

  // Group images by folder
  const imagesByFolder = imageFiles.reduce((acc, file) => {
    const pathParts = file.name.split('/');
    const folder = pathParts.length > 1 ? pathParts[0] : 'Hoofd';
    if (!acc[folder]) {
      acc[folder] = [];
    }
    acc[folder].push(file);
    return acc;
  }, {} as Record<string, typeof imageFiles>);

  const imageFolders = Object.keys(imagesByFolder);
  const hasImageFolders = imageFolders.length > 1 || !imagesByFolder['Hoofd'];

  // Group other files by folder
  const otherFilesByFolder = otherFiles.reduce((acc, file) => {
    const pathParts = file.name.split('/');
    const folder = pathParts.length > 1 ? pathParts[0] : 'Root';
    if (!acc[folder]) {
      acc[folder] = [];
    }
    acc[folder].push(file);
    return acc;
  }, {} as Record<string, typeof otherFiles>);

  const otherFileFolders = Object.keys(otherFilesByFolder);

  const toggleFolder = (folder: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [folder]: !prev[folder]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Sticky Navigation */}
      <nav className={`sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm backdrop-blur-sm bg-white/95 transition-opacity duration-1000 ${loadingThumbnails ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Info */}
            <div className="flex items-center gap-6">
              <a 
                href="https://wouter.photo" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex-shrink-0 text-gray-700 hover:text-gray-900 transition-colors text-lg tracking-tight"
              >
                <span className="font-bold">WOUTER.</span>
                <span className="font-normal">PHOTO</span>
              </a>
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                <span>{metadata.files.length} bestand{metadata.files.length !== 1 ? 'en' : ''}</span>
                <span className="text-gray-400">•</span>
                <span>{formatBytes(totalSize)}</span>
                <span className="text-gray-400">•</span>
                <span>Beschikbaar tot {formatExpiryDate(metadata.expiresAt)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              {/* Social Icons */}
              <div className="hidden sm:flex items-center gap-4">
                <a
                  href="https://instagram.com/woutervellekoop"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                  aria-label="Instagram"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a
                  href="https://www.linkedin.com/in/woutervellekoop/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                  aria-label="LinkedIn"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
              
              {/* Download Button */}
              <div className="flex items-center gap-2">
                {isSelectMode && selectedFiles.size > 0 && (
                  <Button
                    onClick={downloadSelected}
                    disabled={downloading}
                    size="sm"
                    variant="outline"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download {selectedFiles.size}
                  </Button>
                )}
                <Button
                  onClick={downloadAll}
                  disabled={downloading}
                  size="sm"
                >
                  <Download className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{downloading ? "Voorbereiden..." : "Download Alles"}</span>
                  <span className="sm:hidden">Download</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Fullscreen loading overlay with subtle progress */}
      {loadingThumbnails && (
        <div 
          className="fixed inset-0 z-50 transition-opacity duration-1000" 
          style={{ opacity: loadingThumbnails ? 1 : 0 }}
        >
          {/* Fullscreen preview image */}
          <div className="absolute inset-0 bg-black">
            {previewImage && thumbnailUrls[previewImage.key] ? (
              <Image
                src={thumbnailUrls[previewImage.key]}
                alt="Loading preview"
                fill
                className="object-cover animate-in fade-in duration-700"
                sizes="100vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
                <div className="relative w-32 h-32">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full opacity-30 animate-pulse" />
                  <ImageIcon className="absolute inset-0 m-auto h-16 w-16 text-white/40" />
                </div>
              </div>
            )}
          </div>
          
          {/* Subtle dark overlay */}
          <div className="absolute inset-0 bg-black/20" />
          
          {/* Minimal progress bar at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="max-w-md mx-auto space-y-3">
              {/* Thin progress bar */}
              <div className="relative w-full h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                <div 
                  className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(thumbnailsLoaded / metadata.files.length) * 100}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
                </div>
              </div>
              
              {/* Minimal stats */}
              <div className="flex items-center justify-between text-sm text-white/90">
                <span className="font-medium drop-shadow">
                  {Math.round((thumbnailsLoaded / metadata.files.length) * 100)}%
                </span>
                <span className="drop-shadow">
                  {thumbnailsLoaded} / {metadata.files.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`container mx-auto p-6 max-w-6xl transition-opacity duration-1000 ${loadingThumbnails ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Project Title */}
        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold text-gray-900 text-center">
            {metadata.slug.replace(/-/g, " ")}
            <span className="ml-3 text-3xl text-gray-500">
              ({imageFiles.length})
            </span>
          </h1>
        </div>

        {/* Photos Section */}
        {imageFiles.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div></div>
              <Button
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  if (isSelectMode) {
                    setSelectedFiles(new Set());
                  }
                }}
                variant="outline"
                size="sm"
              >
                {isSelectMode ? 'Annuleren' : 'Selecteren'}
              </Button>
            </div>

            {isSelectMode && (
              <div className="mb-4 flex items-center gap-4">
                <Button
                  onClick={toggleSelectAll}
                  variant="outline"
                  size="sm"
                >
                  {selectedFiles.size === imageFiles.length ? 'Deselecteer alles' : 'Selecteer alles'}
                </Button>
                {selectedFiles.size > 0 && (
                  <span className="text-sm text-gray-600">
                    {selectedFiles.size} foto{selectedFiles.size !== 1 ? "'s" : ''} geselecteerd
                  </span>
                )}
              </div>
            )}

            {imageFolders.map((folder) => (
              <div key={folder} className="mb-8">
                {hasImageFolders && (
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    {folder}
                    <span className="text-sm font-normal text-gray-500">
                      ({imagesByFolder[folder].length})
                    </span>
                  </h3>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {imagesByFolder[folder].map((file, index) => {
                      const displayName = file.name.split('/').pop() || file.name;
                      const isSelected = selectedFiles.has(file.key);
                      return (
                        <div
                          key={`${file.key}-${index}`}
                          className="group relative bg-white rounded-lg shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden"
                        >
                          {/* Selection checkbox */}
                          {isSelectMode && (
                            <div className="absolute top-2 left-2 z-10">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectFile(file.key)}
                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </div>
                          )}

                          {/* Thumbnail with hover zoom */}
                          <div 
                            className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden relative select-none cursor-pointer"
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                            onClick={() => isSelectMode && toggleSelectFile(file.key)}
                          >
                            {thumbnailUrls[file.key] ? (
                              <Image
                                src={thumbnailUrls[file.key]}
                                alt={file.name}
                                fill
                                className="object-cover pointer-events-none transition-transform duration-300 group-hover:scale-110"
                                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                loading="lazy"
                                quality={75}
                                draggable={false}
                                onContextMenu={(e) => e.preventDefault()}
                              />
                            ) : (
                              <ImageIcon className="h-12 w-12 text-gray-300" />
                            )}
                            
                            {/* Hover overlay with file info */}
                            {!isSelectMode && (
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                                <p className="text-white text-sm font-medium truncate">{displayName}</p>
                                <p className="text-white/80 text-xs">{formatBytes(file.size)}</p>
                              </div>
                            )}
                          </div>

                          {/* Download button overlay */}
                          {!isSelectMode && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <Button
                                size="sm"
                                className="shadow-lg"
                                onClick={() => downloadSingle(file.key, displayName)}
                                disabled={downloadingFile === file.key}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Files Section */}
        {otherFiles.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              📁 Bestanden
              <span className="text-sm font-normal text-gray-500">
                ({otherFiles.length})
              </span>
            </h2>

            <div className="space-y-4">
              {otherFileFolders.map((folder) => {
                const folderFiles = otherFilesByFolder[folder];
                const isCollapsed = collapsedFolders[folder];
                
                return (
                  <div key={folder} className="bg-white rounded-lg shadow-sm border border-gray-200">
                    {/* Folder Header */}
                    <div className="p-4 flex items-center justify-between border-b border-gray-200">
                      <button
                        onClick={() => toggleFolder(folder)}
                        className="flex items-center gap-3 flex-1 text-left hover:bg-gray-50 -m-2 p-2 rounded transition-colors"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-500" />
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{folder}</p>
                          <p className="text-xs text-gray-500">
                            {folderFiles.length} bestand{folderFiles.length !== 1 ? 'en' : ''}
                          </p>
                        </div>
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-4"
                        onClick={() => downloadFolder(folder)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download folder
                      </Button>
                    </div>

                    {/* File List */}
                    {!isCollapsed && (
                      <div className="divide-y divide-gray-100">
                        {folderFiles.map((file, index) => {
                          const displayName = file.name.split('/').pop() || file.name;
                          const ext = displayName.split('.').pop()?.toLowerCase();
                          
                          return (
                            <div
                              key={`${file.key}-${index}`}
                              className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {getFileIcon(displayName)}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900 truncate" title={displayName}>
                                    {displayName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatBytes(file.size)} {ext && `• ${ext.toUpperCase()}`}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => downloadSingle(file.key, displayName)}
                                disabled={downloadingFile === file.key}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>© Wouter.Photo</p>
        </div>
      </div>
    </div>
  );
}
