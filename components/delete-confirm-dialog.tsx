'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  type: 'entry' | 'all-entries' | 'account';
  title?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  isOpen,
  type,
  title = '',
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = React.useCallback(() => {
    setConfirmInput('');
    setError(null);
    setIsDeleting(false);
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, handleClose]);

  if (!isOpen) return null;

  const isAccount = type === 'account';
  const isAllEntries = type === 'all-entries';
  const requiresVerification = isAccount || isAllEntries;
  const targetKeyword = isAccount ? 'DELETE' : 'CLEAR';
  const canSubmit = !requiresVerification || confirmInput.trim().toUpperCase() === targetKeyword;

  const handleExecute = async () => {
    if (!canSubmit || isDeleting) return;
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm();
      handleClose();
    } catch (err: any) {
      console.error('Delete execution error');
      setError(err?.message || 'Failed to complete deletion. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div
      id="delete-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#211F1C]/40 backdrop-blur-none"
      onClick={() => {
        if (!isDeleting) handleClose();
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
    >
      <div
        id="delete-modal-panel"
        className="w-full max-w-md bg-[#FAF7F0] border border-[#211F1C]/10 shadow-2xl p-6 relative rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-1 text-[#211F1C]/40 hover:text-[#211F1C] transition-colors"
          aria-label="Cancel deletion"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 mb-4">
          <div className="p-2 bg-[#F9EBE7] text-[#B3432B] rounded-full shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div>
            <h3
              id="delete-dialog-title"
              className="font-serif italic text-2xl text-[#211F1C] leading-snug"
            >
              {isAccount
                ? 'Permanently delete account and all entries?'
                : isAllEntries
                ? 'Delete all reflection sessions?'
                : `Delete "${title || 'Untitled reflection'}"?`}
            </h3>

            <p
              id="delete-dialog-desc"
              className="font-sans text-sm text-[#211F1C]/70 mt-2 leading-relaxed"
            >
              {isAccount
                ? 'This performs a permanent hard-deletion of your user partition in Firestore. All your reflection turns, syntheses, and archives will be irreversibly erased.'
                : isAllEntries
                ? 'This will permanently erase all saved reflections and conversation logs from your isolated Firestore partition. Your account will remain active. This action cannot be undone.'
                : 'This reflection will be permanently erased from your isolated Firestore partition. This action cannot be undone.'}
            </p>
          </div>
        </div>

        {requiresVerification && (
          <div className="my-4 pt-3 border-t border-[#211F1C]/10">
            <label
              htmlFor="verify-delete-input"
              className="text-[10px] font-bold tracking-widest uppercase text-[#211F1C]/60 block mb-1.5"
            >
              Type <strong className="text-[#B3432B]">{targetKeyword}</strong> to confirm:
            </label>
            <input
              id="verify-delete-input"
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={targetKeyword}
              className="w-full px-3 py-2 text-xs font-sans bg-[#F5F1E8] border border-[#211F1C]/15 focus:border-[#B3432B] outline-none text-[#211F1C] rounded-sm uppercase tracking-wider"
            />
          </div>
        )}

        {error && (
          <div className="p-3 bg-[#F9EBE7] text-[#B3432B] text-xs mb-4 rounded-sm" role="alert">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#211F1C]/10">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="text-[11px] font-bold tracking-widest uppercase text-[#211F1C]/50 hover:text-[#211F1C] px-4 py-2 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            id="confirm-delete-action-btn"
            type="button"
            onClick={handleExecute}
            disabled={!canSubmit || isDeleting}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-bold tracking-widest uppercase text-[#FAF7F0] bg-[#B3432B] hover:bg-[#8F3320] rounded-full transition-all disabled:opacity-40 cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {isDeleting
                ? 'Erasing permanently...'
                : isAccount
                ? 'Permanently erase all data'
                : isAllEntries
                ? 'Delete All Sessions'
                : 'Delete entry'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
