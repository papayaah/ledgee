'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { agentDb, AgentRecord } from '@/lib/database';
import { MdDelete, MdWarning } from 'react-icons/md';

interface AgentWithCount extends AgentRecord {
  invoiceCount: number;
}

export default function AgentsPage() {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<AgentWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await agentDb.list();
      
      // Get invoice counts for each agent
      const agentsWithCounts = await Promise.all(
        records.map(async (agent) => {
          const invoiceCount = await agentDb.getInvoiceCount(agent.id);
          return { ...agent, invoiceCount };
        })
      );
      
      setItems(agentsWithCounts);
    } catch (error) {
      console.error('Failed to load agents', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    setIsSubmitting(true);
    try {
      await agentDb.create(trimmed);
      await loadAgents();
      setName('');
    } catch (error) {
      console.error('Failed to create agent', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (agent: AgentWithCount) => {
    setEditingId(agent.id);
    setEditName(agent.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    
    const trimmedName = editName.trim();
    if (!trimmedName) {
      alert('Agent name is required');
      return;
    }

    setIsSavingEdit(true);
    try {
      await agentDb.update(editingId, { name: trimmedName });
      await loadAgents();
      setEditingId(null);
      setEditName('');
    } catch (error) {
      console.error('Failed to update agent', error);
      alert('Failed to update agent. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (agent: AgentWithCount) => {
    if (deleteConfirmId === agent.id) {
      // Second click - actually delete
      handleDelete(agent.id);
    } else {
      // First click - show confirmation
      setDeleteConfirmId(agent.id);
    }
  };

  const handleDelete = async (agentId: string) => {
    try {
      await agentDb.remove(agentId);
      await loadAgents();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete agent', error);
    }
  };

  return (
    <div className="max-w-[1920px] mx-auto px-4 py-8 min-h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Track the agents linked to your invoices.
        </p>
      </header>

      <section className="bg-card border border-border rounded-2xl p-6 mb-8 shadow-sm">
        <form onSubmit={handleCreate} className="flex flex-col md:flex-row md:items-center gap-4">
          <input
            type="text"
            className="flex-1 rounded-xl bg-background border border-border px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Agent name"
            value={name}
            onChange={event => setName(event.target.value)}
            disabled={isSubmitting}
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : 'Add Agent'}
          </button>
        </form>
      </section>

      <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="min-w-full text-left text-sm text-foreground">
          <thead className="bg-muted text-muted-foreground uppercase text-xs tracking-wide">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Invoices</th>
              <th className="px-4 py-3 font-semibold w-16"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  Loading agents…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  No agents yet. Add your first agent to get started.
                </td>
              </tr>
            ) : (
              items.map(agent => (
                <React.Fragment key={agent.id}>
                  <tr 
                    className="border-t border-border hover:bg-muted/30 group cursor-pointer transition-colors"
                    onClick={(e) => {
                      // Don't trigger if clicking on delete icon
                      if ((e.target as HTMLElement).closest('button')) {
                        return;
                      }
                      handleEdit(agent);
                    }}
                  >
                    <td className="px-4 py-3">{agent.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {agent.invoiceCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(agent);
                        }}
                        onMouseLeave={() => {
                          if (deleteConfirmId === agent.id) {
                            setDeleteConfirmId(null);
                          }
                        }}
                        className={`
                          p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100
                          ${deleteConfirmId === agent.id 
                            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                            : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                          }
                        `}
                        title={deleteConfirmId === agent.id ? 'Click again to confirm delete' : 'Delete agent'}
                      >
                        {deleteConfirmId === agent.id ? (
                          <MdWarning className="w-5 h-5" />
                        ) : (
                          <MdDelete className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Inline Edit Form */}
                  {editingId === agent.id && (
                    <tr className="bg-muted/50 border-t border-border">
                      <td colSpan={3} className="px-4 py-4">
                        <div className="bg-card rounded-lg p-4 shadow-sm">
                          <h4 className="text-sm font-semibold mb-3">Edit Agent</h4>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Agent name *
                              </label>
                              <input
                                type="text"
                                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                placeholder="Agent name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                disabled={isSavingEdit}
                              />
                            </div>
                            <div className="flex gap-2 mt-5">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition text-sm font-medium"
                                disabled={isSavingEdit}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition text-sm font-semibold disabled:opacity-50"
                                disabled={isSavingEdit}
                              >
                                {isSavingEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
