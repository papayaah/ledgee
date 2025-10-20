'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { MdAdd, MdDashboard, MdReceipt, MdAnalytics, MdSettings, MdClose, MdStore, MdPerson, MdStoreMallDirectory } from 'react-icons/md';
import { useAIProvider } from '@/contexts/AIProviderContext';
import { useAppStateStore } from '@/store/appStateStore';
import { useAIAvailabilityStore } from '@/store/aiAvailabilityStore';
import { db } from '@/lib/database';

export default function FloatingHeader() {
  const pathname = usePathname();
  const { isNavigationExpanded, setIsNavigationExpanded, isDemoActive, setIsDemoActive } = useAppStateStore();
  const [isAutoCollapsed, setIsAutoCollapsed] = useState(false);
  const [showBranding, setShowBranding] = useState(true);
  const [showInvoicesSubmenu, setShowInvoicesSubmenu] = useState(false);

  const { useOnlineGemini } = useAIProvider();
  const { isAvailable: aiAvailable } = useAIAvailabilityStore();

  // Close submenu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showInvoicesSubmenu && !target.closest('.invoices-submenu-container')) {
        setShowInvoicesSubmenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInvoicesSubmenu]);

  // Check if there are any invoices
  const invoices = useLiveQuery(
    async () => {
      try {
        const allInvoices = await db.invoices.toArray();
        return allInvoices;
      } catch (error) {
        console.error('FloatingHeader: Error fetching invoices:', error);
        return [];
      }
    },
    []
  ) || [];

  const hasInvoices = invoices.length > 0;

  // Reset demo state if we have invoices but demo is still active (fix for stuck demo state)
  useEffect(() => {
    if (hasInvoices && isDemoActive) {
      setIsDemoActive(false);
    }
  }, [hasInvoices, isDemoActive, setIsDemoActive]);

  // Auto-collapse on narrow screens (same as webpage breakpoint)
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;

      // Auto-collapse if screen width < 768px (md breakpoint - same as page layouts)
      if (width < 768) {
        setIsAutoCollapsed(true);
      } else {
        setIsAutoCollapsed(false);
      }

      // Hide branding if screen width < 1000px
      if (width < 1000) {
        setShowBranding(false);
      } else {
        setShowBranding(true);
      }
    };

    // Check on mount
    handleResize();

    // Listen for resize events
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  // Determine actual expanded state (user preference AND auto-collapse)
  const actuallyExpanded = isNavigationExpanded && !isAutoCollapsed;

  // Show simplified header (only Ledgee title) during demo, when Chrome AI setup is needed, or when no invoices exist
  const showOnlyTitle = isDemoActive || (!aiAvailable && !useOnlineGemini);
  const showMinimalNav = !hasInvoices && !showOnlyTitle;
  
  if (showOnlyTitle) {
    return (
      <header className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <div className="floating-header rounded-2xl px-4 py-3 transition-all duration-300">
          <div className="flex items-center space-x-2">
            <Image
              src="/logo.png"
              alt="Ledgee Logo"
              width={24}
              height={24}
              className="flex-shrink-0"
            />
            <h1 className="text-sm font-bold text-white leading-tight">
              Ledgee
            </h1>
          </div>
        </div>
      </header>
    );
  }

  // Show minimal navigation (title + add invoice + settings) when no invoices exist
  // Also show minimal nav if we can't determine invoice count (fallback)
  if (showMinimalNav || (invoices === null && !showOnlyTitle)) {
    return (
      <header className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <div className="floating-header rounded-2xl px-4 py-3 transition-all duration-300">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <Image
                src="/logo.png"
                alt="Ledgee Logo"
                width={24}
                height={24}
                className="flex-shrink-0"
              />
              <h1 className="text-sm font-bold text-white leading-tight">
                Ledgee
              </h1>
            </div>
            <Link
              href="/add-invoice"
              className={`flex items-center space-x-1.5 px-2.5 py-2 rounded-lg transition-all duration-200 ${
                pathname === '/add-invoice'
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
              title="Add Invoice"
            >
              <MdAdd className="w-6 h-6" />
              <span className="text-sm font-medium whitespace-nowrap">Add Invoice</span>
            </Link>
            <Link
              href="/settings"
              className={`flex items-center space-x-1.5 px-2.5 py-2 rounded-lg transition-all duration-200 ${
                pathname === '/settings'
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
              title="Settings"
            >
              <MdSettings className="w-6 h-6" />
              <span className="text-sm font-medium whitespace-nowrap">Settings</span>
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const navigationItems = [
    { href: '/', icon: MdDashboard, label: 'Dashboard', active: pathname === '/' },
    { href: '/add-invoice', icon: MdAdd, label: 'Add Invoice', active: pathname === '/add-invoice' },
    { href: '/invoices', icon: MdReceipt, label: 'Invoices', active: pathname === '/invoices' || pathname === '/stores' || pathname === '/merchants' || pathname === '/agents', hasSubmenu: true },
    { href: '/reporting', icon: MdAnalytics, label: 'Reporting', active: pathname === '/reporting' },
    { href: '/settings', icon: MdSettings, label: 'Settings', active: pathname === '/settings' },
  ];

  const submenuItems = [
    { href: '/stores', icon: MdStore, label: 'Stores', active: pathname === '/stores' },
    { href: '/merchants', icon: MdStoreMallDirectory, label: 'Merchants', active: pathname === '/merchants' },
    { href: '/agents', icon: MdPerson, label: 'Agents', active: pathname === '/agents' },
  ];

  return (
    <header className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      <div className="floating-header rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300">
        <div className="flex items-center space-x-2">
          {/* Brand & Collapse/Expand Toggle */}
          <div className="flex items-center space-x-2">
            {/* Collapse/Expand Toggle */}
            <button
              onClick={() => setIsNavigationExpanded(!isNavigationExpanded)}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/10 transition-all duration-200"
              title={actuallyExpanded ? 'Collapse' : isAutoCollapsed ? 'Auto-collapsed (resize window)' : 'Expand'}
            >
              {actuallyExpanded ? (
                <MdClose className="w-6 h-6 text-white" />
              ) : (
                <Image
                  src="/logo.png"
                  alt="Ledgee Logo"
                  width={24}
                  height={24}
                  className="flex-shrink-0"
                />
              )}
            </button>

            {/* Ledgee Branding - Show when expanded and screen >= 1000px */}
            {actuallyExpanded && showBranding && (
              <div className="flex items-center space-x-2">
                <Image
                  src="/logo.png"
                  alt="Ledgee Logo"
                  width={24}
                  height={24}
                  className="flex-shrink-0"
                />
                <h1 className="text-sm font-bold text-white leading-tight">
                  Ledgee
                </h1>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center space-x-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              
              // Special handling for Invoices with submenu
              if (item.hasSubmenu) {
                return (
                  <div key={item.href} className="relative invoices-submenu-container">
                    {/* Submenu - appears upward with floating header style */}
                    {showInvoicesSubmenu && (
                      <div className="absolute bottom-full mb-2 right-0 floating-header rounded-lg shadow-lg overflow-hidden min-w-[180px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                        {submenuItems.map((subItem) => {
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              onClick={() => setShowInvoicesSubmenu(false)}
                              className={`flex items-center space-x-2 px-4 py-3 transition-colors ${
                                subItem.active
                                  ? 'bg-white/30 text-white'
                                  : 'text-white/80 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <SubIcon className="w-5 h-5" />
                              <span className="text-sm font-medium">{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Invoices button with submenu toggle */}
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        onClick={() => setShowInvoicesSubmenu(true)}
                        className={`flex items-center space-x-1.5 px-2.5 py-2 rounded-l-lg transition-all duration-200 ${
                          item.active
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                        title={item.label}
                      >
                        <Icon className="w-6 h-6" />
                        {actuallyExpanded && (
                          <span className="text-sm font-medium whitespace-nowrap">
                            {item.label}
                          </span>
                        )}
                      </Link>
                      <button
                        onClick={() => setShowInvoicesSubmenu(!showInvoicesSubmenu)}
                        className={`flex items-center justify-center px-1.5 py-2 rounded-r-lg border-l border-white/10 transition-all duration-200 ${
                          item.active
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                        title="Show submenu"
                      >
                        <span className="text-xs">▲</span>
                      </button>
                    </div>
                  </div>
                );
              }
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-2.5 py-2 rounded-lg transition-all duration-200 ${
                    item.active
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-6 h-6" />
                  {actuallyExpanded && (
                    <span className="text-sm font-medium whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
