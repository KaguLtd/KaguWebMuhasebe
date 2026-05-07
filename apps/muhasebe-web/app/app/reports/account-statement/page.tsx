import { notFound } from "next/navigation";

import { StatementPrintButton } from "@/components/kagu/StatementPrintButton";
import { formatMinor } from "@/lib/kagu/helpers";
import { getDbAccountStatementReport } from "@/lib/kagu/report-repository";

type PageProps = {
  searchParams: Promise<{
    accountId?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
};

export default async function AccountStatementPrintPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  if (!params.accountId) {
    notFound();
  }

  const report = await getDbAccountStatementReport(
    params.accountId,
    params.dateFrom,
    params.dateTo,
  );

  if (!report) {
    notFound();
  }

  const currency = typeof report.account.currency === "string"
    ? report.account.currency
    : "TRY";
  const accountTitle = `${String(report.account.code ?? "")} - ${String(
    report.account.name ?? "",
  )}`;

  return (
    <main className="kagu-print-page">
      <section className="kagu-print-sheet">
        <header className="kagu-print-header">
          <div>
            <p className="kagu-section-kicker">KAGU ERP Cari Ekstre</p>
            <h1>{accountTitle}</h1>
            <p>
              Tarih araligi: {params.dateFrom ?? "-"} / {params.dateTo ?? "-"}
            </p>
          </div>
          <div className="kagu-print-actions">
            <StatementPrintButton />
          </div>
        </header>
        <div className="kagu-print-summary">
          <strong>Borc: {formatMinor(report.debitTotalMinor, currency)}</strong>
          <strong>Alacak: {formatMinor(report.creditTotalMinor, currency)}</strong>
          <strong>Bakiye: {formatMinor(report.closingBalanceMinor, currency)}</strong>
        </div>
        <table className="kagu-print-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Evrak No</th>
              <th>Aciklama</th>
              <th>Borc</th>
              <th>Alacak</th>
              <th>Bakiye</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.docDate}</td>
                <td>{row.docNo}</td>
                <td>{row.description ?? "-"}</td>
                <td>{formatMinor(row.debitMinor, currency)}</td>
                <td>{formatMinor(row.creditMinor, currency)}</td>
                <td>{formatMinor(row.runningBalanceMinor, currency)}</td>
              </tr>
            ))}
            {!report.rows.length ? (
              <tr>
                <td colSpan={6}>Bu tarih araliginda cari hareketi yok.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
