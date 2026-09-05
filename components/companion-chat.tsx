'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { JournalEntry, JournalTurn } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { extractTextFromTipTap } from '@/lib/editor-utils';
import { useSettings } from '@/lib/settings-context';
import Markdown from 'react-markdown';
import {
  Send,
  AlertCircle,
  RefreshCw,
  X,
  MessageSquare,
  Compass,
  Square,
  PanelRightClose,
  Copy,
  Check,
} from 'lucide-react';

interface CompanionChatProps {
  entry: JournalEntry;
  onUpdateEntry: (updated: JournalEntry) => void;
  onPersistEntry: (updated: JournalEntry) => Promise<void>;
  onCloseMobile?: () => void;
  onCloseDesktop?: () => void;
  onOpenSettings?: () => void;
  isMobileDrawer?: boolean;
  isDesktopOpen?: boolean;
}

function createTurn(role: 'user' | 'model', text: string): JournalTurn {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return {
    id: `turn-${timestamp}-${randomSuffix}`,
    role,
    text,
    timestamp,
  };
}

export function CompanionChat({
  entry,
  onUpdateEntry,
  onPersistEntry,
  onCloseMobile,
  onCloseDesktop,
  onOpenSettings,
  isMobileDrawer = false,
  isDesktopOpen = true,
}: CompanionChatProps) {
  const { user } = useAuth();
  const { preferences } = useSettings();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll when turns arrive
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entry.turns.length, isSending]);

  // Clean up any pending abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  // Stop current in-flight Gemini generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSending(false);
  };

  const handleCopyTurn = async (turnId: string, text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedTurnId(turnId);
      setTimeout(() => {
        setCopiedTurnId((prev) => (prev === turnId ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const message = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!message || !user || isSending) return;

    setApiError(null);
    setLastFailedInput(null);

    const userTurn = createTurn('user', message);
    const nextTurns = [...(entry.turns || []), userTurn];

    // Intermediate entry state
    const intermediateEntry: JournalEntry = {
      ...entry,
      turns: nextTurns,
      updatedAt: new Date().toISOString(),
    };

    onUpdateEntry(intermediateEntry);

    if (textToSend === undefined) {
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }

    await onPersistEntry(intermediateEntry);
    setIsSending(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Extract document plain text so Gemini understands full draft context
      const currentDocText = extractTextFromTipTap(entry.content);
      const token = await user.getIdToken();

      const response = await fetch('/api/journal/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        signal: controller.signal,
        body: JSON.stringify({
          turns: nextTurns.map((t) => ({ role: t.role, text: t.text })),
          docTitle: entry.title || '',
          docText: currentDocText,
          companionSettings: preferences.companion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gemini response could not be completed.');
      }

      const modelTurn = createTurn('model', data.text);
      const finalTurns = [...nextTurns, modelTurn];
      const finalizedEntry: JournalEntry = {
        ...intermediateEntry,
        turns: finalTurns,
        updatedAt: new Date().toISOString(),
      };

      onUpdateEntry(finalizedEntry);
      await onPersistEntry(finalizedEntry);
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        // Generation was intentionally stopped by the user - do not show error
        setApiError(null);
        return;
      }
      console.error('Gemini companion proxy error');
      setApiError(err?.message || 'The companion could not reply right now.');
      setLastFailedInput(message);
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  const formatTurnTime = (timestamp: number) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(timestamp));
    } catch {
      return '';
    }
  };

  const promptStarters = [
    'Help me untangle this thought',
    "What question am I avoiding?",
    'Give me a fresh perspective',
  ];

  return (
    <aside
      id="companion-panel"
      aria-label="Gemini thinking companion"
      className={`flex flex-col h-full bg-[#F0EBE0] text-[#211F1C] select-text relative ${
        isMobileDrawer ? 'w-full' : 'w-full'
      }`}
    >
      {/* Companion Header */}
      <header className="px-5 py-3.5 border-b border-[#211F1C]/10 flex items-center justify-between shrink-0 bg-[#F0EBE0]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#1F4B43]" />
          <h3 className="text-xs font-bold tracking-widest uppercase text-[#211F1C]">
            Thinking Companion
          </h3>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="ml-1 text-[10px] font-sans font-medium px-2 py-0.5 rounded-full bg-[#1F4B43]/10 text-[#1F4B43] hover:bg-[#1F4B43]/20 transition-colors cursor-pointer capitalize"
              title="Change companion demeanor in settings"
            >
              {preferences.companion.persona}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Close trigger for mobile */}
          {onCloseMobile && (
            <button
              type="button"
              id="close-companion-mobile-btn"
              onClick={onCloseMobile}
              className="p-1 text-[#211F1C]/50 hover:text-[#211F1C] rounded transition-colors md:hidden"
              aria-label="Close companion pane"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Hide / Collapse trigger for desktop */}
          {onCloseDesktop && isDesktopOpen && (
            <button
              type="button"
              id="hide-companion-desktop-btn"
              onClick={onCloseDesktop}
              className="hidden md:flex p-1.5 text-[#211F1C]/50 hover:text-[#1F4B43] hover:bg-[#211F1C]/8 rounded-md transition-colors cursor-pointer"
              title="Close companion panel"
              aria-label="Close companion panel"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Flat Conversation Stream */}
      <div
        id="companion-turns-stream"
        className="flex-1 overflow-y-auto p-5 space-y-7 text-sm no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        role="feed"
        aria-label="Companion turns"
      >
        {entry.turns.length === 0 ? (
          <div className="py-10 text-center space-y-3 max-w-xs mx-auto">
            <div className="w-8 h-8 rounded-full bg-[#1F4B43]/10 text-[#1F4B43] flex items-center justify-center mx-auto">
              <Compass className="w-4 h-4" />
            </div>
            <p className="font-serif italic text-base text-[#211F1C]/75">
              Reflect out loud.
            </p>
            <p className="text-xs font-sans text-[#211F1C]/55 leading-relaxed">
              Use this side companion to brainstorm ideas, ask questions, or untangle a thought while writing your document.
            </p>

            {preferences.companion.showSuggestions !== false && (
              <div className="pt-2 flex flex-col gap-1.5 text-left">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#211F1C]/40 mb-1">
                  Conversation Starters:
                </span>
                {promptStarters.map((starter, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(starter)}
                    disabled={isSending}
                    className="text-xs text-left p-2 rounded bg-white/50 hover:bg-white border border-[#211F1C]/10 text-[#211F1C]/80 hover:text-[#1F4B43] transition-colors cursor-pointer"
                  >
                    &ldquo;{starter}&rdquo;
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          entry.turns.map((turn, idx) => {
            const isUser = turn.role === 'user';
            const turnKey = turn.id || `turn-${idx}`;

            if (isUser) {
              return (
                <article
                  key={turnKey}
                  id={`companion-turn-${turnKey}`}
                  className="flex flex-col items-end w-full"
                >
                  {/* Sender label & time */}
                  <div className="flex items-center gap-1.5 mb-1 mr-1">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[#211F1C]/50">
                      You
                    </span>
                    <span className="text-[9px] font-medium tracking-widest uppercase text-[#211F1C]/35">
                      {formatTurnTime(turn.timestamp)}
                    </span>
                  </div>

                  {/* User message in card styled with a shade of the companion bg color */}
                  <div className="max-w-[85%] sm:max-w-[80%] bg-[#E5DFD2] border border-[#211F1C]/10 rounded-2xl rounded-tr-xs px-3.5 py-2.5 shadow-xs text-left">
                    <p className="font-sans text-xs sm:text-sm text-[#211F1C]/90 leading-relaxed whitespace-pre-wrap break-words">
                      {turn.text}
                    </p>
                  </div>
                </article>
              );
            }

            return (
              <article
                key={turnKey}
                id={`companion-turn-${turnKey}`}
                className="group relative w-full"
              >
                {/* Sender label, time & copy button on hover */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[#1F4B43]">
                      Gemini
                    </span>
                    <span className="text-[9px] font-medium tracking-widest uppercase text-[#211F1C]/35">
                      {formatTurnTime(turn.timestamp)}
                    </span>
                  </div>

                  {/* Copy button revealed on hover */}
                  <button
                    id={`copy-companion-turn-${turnKey}`}
                    type="button"
                    onClick={() => handleCopyTurn(turnKey, turn.text)}
                    title={copiedTurnId === turnKey ? 'Copied to clipboard' : 'Copy response'}
                    aria-label="Copy Gemini response"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-[#211F1C]/45 hover:text-[#1F4B43] hover:bg-[#211F1C]/5 rounded cursor-pointer inline-flex items-center gap-1 text-[10px]"
                  >
                    {copiedTurnId === turnKey ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#1F4B43]" />
                        <span className="text-[9px] font-semibold text-[#1F4B43]">Copied</span>
                      </>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Turn Content */}
                <div className="companion-markdown-preview font-serif text-sm sm:text-base text-[#211F1C]/90 leading-relaxed pl-0.5">
                  <Markdown
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2.5 leading-relaxed font-serif text-sm sm:text-base text-[#211F1C]/90 last:mb-0">
                          {children}
                        </p>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-[#211F1C]">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic text-[#211F1C]/90">{children}</em>
                      ),
                      ul: ({ children }) => (
                        <ul className="my-2 pl-5 list-disc space-y-1 text-sm sm:text-base font-serif text-[#211F1C]/90">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="my-2 pl-5 list-decimal space-y-1 text-sm sm:text-base font-serif text-[#211F1C]/90">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="leading-relaxed pl-1">{children}</li>
                      ),
                      h1: ({ children }) => (
                        <h1 className="font-serif font-semibold text-base sm:text-lg text-[#1F4B43] mt-3 mb-1.5">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="font-serif font-semibold text-sm sm:text-base text-[#1F4B43] mt-2.5 mb-1">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="font-serif font-medium text-sm sm:text-base text-[#1F4B43] mt-2 mb-1">
                          {children}
                        </h3>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-[#1F4B43]/50 pl-3 my-2 italic text-[#211F1C]/75">
                          {children}
                        </blockquote>
                      ),
                      code: ({ children }) => (
                        <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#211F1C]/8 text-[#1F4B43] font-medium">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="font-mono text-xs p-2.5 my-2 rounded bg-[#FAF7F0] border border-[#211F1C]/10 overflow-x-auto text-[#211F1C]">
                          {children}
                        </pre>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#1F4B43] underline underline-offset-2 hover:opacity-80"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {turn.text}
                  </Markdown>
                </div>
              </article>
            );
          })
        )}

        {/* Gemini Reflecting Pulse & Stop Button */}
        {isSending && (
          <div
            id="companion-thinking-indicator"
            className="flex items-center justify-between py-2 px-3 bg-[#FAF7F0] border border-[#211F1C]/10 rounded-sm"
            aria-live="polite"
          >
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-[#1F4B43] rounded-full opacity-70 animate-ping" />
              <span className="text-[10px] font-medium uppercase tracking-widest opacity-60 text-[#211F1C]">
                Gemini is reflecting…
              </span>
            </div>
            <button
              id="stop-companion-stream-btn"
              type="button"
              onClick={handleStopGeneration}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#B3432B] hover:text-[#8D3421] bg-[#F9EBE7] hover:bg-[#F4D9D2] px-2 py-0.5 rounded transition-colors cursor-pointer"
              title="Stop response"
              aria-label="Stop response"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Stop</span>
            </button>
          </div>
        )}

        {/* Error notification */}
        {apiError && (
          <div
            role="alert"
            className="p-3 bg-[#F9EBE7] border-l-2 border-[#B3432B] text-[#B3432B] text-xs flex items-center justify-between rounded-xs"
          >
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{apiError}</span>
            </div>
            {lastFailedInput && (
              <button
                type="button"
                onClick={() => handleSendMessage(lastFailedInput)}
                className="text-[10px] font-bold uppercase tracking-widest underline flex items-center gap-1 shrink-0 ml-2"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        <div ref={scrollAnchorRef} />
      </div>

      {/* Companion Input Footer */}
      <footer className="p-3.5 border-t border-[#211F1C]/10 bg-[#F0EBE0] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex flex-col gap-2"
        >
          <div className="relative flex items-end gap-1.5 bg-white/70 border border-[#211F1C]/15 rounded-md p-1.5 focus-within:border-[#1F4B43]/50 transition-colors">
            <textarea
              id="companion-input-field"
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask companion or brainstorm..."
              disabled={isSending}
              aria-label="Ask companion or brainstorm"
              className="flex-1 bg-transparent border-none text-xs sm:text-sm font-sans placeholder-[#211F1C]/35 outline-none resize-none leading-relaxed py-1 px-1 max-h-32 focus:outline-none"
            />

            {isSending ? (
              <button
                id="stop-companion-turn-btn"
                type="button"
                onClick={handleStopGeneration}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-[#B3432B] bg-[#F9EBE7] hover:bg-[#B3432B] hover:text-[#FAF7F0] rounded transition-all cursor-pointer shrink-0"
                aria-label="Stop generation"
                title="Stop generation"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                id="send-companion-turn-btn"
                type="submit"
                disabled={!inputText.trim()}
                className="p-1.5 text-[#1F4B43] hover:bg-[#1F4B43] hover:text-[#FAF7F0] rounded transition-all disabled:opacity-25 cursor-pointer shrink-0"
                aria-label="Send to companion"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-[9px] font-bold tracking-widest uppercase text-[#211F1C]/40 px-1">
            <span>Enter to send · Shift+Enter newline</span>
          </div>
        </form>
      </footer>
    </aside>
  );
}
