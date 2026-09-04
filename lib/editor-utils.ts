/**
 * Utilities for TipTap ProseMirror document serialization, snippet extraction,
 * and word counting for Inklume document-first journal.
 */

import type { JournalEntry } from './types';

export function extractTextFromTipTap(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return extractTextFromTipTap(parsed);
    } catch {
      return content.trim();
    }
  }
  if (Array.isArray(content)) {
    return content.map(extractTextFromTipTap).filter(Boolean).join(' ').trim();
  }
  if (content.text) {
    return content.text;
  }
  if (Array.isArray(content.content)) {
    return content.content.map(extractTextFromTipTap).filter(Boolean).join(' ').trim();
  }
  return '';
}

/**
 * Returns a display snippet for timeline and archive views.
 * Requirement 5: show a snippet of the document content, falling back to the
 * existing summary or chat excerpt when content is empty (i.e. for legacy entries).
 */
export function getEntrySnippet(entry: JournalEntry, maxLength = 120): string {
  if (!entry) return '';

  // 1. Primary: text from TipTap document content
  const docText = extractTextFromTipTap(entry.content);
  if (docText) {
    return docText.length > maxLength
      ? `${docText.slice(0, maxLength).trim()}…`
      : docText;
  }

  // 2. Fallback: session summary
  if (entry.summary) {
    return entry.summary.length > maxLength
      ? `${entry.summary.slice(0, maxLength).trim()}…`
      : entry.summary;
  }

  // 3. Fallback: first user turn in chat history
  const firstTurn = entry.turns?.find((t) => t.role === 'user') || entry.turns?.[0];
  if (firstTurn?.text) {
    return firstTurn.text.length > maxLength
      ? `${firstTurn.text.slice(0, maxLength).trim()}…`
      : firstTurn.text;
  }

  return 'Empty reflection';
}

export function countWordsAndChars(text: string): { words: number; chars: number } {
  if (!text || !text.trim()) return { words: 0, chars: 0 };
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const chars = trimmed.length;
  return { words, chars };
}

export function isSessionEmpty(entry?: JournalEntry | null): boolean {
  if (!entry) return true;
  const cleanTitle = (entry.title || '').trim();
  const isDefaultTitle =
    cleanTitle.length === 0 || cleanTitle.toLowerCase() === 'untitled reflection';
  const rawText = extractTextFromTipTap(entry.content);
  const textContent = rawText
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\u200B/g, '')
    .trim();
  const hasTurns = (entry.turns || []).length > 0;
  return isDefaultTitle && textContent.length === 0 && !hasTurns;
}

/**
 * Format an individual entry to clean Markdown with metadata and dialogue history.
 */
export function formatEntryAsMarkdown(entry: JournalEntry): string {
  const title = entry.title || 'Untitled reflection';
  const dateStr = new Date(entry.createdAt).toISOString();
  const readableDate = new Date(entry.createdAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const docText = extractTextFromTipTap(entry.content);

  let md = `---
title: "${title.replace(/"/g, '\\"')}"
date: ${dateStr}
id: ${entry.id}
---

# ${title}

*Reflected on ${readableDate}*

${docText || '_No document text captured._'}
`;

  if (entry.summary) {
    md += `\n\n## Core Insight\n\n> ${entry.summary}\n`;
  }

  if (entry.keyInsights && entry.keyInsights.length > 0) {
    md += `\n\n### Key Takeaways\n\n${entry.keyInsights.map((ki) => `- ${ki}`).join('\n')}\n`;
  }

  if (entry.turns && entry.turns.length > 0) {
    md += `\n\n## Companion Dialogue\n\n`;
    entry.turns.forEach((t) => {
      const roleLabel = t.role === 'user' ? '**You**' : '**Thinking Companion**';
      md += `${roleLabel}:\n${t.text}\n\n`;
    });
  }

  return md.trim();
}

/**
 * Format an individual entry to plain text.
 */
export function formatEntryAsPlainText(entry: JournalEntry): string {
  const title = entry.title || 'Untitled reflection';
  const readableDate = new Date(entry.createdAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const docText = extractTextFromTipTap(entry.content);

  let txt = `${title.toUpperCase()}\nDate: ${readableDate}\n${'='.repeat(40)}\n\n`;
  txt += docText ? `${docText}\n\n` : '(No document body)\n\n';

  if (entry.summary) {
    txt += `CORE INSIGHT:\n${entry.summary}\n\n`;
  }

  if (entry.turns && entry.turns.length > 0) {
    txt += `DIALOGUE LOG:\n${'-'.repeat(30)}\n`;
    entry.turns.forEach((t) => {
      const speaker = t.role === 'user' ? 'YOU' : 'COMPANION';
      txt += `[${speaker}]: ${t.text}\n\n`;
    });
  }

  return txt.trim();
}

/**
 * Format all entries into a single compiled Markdown journal archive.
 */
export function formatAllEntriesAsMarkdown(entries: JournalEntry[]): string {
  const header = `# Inklume Personal Journal Archive\nExported on: ${new Date().toLocaleString()}\nTotal Reflections: ${entries.length}\n\n---\n\n`;
  const body = entries.map((e) => formatEntryAsMarkdown(e)).join('\n\n---\n\n');
  return header + body;
}

/**
 * Triggers a client-side file download safely.
 */
export function triggerFileDownload(filename: string, content: string, mimeType: string = 'text/plain'): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


