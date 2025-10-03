'use client';

import React, { useState } from 'react';
import { FiImage, FiLoader } from 'react-icons/fi';

interface SampleImagesProps {
  onImageSelect: (file: File) => Promise<void>;
  disabled?: boolean;
}

const SAMPLE_IMAGES = [
  '235e2d80-f749-4c15-82f0-e114b2ffb70f.jpeg',
  '32bdc02e-9b44-4d0b-bacf-f625fa90c31d.jpeg',
  '7775149e-34c8-4c47-91a8-c569869036f7.jpeg',
  '81b40b9f-2fa3-44dd-87df-cfa932e9a55f.jpeg',
  'f6191cd3-7b69-4db5-93f5-e4fb979ad32b.jpeg'
];

export default function SampleImages({ onImageSelect, disabled = false }: SampleImagesProps) {
  const [loadingImage, setLoadingImage] = useState<string | null>(null);

  const handleImageClick = async (imageName: string) => {
    if (disabled || loadingImage) return;

    setLoadingImage(imageName);
    
    try {
      // Fetch the image from the public/samples directory
      const response = await fetch(`/samples/${imageName}`);
      const blob = await response.blob();
      
      // Create a File object from the blob
      const file = new File([blob], imageName, { type: blob.type });
      
      // Call the onImageSelect callback
      await onImageSelect(file);
    } catch (error) {
      console.error('Failed to load sample image:', error);
    } finally {
      setLoadingImage(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FiImage className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">Sample Invoices</h3>
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {SAMPLE_IMAGES.map((imageName) => (
          <button
            key={imageName}
            onClick={() => handleImageClick(imageName)}
            disabled={disabled || loadingImage !== null}
            className={`
              relative aspect-square rounded-lg border-2 border-border overflow-hidden
              transition-all duration-200 hover:scale-105 hover:shadow-md
              ${disabled || loadingImage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}
              ${loadingImage === imageName ? 'border-primary bg-primary/10' : ''}
            `}
            title={`Click to analyze: ${imageName}`}
          >
            <img
              src={`/samples/${imageName}`}
              alt={`Sample invoice: ${imageName}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            
            {loadingImage === imageName && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                <FiLoader className="w-4 h-4 text-primary animate-spin" />
              </div>
            )}
            
            {/* Filename label */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5 text-center truncate">
              {imageName.substring(0, 8)}...
            </div>
            
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
              <div className="opacity-0 hover:opacity-100 transition-opacity duration-200">
                <div className="bg-white/90 text-black text-xs px-2 py-1 rounded-full font-medium">
                  Analyze
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        Click any sample invoice to automatically analyze it with AI
      </p>
    </div>
  );
}
