'use client';

import React, { useState } from 'react';
import { FiTrash2, FiAlertTriangle } from 'react-icons/fi';

interface DeleteAllDataProps {
  onDeleteAll: () => Promise<void>;
  disabled?: boolean;
}

export default function DeleteAllData({ onDeleteAll, disabled = false }: DeleteAllDataProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = () => {
    if (showConfirm) {
      handleConfirmDelete();
    } else {
      setShowConfirm(true);
      // Auto-hide confirmation after 5 seconds
      setTimeout(() => setShowConfirm(false), 5000);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAll();
      setShowConfirm(false);
    } catch (error) {
      console.error('Failed to delete all data:', error);
    } finally {
      setIsDeleting(false);
    }
  };


  return (
    <div className="relative">
      <button
        onClick={handleDeleteClick}
        disabled={disabled || isDeleting}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
          transition-all duration-200
          ${showConfirm
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
          }
          ${disabled || isDeleting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {isDeleting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Deleting...</span>
          </>
        ) : showConfirm ? (
          <>
            <FiAlertTriangle className="w-4 h-4" />
            <span>Click again to confirm</span>
          </>
        ) : (
          <>
            <FiTrash2 className="w-4 h-4" />
            <span>Delete All Data</span>
          </>
        )}
      </button>
      
      {showConfirm && (
        <div className="absolute top-full left-0 mt-1 text-xs text-muted-foreground bg-background border border-border rounded p-2 shadow-lg z-10 max-w-xs">
          This will permanently delete all invoices, queue, stores, merchants, and agents. Settings and OAuth tokens will be preserved.
        </div>
      )}
    </div>
  );
}
