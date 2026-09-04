'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Sliders,
  Type,
  Download,
  Trash2,
  ShieldCheck,
  Check,
  FileText,
  FileCode,
  Archive,
  BookOpen,
  Info,
  RotateCcw,
} from 'lucide-react';
import { useSettings } from '@/lib/settings-context';
import type { JournalEntry, CompanionSettings, AppPreferences } from '@/lib/types';
import {
  formatEntryAsMarkdown,
  formatEntryAsPlainText,
  formatAllEntriesAsMarkdown,
  triggerFileDownload,
  countWordsAndChars,
  extractTextFromTipTap,
} from '@/lib/editor-utils';
import { InklumeLogo } from '@/components/inklume-logo';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activeEntry: JournalEntry | null;
  entries: JournalEntry[];
  onRequestDeleteAllEntries: () => void;
  onRequestDeleteAccount: () => void;
}

type TabType = 'companion' | 'appearance' | 'export' | 'privacy';

export function SettingsDialog({
  isOpen,
  onClose,
  activeEntry,
  entries,
  onRequestDeleteAllEntries,
  onRequestDeleteAccount,
}: SettingsDialogProps) {
  const { preferences, updatePreferences, updateCompanionSettings, resetPreferences } = useSettings();
  const [activeTab, setActiveTab] = useState<TabType>('companion');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setExportNotice(msg);
    setTimeout(() => {
      setExportNotice(null);
    }, 3000);
  };

  // Export handlers
  const handleExportSingleMarkdown = () => {
    if (!activeEntry) return;
    const md = formatEntryAsMarkdown(activeEntry);
    const safeTitle = (activeEntry.title || 'untitled-reflection')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const dateStr = new Date(activeEntry.createdAt).toISOString().split('T')[0];
    triggerFileDownload(`${safeTitle}-${dateStr}.md`, md, 'text/markdown');
    showFeedback('Active reflection exported as Markdown');
  };

  const handleExportSinglePlainText = () => {
    if (!activeEntry) return;
    const txt = formatEntryAsPlainText(activeEntry);
    const safeTitle = (activeEntry.title || 'untitled-reflection')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const dateStr = new Date(activeEntry.createdAt).toISOString().split('T')[0];
    triggerFileDownload(`${safeTitle}-${dateStr}.txt`, txt, 'text/plain');
    showFeedback('Active reflection exported as Plain Text');
  };

  const handleExportSingleJSON = () => {
    if (!activeEntry) return;
    const jsonStr = JSON.stringify(activeEntry, null, 2);
    const safeTitle = (activeEntry.title || 'untitled-reflection')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const dateStr = new Date(activeEntry.createdAt).toISOString().split('T')[0];
    triggerFileDownload(`${safeTitle}-${dateStr}.json`, jsonStr, 'application/json');
    showFeedback('Active reflection exported as JSON');
  };

  const handleExportAllMarkdown = () => {
    if (entries.length === 0) return;
    const md = formatAllEntriesAsMarkdown(entries);
    const dateStr = new Date().toISOString().split('T')[0];
    triggerFileDownload(`inklume-reflections-anthology-${dateStr}.md`, md, 'text/markdown');
    showFeedback(`All ${entries.length} reflections exported as Markdown archive`);
  };

  const handleExportAllJSON = () => {
    if (entries.length === 0) return;
    const backupData = {
      exportedAt: new Date().toISOString(),
      totalEntries: entries.length,
      entries,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    triggerFileDownload(`inklume-complete-backup-${dateStr}.json`, jsonStr, 'application/json');
    showFeedback(`Full backup of ${entries.length} reflections exported as JSON`);
  };

  return (
    <div
      id="settings-dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#211F1C]/40 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div
        id="settings-dialog-panel"
        className="w-full max-w-2xl max-h-[90vh] bg-[#FAF7F0] border border-[#211F1C]/15 shadow-2xl rounded-xl flex flex-col overflow-hidden text-[#211F1C]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-[#211F1C]/10 flex items-center justify-between bg-[#FAF7F0] shrink-0">
          <div className="flex items-center gap-2.5">
            <InklumeLogo size="xs" variant="mark" />
            <div>
              <h2
                id="settings-dialog-title"
                className="font-serif italic text-xl sm:text-2xl text-[#211F1C] tracking-tight leading-none"
              >
                Preferences &amp; Companion
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#211F1C]/45 mt-1">
                Personalized Writing Sanctuary
              </p>
            </div>
          </div>

          <button
            id="close-settings-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#211F1C]/50 hover:text-[#211F1C] hover:bg-[#211F1C]/5 rounded-md transition-colors cursor-pointer"
            aria-label="Close preferences dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Tab Navigation */}
        <nav className="flex items-center border-b border-[#211F1C]/10 bg-[#F5F1E8]/60 px-6 gap-1 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('companion')}
            className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'companion'
                ? 'border-[#1F4B43] text-[#1F4B43]'
                : 'border-transparent text-[#211F1C]/50 hover:text-[#211F1C]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Companion</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'appearance'
                ? 'border-[#1F4B43] text-[#1F4B43]'
                : 'border-transparent text-[#211F1C]/50 hover:text-[#211F1C]'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Desk &amp; Type</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'export'
                ? 'border-[#1F4B43] text-[#1F4B43]'
                : 'border-transparent text-[#211F1C]/50 hover:text-[#211F1C]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export &amp; Backup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'border-[#B3432B] text-[#B3432B]'
                : 'border-transparent text-[#211F1C]/50 hover:text-[#B3432B]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Data &amp; Danger Zone</span>
          </button>
        </nav>

        {/* Feedback Banner */}
        {exportNotice && (
          <div className="px-6 py-2 bg-[#1F4B43] text-[#FAF7F0] text-xs font-sans flex items-center gap-2 transition-all animate-in fade-in">
            <Check className="w-3.5 h-3.5 text-[#C99A3E]" />
            <span>{exportNotice}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* TAB 1: COMPANION */}
          {activeTab === 'companion' && (
            <div className="space-y-6">
              {/* Response Length */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#211F1C]/70 block mb-2">
                  Reflection Depth &amp; Response Length
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'concise', label: 'Concise', sub: '1-2 brief sentences & 1 question' },
                    { id: 'balanced', label: 'Balanced', sub: '2-3 thoughtful paragraphs' },
                    { id: 'inDepth', label: 'Expansive', sub: 'Substantive exploration of nuances' },
                  ].map((len) => {
                    const isSelected = preferences.companion.responseLength === len.id;
                    return (
                      <button
                        key={len.id}
                        type="button"
                        onClick={() =>
                          updateCompanionSettings({
                            responseLength: len.id as CompanionSettings['responseLength'],
                          })
                        }
                        className={`p-3 text-left rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1F4B43]/5 border-[#1F4B43] font-medium'
                            : 'bg-[#F5F1E8]/50 border-[#211F1C]/10 hover:bg-[#F5F1E8]'
                        }`}
                      >
                        <span className="block text-xs font-bold text-[#211F1C]">{len.label}</span>
                        <span className="block text-[10px] text-[#211F1C]/60 mt-0.5 leading-tight">
                          {len.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Guidance Instructions */}
              <div className="pt-4 border-t border-[#211F1C]/10">
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="custom-companion-guidance"
                    className="text-[11px] font-bold uppercase tracking-widest text-[#211F1C]/70"
                  >
                    Custom Thinking Partner Guidance
                  </label>
                  <span className="text-[10px] text-[#211F1C]/45">
                    {preferences.companion.customGuidance.length}/300
                  </span>
                </div>
                <textarea
                  id="custom-companion-guidance"
                  rows={2}
                  maxLength={300}
                  value={preferences.companion.customGuidance}
                  onChange={(e) => updateCompanionSettings({ customGuidance: e.target.value })}
                  placeholder="e.g., Encourage me to view problems through a stoic lens; challenge my self-doubt; ask about practical next steps."
                  className="w-full px-3.5 py-2.5 text-xs font-sans bg-[#F5F1E8] border border-[#211F1C]/15 rounded-lg focus:border-[#1F4B43] focus:ring-1 focus:ring-[#1F4B43] outline-none text-[#211F1C] placeholder-[#211F1C]/35 leading-relaxed resize-none"
                />
                <p className="text-[10px] text-[#211F1C]/50 mt-1">
                  Optional personal instructions added to the companion&apos;s demeanor for every turn.
                </p>
              </div>

              {/* Proactive Prompts Toggle */}
              <div className="pt-4 border-t border-[#211F1C]/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#211F1C]">
                    Prompt Starters in Dialogue
                  </h4>
                  <p className="text-[11px] text-[#211F1C]/60">
                    Display quick reflection starter chips when the conversation is quiet.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateCompanionSettings({
                      showSuggestions: !preferences.companion.showSuggestions,
                    })
                  }
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    preferences.companion.showSuggestions ? 'bg-[#1F4B43]' : 'bg-[#211F1C]/20'
                  }`}
                  aria-label="Toggle prompt suggestion chips"
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      preferences.companion.showSuggestions ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE & DESK */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Typeface */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#211F1C]/70 block mb-2">
                  Document Typeface Family
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'serif', title: 'Editorial Serif', sample: 'Literary & Contemplative' },
                    { id: 'sans', title: 'Modern Sans', sample: 'Clean & Minimalist' },
                    { id: 'mono', title: 'Typewriter Mono', sample: 'Deliberate & Distraction-free' },
                  ].map((font) => {
                    const isSelected = preferences.editorFont === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() =>
                          updatePreferences({
                            editorFont: font.id as AppPreferences['editorFont'],
                          })
                        }
                        className={`p-3.5 text-left rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1F4B43]/5 border-[#1F4B43] shadow-xs ring-1 ring-[#1F4B43]'
                            : 'bg-[#F5F1E8]/50 border-[#211F1C]/10 hover:bg-[#F5F1E8]'
                        }`}
                      >
                        <span className="block text-xs font-bold text-[#211F1C]">{font.title}</span>
                        <span
                          className={`block text-sm text-[#211F1C]/80 mt-1 ${
                            font.id === 'serif'
                              ? 'font-serif italic'
                              : font.id === 'mono'
                              ? 'font-mono text-xs'
                              : 'font-sans'
                          }`}
                        >
                          {font.sample}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editor Font Size */}
              <div className="pt-4 border-t border-[#211F1C]/10">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#211F1C]/70 block mb-2">
                  Reading &amp; Writing Font Size
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'sm', label: 'Compact', size: '15px' },
                    { id: 'base', label: 'Standard', size: '17px' },
                    { id: 'lg', label: 'Spacious', size: '19px' },
                  ].map((fs) => {
                    const isSelected = preferences.editorFontSize === fs.id;
                    return (
                      <button
                        key={fs.id}
                        type="button"
                        onClick={() =>
                          updatePreferences({
                            editorFontSize: fs.id as AppPreferences['editorFontSize'],
                          })
                        }
                        className={`p-3 text-center rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1F4B43]/5 border-[#1F4B43] font-bold'
                            : 'bg-[#F5F1E8]/50 border-[#211F1C]/10 hover:bg-[#F5F1E8]'
                        }`}
                      >
                        <span className="block text-xs text-[#211F1C]">{fs.label}</span>
                        <span className="block text-[10px] text-[#211F1C]/50 mt-0.5">{fs.size}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editor Canvas Width */}
              <div className="pt-4 border-t border-[#211F1C]/10">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#211F1C]/70 block mb-2">
                  Document Canvas Max Width
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'narrow', label: 'Focused', width: '680px' },
                    { id: 'standard', label: 'Classic', width: '800px (Default)' },
                    { id: 'wide', label: 'Expanded', width: '960px' },
                  ].map((w) => {
                    const isSelected = preferences.editorWidth === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() =>
                          updatePreferences({
                            editorWidth: w.id as AppPreferences['editorWidth'],
                          })
                        }
                        className={`p-3 text-center rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1F4B43]/5 border-[#1F4B43] font-bold'
                            : 'bg-[#F5F1E8]/50 border-[#211F1C]/10 hover:bg-[#F5F1E8]'
                        }`}
                      >
                        <span className="block text-xs text-[#211F1C]">{w.label}</span>
                        <span className="block text-[10px] text-[#211F1C]/50 mt-0.5">{w.width}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Show Word Count Toggle */}
              <div className="pt-4 border-t border-[#211F1C]/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#211F1C]">
                    Word Count &amp; Reading Metric
                  </h4>
                  <p className="text-[11px] text-[#211F1C]/60">
                    Show live word counter and estimated reading time at bottom of the document.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updatePreferences({
                      showWordCount: !preferences.showWordCount,
                    })
                  }
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    preferences.showWordCount ? 'bg-[#1F4B43]' : 'bg-[#211F1C]/20'
                  }`}
                  aria-label="Toggle word count indicator"
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      preferences.showWordCount ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Reset Defaults button */}
              <div className="pt-4 border-t border-[#211F1C]/10 flex justify-end">
                <button
                  type="button"
                  onClick={resetPreferences}
                  className="inline-flex items-center gap-1.5 text-xs text-[#211F1C]/60 hover:text-[#1F4B43] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Preferences to Default</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: EXPORT & BACKUP */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Active Document Export */}
              <div className="bg-[#F5F1E8]/70 border border-[#211F1C]/10 rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-[#1F4B43]" />
                  <h3 className="font-serif italic text-base sm:text-lg text-[#211F1C]">
                    Export Active Reflection
                  </h3>
                </div>
                <p className="text-xs text-[#211F1C]/65 mb-4 leading-relaxed">
                  Export &ldquo;{activeEntry?.title || 'Untitled reflection'}&rdquo; including document
                  body, distilled core insight, and thinking companion dialogue.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportSingleMarkdown}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-[#FAF7F0] border border-[#211F1C]/15 hover:border-[#1F4B43] hover:text-[#1F4B43] rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Markdown (.md)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportSinglePlainText}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-[#FAF7F0] border border-[#211F1C]/15 hover:border-[#1F4B43] hover:text-[#1F4B43] rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Plain Text (.txt)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportSingleJSON}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-[#FAF7F0] border border-[#211F1C]/15 hover:border-[#1F4B43] hover:text-[#1F4B43] rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>JSON Raw Data</span>
                  </button>
                </div>
              </div>

              {/* Complete Archive Export */}
              <div className="bg-[#F5F1E8]/70 border border-[#211F1C]/10 rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Archive className="w-4 h-4 text-[#1F4B43]" />
                    <h3 className="font-serif italic text-base sm:text-lg text-[#211F1C]">
                      Complete Journal Archive
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#1F4B43]/10 text-[#1F4B43] rounded-full">
                    {entries.length} Reflections
                  </span>
                </div>
                <p className="text-xs text-[#211F1C]/65 mb-4 leading-relaxed">
                  Download your entire writing history across all sessions. Zero vendor lock-in —
                  your reflections remain open, human-readable, and machine-parsable.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleExportAllMarkdown}
                    disabled={entries.length === 0}
                    className="flex items-start gap-3 p-3 bg-[#FAF7F0] border border-[#211F1C]/15 hover:border-[#1F4B43] rounded-lg text-left transition-all cursor-pointer disabled:opacity-40 shadow-2xs group"
                  >
                    <div className="p-2 bg-[#1F4B43]/10 rounded-md text-[#1F4B43] group-hover:bg-[#1F4B43] group-hover:text-[#FAF7F0] transition-colors">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-[#211F1C]">
                        Compiled Markdown Anthology
                      </span>
                      <span className="block text-[10px] text-[#211F1C]/60 mt-0.5">
                        Single chronological file with all documents &amp; dialogues
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportAllJSON}
                    disabled={entries.length === 0}
                    className="flex items-start gap-3 p-3 bg-[#FAF7F0] border border-[#211F1C]/15 hover:border-[#1F4B43] rounded-lg text-left transition-all cursor-pointer disabled:opacity-40 shadow-2xs group"
                  >
                    <div className="p-2 bg-[#C99A3E]/15 rounded-md text-[#C99A3E] group-hover:bg-[#C99A3E] group-hover:text-[#FAF7F0] transition-colors">
                      <Archive className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-[#211F1C]">
                        Full JSON Data Backup
                      </span>
                      <span className="block text-[10px] text-[#211F1C]/60 mt-0.5">
                        Complete structural database export with all metadata
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRIVACY & DANGER ZONE */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              {/* Privacy guarantees */}
              <div className="p-4 bg-[#1F4B43]/5 border border-[#1F4B43]/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-[#1F4B43]" />
                  <h3 className="font-serif italic text-base text-[#1F4B43]">
                    Privacy &amp; Isolation Assurances
                  </h3>
                </div>
                <ul className="space-y-1.5 text-xs text-[#211F1C]/75 list-disc list-inside">
                  <li>
                    <strong>Isolated Partition:</strong> Your reflections and turns are stored
                    under your own owner-scoped Firestore path (<code className="text-[11px] bg-[#211F1C]/5 px-1 rounded">/users/[uid]/entries</code>).
                  </li>
                  <li>
                    <strong>No Public Storage:</strong> Your private entries can never be viewed or
                    queried by other users or indexers.
                  </li>
                  <li>
                    <strong>Client-Side Export:</strong> All exports happen directly in your browser
                    without intermediary third-party servers.
                  </li>
                </ul>
              </div>

              {/* Danger Zone */}
              <div className="border border-[#B3432B]/30 bg-[#F9EBE7]/40 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-[#B3432B]">
                  <Trash2 className="w-4 h-4" />
                  <h3 className="font-serif italic text-lg leading-none">Danger Zone</h3>
                </div>

                <div className="space-y-3 pt-2">
                  {/* Action 1: Delete All Sessions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#FAF7F0] border border-[#B3432B]/20 rounded-lg">
                    <div>
                      <h4 className="font-bold text-xs text-[#211F1C]">
                        Delete All Reflection Sessions
                      </h4>
                      <p className="text-[11px] text-[#211F1C]/60 mt-0.5">
                        Permanently erases all saved entries ({entries.length} reflections). Keeps your user account and preferences intact.
                      </p>
                    </div>
                    <button
                      id="settings-delete-all-sessions-btn"
                      type="button"
                      onClick={() => {
                        onClose();
                        onRequestDeleteAllEntries();
                      }}
                      className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[#B3432B] bg-[#F9EBE7] hover:bg-[#B3432B] hover:text-[#FAF7F0] rounded-lg transition-all shrink-0 cursor-pointer text-center"
                    >
                      Delete All Sessions
                    </button>
                  </div>

                  {/* Action 2: Delete Account & Data */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#FAF7F0] border border-[#B3432B]/20 rounded-lg">
                    <div>
                      <h4 className="font-bold text-xs text-[#B3432B]">
                        Permanently Delete Account &amp; All Data
                      </h4>
                      <p className="text-[11px] text-[#211F1C]/60 mt-0.5">
                        Hard deletes your complete Firestore user subtree and deletes your authentication account per Directive 7.
                      </p>
                    </div>
                    <button
                      id="settings-delete-account-btn"
                      type="button"
                      onClick={() => {
                        onClose();
                        onRequestDeleteAccount();
                      }}
                      className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[#FAF7F0] bg-[#B3432B] hover:bg-[#8F3320] rounded-lg transition-all shrink-0 cursor-pointer text-center shadow-xs"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3.5 border-t border-[#211F1C]/10 bg-[#FAF7F0] flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#211F1C]/40">
            Inklume v1.2 · Reflection Engine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#FAF7F0] bg-[#1F4B43] hover:bg-[#163630] rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
