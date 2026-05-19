import { notFound } from "next/navigation";

import {
  ReportPrintHeader,
  ReportPrintLayout,
  ReportPrintTable,
} from "@/components/kagu/print/ReportPrint";
import { StatementPrintButton } from "@/components/kagu/StatementPrintButton";
import { getDbAccountStatementReport } from "@/lib/kagu/report-repository";
import {
  formatBalanceWithSide,
  formatReportDate,
  formatReportMoney,
} from "@/lib/kagu/report-format";

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
  const accountTitle = String(report.account.name ?? "");

  return (
    <ReportPrintLayout actions={<StatementPrintButton />}>
      <ReportPrintHeader
        meta={[
          {
            label: "Tarih Araligi",
            value: `${formatReportDate(params.dateFrom)} - ${formatReportDate(params.dateTo)}`,
          },
          { label: "Cari Hesap", value: accountTitle },
          { label: "Para Birimi", value: currency },
        ]}
        subject={accountTitle}
        title="Cari Hesap Ekstresi"
      />
        <ReportPrintTable>
          <thead>
            <tr>
              <th style={{ width: "10%" }}>Tarih</th>
              <th style={{ width: "14%" }}>Fis No</th>
              <th style={{ width: "14%" }}>Fis Turu</th>
              <th style={{ width: "24%" }}>Açıklama</th>
              <th style={{ width: "12%" }}>Borc</th>
              <th style={{ width: "12%" }}>Alacak</th>
              <th style={{ width: "14%" }}>Bakiye</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.id}>
                <td>{formatReportDate(row.docDate)}</td>
                <td>{row.displayDocNo ?? row.docNo}</td>
                <td>{row.voucherTypeLabel ?? row.docType}</td>
                <td className="kagu-report-desc">{row.sourceDescription ?? row.description ?? "-"}</td>
                <td className="kagu-report-num">{formatReportMoney(row.debitMinor, currency)}</td>
                <td className="kagu-report-num">{formatReportMoney(row.creditMinor, currency)}</td>
                <td className="kagu-report-num">{formatBalanceWithSide(row.runningBalanceMinor, currency)}</td>
              </tr>
            ))}
            {!report.rows.length ? (
              <tr>
                <td className="kagu-report-empty" colSpan={7}>
                  Bu tarih araliginda cari hareketi bulunamadi.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="kagu-report-total-row">
              <td colSpan={4}>Toplam</td>
              <td className="kagu-report-num">{formatReportMoney(report.debitTotalMinor, currency)}</td>
              <td className="kagu-report-num">{formatReportMoney(report.creditTotalMinor, currency)}</td>
              <td className="kagu-report-num">{formatBalanceWithSide(report.closingBalanceMinor, currency)}</td>
            </tr>
          </tfoot>
        </ReportPrintTable>
    </ReportPrintLayout>
  );
}
