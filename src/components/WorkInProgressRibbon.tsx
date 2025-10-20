'use client';

import { useState, useEffect } from 'react';

export default function WorkInProgressRibbon() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show ribbon after a short delay to avoid flash
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 right-0 z-50 pointer-events-none" style={{ width: '120px', height: '120px', overflow: 'visible' }}>
      <div className="relative w-full h-full">
        {/* Main Ribbon */}
        <div 
          className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-8 py-2 shadow-lg absolute"
          style={{
            transform: 'rotate(45deg)',
            transformOrigin: 'center',
            top: '20px',
            right: '-35px',
            width: '150px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div className="flex flex-col items-center whitespace-nowrap">
            <span className="text-[14px] leading-tight font-bold">ALPHA</span>
            <span className="text-[10px] leading-tight font-medium">Still Making It Better</span>
          </div>
        </div>
      </div>
    </div>
  );
}
