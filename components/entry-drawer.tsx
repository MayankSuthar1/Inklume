'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { JournalEntry } from '@/lib/types';
import { X, Search, Trash2, Calendar, FileText, Sparkles, Settings } from 'lucide-react';
import { InklumeLogo } from '@/components/inklume-logo';
import { getEntrySnippet, extractTextFromTipTap, isSessionEmpty } from '@/lib/editor-utils';

interface EntryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onRequestDeleteEntry: (entryId: string) => void;
  onRequestDeleteAccount: () => void;
  onOpenSettings?: () => void;
}

export function EntryDrawer({
  isOpen,
  onClose,
  entries,
  activeEntryId,
  onSelectEntry,
  onRequestDeleteEntry,
  onRequestDeleteAccount,
  onOpenSettings,
}: EntryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Only include non-empty entries
  const validEntries = useMemo(() => {
    return (entries || []).filter((e) => !isSessionEmpty(e));
  }, [entries]);

  // Filter entries based on search query
  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return validEntries;
    return validEntries.filter((entry) => {
      const titleMatch = (entry.title || '').toLowerCase().includes(q);
      const summaryMatch = (entry.summary || '').toLowerCase().includes(q);
      const contentText = extractTextFromTipTap(entry.content).toLowerCase();
      const contentMatch = contentText.includes(q);
      const turnMatch = (entry.turns || []).some((t) =>
        (t.text || '').toLowerCase().includes(q)
      );
      return titleMatch || summaryMatch || contentMatch || turnMatch;
    });
  }, [validEntries, searchQuery]);

  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(isoString));
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="entry-drawer-backdrop"
      className="fixed inset-0 z-50 flex justify-end bg-[#211F1C]/20 backdrop-blur-none transition-opacity duration-200"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Archive entries drawer"
    >
      {/* Drawer Container */}
      <div
        id="entry-drawer-panel"
        className="w-full max-w-md bg-[#FAF7F0] h-full shadow-2xl border-l border-[#211F1C]/10 flex flex-col justify-between overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <header className="p-6 border-b border-[#211F1C]/10 bg-[#FAF7F0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <InklumeLogo size="xs" variant="mark" />
            <div>
              <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#211F1C]/70">
                Inklume Archive
              </h3>
              <p className="text-xs font-serif italic text-[#211F1C]/60 mt-0.5">
                {entries.length} reflections preserved
              </p>
            </div>
          </div>

          <button
            id="close-drawer-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#211F1C]/40 hover:text-[#211F1C] hover:bg-[#211F1C]/5 rounded-full transition-colors"
            aria-label="Close archive drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Search Input Filter */}
        <div className="p-4 border-b border-[#211F1C]/10 bg-[#FAF7F0] shrink-0">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#211F1C]/30 absolute left-3.5 pointer-events-none" />
            <input
              id="search-entries-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across title, summary, or thoughts..."
              aria-label="Search reflections"
              className="w-full pl-9 pr-8 py-2 text-xs font-sans bg-[#F5F1E8] border border-[#211F1C]/10 text-[#211F1C] placeholder-[#211F1C]/30 outline-none focus:border-[#1F4B43] rounded-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 text-[#211F1C]/40 hover:text-[#211F1C]"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Entries List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {filteredEntries.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="font-serif italic text-lg text-[#211F1C]/70">
                {searchQuery ? 'No matching reflections.' : 'Your archive is empty.'}
              </p>
              <p className="text-xs font-sans text-[#211F1C]/40">
                {searchQuery
                  ? 'Try searching with another keyword or date.'
                  : 'Start a conversation on the desk to preserve your first entry.'}
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isActive = entry.id === activeEntryId;
              return (
                <div
                  key={entry.id}
                  id={`archive-item-${entry.id}`}
                  className={`group relative transition-all ${
                    isActive
                      ? 'border-l-2 border-[#1F4B43] pl-4'
                      : 'pl-4 opacity-50 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectEntry(entry);
                        onClose();
                      }}
                      className="flex-1 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold tracking-widest uppercase text-[#211F1C]/40">
                          {formatDate(entry.createdAt)}
                        </span>
                        {entry.summary && (
                          <span className="text-[9px] font-bold tracking-widest uppercase text-[#C99A3E] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#C99A3E]" />
                            <span>Insight</span>
                          </span>
                        )}
                      </div>

                      <h4 className="font-serif text-lg leading-tight text-[#211F1C] mb-1.5 group-hover:text-[#1F4B43] transition-colors">
                        {entry.title || 'Untitled reflection'}
                      </h4>

                      <p className="text-xs font-sans text-[#211F1C]/65 leading-relaxed line-clamp-2">
                        {getEntrySnippet(entry, 140)}
                      </p>
                    </button>

                    {/* Delete Entry Button */}
                    <button
                      id={`delete-entry-btn-${entry.id}`}
                      type="button"
                      onClick={() => onRequestDeleteEntry(entry.id)}
                      title="Delete entry permanently"
                      className="p-1.5 text-[#211F1C]/30 hover:text-[#B3432B] hover:bg-[#F9EBE7] rounded opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                      aria-label={`Delete entry titled ${entry.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer with Account Data Management & Settings */}
        <footer className="p-5 border-t border-[#211F1C]/10 bg-[#FAF7F0] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onOpenSettings && (
              <button
                type="button"
                id="drawer-open-settings-btn"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="text-[10px] font-bold uppercase tracking-widest text-[#1F4B43] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings & Export</span>
              </button>
            )}
          </div>
          <button
            id="drawer-delete-account-btn"
            type="button"
            onClick={() => {
              onClose();
              onRequestDeleteAccount();
            }}
            className="text-[10px] font-bold uppercase tracking-widest text-[#B3432B] opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Data</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
