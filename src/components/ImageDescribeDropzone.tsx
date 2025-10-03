'use client';

import React, { useCallback, useState, DragEvent } from 'react';

type Props = {
  onFileSelected: (file: File) => Promise<void> | void;
  disabled?: boolean;
};

export default function ImageDescribeDropzone({ onFileSelected, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || disabled) return;
      const [file] = Array.from(files);
      if (!file) return;
      await onFileSelected(file);
    },
    [onFileSelected, disabled]
  );

  const onDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      await handleFiles(event.dataTransfer?.files ?? null);
    },
    [handleFiles]
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const onInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      await handleFiles(event.target.files);
      event.target.value = '';
    },
    [handleFiles]
  );

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer ${
        disabled
          ? 'opacity-60 cursor-not-allowed'
          : isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      }`}
    >
      <input
        type="file"
        accept="image/*"
        onChange={onInputChange}
        disabled={disabled}
        className="hidden"
        id="simple-image-upload"
      />
      <label htmlFor="simple-image-upload" className="block space-y-2">
        <div className="text-3xl">🖼️</div>
        <p className="text-sm text-muted-foreground">
          Drop an image here or click to select a file. The AI will describe what it sees.
        </p>
      </label>
    </div>
  );
}
