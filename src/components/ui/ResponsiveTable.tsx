import type { ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  mobileHide?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  footer?: ReactNode;
  mobileTitle?: (row: T) => ReactNode;
  mobileSubtitle?: (row: T) => ReactNode;
  mobileActions?: (row: T) => ReactNode;
}

export function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  emptyTitle = "No records found",
  emptyDescription = "Records appear here once entered.",
  emptyAction,
  footer,
  mobileTitle,
  mobileSubtitle,
  mobileActions,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-12 text-center">
        <p className="text-sm font-medium text-[var(--text-primary)]">{emptyTitle}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{emptyDescription}</p>
        {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(35,23,15,0.04)] md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)]">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className="transition-colors hover:bg-[var(--bg-subtle)]/60"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-[var(--text-primary)] ${
                        col.align === "right" ? "text-right tabular-nums" : ""
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer ? (
              <tfoot className="border-t border-[var(--border-strong)] bg-[var(--bg-subtle)] font-semibold text-[var(--text-primary)]">
                {footer}
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[0_1px_2px_rgba(35,23,15,0.04)]"
          >
            {mobileTitle ? (
              <div className="mb-2 flex items-start justify-between gap-2 border-b border-[var(--border-default)] pb-2">
                <div className="min-w-0 font-medium text-[var(--text-primary)]">
                  {mobileTitle(row)}
                </div>
                {mobileSubtitle ? (
                  <div className="shrink-0">{mobileSubtitle(row)}</div>
                ) : null}
              </div>
            ) : null}
            <dl className="space-y-1.5 text-sm">
              {columns
                .filter((c) => !c.mobileHide)
                .map((col) => (
                  <div
                    key={col.key}
                    className="flex items-center justify-between gap-3"
                  >
                    <dt className="text-xs text-[var(--text-muted)]">{col.header}</dt>
                    <dd className="text-right font-medium text-[var(--text-primary)] tabular-nums">
                      {col.render(row)}
                    </dd>
                  </div>
                ))}
            </dl>
            {mobileActions ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border-default)] pt-3">
                {mobileActions(row)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
