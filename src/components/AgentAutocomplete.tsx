'use client';

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { agentDb, AgentRecord } from '@/lib/database';
import { MdPerson } from 'react-icons/md';

interface AgentAutocompleteProps {
  value: string;
  onChange: (value: string, agentId?: string, isSelection?: boolean) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

function AgentAutocomplete({
  value,
  onChange,
  onBlur,
  disabled = false,
  className = '',
  autoFocus = false
}: AgentAutocompleteProps) {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredAgents, setFilteredAgents] = useState<AgentRecord[]>([]);
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

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const records = await agentDb.list();
        setAgents(records);
      } catch (error) {
        console.error('Failed to load agents:', error);
      }
    };
    loadAgents();
  }, []);

  // Filter agents when input changes
  useEffect(() => {
    const term = internalValue.trim().toLowerCase();
    if (!term) {
      if (filteredAgents.length) setFilteredAgents([]);
      if (isFocused && showDropdown) {
        setShowDropdown(false);
      }
      return;
    }

    const nextFiltered = agents.filter(agent => 
      agent.name.toLowerCase().includes(term)
    );

    // Shallow compare by id to avoid unnecessary list resets
    const sameList =
      filteredAgents.length === nextFiltered.length &&
      filteredAgents.every((a, i) => a.id === nextFiltered[i]?.id);

    if (!sameList) {
      setFilteredAgents(nextFiltered);
      setHighlightedIndex(0);
    }

    if (isFocused) {
      const shouldShow = nextFiltered.length > 0;
      if (showDropdown !== shouldShow) {
        setShowDropdown(shouldShow);
      }
    }
  }, [internalValue, agents, isFocused, showDropdown, filteredAgents]);

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
    onChange(newValue, undefined, false); // false = typing, not selection
  };

  const handleSelectAgent = (agent: AgentRecord) => {
    setInternalValue(agent.name);
    onChange(agent.name, agent.id, true); // true = selection from dropdown
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredAgents.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredAgents.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredAgents[highlightedIndex]) {
          handleSelectAgent(filteredAgents[highlightedIndex]);
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
    if (filteredAgents.length > 0) {
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
        placeholder="Start typing agent name..."
        autoComplete="off"
      />
      
      {showDropdown && filteredAgents.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full top-full bg-white dark:bg-gray-800 border border-border rounded-b-lg shadow-lg max-h-60 overflow-y-auto -mt-px border-t-0"
          style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
        >
          {filteredAgents.map((agent, index) => (
            <div
              key={agent.id}
              onClick={() => handleSelectAgent(agent)}
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
                <MdPerson className="w-4 h-4 text-muted-foreground" />
                {agent.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Helper text */}
      {value.trim() && filteredAgents.length === 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          Press Enter to create a new agent
        </div>
      )}
    </div>
  );
}

export default React.memo(AgentAutocomplete);

