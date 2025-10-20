'use client';

import React, { useState, useEffect } from 'react';
import { storeDb, StoreRecord } from '@/lib/database';

interface StoreDropdownProps {
  value: string;
  onChange: (storeName: string) => void;
  className?: string;
  disabled?: boolean;
}

export default function StoreDropdown({
  value,
  onChange,
  className = '',
  disabled = false
}: StoreDropdownProps) {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStores = async () => {
      try {
        const records = await storeDb.list();
        setStores(records);
      } catch (error) {
        console.error('Failed to load stores:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStores();
  }, []);

  if (loading) {
    return (
      <select className={className} disabled>
        <option>Loading stores...</option>
      </select>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled}
    >
      <option value="">Select a store</option>
      {stores.map((store) => (
        <option key={store.id} value={store.name}>
          {store.name}{store.isDefault ? ' (Default)' : ''}
        </option>
      ))}
    </select>
  );
}

