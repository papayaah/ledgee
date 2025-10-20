'use client';

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { merchantDb, MerchantRecord } from '@/lib/database';
import { MdLocationOn } from 'react-icons/md';

interface MerchantAutocompleteProps {
  value: string;
  onChange: (value: string, merchantId?: string, merchantAddress?: string, isSelection?: boolean) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

function MerchantAutocomplete({
  value,
  onChange,
  onBlur,
  disabled = false,
  className = '',
  autoFocus = false
}: MerchantAutocompleteProps) {
  const [merchants, setMerchants] = useState<MerchantRecord[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredMerchants, setFilteredMerchants] = useState<MerchantRecord[]>([]);
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

  // Load merchants on mount
  useEffect(() => {
    const loadMerchants = async () => {
      try {
        const records = await merchantDb.list();
        setMerchants(records);
      } catch (error) {
        console.error('Failed to load merchants:', error);
      }
    };
    loadMerchants();
  }, []);

  // Filter merchants when input changes (use internal value to avoid parent timing issues)
  useEffect(() => {
    const term = internalValue.trim().toLowerCase();
    if (!term) {
      if (filteredMerchants.length) setFilteredMerchants([]);
      if (isFocused && showDropdown) {
        console.log('[MerchantAutocomplete] Hide dropdown (empty term)');
        setShowDropdown(false);
      }
      return;
    }

    const nextFiltered = merchants.filter(merchant => 
      merchant.name.toLowerCase().includes(term) ||
      merchant.address.toLowerCase().includes(term)
    );

    // Shallow compare by id to avoid unnecessary list resets/flicker
    const sameList =
      filteredMerchants.length === nextFiltered.length &&
      filteredMerchants.every((m, i) => m.id === nextFiltered[i]?.id);

    if (!sameList) {
      setFilteredMerchants(nextFiltered);
      setHighlightedIndex(0);
    }

    if (isFocused) {
      const shouldShow = nextFiltered.length > 0;
      if (showDropdown !== shouldShow) {
        setShowDropdown(shouldShow);
      }
    }
  }, [internalValue, merchants, isFocused, showDropdown, filteredMerchants]);

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
    onChange(newValue, undefined, undefined, false); // false = typing, not selection
  };

  const handleSelectMerchant = (merchant: MerchantRecord) => {
    setInternalValue(merchant.name);
    onChange(merchant.name, merchant.id, merchant.address, true); // true = selection from dropdown
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredMerchants.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredMerchants.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredMerchants[highlightedIndex]) {
          handleSelectMerchant(filteredMerchants[highlightedIndex]);
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
    if (filteredMerchants.length > 0) {
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

  // Ensure focus remains on the input while typing even during parent re-renders
  useLayoutEffect(() => {
    if (isFocused && inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus({ preventScroll: true } as any);
      try {
        const val = inputRef.current.value;
        inputRef.current.setSelectionRange(val.length, val.length);
      } catch {}
    }
  }, [internalValue, isFocused]);

  // Initial autoFocus on mount when requested
  useLayoutEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus({ preventScroll: true } as any);
      setIsFocused(true);
      try {
        const val = inputRef.current.value;
        inputRef.current.setSelectionRange(val.length, val.length);
      } catch {}
    }
  }, [autoFocus]);

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
        placeholder="Start typing merchant name..."
        autoComplete="off"
      />
      
      {showDropdown && filteredMerchants.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full top-full bg-white dark:bg-gray-800 border border-border rounded-b-lg shadow-lg max-h-60 overflow-y-auto -mt-px border-t-0"
          style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
        >
          {filteredMerchants.map((merchant, index) => (
            <div
              key={merchant.id}
              onClick={() => handleSelectMerchant(merchant)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`
                px-4 py-3 cursor-pointer transition-colors border-b border-border last:border-b-0
                ${index === highlightedIndex 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-foreground' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-foreground'
                }
              `}
            >
              <div className="font-medium text-sm">{merchant.name}</div>
              {merchant.address && (
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <MdLocationOn className="w-3 h-3" />
                  <span>{merchant.address}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Helper text */}
      {value.trim() && filteredMerchants.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          Press Enter to create a new merchant
        </div>
      )}
    </div>
  );
}
export default React.memo(MerchantAutocomplete);
