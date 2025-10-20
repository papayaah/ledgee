'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

export default function AboutPullout() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <>
      {/* Pullout tab */}
      <button
        aria-label="About Ledgee"
        onClick={() => setOpen(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          fixed right-0 bottom-28 md:bottom-32 z-60
          transition-all duration-300 ease-out
          ${hovered 
            ? 'translate-x-0 rotate-0' 
            : 'translate-x-[90%] -rotate-3'
          }
          shadow-xl rounded-xl bg-white/95 hover:bg-white
          border border-border
        `}
        style={{ width: 112, height: 152 }}
      >
        <div className="relative w-full h-full overflow-hidden rounded-xl">
          {/* Polaroid style */}
          <div className="absolute inset-0 bg-white z-0" />
          <div className="p-2 relative z-10">
            <div className="rounded-md overflow-hidden shadow-sm">
              <Image
                src="/family.jpg"
                alt="Family inspiration photo"
                width={108}
                height={96}
                className="w-full h-24 object-cover"
                priority
              />
            </div>
            <div className="mt-2 text-[10px] tracking-wide font-semibold text-center">
              <span className="text-muted-foreground mr-1">MADE WITH</span>
              <span className="text-red-600">❤</span>
            </div>
          </div>
        </div>
      </button>

      {/* About modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div
            ref={dialogRef}
            className="relative bg-background rounded-2xl shadow-2xl border border-border max-w-2xl w-[92%] md:w-[720px] p-6 md:p-8 z-10"
          >
            <button
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close about dialog"
            >
              ×
            </button>

            <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 items-start">
              <div className="hidden md:block">
                <div className="bg-white rounded-xl shadow-md p-2 rotate-[-3deg]">
                  <Image
                    src="/family.jpg"
                    alt="Family inspiration"
                    width={160}
                    height={200}
                    className="w-full h-auto rounded-md object-cover"
                  />
                  <div className="mt-2 text-[11px] text-center font-semibold">
                    <span className="text-red-600">❤</span>
                    <span className="ml-1 text-muted-foreground">My Inspiration</span>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-3">About Ledgee</h2>
                <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                  <p>
                    I built Ledgee to make extracting invoice data simple, fast, and privacy‑first. Perfect for mom-and-pop shops, 
                    small businesses, and local retailers who need reliable invoice processing without internet dependency. 
                    This app brings the best of Chrome's built-in AI and a clean workflow to help you move faster.
                  </p>
                  <p>
                    Your data stays on your device. There are no servers involved unless you explicitly enable Online
                    Gemini with your own API key. Works completely offline and syncs to Google Sheets when you're ready.
                    You control what runs and where it runs.
                  </p>
                  <p>
                    I hope this saves you time and adds a bit of delight to your workflow. If it helps you in any way,
                    that means a lot to me.
                  </p>
                  
                  <div className="mt-6 pt-4 border-t border-border">
                    <h3 className="font-semibold text-foreground mb-3">Support & Resources</h3>
                    <div className="space-y-2">
                      <p>
                        <strong>Support:</strong>{' '}
                        <a 
                          href="https://strostudio.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          https://strostudio.com
                        </a>
                      </p>
                      <p>
                        <strong>GitHub:</strong>{' '}
                        <a 
                          href="https://github.com/papayaah/ledgee" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          https://github.com/papayaah/ledgee
                        </a>
                      </p>
                      <p>
                        <strong>Follow:</strong>{' '}
                        <a 
                          href="https://x.com/papayaahtries" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          @papayaahtries
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}


