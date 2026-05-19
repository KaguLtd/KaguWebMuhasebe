import type { ReactNode } from "react";

import { formatReportDate } from "@/lib/kagu/report-format";

export type ReportMetaItem = {
  label: string;
  value?: ReactNode;
};

export function ReportPrintLayout({
  actions,
  children,
}: {
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="kagu-report-print-page">
      <section className="kagu-report-print-sheet">
        {actions ? <div className="kagu-print-actions">{actions}</div> : null}
        {children}
      </section>
    </main>
  );
}

export function ReportPrintHeader({
  meta,
  note,
  reportDate,
  subject,
  title,
}: {
  meta: ReportMetaItem[];
  note?: ReactNode;
  reportDate?: string;
  subject?: ReactNode;
  title: string;
}) {
  return (
    <header className="kagu-report-print-header">
      <div className="kagu-report-print-topline">
        <span>Rapor Tarihi: {formatReportDate(reportDate ?? new Date())}</span>
        <strong>{title}</strong>
        <span>Sayfa: 1</span>
      </div>
      <div className="kagu-report-print-company">Kagu Design Ltd.</div>
      {subject ? <div className="kagu-report-print-subject">{subject}</div> : null}
      <dl className="kagu-report-print-meta">
        {meta.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value || "-"}</dd>
          </div>
        ))}
      </dl>
      {note ? <p className="kagu-report-print-note">{note}</p> : null}
    </header>
  );
}

export function ReportPrintTable({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <table className={`kagu-report-print-table ${className}`.trim()}>{children}</table>;
}
