'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent, Mark, mergeAttributes } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import {
  Bold,
  Italic,
  Type,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo2,
  Redo2,
  Sparkles,
  AlertCircle,
  Compass,
  Mic,
  Square,
  Loader2,
} from 'lucide-react';
import { countWordsAndChars } from '@/lib/editor-utils';
import { useSettings } from '@/lib/settings-context';
import type { JournalTurn } from '@/lib/types';

// Custom Mark to format selected text with Arial and compact line spacing from the reference
export const ArialDocStyle = Mark.create({
  name: 'arialDocStyle',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-doc-font="arial"]',
      },
      {
        tag: 'span.doc-arial-style',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-doc-font': 'arial',
        class: 'doc-arial-style',
      }),
      0,
    ];
  },
});

export const ReflectHighlight = Highlight.extend({
  addAttributes() {
    return {
      comment: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment'),
        renderHTML: attributes => {
          if (!attributes.comment) {
            return {};
          }
          return {
            'data-comment': attributes.comment,
          };
        },
      },
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }
          return {
            'data-id': attributes.id,
          };
        },
      },
    };
  },
});

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export interface DocumentEditorRef {
  insertTextAtCursor: (text: string) => void;
}

interface DocumentEditorProps {
  entryId: string;
  initialContent?: Record<string, any> | null;
  onContentChange: (jsonContent: Record<string, any>, plainText: string) => void;
  onForceSave?: () => void;
  disabled?: boolean;
  editorRef?: React.Ref<DocumentEditorRef>;
  companionTurns?: JournalTurn[];
  userId?: string;
}

export function DocumentEditor({
  entryId,
  initialContent,
  onContentChange,
  onForceSave,
  disabled = false,
  editorRef,
  companionTurns,
  userId,
}: DocumentEditorProps) {
  const { preferences } = useSettings();
  const isUpdatingFromPropRef = useRef(false);
  const currentEntryIdRef = useRef(entryId);
  const [stats, setStats] = React.useState({ words: 0, chars: 0 });

  // Inline Companion Reflection Draft states
  const [isDrafting, setIsDrafting] = React.useState(false);
  const [draftedParagraph, setDraftedParagraph] = React.useState<string | null>(null);
  const [draftError, setDraftError] = React.useState<string | null>(null);
  const [inlineNotice, setInlineNotice] = React.useState<string | null>(null);

  const draftedParagraphRef = useRef<string | null>(null);
  const isDraftingRef = useRef(false);
  const draftAbortControllerRef = useRef<AbortController | null>(null);

  // Reflecting states
  const [isReflecting, setIsReflecting] = React.useState(false);
  const [activeHighlight, setActiveHighlight] = React.useState<{ id: string, comment: string, top: number, left: number } | null>(null);

  // Voice Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    draftedParagraphRef.current = draftedParagraph;
    isDraftingRef.current = isDrafting;
  }, [draftedParagraph, isDrafting]);

  const fontClass =
    preferences.editorFont === 'sans'
      ? 'font-sans'
      : preferences.editorFont === 'mono'
      ? 'font-mono'
      : 'font-serif';

  const sizeClass =
    preferences.editorFontSize === 'sm'
      ? 'text-[15px]'
      : preferences.editorFontSize === 'lg'
      ? 'text-[19px]'
      : 'text-[17px]';

  const widthClass =
    preferences.editorWidth === 'narrow'
      ? 'w-[680px]'
      : preferences.editorWidth === 'wide'
      ? 'w-[960px]'
      : 'w-[800px]';

  // Initialize TipTap
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      ReflectHighlight.configure({ HTMLAttributes: { class: 'bg-[#C99A3E]/30 cursor-pointer rounded-sm hover:bg-[#C99A3E]/40 transition-colors' } }),
      Placeholder.configure({
        placeholder: 'Press ⌘+J or Ctrl+J to weave opening reflection from companion',
        emptyEditorClass: 'is-editor-empty',
      }),
      ArialDocStyle,
    ],
    content: initialContent || '',
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `prose-editorial max-w-none focus:outline-none min-h-[420px] pb-24 text-[#211F1C] ${fontClass} ${sizeClass} ${widthClass} max-w-full leading-[1.55] transition-all`,
        id: 'journal-prosemirror-editor',
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      if (isUpdatingFromPropRef.current) return;
      const json = activeEditor.getJSON();
      const text = activeEditor.getText();
      setStats(countWordsAndChars(text));
      onContentChange(json, text);
    },
  });

  // Handle entryId changes or remote entry loads
  useEffect(() => {
    if (!editor) return;

    // Check if we switched entries or if initial content was loaded for an existing entry
    if (currentEntryIdRef.current !== entryId) {
      currentEntryIdRef.current = entryId;
      isUpdatingFromPropRef.current = true;
      
      // Check local crash recovery buffer first
      let recoveryContent: any = null;
      try {
        const cached = localStorage.getItem(`ink-draft-${entryId}`);
        if (cached) {
          recoveryContent = JSON.parse(cached);
        }
      } catch {
        recoveryContent = null;
      }

      const contentToSet = recoveryContent || initialContent || '';
      editor.commands.setContent(contentToSet);
      setStats(countWordsAndChars(editor.getText()));
      isUpdatingFromPropRef.current = false;
    }
  }, [editor, entryId, initialContent]);

  // Update disabled state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  // Imperative handle for inserting text at cursor / document start
  React.useImperativeHandle(
    editorRef,
    () => ({
      insertTextAtCursor: (text: string) => {
        if (!editor) return;
        const clean = text.trim();
        if (!clean) return;

        if (editor.isEmpty) {
          editor.chain().focus('start').insertContent(`<p>${clean}</p>`).run();
        } else {
          editor.chain().focus().insertContent(`<p>${clean}</p>`).run();
        }
      },
    }),
    [editor]
  );

  // Handlers for drafting opening paragraph directly in the writing surface
  const handleTriggerDraft = useCallback(
    async (isRetry = false) => {
      if (isDraftingRef.current) return;

      if (draftAbortControllerRef.current) {
        draftAbortControllerRef.current.abort();
      }
      draftAbortControllerRef.current = new AbortController();

      const turns = companionTurns || [];
      if (turns.length === 0) {
        setInlineNotice(
          'Talk with your companion in the chat first, then press ⌘J to weave an opening reflection.'
        );
        setTimeout(() => {
          setInlineNotice((prev) =>
            prev?.startsWith('Talk with your companion') ? null : prev
          );
        }, 4500);
        return;
      }

      if (editor && !editor.isEmpty) {
        setInlineNotice(
          'Drafting from chat is only available in an empty document.'
        );
        setTimeout(() => {
          setInlineNotice((prev) =>
            prev?.startsWith('Drafting from chat') ? null : prev
          );
        }, 4500);
        return;
      }

      setIsDrafting(true);
      setDraftError(null);
      setInlineNotice(null);
      if (!isRetry) {
        setDraftedParagraph(null);
      }

      try {
        const authModule = await import('@/lib/auth-context');
        // fallback to checking if firebase provides a direct way or use the provided method
        // actually wait, DocumentEditor is a function component, we can just use hooks.
        // Let's use `import { auth } from '@/lib/firebase';` directly to get current user if we don't want to change hook rules, or just change the fetch calls since they are async.
        const { auth } = await import('@/lib/firebase');
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('Not authenticated');
        const token = await currentUser.getIdToken();

        const res = await fetch('/api/journal/draft-opening', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({
            entryId,
            turns,
          }),
          signal: draftAbortControllerRef.current.signal,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to draft opening reflection.');
        }

        setDraftedParagraph(data.paragraph);
        console.info(
          JSON.stringify({
            event: 'draft_opening_received',
            entryId,
          })
        );
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setDraftError(err?.message || 'Could not draft opening reflection.');
      } finally {
        setIsDrafting(false);
      }
    },
    [companionTurns, entryId, editor]
  );

  const handleConfirmInsert = useCallback(() => {
    const textToInsert = draftedParagraphRef.current;
    if (!textToInsert || !editor) return;

    const clean = textToInsert.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (editor.isEmpty) {
      editor.chain().focus('start').insertContent(`<p>${clean}</p>`).run();
    } else {
      editor.chain().focus().insertContent(`<p>${clean}</p>`).run();
    }

    setDraftedParagraph(null);
    setDraftError(null);
    setInlineNotice(null);

    console.info(
      JSON.stringify({
        event: 'draft_opening_inserted',
        entryId,
      })
    );
  }, [editor, entryId]);

  const startRecording = async () => {
    try {
      setVoiceError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        audioChunksRef.current = [];
        stream.getTracks().forEach(track => track.stop());
        await handleTranscription(audioBlob, mediaRecorder.mimeType);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (err: any) {
      console.error('Failed to start recording', err);
      setVoiceError(err.message || 'Microphone access denied or unavailable.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscription = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setVoiceError(null);
    try {
      const formData = new FormData();
      const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'ogg';
      formData.append('audio', blob, `recording.${ext}`);
      
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const token = await currentUser.getIdToken();

      const res = await fetch('/api/journal/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to transcribe audio.');
      }

      if (data.text && editor) {
        const cleanText = data.text.trim();
        if (editor.isEmpty) {
          editor.chain().focus('start').insertContent(`<p>${cleanText}</p>`).run();
        } else {
          editor.chain().focus().insertContent(` ${cleanText} `).run();
        }
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setVoiceError(err.message || 'Transcription failed.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleDiscardDraft = useCallback(() => {
    if (draftAbortControllerRef.current) {
      draftAbortControllerRef.current.abort();
      draftAbortControllerRef.current = null;
    }
    setDraftedParagraph(null);
    setDraftError(null);
    setInlineNotice(null);
    setIsDrafting(false);
    editor?.commands.focus();
  }, [editor]);

  // Keyboard shortcut listeners:
  // - Ctrl+S / Cmd+S: Save
  // - Ctrl+J / Cmd+J OR Ctrl+Shift+D / Cmd+Shift+D: Draft opening from companion
  // - Enter or Tab (while draft card active): Insert into journal
  // - Esc (while draft card active): Discard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S / Ctrl+S to force save
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onForceSave?.();
        return;
      }

      // Cmd+J / Ctrl+J OR Cmd+Shift+D / Ctrl+Shift+D to trigger opening reflection
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd')
      ) {
        e.preventDefault();
        handleTriggerDraft();
        return;
      }

      // Draft action shortcuts when draft is active or drafting
      if (draftedParagraphRef.current || isDraftingRef.current) {
        if (!isDraftingRef.current && (e.key === 'Enter' || e.key === 'Tab')) {
          e.preventDefault();
          handleConfirmInsert();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          handleDiscardDraft();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onForceSave, handleTriggerDraft, handleConfirmInsert, handleDiscardDraft]);

  const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const toggleArialDocStyle = useCallback(() => editor?.chain().focus().toggleMark('arialDocStyle').run(), [editor]);
  const toggleH1 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 1 }).run(), [editor]);
  const toggleH2 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 2 }).run(), [editor]);
  const toggleBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const toggleOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
  const toggleBlockquote = useCallback(() => editor?.chain().focus().toggleBlockquote().run(), [editor]);
  const setHorizontalRule = useCallback(() => editor?.chain().focus().setHorizontalRule().run(), [editor]);
  const undo = useCallback(() => editor?.chain().focus().undo().run(), [editor]);
  const redo = useCallback(() => editor?.chain().focus().redo().run(), [editor]);

  const handleReflectSelection = async () => {
    if (!editor || isReflecting || !userId) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) return;

    const selectionText = editor.state.doc.textBetween(from, to, '\n');
    if (selectionText.trim().length === 0) return;

    // Get surrounding context (the block containing the selection)
    const $from = editor.state.selection.$from;
    const blockText = $from.parent.textContent;

    setIsReflecting(true);
    try {
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      const token = await currentUser.getIdToken();

      const response = await fetch('/api/journal/reflect-selection', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          selection: selectionText,
          context: blockText,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const id = crypto.randomUUID();
      editor.chain().focus().setMark('highlight', { id, comment: data.reflection }).run();
    } catch (err: any) {
      console.error('Failed to reflect:', err);
      // maybe show toast if we had one, for now silently fail or use inline notice
      setInlineNotice('Failed to generate reflection.');
    } finally {
      setIsReflecting(false);
    }
  };

  // Click handler for highlights to show popover
  useEffect(() => {
    if (!editor) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'MARK' && target.hasAttribute('data-comment')) {
        const comment = target.getAttribute('data-comment');
        const id = target.getAttribute('data-id');
        const rect = target.getBoundingClientRect();
        const editorRect = document.getElementById('journal-editor-writing-surface')?.getBoundingClientRect();
        if (editorRect && comment && id) {
          setActiveHighlight({
            id,
            comment,
            top: rect.bottom - editorRect.top + 5,
            left: rect.left - editorRect.left,
          });
        }
      } else {
        if (!target.closest('#journal-highlight-popover')) {
          setActiveHighlight(null);
        }
      }
    };
    
    const dom = editor.view.dom;
    dom.addEventListener('click', handleClick);
    return () => dom.removeEventListener('click', handleClick);
  }, [editor]);

  const removeHighlight = () => {
    if (!editor || !activeHighlight) return;
    const { id } = activeHighlight;
    const { tr } = editor.state;
    let found = false;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText) {
        const mark = node.marks.find((m) => m.type.name === 'highlight' && m.attrs.id === id);
        if (mark) {
          tr.removeMark(pos, pos + node.nodeSize, mark);
          found = true;
        }
      }
    });
    if (found) {
      editor.view.dispatch(tr);
    }
    setActiveHighlight(null);
  };

  if (!editor) {
    return (
      <div className="py-16 text-center text-[#211F1C]/40 font-serif italic">
        Preparing document surface...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Editorial Formatting Toolbar */}
      <div
        id="editor-formatting-toolbar"
        aria-label="Formatting options"
        className="flex items-center justify-between gap-1 pb-3 mb-6 border-b border-[#211F1C]/10 shrink-0 select-none flex-wrap text-[#211F1C]"
      >
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            id="format-bold-btn"
            onClick={toggleBold}
            disabled={disabled}
            aria-label="Bold text"
            aria-pressed={editor.isActive('bold')}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('bold')
                ? 'bg-[#1F4B43] text-[#FAF7F0]'
                : 'text-[#211F1C]/60 hover:text-[#211F1C] hover:bg-[#211F1C]/5'
            }`}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="format-italic-btn"
            onClick={toggleItalic}
            disabled={disabled}
            aria-label="Italic text"
            aria-pressed={editor.isActive('italic')}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('italic')
                ? 'bg-[#1F4B43] text-[#FAF7F0]'
                : 'text-[#211F1C]/60 hover:text-[#211F1C] hover:bg-[#211F1C]/5'
            }`}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="format-arial-doc-btn"
            onClick={toggleArialDocStyle}
            disabled={disabled}
            aria-label="Apply Arial font and spacing to selected text"
            title="Apply Arial font & compact spacing to selected text"
            aria-pressed={editor.isActive('arialDocStyle')}
            className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1.5 ${
              editor.isActive('arialDocStyle')
                ? 'bg-[#1F4B43] text-[#FAF7F0] font-semibold'
                : 'text-[#211F1C]/70 hover:text-[#211F1C] hover:bg-[#211F1C]/5'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="text-[11px] font-sans font-medium">Arial</span>
          </button>

          <div className="w-[1px] h-4 bg-[#211F1C]/15 mx-1" />

          <button
            type="button"
            id="format-h1-btn"
            onClick={toggleH1}
            disabled={disabled}
            aria-label="Heading 1"
            aria-pressed={editor.isActive('heading', { level: 1 })}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-[#1F4B43] text-[#FAF7F0]'
                : 'text-[#211F1C]/60 hover:text-[#211F1C] hover:bg-[#211F1C]/5'
            }`}
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="format-h2-btn"
            onClick={toggleH2}
            disabled={disabled}
            aria-label="Heading 2"
            aria-pressed={editor.isActive('heading', { level: 2 })}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-[#1F4B43] text-[#FAF7F0]'
                : 'text-[#211F1C]/60 hover:text-[#211F1C] hover:bg-[#211F1C]/5'
            }`}
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-[#211F1C]/15 mx-1" />

          <button
            type="button"
            id="format-bullet-list-btn"
            onClick={toggleBulletList}
            disabled={disabled}
            aria-label="Bullet list"
            aria-pressed={editor.isActive('bulletList')}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('bulletList')
                ? 'bg-[#1F4B43] text-[#FAF7F0]'
                : 'text-[#211F1C]/60 hover:text-[#211F1C] hover:bg-[#211F1C]/5'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="format-ordered-list-btn"
            onClick={toggleOrderedList}
            disabled={disabled}
            aria-label="Numbered list"
            aria-pressed={editor.isActive('orderedList')}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('orderedList')
                ? 'bg-[#1F4B43] text-[#FAF7F0]'
                : 'text-[#211F1C]/60 hover:text-[#211F1C] hover:bg-[#211F1C]/5'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="format-quote-btn"
            onClick={toggleBlockquote}
            disabled={disabled}
            aria-label="Blockquote"
            aria-pressed={editor.isActive('blockquote')}
            className={`p-1.5 rounded transition-colors ${
              editor.isActive('blockquote')
                ? 'bg-[#1F4B43] text-[#FAF7F0]'
                : 'text-[#211F1C]/60 hover:text-[#211F1C] hover:bg-[#211F1C]/5'
            }`}
          >
            <Quote className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            id="format-hr-btn"
            onClick={setHorizontalRule}
            disabled={disabled}
            aria-label="Divider"
            className="p-1.5 rounded text-[#211F1C]/60 hover:text-[#211F1C] hover:bg-[#211F1C]/5 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Word count & Undo/Redo */}
        <div className="flex items-center gap-3 ml-auto text-[11px] font-sans text-[#211F1C]/50">
          <div className="flex items-center gap-1">
            <button
              type="button"
              id="editor-undo-btn"
              onClick={undo}
              disabled={disabled || !editor.can().undo()}
              aria-label="Undo"
              className="p-1 rounded text-[#211F1C]/60 hover:text-[#211F1C] hover:bg-[#211F1C]/5 transition-colors disabled:opacity-30"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              id="editor-redo-btn"
              onClick={redo}
              disabled={disabled || !editor.can().redo()}
              aria-label="Redo"
              className="p-1 rounded text-[#211F1C]/60 hover:text-[#211F1C] hover:bg-[#211F1C]/5 transition-colors disabled:opacity-30"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-[#211F1C]/15 mx-1" />

            {!isRecording && !isTranscribing ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={disabled}
                aria-label="Start voice typing"
                title="Dictate an entry"
                className="p-1 rounded text-[#211F1C]/60 hover:text-[#211F1C] hover:bg-[#211F1C]/5 transition-colors disabled:opacity-30"
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            ) : isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                aria-label="Stop recording"
                title="Stop recording"
                className="p-1 rounded text-[#FAF7F0] bg-[#B3432B] hover:bg-[#A03A25] transition-colors relative flex items-center justify-center animate-pulse"
              >
                <Square className="w-3.5 h-3.5" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                disabled
                aria-label="Transcribing..."
                title="Transcribing audio"
                className="p-1 rounded text-[#211F1C]/60 transition-colors opacity-50 cursor-not-allowed"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </button>
            )}
          </div>

          {preferences.showWordCount && (
            <div className="hidden sm:flex items-center gap-2 tracking-wide uppercase text-[10px] font-medium border-l border-[#211F1C]/15 pl-3">
              <span>{stats.words} {stats.words === 1 ? 'word' : 'words'}</span>
              <span className="text-[#211F1C]/40">·</span>
              <span className="text-[#211F1C]/60">{Math.max(1, Math.ceil(stats.words / 200))} min read</span>
            </div>
          )}
        </div>
      </div>

      {/* Editor Content Area */}
      <div
        id="journal-editor-writing-surface"
        className="flex-1 relative cursor-text"
        onClick={() => editor.commands.focus()}
      >
        {/* Inline Drafting Indicator */}
        {isDrafting && (
          <div
            id="journal-inline-drafting-indicator"
            className="mb-5 py-2.5 px-3.5 rounded bg-[#FAF7F0] border border-[#1F4B43]/20 border-l-2 border-l-[#1F4B43] text-[#1F4B43] font-serif italic text-sm flex items-center justify-between animate-pulse"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#C99A3E] animate-spin shrink-0" />
              <span>Weaving opening reflection from companion conversation…</span>
            </div>
            <span className="text-[11px] font-sans not-italic text-[#211F1C]/40">
              Esc to cancel
            </span>
          </div>
        )}

        {/* Inline Notice (e.g. prompt to chat first) */}
        {inlineNotice && (
          <div
            id="journal-inline-draft-notice"
            className="mb-4 py-2 px-3 rounded bg-[#FAF7F0] border border-[#211F1C]/15 text-[#211F1C]/80 text-xs font-serif italic flex items-center justify-between transition-all animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-[#1F4B43] shrink-0" />
              <span>{inlineNotice}</span>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setInlineNotice(null);
              }}
              className="text-[#211F1C]/40 hover:text-[#211F1C] cursor-pointer text-xs ml-2 select-none"
            >
              ✕
            </span>
          </div>
        )}

        {/* Voice Recording Active Notice */}
        {/*isRecording && (
          <div
            id="journal-voice-recording-notice"
            className="mb-4 py-2.5 px-3.5 rounded bg-[#F9EBE7] border border-[#B3432B]/30 text-[#B3432B] text-xs flex items-center justify-between transition-all animate-in fade-in"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#B3432B] animate-ping" />
              <span className="font-medium">Listening to your thoughts... Click stop when finished to transcribe.</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                stopRecording();
              }}
              className="px-2.5 py-1 text-[11px] font-medium bg-[#B3432B] text-[#FAF7F0] rounded hover:bg-[#A03A25] transition-colors"
            >
              Finish & Insert
            </button>
          </div>
        )*/}

        {/* Voice Transcribing Notice */}
        {/*isTranscribing && (
          <div
            id="journal-voice-transcribing-notice"
            className="mb-4 py-2.5 px-3.5 rounded bg-[#FAF7F0] border border-[#1F4B43]/20 text-[#1F4B43] text-xs flex items-center gap-2 transition-all animate-pulse font-serif italic"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-[#1F4B43]" />
            <span>Transcribing your audio with Gemini... Inserting reflection into document.</span>
          </div>
        )*/}

        {/* Voice Error Notice */}
        {voiceError && (
          <div
            id="journal-voice-error"
            className="mb-4 py-2.5 px-3 rounded bg-[#F9EBE7] border border-[#B3432B]/20 text-[#B3432B] text-xs flex items-center justify-between transition-all animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{voiceError}</span>
            </div>
            <div className="flex items-center gap-3">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setVoiceError(null);
                }}
                className="cursor-pointer text-[#211F1C]/50 hover:text-[#211F1C] select-none"
              >
                ✕
              </span>
            </div>
          </div>
        )}

        {/* Inline Error Notice */}
        {draftError && !isDrafting && (
          <div
            id="journal-inline-draft-error"
            className="mb-4 py-2.5 px-3 rounded bg-[#F9EBE7] border border-[#B3432B]/20 text-[#B3432B] text-xs flex items-center justify-between transition-all animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{draftError}</span>
            </div>
            <div className="flex items-center gap-3">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTriggerDraft(true);
                }}
                className="font-semibold underline cursor-pointer hover:opacity-80 select-none"
              >
                Retry (⌘J)
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setDraftError(null);
                }}
                className="cursor-pointer text-[#211F1C]/50 hover:text-[#211F1C] select-none"
              >
                ✕
              </span>
            </div>
          </div>
        )}

        {/* Inline Drafted Reflection Preview Card (Typographic slip, strictly NO bulky buttons) */}
        {draftedParagraph && !isDrafting && (
          <div
            id="journal-inline-draft-card"
            onClick={(e) => e.stopPropagation()}
            className="mb-6 p-4 rounded bg-[#FAF7F0] border border-[#1F4B43]/20 border-l-3 border-l-[#1F4B43] shadow-[0_1px_3px_rgba(31,75,67,0.06)] text-[#211F1C] transition-all animate-in fade-in slide-in-from-top-1"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#211F1C]/10 text-[11px] font-sans text-[#1F4B43] font-medium">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-bold">
                <Sparkles className="w-3 h-3 text-[#C99A3E]" />
                Companion Opening Reflection
              </span>
              <span className="text-[10px] text-[#211F1C]/45 font-sans hidden sm:inline">
                Press <strong>[Enter ↵]</strong> or <strong>[Tab]</strong> to insert &bull; <strong>[Esc]</strong> to dismiss
              </span>
            </div>

            <p className="font-serif italic text-[16px] leading-[1.6] text-[#211F1C]/90 py-1.5 select-text">
              &ldquo;{draftedParagraph}&rdquo;
            </p>

            <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-[#211F1C]/10 text-xs font-sans">
              <span className="text-[11px] text-[#211F1C]/50">
                Press <strong>↵ Enter</strong> to weave into document
              </span>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleDiscardDraft}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleDiscardDraft();
                  }}
                  className="text-[#211F1C]/50 hover:text-[#B3432B] hover:underline cursor-pointer select-none transition-colors"
                >
                  Discard (Esc)
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTriggerDraft(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleTriggerDraft(true);
                  }}
                  className="text-[#1F4B43]/70 hover:text-[#1F4B43] hover:underline cursor-pointer select-none transition-colors"
                >
                  Regenerate
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={handleConfirmInsert}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleConfirmInsert();
                  }}
                  className="text-[#1F4B43] font-semibold hover:underline cursor-pointer select-none transition-colors"
                >
                  Insert reflection ↵
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ProseMirror Content Area */}
        <EditorContent editor={editor} />

        {editor && (
          <BubbleMenu 
            editor={editor} 
            shouldShow={({ editor, view, state, from, to }) => {
              const { empty } = state.selection;
              if (empty) return false;
              const text = state.doc.textBetween(from, to, '\n');
              return text.trim().length > 0 && !editor.isActive('highlight');
            }}
          >
            <div className="flex items-center gap-1 p-1 bg-[#FAF7F0] border border-[#211F1C]/10 rounded shadow-md">
              <button
                type="button"
                onClick={handleReflectSelection}
                disabled={isReflecting}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium font-sans rounded hover:bg-[#1F4B43]/5 text-[#1F4B43] disabled:opacity-50 transition-colors"
              >
                {isReflecting ? (
                  <Sparkles className="w-3.5 h-3.5 text-[#C99A3E] animate-spin" />
                ) : (
                  <Compass className="w-3.5 h-3.5 text-[#C99A3E]" />
                )}
                {isReflecting ? 'Reflecting...' : 'Reflect on this'}
              </button>
            </div>
          </BubbleMenu>
        )}

        {activeHighlight && (
          <div
            id="journal-highlight-popover"
            className="absolute z-50 w-72 p-4 bg-[#FAF7F0] border border-[#C99A3E]/30 rounded shadow-lg animate-in fade-in zoom-in-95 font-serif text-[#211F1C]/90 text-[15px] leading-relaxed"
            style={{
              top: `${activeHighlight.top}px`,
              left: `${Math.max(10, activeHighlight.left - 100)}px`,
            }}
          >
            <p className="mb-3 italic">&ldquo;{activeHighlight.comment}&rdquo;</p>
            <div className="flex justify-end pt-2 border-t border-[#211F1C]/10">
              <button
                type="button"
                onClick={removeHighlight}
                className="text-xs font-sans text-[#211F1C]/50 hover:text-[#B3432B] transition-colors"
              >
                Remove reflection
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
