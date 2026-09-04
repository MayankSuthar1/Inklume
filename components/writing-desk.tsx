'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { JournalEntry } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { saveJournalEntry } from '@/lib/firebase';
import { InklumeLogo } from '@/components/inklume-logo';
import { DocumentEditor, type SaveStatus, type DocumentEditorRef } from '@/components/document-editor';
import { CompanionChat } from '@/components/companion-chat';
import { extractTextFromTipTap, isSessionEmpty } from '@/lib/editor-utils';
import {
  Menu,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  X,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  GripVertical,
  Sparkles,
  Settings,
} from 'lucide-react';
import { useSettings } from '@/lib/settings-context';

interface WritingDeskProps {
  entry: JournalEntry;
  onUpdateEntry: (updated: JournalEntry) => void;
  onRequestDeleteEntry?: (entryId: string) => void;
  onOpenMobileTimeline: () => void;
  onNewEntry: () => void;
  onOpenSettings?: () => void;
}

export function WritingDesk({
  entry,
  onUpdateEntry,
  onRequestDeleteEntry,
  onOpenMobileTimeline,
  onNewEntry,
  onOpenSettings,
}: WritingDeskProps) {
  const { user } = useAuth();
  const { preferences } = useSettings();

  // Save status indicator: 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isMobileCompanionOpen, setIsMobileCompanionOpen] = useState(false);

  // Desktop companion open/collapsed state
  const [isCompanionOpen, setIsCompanionOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ink-companion-open');
      if (stored !== null) return stored === 'true';
    }
    return true;
  });

  // Desktop companion panel resizable width (clamped between 260px and 620px)
  const [companionWidth, setCompanionWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ink-companion-width');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 700) {
          return parsed;
        }
      }
    }
    return 380;
  });

  const [isResizing, setIsResizing] = useState(false);

  // Sync companion open state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ink-companion-open', String(isCompanionOpen));
    } catch {
      // ignore
    }
  }, [isCompanionOpen]);

  // Sync companion width to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ink-companion-width', String(companionWidth));
    } catch {
      // ignore
    }
  }, [companionWidth]);

  // Drag-to-resize handler for companion panel
  const handleStartResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = window.innerWidth - moveEvent.clientX;
      const minW = 260;
      const maxW = Math.max(300, Math.min(window.innerWidth * 0.55, 660));
      const clamped = Math.max(minW, Math.min(newWidth, maxW));
      setCompanionWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  // Debounce & persistence tracking refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingEntryRef = useRef<JournalEntry>(entry);
  const currentEntryIdRef = useRef<string>(entry.id);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<DocumentEditorRef>(null);

  // Keep pendingEntryRef in sync with entry prop
  useEffect(() => {
    // If entry switched, flush any pending save for the previous entry first
    if (currentEntryIdRef.current !== entry.id) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        // Save pending data of previous entry before switching only if non-empty
        if (user && pendingEntryRef.current && !isSessionEmpty(pendingEntryRef.current)) {
          saveJournalEntry(user.uid, pendingEntryRef.current).catch((err) =>
            console.error('Failed to flush previous entry save:', err)
          );
        }
      }
      currentEntryIdRef.current = entry.id;
      setSaveStatus('idle');
      setSynthesisError(null);
    }
    pendingEntryRef.current = entry;
  }, [entry, user]);

  // Adjust title textarea height dynamically
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, [entry.title, entry.id]);

  // Execute debounced persistence to Firestore
  const executePersist = useCallback(
    async (entryToSave: JournalEntry) => {
      if (!user) return;
      // Do not save empty session
      if (isSessionEmpty(entryToSave)) {
        setSaveStatus('idle');
        return;
      }
      try {
        setSaveStatus('saving');
        await saveJournalEntry(user.uid, entryToSave);
        
        // Remove crash recovery backup on successful save
        try {
          localStorage.removeItem(`ink-draft-${entryToSave.id}`);
        } catch {
          // ignore localStorage error
        }

        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 3000);
      } catch (err) {
        console.error('Save to Firestore failed:', err);
        setSaveStatus('error');
      }
    },
    [user]
  );

  // Schedule debounced autosave (2 seconds after user stops typing)
  const scheduleAutosave = useCallback(
    (updated: JournalEntry) => {
      pendingEntryRef.current = updated;
      onUpdateEntry(updated);
      setSaveStatus('unsaved');

      // Local crash-prevention cache: stores to localStorage immediately
      try {
        if (updated.content) {
          localStorage.setItem(`ink-draft-${updated.id}`, JSON.stringify(updated.content));
        }
      } catch {
        // ignore localStorage error
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        executePersist(pendingEntryRef.current);
      }, 2000);
    },
    [onUpdateEntry, executePersist]
  );

  // Direct persistence (e.g. from chat turns, blur, or Cmd+S)
  const forceImmediateSave = useCallback(
    async (entryToSave?: JournalEntry) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const target = entryToSave || pendingEntryRef.current;
      if (isSessionEmpty(target)) {
        setSaveStatus('idle');
        return;
      }
      await executePersist(target);
    },
    [executePersist]
  );

  // Window beforeunload listener to guarantee no lost text on refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (
        saveStatus === 'unsaved' &&
        user &&
        pendingEntryRef.current &&
        !isSessionEmpty(pendingEntryRef.current)
      ) {
        // Synchronously save or warn
        saveJournalEntry(user.uid, pendingEntryRef.current).catch(() => {});
        e.preventDefault();
        e.returnValue = 'You have unsaved reflections.';
        return 'You have unsaved reflections.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus, user]);

  // Handle document content change from TipTap
  const handleDocumentChange = useCallback(
    (jsonContent: Record<string, any>, _plainText: string) => {
      const updated: JournalEntry = {
        ...pendingEntryRef.current,
        content: jsonContent,
        updatedAt: new Date().toISOString(),
      };
      scheduleAutosave(updated);
    },
    [scheduleAutosave]
  );

  // Handle title change
  const handleTitleChange = (newTitle: string) => {
    const updated: JournalEntry = {
      ...pendingEntryRef.current,
      title: newTitle,
      updatedAt: new Date().toISOString(),
    };
    scheduleAutosave(updated);

    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  };

  const handleTitleBlur = () => {
    forceImmediateSave();
  };

  // Synthesize Core Insight using both document text and thinking companion chat history
  const [synthesizingIds, setSynthesizingIds] = useState<Set<string>>(new Set());

  const isSynthesizing = synthesizingIds.has(entry.id);

  const handleSynthesizeInsight = async () => {
    const targetEntry = pendingEntryRef.current;
    if (!user || synthesizingIds.has(targetEntry.id)) return;

    // Extract current document content text
    const currentDocText = extractTextFromTipTap(targetEntry.content);
    const hasDoc = currentDocText.trim().length > 0;
    const currentTurns = targetEntry.turns || [];
    const hasTurns = currentTurns.length > 0;

    if (!hasDoc && !hasTurns) {
      setSynthesisError('Write some thoughts in the document or dialogue with the companion first.');
      return;
    }

    setSynthesizingIds((prev) => {
      const next = new Set(prev);
      next.add(targetEntry.id);
      return next;
    });
    setSynthesisError(null);

    try {
      const response = await fetch('/api/journal/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          docTitle: targetEntry.title || '',
          docText: currentDocText,
          turns: currentTurns.map((t) => ({ role: t.role, text: t.text })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to synthesize core insight.');
      }

      const currentTitle = targetEntry.title?.trim();
      const shouldAdoptTitle =
        (!currentTitle ||
          currentTitle.toLowerCase() === 'untitled reflection' ||
          currentTitle.toLowerCase() === 'untitled') &&
        data.title;

      const updated: JournalEntry = {
        ...targetEntry,
        title: shouldAdoptTitle ? data.title : targetEntry.title,
        summary: data.summary || '',
        keyInsights: Array.isArray(data.keyInsights) ? data.keyInsights : [],
        updatedAt: new Date().toISOString(),
      };

      // If the user hasn't switched away from this session, merge with pending edits
      if (pendingEntryRef.current.id === targetEntry.id) {
        const newlyUpdated: JournalEntry = {
          ...pendingEntryRef.current,
          title: shouldAdoptTitle ? data.title : pendingEntryRef.current.title,
          summary: data.summary || '',
          keyInsights: Array.isArray(data.keyInsights) ? data.keyInsights : [],
          updatedAt: new Date().toISOString(),
        };
        onUpdateEntry(newlyUpdated);
        pendingEntryRef.current = newlyUpdated;
        await saveJournalEntry(user.uid, newlyUpdated);
        setSaveStatus('saved');
      } else {
        // If the user switched sessions, just update the parent state and firestore
        onUpdateEntry(updated);
        await saveJournalEntry(user.uid, updated);
      }
    } catch (err: any) {
      console.error('Core insight synthesis failed:', err);
      // Only show the error if we're still looking at the same entry
      if (pendingEntryRef.current.id === targetEntry.id) {
        setSynthesisError(err?.message || 'Synthesis unavailable right now.');
      }
    } finally {
      setSynthesizingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetEntry.id);
        return next;
      });
    }
  };

  return (
    <main
      id="writing-desk-main"
      className="flex-1 flex flex-col md:flex-row h-screen overflow-hidden bg-[#F5F1E8] selection:bg-[#1F4B43] selection:text-[#F5F1E8]"
    >
      {/* ============================================================ */}
      {/* MAIN DOCUMENT PANE (Left, ~68-70% width on desktop)           */}
      {/* ============================================================ */}
      <section
        id="main-document-pane"
        aria-label="Journal document editor"
        className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF7F0] relative min-w-0"
      >
        {/* Scrollable Document Body */}
        <div
          id="document-scroll-container"
          className={`flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-8 ${
            preferences.editorWidth === 'narrow'
              ? 'max-w-[740px]'
              : preferences.editorWidth === 'wide'
              ? 'max-w-[1040px]'
              : 'max-w-[864px]'
          } mx-auto w-full no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
        >
          {/* Mobile Top Controls Bar (< md only) */}
          <div className="md:hidden flex items-center justify-between pb-4 mb-4 border-b border-[#211F1C]/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="open-timeline-rail-btn"
                onClick={onOpenMobileTimeline}
                className="p-1.5 text-[#211F1C]/60 hover:text-[#1F4B43] rounded"
                aria-label="Open timeline rail"
              >
                <Menu className="w-4 h-4" />
              </button>
              <InklumeLogo size="xs" variant="mark" />
            </div>

            <div className="flex items-center gap-2">
              {onOpenSettings && (
                <button
                  type="button"
                  id="mobile-settings-btn"
                  onClick={onOpenSettings}
                  className="p-1.5 text-[#211F1C]/60 hover:text-[#1F4B43] rounded"
                  aria-label="Open settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              {/* Mobile Companion Drawer Trigger */}
              <button
                type="button"
                id="mobile-open-companion-btn"
                onClick={() => setIsMobileCompanionOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase text-[#1F4B43] border border-[#1F4B43]/30 rounded-full hover:bg-[#1F4B43] hover:text-[#FAF7F0] transition-all cursor-pointer"
                aria-label="Open thinking companion"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Companion {entry.turns?.length > 0 && `(${entry.turns.length})`}</span>
              </button>
            </div>
          </div>

          {/* Document Title Header */}
          <div className="mb-6">
            <textarea
              ref={titleTextareaRef}
              id="document-title-input"
              rows={1}
              value={entry.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Untitled reflection"
              aria-label="Document reflection title"
              className="w-full text-3xl sm:text-4xl font-serif italic mb-2 leading-tight text-[#211F1C] bg-transparent border-none outline-none placeholder-[#211F1C]/30 tracking-tight resize-none overflow-hidden block break-words whitespace-pre-wrap focus:ring-0 focus:outline-none"
            />
            <div className="flex items-center justify-between text-[10px] font-medium tracking-widest uppercase text-[#211F1C]/45">
              <div className="flex items-center space-x-3">
                <span>
                  {new Date(entry.createdAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>

              {/* Action controls & Save Status */}
              <div className="flex items-center gap-2.5">
                <button
                  id="doc-synthesize-action-btn"
                  type="button"
                  onClick={handleSynthesizeInsight}
                  disabled={isSynthesizing}
                  title={
                    entry.summary
                      ? 'Re-synthesize core insight from current document and companion turns'
                      : 'Request core insight synthesis'
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase text-[#1F4B43] bg-[#EAE5DA]/70 hover:bg-[#1F4B43] hover:text-[#FAF7F0] border border-[#1F4B43]/25 rounded-full transition-all cursor-pointer disabled:opacity-50"
                  aria-label="Request core insight"
                >
                  {isSynthesizing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-[#C99A3E]" />
                      <span>Distilling…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-[#C99A3E]" />
                      <span>{entry.summary ? 'Re-synthesize' : 'Synthesize'}</span>
                    </>
                  )}
                </button>

                {/* Debounced Save Status Indicator */}
                <div
                  id="save-status-indicator"
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#211F1C]/50"
                aria-live="polite"
              >
                {saveStatus === 'unsaved' && (
                  <span className="text-[#C99A3E] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C99A3E] animate-pulse" />
                    <span>Unsaved</span>
                  </span>
                )}
                {saveStatus === 'saving' && (
                  <span className="text-[#1F4B43] flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving…</span>
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-[#1F4B43] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Saved</span>
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-[#B3432B] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Failed</span>
                  </span>
                )}
                {saveStatus === 'idle' && (
                  <span className="text-[#211F1C]/35">Draft</span>
                )}
              </div>
            </div>
          </div>
        </div>

          {/* Synthesis Error Display if any */}
          {synthesisError && (
            <div
              id="doc-synthesis-error"
              className="mb-6 p-3.5 rounded bg-[#F9EBE7] border border-[#B3432B]/20 text-[#B3432B] text-xs flex items-center justify-between"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{synthesisError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSynthesisError(null)}
                className="text-xs font-bold underline ml-3 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Document Section: Core Insight Display (Only shown when requested or present) */}
          {(entry.summary || isSynthesizing) && (
            <section
              id="doc-core-insight-card"
              aria-label="Core Insight and Synthesis"
              className="mb-8 p-5 bg-[#FAF7F0] border border-[#211F1C]/15 rounded-md shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#C99A3E]" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#C99A3E]">
                    Core Insight
                  </span>
                  <span className="text-[9px] font-medium tracking-wider uppercase text-[#211F1C]/40 hidden sm:inline">
                    (Document & Dialogue Synthesis)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    id="doc-insight-clear-btn"
                    onClick={() => {
                      const cleared: JournalEntry = {
                        ...pendingEntryRef.current,
                        summary: '',
                        keyInsights: [],
                        updatedAt: new Date().toISOString(),
                      };
                      onUpdateEntry(cleared);
                      pendingEntryRef.current = cleared;
                      scheduleAutosave(cleared);
                    }}
                    className="text-[10px] font-medium uppercase tracking-wider text-[#211F1C]/35 hover:text-[#B3432B] transition-colors cursor-pointer"
                    title="Clear insight"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {isSynthesizing && !entry.summary ? (
                <div className="flex items-center gap-2.5 py-4 text-xs text-[#1F4B43]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#C99A3E]" />
                  <span className="font-serif italic text-sm text-[#211F1C]/70">
                    Distilling core reflection from your document and dialogue…
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-base sm:text-lg font-serif italic text-[#211F1C]/90 leading-relaxed mb-3">
                    &ldquo;{entry.summary}&rdquo;
                  </p>

                  {entry.keyInsights && entry.keyInsights.length > 0 && (
                    <div className="pt-2.5 border-t border-[#211F1C]/8">
                      <span className="text-[9px] font-bold tracking-wider uppercase text-[#211F1C]/45 block mb-1.5">
                        Key Distillations:
                      </span>
                      <ul className="space-y-1 text-xs font-serif text-[#211F1C]/75">
                        {entry.keyInsights.map((insight, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[#C99A3E] font-bold mt-0.5">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* Primary Rich-Text Document Surface (TipTap ProseMirror) */}
          <DocumentEditor
            key={entry.id}
            entryId={entry.id}
            initialContent={entry.content}
            onContentChange={handleDocumentChange}
            onForceSave={forceImmediateSave}
            editorRef={editorRef}
            companionTurns={entry.turns}
            userId={user?.uid}
          />
        </div>
      </section>

      {/* ============================================================ */}
      {/* SIDE COMPANION PANE (Right, resizable & collapsable)        */}
      {/* ============================================================ */}
      {/* Vertical Resize Handle */}
      {isCompanionOpen && (
        <div
          id="companion-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize companion panel"
          title="Drag to resize companion panel"
          onMouseDown={handleStartResize}
          className={`hidden md:flex w-2 -ml-1 cursor-col-resize select-none shrink-0 transition-colors items-center justify-center group z-10 ${
            isResizing ? 'bg-[#1F4B43]' : 'bg-transparent hover:bg-[#1F4B43]/15'
          }`}
        >
          <div
            className={`w-[2px] h-8 rounded-full transition-colors ${
              isResizing ? 'bg-[#FAF7F0]' : 'bg-[#211F1C]/20 group-hover:bg-[#1F4B43]'
            }`}
          />
        </div>
      )}

      {/* Resizable Desktop Companion Pane with Smooth Transition */}
      <div
        id="desktop-companion-container"
        style={{ width: isCompanionOpen ? `${companionWidth}px` : '0px' }}
        className={`hidden md:flex shrink-0 border-l border-[#211F1C]/10 h-full flex-col bg-[#F0EBE0] overflow-hidden ${
          isResizing ? '' : 'transition-[width,opacity] duration-300 ease-in-out'
        } ${isCompanionOpen ? 'opacity-100' : 'border-l-0 opacity-0 pointer-events-none'}`}
      >
        <div style={{ width: `${companionWidth}px` }} className="h-full flex flex-col shrink-0">
          <CompanionChat
            entry={entry}
            onUpdateEntry={onUpdateEntry}
            onPersistEntry={forceImmediateSave}
            onCloseDesktop={() => setIsCompanionOpen(false)}
            onOpenSettings={onOpenSettings}
            isDesktopOpen={isCompanionOpen}
          />
        </div>
      </div>

      {/* Re-open Companion Button on desktop (smooth top-right toggle) */}
      {!isCompanionOpen && (
        <button
          type="button"
          id="hide-companion-desktop-btn"
          onClick={() => setIsCompanionOpen(true)}
          className="hidden md:flex absolute top-3.5 right-4 z-20 p-1.5 text-[#211F1C]/60 hover:text-[#1F4B43] hover:bg-[#EAE5DA] bg-[#F0EBE0] border border-[#211F1C]/15 rounded-md shadow-xs transition-all duration-200 cursor-pointer items-center justify-center group animate-in fade-in"
          title="Open thinking companion"
          aria-label="Open thinking companion"
        >
          <PanelRightOpen className="w-4 h-4 text-[#1F4B43] transition-transform group-hover:scale-105" />
        </button>
      )}

      {/* ============================================================ */}
      {/* MOBILE COMPANION DRAWER / SLIDE-OVER (<768px)               */}
      {/* ============================================================ */}
      {isMobileCompanionOpen && (
        <div
          id="mobile-companion-backdrop"
          className="fixed inset-0 z-50 bg-[#211F1C]/40 backdrop-blur-xs flex justify-end md:hidden"
          onClick={() => setIsMobileCompanionOpen(false)}
        >
          <div
            id="mobile-companion-sheet"
            className="w-full max-w-sm h-full bg-[#F0EBE0] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <CompanionChat
              entry={entry}
              onUpdateEntry={onUpdateEntry}
              onPersistEntry={forceImmediateSave}
              onCloseMobile={() => setIsMobileCompanionOpen(false)}
              onOpenSettings={onOpenSettings}
              isMobileDrawer
            />
          </div>
        </div>
      )}
    </main>
  );
}
