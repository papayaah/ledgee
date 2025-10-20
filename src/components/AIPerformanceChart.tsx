'use client';

import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { MdSpeed, MdTimeline, MdBarChart, MdPieChart } from 'react-icons/md';

export default function AIPerformanceChart() {
  const [viewMode, setViewMode] = useState<'bar' | 'pie'>('bar');
  
  const invoices = useLiveQuery(
    async () => {
      const allInvoices = await db.invoices.toArray();
      return allInvoices.filter(inv => inv.aiExtractedFrom === 'image' && inv.aiResponseTime);
    },
    []
  ) || [];

  // Helper function to format milliseconds to seconds
  const formatTime = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const stats = useMemo(() => {
    const byModel: { [key: string]: { count: number; totalTime: number; times: number[] } } = {};
    
    invoices.forEach(invoice => {
      const model = invoice.aiModel || 'unknown';
      if (!byModel[model]) {
        byModel[model] = { count: 0, totalTime: 0, times: [] };
      }
      byModel[model].count++;
      byModel[model].totalTime += invoice.aiResponseTime || 0;
      byModel[model].times.push(invoice.aiResponseTime || 0);
    });

    const chartData = Object.entries(byModel).map(([model, data]) => ({
      name: model === 'chrome-builtin' ? 'Chrome AI' : model === 'gemini-api' ? 'Gemini API' : 'Unknown',
      avgTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0,
      avgTimeSec: data.count > 0 ? (data.totalTime / data.count) / 1000 : 0,
      count: data.count,
      minTime: Math.min(...data.times),
      maxTime: Math.max(...data.times)
    }));

    const pieData = Object.entries(byModel).map(([model, data]) => ({
      name: model === 'chrome-builtin' ? 'Chrome AI' : model === 'gemini-api' ? 'Gemini API' : 'Unknown',
      value: data.count
    }));

    return { chartData, pieData, totalExtracted: invoices.length, formatTime };
  }, [invoices]);

  if (stats.totalExtracted === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <MdSpeed className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-semibold">AI Performance</h2>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <MdTimeline className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No AI-extracted invoices yet</p>
          <p className="text-xs mt-1">Performance metrics will appear after you extract invoices</p>
        </div>
      </div>
    );
  }

  const COLORS = ['#c4b5fd', '#fcd34d', '#6ee7b7'];

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <MdSpeed className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-semibold">AI Performance</h2>
          <span className="text-sm text-muted-foreground">
            ({stats.totalExtracted} extracted)
          </span>
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'bar' ? 'pie' : 'bar')}
          className="p-2 rounded-md hover:bg-muted transition-colors"
          title={viewMode === 'bar' ? 'Switch to pie chart' : 'Switch to bar chart'}
        >
          {viewMode === 'bar' ? (
            <MdPieChart className="w-5 h-5 text-primary" />
          ) : (
            <MdBarChart className="w-5 h-5 text-primary" />
          )}
        </button>
      </div>

      {viewMode === 'bar' ? (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-center">Average Response Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 11 }} 
                stroke="#6b7280"
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                stroke="#6b7280"
                label={{ value: 'Time (s)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                tickFormatter={(value) => value.toFixed(1)}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: 12 }}
                formatter={(value: number) => [`${value.toFixed(1)}s`, 'Avg Time']}
              />
              <Bar dataKey="avgTimeSec" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          
          {/* Stats table */}
          <div className="mt-3 space-y-1">
            {stats.chartData.map((data, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
                <span className="font-medium">{data.name}:</span>
                <span className="text-muted-foreground">
                  {data.count} invoices, {stats.formatTime(data.minTime)} - {stats.formatTime(data.maxTime)} range
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-center">Usage by AI Model</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={stats.pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent, value }: any) => 
                  `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                }
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
              >
                {stats.pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Summary stats */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                {stats.formatTime(Math.round(stats.chartData.reduce((sum, d) => sum + d.avgTime, 0) / stats.chartData.length) || 0)}
              </div>
              <div className="text-xs text-muted-foreground">Overall Avg</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">
                {stats.totalExtracted}
              </div>
              <div className="text-xs text-muted-foreground">AI Extracted</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

