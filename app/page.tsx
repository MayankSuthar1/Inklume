'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SettingsProvider } from '@/lib/settings-context';
import { LandingView } from '@/components/landing-view';
import { WritingDesk } from '@/components/writing-desk';
import { TimelineRail } from '@/components/timeline-rail';
import { EntryDrawer } from '@/components/entry-drawer';
import { SettingsDialog } from '@/components/settings-dialog';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';
import type { JournalEntry } from '@/lib/types';
import {
  subscribeToUserEntries,
  saveJournalEntry,
  deleteJournalEntry,
  deleteAllUserEntries,
} from '@/lib/firebase';
import { isSessionEmpty } from '@/lib/editor-utils';
import { Loader2 } from 'lucide-react';

function createNewEntry(userId: string): JournalEntry {
  return {
    id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId,
    title: 'Untitled reflection',
    content: null,
    summary: '',
    keyInsights: [],
    tags: [],
    turns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
  };
}

function JournalApp() {
  const { user, loading: authLoading, deleteAccountAndData } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);

  // Modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: 'entry' | 'all-entries' | 'account';
    entryId?: string;
    title?: string;
  }>({
    isOpen: false,
    type: 'entry',
  });

  // Subscribe to entries when user is logged in
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);

        // Manage activeEntry
        setActiveEntry((current) => {
          if (!current) {
            // If there's an existing entry, select the most recent one; otherwise create fresh
            return fetchedEntries.length > 0 ? fetchedEntries[0] : createNewEntry(user.uid);
          }
          // If current is an empty draft not yet saved, keep it
          if (isSessionEmpty(current) && !fetchedEntries.some((e) => e.id === current.id)) {
            return current;
          }
          // If current was updated in Firestore, update it, else keep it
          const match = fetchedEntries.find((e) => e.id === current.id);
          return match || current;
        });
      },
      (err) => {
        console.error('Failed to subscribe to entries:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Handle creating a new entry
  const handleNewEntry = useCallback(() => {
    if (!user) return;
    const fresh = createNewEntry(user.uid);
    setActiveEntry(fresh);
  }, [user]);

  // Handle updating an entry
  const handleUpdateEntry = useCallback(
    (updated: JournalEntry) => {
      setActiveEntry(updated);
      if (user && !isSessionEmpty(updated)) {
        saveJournalEntry(user.uid, updated).catch((err) => {
          console.error('Error saving entry:', err);
        });
      }
    },
    [user]
  );

  // Handle switching active entry
  const handleSelectEntry = useCallback((entry: JournalEntry) => {
    setActiveEntry(entry);
    setIsDrawerOpen(false);
  }, []);

  // Handle entry deletion requests
  const handleRequestDeleteEntry = useCallback(
    (entryId: string) => {
      const target = entries.find((e) => e.id === entryId) || (activeEntry?.id === entryId ? activeEntry : null);
      setDeleteModalState({
        isOpen: true,
        type: 'entry',
        entryId,
        title: target?.title || 'this reflection',
      });
    },
    [entries, activeEntry]
  );

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(async () => {
    if (!user) return;

    if (deleteModalState.type === 'entry' && deleteModalState.entryId) {
      const entryId = deleteModalState.entryId;
      await deleteJournalEntry(user.uid, entryId);
      if (activeEntry?.id === entryId) {
        const remaining = entries.filter((e) => e.id !== entryId);
        setActiveEntry(remaining.length > 0 ? remaining[0] : createNewEntry(user.uid));
      }
    } else if (deleteModalState.type === 'all-entries') {
      await deleteAllUserEntries(user.uid);
      setEntries([]);
      setActiveEntry(createNewEntry(user.uid));
    } else if (deleteModalState.type === 'account') {
      await deleteAccountAndData();
    }

    setDeleteModalState((prev) => ({ ...prev, isOpen: false }));
  }, [user, deleteModalState, activeEntry, entries, deleteAccountAndData]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center p-6 text-[#211F1C]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1F4B43] mb-4" />
        <p className="font-serif italic text-base text-[#211F1C]/70">Opening desk…</p>
      </div>
    );
  }

  if (!user) {
    return <LandingView />;
  }

  // Ensure an active entry exists
  const currentEntry = activeEntry || createNewEntry(user.uid);

  return (
    <div className="flex h-screen w-full bg-[#FAF7F0] overflow-hidden">
      {/* Desktop Left Timeline Rail */}
      <TimelineRail
        entries={entries}
        activeEntryId={currentEntry.id}
        activeEntry={currentEntry}
        onSelectEntry={handleSelectEntry}
        onNewEntry={handleNewEntry}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRequestDeleteAccount={() =>
          setDeleteModalState({ isOpen: true, type: 'account', title: 'your entire account' })
        }
        onRequestDeleteEntry={handleRequestDeleteEntry}
      />

      {/* Center & Right: Main Writing Desk */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <WritingDesk
          entry={currentEntry}
          onUpdateEntry={handleUpdateEntry}
          onRequestDeleteEntry={handleRequestDeleteEntry}
          onOpenMobileTimeline={() => setIsDrawerOpen(true)}
          onNewEntry={handleNewEntry}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* Mobile Drawer / Archive Search */}
      <EntryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        entries={entries}
        activeEntryId={currentEntry.id}
        onSelectEntry={handleSelectEntry}
        onRequestDeleteEntry={handleRequestDeleteEntry}
        onRequestDeleteAccount={() =>
          setDeleteModalState({ isOpen: true, type: 'account', title: 'your entire account' })
        }
        onOpenSettings={() => {
          setIsDrawerOpen(false);
          setIsSettingsOpen(true);
        }}
      />

      {/* Settings Modal */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeEntry={currentEntry}
        entries={entries}
        onRequestDeleteAllEntries={() => {
          setIsSettingsOpen(false);
          setDeleteModalState({
            isOpen: true,
            type: 'all-entries',
            title: 'all your reflections',
          });
        }}
        onRequestDeleteAccount={() => {
          setIsSettingsOpen(false);
          setDeleteModalState({
            isOpen: true,
            type: 'account',
            title: 'your entire account',
          });
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmDialog
        isOpen={deleteModalState.isOpen}
        type={deleteModalState.type}
        title={deleteModalState.title}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default function Page() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <JournalApp />
      </SettingsProvider>
    </AuthProvider>
  );
}
