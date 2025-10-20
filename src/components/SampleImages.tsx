'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { FiImage, FiCheck } from 'react-icons/fi';

interface SampleImagesProps {
  onImageSelect: (file: File) => Promise<void>;
  onMultipleImagesSelect?: (files: File[]) => Promise<void>;
}

const SAMPLE_IMAGES = [
  'invoice1.jpeg',
  'invoice2.jpeg',
  'invoice3.jpg',
  'invoice4.jpg',
  'invoice5.jpeg'
];

export default function SampleImages({ 
  onImageSelect, 
  onMultipleImagesSelect
}: SampleImagesProps) {
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const handleImageClick = async (imageName: string) => {
    console.log('🖼️ [SampleImages] Image clicked:', imageName);
    
    // Multi-select mode - toggle selection (no key combos needed!)
    if (isMultiSelectMode) {
      console.log('📋 [SampleImages] Multi-select mode - toggling selection');
      setSelectedImages(prev => {
        const newSet = new Set(prev);
        if (newSet.has(imageName)) {
          newSet.delete(imageName);
        } else {
          newSet.add(imageName);
        }
        return newSet;
      });
      return;
    }

    // Single select mode - process immediately
    try {
      console.log('📥 [SampleImages] Fetching sample image:', `/samples/${imageName}`);
      const response = await fetch(`/samples/${imageName}`);
      console.log('📥 [SampleImages] Fetch response:', { 
        status: response.status, 
        ok: response.ok, 
        contentType: response.headers.get('content-type') 
      });
      
      const blob = await response.blob();
      console.log('📥 [SampleImages] Blob created:', { 
        size: blob.size, 
        type: blob.type 
      });
      
      const file = new File([blob], imageName, { type: blob.type });
      console.log('📥 [SampleImages] File created:', { 
        name: file.name, 
        size: file.size, 
        type: file.type 
      });
      
      console.log('📤 [SampleImages] Calling onImageSelect with file...');
      await onImageSelect(file);
      console.log('✅ [SampleImages] onImageSelect completed successfully');
    } catch (error) {
      console.error('❌ [SampleImages] Failed to load sample image:', error);
    }
  };

  const handleProcessSelected = async () => {
    if (!onMultipleImagesSelect || selectedImages.size === 0) return;
    
    console.log('📋 [SampleImages] Processing multiple selected images:', selectedImages.size);
    
    try {
      const files = await Promise.all(
        Array.from(selectedImages).map(async (imageName) => {
          console.log('📥 [SampleImages] Fetching:', imageName);
          const response = await fetch(`/samples/${imageName}`);
          const blob = await response.blob();
          console.log('📥 [SampleImages] Blob created for:', imageName, { size: blob.size, type: blob.type });
          return new File([blob], imageName, { type: blob.type });
        })
      );
      
      console.log('📤 [SampleImages] Calling onMultipleImagesSelect with', files.length, 'files');
      await onMultipleImagesSelect(files);
      console.log('✅ [SampleImages] Multiple images processed successfully');
      setSelectedImages(new Set());
      setIsMultiSelectMode(false);
    } catch (error) {
      console.error('❌ [SampleImages] Failed to load sample images:', error);
    }
  };

  const handleCancelSelection = () => {
    setSelectedImages(new Set());
    setIsMultiSelectMode(false);
  };

  const handleSelectAll = () => {
    if (selectedImages.size === SAMPLE_IMAGES.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(SAMPLE_IMAGES));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FiImage className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Sample Invoices</h3>
        </div>
        
        {onMultipleImagesSelect && (
          <div className="flex items-center gap-2">
            {isMultiSelectMode && (
              <>
                <button
                  onClick={handleSelectAll}
                  className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  {selectedImages.size === SAMPLE_IMAGES.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleCancelSelection}
                  className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
            {!isMultiSelectMode && (
              <button
                onClick={() => setIsMultiSelectMode(true)}
                className="text-xs px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
              >
                Multi-Select
              </button>
            )}
          </div>
        )}
      </div>
      
      {isMultiSelectMode && selectedImages.size > 0 && (
        <div className="flex items-center justify-between p-2 bg-primary/10 rounded-md">
          <span className="text-sm text-primary font-medium">
            {selectedImages.size} image{selectedImages.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleProcessSelected}
            className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Add to Queue
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {SAMPLE_IMAGES.map((imageName) => (
          <button
            key={imageName}
            onClick={() => handleImageClick(imageName)}
            className={`
              relative aspect-square rounded-lg border-2 overflow-hidden
              transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer hover:border-primary
              ${selectedImages.has(imageName) ? 'border-primary bg-primary/10 ring-2 ring-primary' : 'border-border'}
            `}
            title={isMultiSelectMode ? `Click to select: ${imageName}` : `Click to add to queue: ${imageName}`}
          >
            <Image
              src={`/samples/${imageName}`}
              alt={`Sample invoice: ${imageName}`}
              width={200}
              height={150}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            
            {selectedImages.has(imageName) && (
              <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                <FiCheck className="w-3 h-3" />
              </div>
            )}
            
            {/* Filename label */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5 text-center truncate">
              {imageName.substring(0, 8)}...
            </div>
            
            {/* Overlay on hover */}
            {!isMultiSelectMode && (
              <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                <div className="opacity-0 hover:opacity-100 transition-opacity duration-200">
                  <div className="bg-white/90 text-black text-xs px-2 py-1 rounded-full font-medium">
                    Add to Queue
                  </div>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        {isMultiSelectMode 
          ? 'Click images to select multiple, then click "Add to Queue"'
          : onMultipleImagesSelect 
            ? 'Click to add to queue instantly, or use Multi-Select to add multiple at once'
            : 'Click any sample invoice to add to processing queue'
        }
      </p>
    </div>
  );
}
