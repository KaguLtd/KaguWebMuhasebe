import { notFound } from "next/navigation";

import {
  ReportPrintHeader,
  ReportPrintLayout,
  ReportPrintTable,
} from "@/components/kagu/print/ReportPrint";
import { StatementPrintButton } from "@/components/kagu/StatementPrintButton";
import { getDbProjectEstimatedMarginReport } from "@/lib/kagu/report-repository";
import { formatReportDate, formatReportMoney } from "@/lib/kagu/report-format";

type PageProps = {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    projectId?: string;
  }>;
};

export default async function ProjectEstimatedMarginPrintPage({ searchParams }: PageProps) {
  const params = await searchParams;

  if (!params.projectId) {
    notFound();
  }

  const report = await getDbProjectEstimatedMarginReport(params.projectId, params);

  if (!report) {
    notFound();
  }

  const currency = report.summary.currency;

  return (
    <ReportPrintLayout actions={<StatementPrintButton />}>
      <ReportPrintHeader
        meta={[
          {
            label: "Tarih Araligi",
            value: `${formatReportDate(params.dateFrom)} - ${formatReportDate(params.dateTo)}`,
          },
          { label: "Proje", value: projectLabel(report.project) },
          { label: "Cari Hesap", value: String(report.project.account_label ?? "-") },
        ]}
        note="Tahmini operasyonel maliyet hesabidir; resmi muhasebe raporu degildir."
        subject={projectLabel(report.project)}
        title="Proje Tahmini Karlilik Raporu"
      />
      <ReportPrintTable>
        <thead>
          <tr>
            <th style={{ width: "12%" }}>Tarih</th>
            <th style={{ width: "18%" }}>Fis No</th>
            <th style={{ width: "17%" }}>Satış Net</th>
            <th style={{ width: "18%" }}>Tahmini Maliyet</th>
            <th style={{ width: "18%" }}>Tahmini Kar</th>
            <th style={{ width: "17%" }}>Marj %</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td>{formatReportDate(row.docDate)}</td>
              <td>{row.displayDocNo ?? row.docNo}</td>
              <td className="kagu-report-num">
                {formatReportMoney(row.invoiceNetTotalMinor, row.currency)}
              </td>
              <td className="kagu-report-num">{formatReportMoney(row.costTotalMinor, row.currency)}</td>
              <td className="kagu-report-num">{formatReportMoney(row.profitMinor, row.currency)}</td>
              <td className="kagu-report-num">{formatPercent(row.marginPercent)}</td>
            </tr>
          ))}
          {!report.rows.length ? (
            <tr>
              <td className="kagu-report-empty" colSpan={6}>
                Bu tarih araliginda tahmini karlilik verisi bulunamadi.
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr className="kagu-report-total-row">
            <td colSpan={2}>Toplam</td>
            <td className="kagu-report-num">
              {formatReportMoney(report.summary.salesNetTotalMinor, currency)}
            </td>
            <td className="kagu-report-num">
              {formatReportMoney(report.summary.estimatedCostTotalMinor, currency)}
            </td>
            <td className="kagu-report-num">
              {formatReportMoney(report.summary.estimatedGrossProfitMinor, currency)}
            </td>
            <td className="kagu-report-num">
              {formatPercent(report.summary.estimatedMarginPercent)}
            </td>
          </tr>
        </tfoot>
      </ReportPrintTable>
    </ReportPrintLayout>
  );
}

function formatPercent(value: number | null) {
  return value == null ? "-" : `${value.toLocaleString("tr-TR")}%`;
}

function projectLabel(project: Record<string, unknown>) {
  return String(project.name ?? "");
}
