"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  minReasonLength?: number;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  requireReason = false,
  reasonLabel = "Reason",
  reasonPlaceholder = "Enter reason...",
  minReasonLength = 3,
  loading = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requireReason && reason.trim().length < minReasonLength) {
      setError(`Please enter at least ${minReasonLength} characters.`);
      return;
    }
    setError(null);
    void onConfirm(requireReason ? reason.trim() : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={loading ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-4">
          <div className="text-sm text-[var(--text-secondary)]">{description}</div>

          {requireReason ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                {reasonLabel}
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
              />
              {error ? (
                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`h-9 rounded-lg px-4 text-xs font-semibold text-white disabled:opacity-50 ${
                variant === "danger"
                  ? "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
                  : "bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)]"
              }`}
            >
              {loading ? "Processing..." : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
