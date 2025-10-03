'use client';

import React, { useCallback, useState, useRef } from 'react';
import { DragDropFile, ProcessingStatus } from '@/types/invoice';

interface InvoiceDropzoneProps {
  onFilesDropped: (files: DragDropFile[]) => void;
  processing: ProcessingStatus;
  maxFiles?: number;
  acceptedTypes?: string[];
}

export default function InvoiceDropzone({
  onFilesDropped,
  processing,
  maxFiles = 10,
  acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
}: InvoiceDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    
    if (dragCounter - 1 === 0) {
      setIsDragOver(false);
    }
  }, [dragCounter]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processFiles = useCallback((files: File[]) => {
    if (processing.status === 'processing') return;

    const validFiles = files
      .filter(file => acceptedTypes.includes(file.type))
      .slice(0, maxFiles);

    if (validFiles.length === 0) return;

    const processedFiles: DragDropFile[] = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));

    onFilesDropped(processedFiles);
  }, [processing.status, acceptedTypes, maxFiles, onFilesDropped]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  }, [processFiles]);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const isProcessing = processing.status === 'processing';
  const isDisabled = isProcessing;

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileInput}
        className="hidden"
        disabled={isDisabled}
      />

      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={!isDisabled ? openFileDialog : undefined}
        className={`
          relative min-h-[300px] w-full rounded-lg border-2 border-dashed 
          transition-all duration-200 cursor-pointer group
          ${isDragOver 
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-border hover:border-primary/50 hover:bg-primary/2'
          }
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Drop overlay */}
        {isDragOver && (
          <div className="absolute inset-2 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10">
            <div className="text-center">
              <div className="text-2xl mb-2">📄</div>
              <p className="text-primary font-medium">Drop invoice images here</p>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          {isProcessing ? (
            <>
              <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Processing Invoice...</h3>
              <p className="text-muted-foreground mb-2">{processing.message}</p>
              {processing.progress !== undefined && (
                <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${processing.progress}%` }}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {/* Icon */}
              <div className="mb-6 text-6xl group-hover:scale-110 transition-transform duration-200">
                📄
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold mb-2 text-foreground">
                Drop Your Invoice Images
              </h3>

              {/* Description */}
              <p className="text-muted-foreground mb-6 max-w-md">
                Drag and drop your invoice images here, or click to browse. 
                Shaw AI will extract all the important information automatically.
              </p>

              {/* Upload button */}
              <button className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors duration-200">
                Browse Files
              </button>

              {/* File info */}
              <div className="mt-6 text-sm text-muted-foreground space-y-1">
                <p>Supported formats: JPG, PNG, WebP</p>
                <p>Maximum {maxFiles} files at once</p>
              </div>
            </>
          )}
        </div>

        {/* Processing status */}
        {processing.status === 'error' && (
          <div className="absolute top-4 right-4 bg-destructive text-destructive-foreground px-3 py-1 rounded-md text-sm">
            Processing failed
          </div>
        )}

        {processing.status === 'completed' && (
          <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-md text-sm">
            Extraction complete!
          </div>
        )}
      </div>

    </div>
  );
}