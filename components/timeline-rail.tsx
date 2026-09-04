'use client';

import React from 'react';
import type { JournalEntry } from '@/lib/types';
import { Plus, BookOpen, LogOut, Trash2, Settings } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { InklumeLogo } from '@/components/inklume-logo';
import { getEntrySnippet, isSessionEmpty } from '@/lib/editor-utils';

interface TimelineRailProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  activeEntry?: JournalEntry | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onOpenDrawer: () => void;
  onOpenSettings?: () => void;
  onRequestDeleteAccount: () => void;
  onRequestDeleteEntry?: (entryId: string) => void;
}

export function TimelineRail({
  entries,
  activeEntryId,
  activeEntry,
  onSelectEntry,
  onNewEntry,
  onOpenDrawer,
  onOpenSettings,
  onRequestDeleteAccount,
  onRequestDeleteEntry,
}: TimelineRailProps) {
  const { user, signOut } = useAuth();

  // Format date helper: e.g. "Oct 12"
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(date);
    } catch {
      return '';
    }
  };

  // Helper to get user initials
  const getInitials = () => {
    if (!user) return 'GA';
    if (user.displayName) {
      const parts = user.displayName.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'GA';
  };

  // Filter entries to only non-empty sessions
  const visibleEntries = React.useMemo(() => {
    return (entries || []).filter((e) => !isSessionEmpty(e));
  }, [entries]);

  // Check if current active session has content before allowing a new one
  const isCurrentEmpty = isSessionEmpty(activeEntry);

  return (
    <aside
      id="timeline-rail"
      aria-label="Journal timeline"
      className="w-72 shrink-0 border-r border-[#211F1C]/10 bg-[#EAE5DA]/40 flex flex-col justify-between h-screen sticky top-0 hidden md:flex select-none"
    >
      {/* Top Header & Actions */}
      <div className="p-6 border-b border-[#211F1C]/10">
        <div className="flex items-center justify-between mb-6">
          <InklumeLogo size="sm" />

          <button
            id="open-history-drawer-btn"
            type="button"
            onClick={onOpenDrawer}
            title="Browse all archive entries"
            className="p-1.5 text-[#211F1C]/50 hover:text-[#211F1C] hover:bg-[#211F1C]/5 rounded transition-colors"
            aria-label="Open all entries archive drawer"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>

        {/* New Reflection Button */}
        <button
          id="new-session-btn"
          type="button"
          onClick={onNewEntry}
          disabled={isCurrentEmpty}
          title={
            isCurrentEmpty
              ? 'Please write in your current session before starting a new reflection'
              : 'Start a new reflection'
          }
          className={`w-full text-center py-2 px-3 text-[11px] font-bold tracking-widest uppercase rounded-full transition-all flex items-center justify-center gap-2 shadow-2xs ${
            isCurrentEmpty
              ? 'border border-[#1F4B43]/15 text-[#1F4B43]/35 opacity-40 cursor-not-allowed bg-transparent'
              : 'text-[#1F4B43] border border-[#1F4B43]/30 hover:bg-[#1F4B43] hover:text-[#FAF7F0] cursor-pointer'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Reflection</span>
        </button>
      </div>

      {/* Timeline entries list - Clean unified list, only non-empty reflections */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {visibleEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#211F1C]/45 font-serif italic leading-relaxed">
            No reflections yet. Write your thoughts to start a session.
          </div>
        ) : (
          visibleEntries.slice(0, 10).map((entry) => {
            const isActive = entry.id === activeEntryId;
            return (
              <div key={entry.id} className="group relative">
                <button
                  id={`timeline-entry-${entry.id}`}
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  className={`w-full text-left transition-all cursor-pointer block border-l-2 pl-4 pr-7 ${
                    isActive
                      ? 'border-[#1F4B43] opacity-100 font-medium'
                      : 'border-transparent opacity-45 hover:opacity-100 transition-opacity'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[#211F1C]/50">
                      {formatDate(entry.createdAt)}
                    </span>
                    {entry.summary && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[#C99A3E]"
                        title="Synthesized insight available"
                      />
                    )}
                  </div>

                  <h4
                    className={`font-serif text-base leading-snug text-[#211F1C] line-clamp-1 ${
                      isActive ? 'font-medium text-[#1F4B43]' : ''
                    }`}
                  >
                    {entry.title || 'Untitled reflection'}
                  </h4>
                  <p className="text-xs font-sans text-[#211F1C]/55 line-clamp-1 mt-0.5">
                    {getEntrySnippet(entry, 70)}
                  </p>
                </button>

                {onRequestDeleteEntry && (
                  <button
                    id={`delete-rail-entry-${entry.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestDeleteEntry(entry.id);
                    }}
                    title="Delete this reflection"
                    className={`absolute right-1 top-2 p-1 text-[#211F1C]/35 hover:text-[#B3432B] hover:bg-[#F9EBE7] rounded transition-all cursor-pointer ${
                      isActive ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    aria-label={`Delete reflection titled ${entry.title || 'Untitled'}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}

        {visibleEntries.length > 10 && (
          <button
            type="button"
            onClick={onOpenDrawer}
            className="w-full text-left pt-2 text-[10px] font-bold uppercase tracking-widest text-[#1F4B43] hover:underline cursor-pointer"
          >
            View all {visibleEntries.length} reflections →
          </button>
        )}
      </div>

      {/* Account & Profile Footer */}
      <div className="p-5 border-t border-[#211F1C]/10 bg-[#EAE5DA]/60 space-y-3">
        <div className="flex items-center justify-between text-xs text-[#211F1C]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-6 h-6 rounded-full bg-[#1F4B43] flex items-center justify-center text-[#FAF7F0] font-bold text-[10px] font-sans tracking-normal shrink-0">
              {getInitials()}
            </div>
            {/* Display username instead of email per user request */}
            <span
              className="truncate max-w-[130px] font-sans text-xs text-[#211F1C] font-semibold"
              title={user?.displayName || (user?.email ? user.email.split('@')[0] : 'Author')}
            >
              {user?.displayName || (user?.email ? user.email.split('@')[0] : 'Author')}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {onOpenSettings && (
              <button
                id="timeline-settings-btn"
                type="button"
                onClick={onOpenSettings}
                title="Preferences & Companion Settings"
                className="p-1.5 text-[#211F1C]/50 hover:text-[#1F4B43] hover:bg-[#211F1C]/5 rounded transition-colors cursor-pointer"
                aria-label="Open settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              id="signout-btn"
              type="button"
              onClick={signOut}
              title="Sign out of journal"
              className="p-1.5 text-[#211F1C]/50 hover:text-[#B3432B] hover:bg-[#211F1C]/5 rounded transition-colors cursor-pointer"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
