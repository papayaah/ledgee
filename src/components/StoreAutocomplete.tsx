'use client';

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { storeDb, StoreRecord } from '@/lib/database';
import { MdStore } from 'react-icons/md';

interface StoreAutocompleteProps {
  value: string;
  onChange: (value: string, storeId?: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
}

function StoreAutocomplete({
  value,
  onChange,
  onBlur,
  disabled = false,
  className = ''
}: StoreAutocompleteProps) {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredStores, setFilteredStores] = useState<StoreRecord[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [internalValue, setInternalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal value with prop value
  useEffect(() => {
    if (!isFocused && value !== internalValue) {
      setInternalValue(value);
    }
  }, [value, isFocused, internalValue]);

  // Load stores on mount
  useEffect(() => {
    const loadStores = async () => {
      try {
        const records = await storeDb.list();
        setStores(records);
      } catch (error) {
        console.error('Failed to load stores:', error);
      }
    };
    loadStores();
  }, []);

  // Filter stores when input changes
  useEffect(() => {
    const term = internalValue.trim().toLowerCase();
    if (!term) {
      if (filteredStores.length) setFilteredStores([]);
      if (isFocused && showDropdown) {
        setShowDropdown(false);
      }
      return;
    }

    const nextFiltered = stores.filter(store => 
      store.name.toLowerCase().includes(term)
    );

    // Shallow compare by id to avoid unnecessary list resets
    const sameList =
      filteredStores.length === nextFiltered.length &&
      filteredStores.every((s, i) => s.id === nextFiltered[i]?.id);

    if (!sameList) {
      setFilteredStores(nextFiltered);
      setHighlightedIndex(0);
    }

    if (isFocused) {
      const shouldShow = nextFiltered.length > 0;
      if (showDropdown !== shouldShow) {
        setShowDropdown(shouldShow);
      }
    }
  }, [internalValue, stores, isFocused, showDropdown, filteredStores]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    if (!showDropdown && isFocused) setShowDropdown(true);
    onChange(newValue, undefined);
  };

  const handleSelectStore = (store: StoreRecord) => {
    setInternalValue(store.name);
    onChange(store.name, store.id);
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredStores.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredStores.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredStores[highlightedIndex]) {
          handleSelectStore(filteredStores[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        break;
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (filteredStores.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleBlur = () => {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      setIsFocused(false);
      onBlur?.();
    }, 200);
  };

  // Ensure focus remains on the input while typing
  useLayoutEffect(() => {
    if (isFocused && inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus({ preventScroll: true } as any);
      try {
        const val = inputRef.current.value;
        inputRef.current.setSelectionRange(val.length, val.length);
      } catch {}
    }
  }, [internalValue, isFocused]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={internalValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className={className}
        placeholder="Start typing store name..."
        autoComplete="off"
      />
      
      {showDropdown && filteredStores.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full top-full bg-white dark:bg-gray-800 border border-border rounded-b-lg shadow-lg max-h-60 overflow-y-auto -mt-px border-t-0"
          style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
        >
          {filteredStores.map((store, index) => (
            <div
              key={store.id}
              onClick={() => handleSelectStore(store)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`
                px-4 py-3 cursor-pointer transition-colors border-b border-border last:border-b-0
                ${index === highlightedIndex 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-foreground' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-foreground'
                }
              `}
            >
              <div className="font-medium text-sm flex items-center gap-2">
                <MdStore className="w-4 h-4 text-muted-foreground" />
                <span>{store.name}</span>
                {store.isDefault && (
                  <span className="text-xs text-primary">(Default)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Helper text */}
      {value.trim() && filteredStores.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          Press Enter to create a new store
        </div>
      )}
    </div>
  );
}

export default React.memo(StoreAutocomplete);

