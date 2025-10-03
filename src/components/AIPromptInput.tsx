'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { aiJSONQueryEngine } from '@/lib/ai-json-query';

interface AIQueryResult {
  success: boolean;
  answer?: string;
  data?: any[];
  error?: string;
}

interface AIPromptInputProps {
  onQueryResult?: (result: AIQueryResult) => void;
  disabled?: boolean;
}

export default function AIPromptInput({ onQueryResult, disabled = false }: AIPromptInputProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [exampleQueries, setExampleQueries] = useState<string[]>([]);
  const [examplesLoading, setExamplesLoading] = useState(true);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading || disabled) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const queryResult = await aiJSONQueryEngine.queryInvoices(query.trim());
      setResult(queryResult);
      onQueryResult?.(queryResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process query';
      setError(errorMessage);
      setResult({
        success: false,
        error: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  }, [query, isLoading, disabled, onQueryResult]);

  const handleExampleClick = useCallback((exampleQuery: string) => {
    setQuery(exampleQuery);
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  // Load example queries on component mount
  useEffect(() => {
    const loadExamples = async () => {
      try {
        const examples = await aiJSONQueryEngine.getExampleQueries();
        setExampleQueries(examples.map(q => q.question));
      } catch (error) {
        console.error('Failed to load example queries:', error);
        setExampleQueries(["How many invoices do I have?", "What's my total spending?"]);
      } finally {
        setExamplesLoading(false);
      }
    };

    loadExamples();
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Ask AI About Your Invoices</h2>
        {result && (
          <button
            onClick={clearResult}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="ai-query" className="text-sm font-medium">
            Ask a question about your invoice data
          </label>
          <div className="flex gap-2">
            <input
              id="ai-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Which merchant made the most sales?"
              className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={isLoading || disabled}
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading || disabled}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Ask
                </div>
              ) : (
                'Ask'
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Example queries */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {examplesLoading ? 'Loading examples...' : 'Try these examples based on your data:'}
        </p>
        <div className="flex flex-wrap gap-2">
          {examplesLoading ? (
            <div className="text-xs text-muted-foreground">Generating personalized examples...</div>
          ) : (
            exampleQueries.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                disabled={isLoading || disabled}
                className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded border border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {example}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {result.success ? 'AI Response' : 'Error'}
              </span>
            </div>

            {result.success && result.answer && (
              <div className="bg-muted/50 border border-border rounded-md p-3 text-sm">
                <p className="whitespace-pre-wrap">{result.answer}</p>
              </div>
            )}

            {result.success && result.data && result.data.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium mb-2">Data:</p>
                <div className="bg-muted/30 border border-border rounded-md p-3 text-xs overflow-x-auto">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {!result.success && result.error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                <p>{result.error}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
