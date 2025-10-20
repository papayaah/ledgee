'use client';

import React from 'react';
import { useInvoiceQueueStore } from '@/store/invoiceQueueStore';
import { QueueItem } from '@/lib/database';
import { FiCheck, FiX, FiLoader, FiClock, FiTrash2 } from 'react-icons/fi';
import Image from 'next/image';

export default function InvoiceQueue() {
  const { queue, removeFromQueue, clearCompleted, clearQueue } = useInvoiceQueueStore();
  
  const pendingItems = queue.filter(item => item.status === 'pending');
  const processingItems = queue.filter(item => item.status === 'processing');
  const completedItems = queue.filter(item => item.status === 'completed');
  const failedItems = queue.filter(item => item.status === 'failed');
  
  if (queue.length === 0) {
    return null;
  }

  const getStatusIcon = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending':
        return <FiClock className="w-4 h-4 text-yellow-500" />;
      case 'processing':
        return <FiLoader className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <FiCheck className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <FiX className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending':
        return 'Waiting...';
      case 'processing':
        return 'Extracting...';
      case 'completed':
        return 'Extracted - Ready to Save';
      case 'failed':
        return 'Failed';
    }
  };

  const getStatusColor = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'processing':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'completed':
        return 'bg-green-500/10 border-green-500/20';
      case 'failed':
        return 'bg-red-500/10 border-red-500/20';
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Processing Queue</h3>
          <p className="text-sm text-muted-foreground">
            {queue.length === 1 ? '1 item in queue' : `${queue.length} items in queue`}
          </p>
        </div>
        
        <div className="flex gap-2">
          {(completedItems.length > 0 || failedItems.length > 0) && (
            <button
              onClick={clearCompleted}
              className="text-sm px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              Clear Processed
            </button>
          )}
          {queue.length > 0 && (
            <button
              onClick={clearQueue}
              className="text-sm px-3 py-1.5 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-center p-2 bg-yellow-500/10 rounded-md">
          <div className="font-semibold text-yellow-600">{pendingItems.length}</div>
          <div className="text-muted-foreground">Pending</div>
        </div>
        <div className="text-center p-2 bg-blue-500/10 rounded-md">
          <div className="font-semibold text-blue-600">{processingItems.length}</div>
          <div className="text-muted-foreground">Processing</div>
        </div>
        <div className="text-center p-2 bg-green-500/10 rounded-md">
          <div className="font-semibold text-green-600">{completedItems.length}</div>
          <div className="text-muted-foreground">Extracted</div>
        </div>
        <div className="text-center p-2 bg-red-500/10 rounded-md">
          <div className="font-semibold text-red-600">{failedItems.length}</div>
          <div className="text-muted-foreground">Failed</div>
        </div>
      </div>

      {/* Queue Items */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {[...queue].reverse().map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${getStatusColor(item.status)}`}
          >
            {/* Thumbnail */}
            <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-muted">
              <Image
                src={item.imageData}
                alt={item.fileName}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.fileName}</p>
              <div className="flex items-center gap-2 mt-1">
                {getStatusIcon(item.status)}
                <span className="text-xs text-muted-foreground">
                  {getStatusText(item.status)}
                </span>
                {item.error && (
                  <span className="text-xs text-red-500">- {item.error}</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0">
              <button
                onClick={() => removeFromQueue(item.id)}
                className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Remove from queue"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

