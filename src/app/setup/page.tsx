'use client';

import React, { useState } from 'react';
import AIStatusIndicator from '@/components/AIStatusIndicator';

export default function SetupPage() {
  const [demoState, setDemoState] = useState<'idle' | 'analyzing' | 'complete' | 'listing'>('idle');

  const getHeaderText = () => {
    switch (demoState) {
      case 'analyzing':
        return {
          title: 'Setup Ledgee',
          subtitle: 'Configure your AI provider and try the interactive demo to see Ledgee in action.'
        };
      case 'complete':
        return {
          title: 'Setup Ledgee',
          subtitle: 'Configure your AI provider and try the interactive demo to see Ledgee in action.'
        };
      case 'listing':
        return {
          title: 'Setup Complete!',
          subtitle: 'Great job! You\'ve successfully completed the Ledgee demo. You can now start using Ledgee for your invoice processing needs.'
        };
      default:
        return {
          title: 'Setup Ledgee',
          subtitle: 'Configure your AI provider and try the interactive demo to see Ledgee in action.'
        };
    }
  };

  const headerText = getHeaderText();

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-full flex flex-col">
      <div className="space-y-8 flex-1">
        {/* Page Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold brand-gradient">
            {headerText.title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {headerText.subtitle}
          </p>
        </div>

        {/* AI Status & Setup Component */}
        <AIStatusIndicator onDemoStateChange={setDemoState} />
      </div>
    </div>
  );
}

