"use client";

import { Download } from "lucide-react";

export function ExportButtons({
  onExcel,
  onCsv,
  onPdf,
}: {
  onExcel?: () => void;
  onCsv?: () => void;
  onPdf?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {onExcel ? (
        <button
          type="button"
          onClick={onExcel}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
        >
          <Download className="h-3.5 w-3.5" />
          Excel
        </button>
      ) : null}
      {onCsv ? (
        <button
          type="button"
          onClick={onCsv}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      ) : null}
      {onPdf ? (
        <button
          type="button"
          onClick={onPdf}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 text-xs font-semibold text-white hover:bg-[var(--brand-hover)]"
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </button>
      ) : null}
    </div>
  );
}
