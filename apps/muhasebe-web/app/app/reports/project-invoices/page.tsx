import { notFound } from "next/navigation";

import {
  ReportPrintHeader,
  ReportPrintLayout,
  ReportPrintTable,
} from "@/components/kagu/print/ReportPrint";
import { StatementPrintButton } from "@/components/kagu/StatementPrintButton";
import { getDbProjectInvoiceListReport } from "@/lib/kagu/report-repository";
import {
  formatReportDate,
  formatReportMoney,
  invoiceKindLabel,
} from "@/lib/kagu/report-format";

type PageProps = {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    invoiceKind?: "SALES" | "PURCHASE";
    projectId?: string;
  }>;
};

export default async function ProjectInvoicesPrintPage({ searchParams }: PageProps) {
  const params = await searchParams;

  if (!params.projectId) {
    notFound();
  }

  const report = await getDbProjectInvoiceListReport(params.projectId, params);

  if (!report) {
    notFound();
  }

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
          { label: "Fatura Filtresi", value: params.invoiceKind ? invoiceKindLabel(params.invoiceKind) : "-" },
        ]}
        subject={projectLabel(report.project)}
        title="Proje Fatura Listesi"
      />
      <ReportPrintTable>
        <thead>
          <tr>
            <th style={{ width: "9%" }}>Tarih</th>
            <th style={{ width: "12%" }}>Fis No</th>
            <th style={{ width: "13%" }}>Fis Turu</th>
            <th style={{ width: "20%" }}>Cari</th>
            <th style={{ width: "12%" }}>Depo</th>
            <th style={{ width: "10%" }}>Net</th>
            <th style={{ width: "9%" }}>KDV</th>
            <th style={{ width: "10%" }}>Toplam</th>
            <th style={{ width: "5%" }}>Para Birimi</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td>{formatReportDate(row.docDate)}</td>
              <td>{row.displayDocNo ?? row.docNo}</td>
              <td>{invoiceKindLabel(row.invoiceKind)}</td>
              <td>{row.accountLabel}</td>
              <td>{row.warehouseLabel ?? "-"}</td>
              <td className="kagu-report-num">{formatReportMoney(row.netTotalMinor, row.currency)}</td>
              <td className="kagu-report-num">{formatReportMoney(row.vatTotalMinor, row.currency)}</td>
              <td className="kagu-report-num">{formatReportMoney(row.grossTotalMinor, row.currency)}</td>
              <td>{row.currency}</td>
            </tr>
          ))}
          {!report.rows.length ? (
            <tr>
              <td className="kagu-report-empty" colSpan={9}>
                Bu tarih araliginda fatura bulunamadi.
              </td>
            </tr>
          ) : null}
        </tbody>
      </ReportPrintTable>
    </ReportPrintLayout>
  );
}

function projectLabel(project: Record<string, unknown>) {
  return String(project.name ?? "");
}
