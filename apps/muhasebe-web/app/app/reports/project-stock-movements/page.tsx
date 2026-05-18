import { notFound } from "next/navigation";

import {
  ReportPrintHeader,
  ReportPrintLayout,
  ReportPrintTable,
} from "@/components/kagu/print/ReportPrint";
import { StatementPrintButton } from "@/components/kagu/StatementPrintButton";
import { getDbProjectStockMovementReport } from "@/lib/kagu/report-repository";
import { formatReportDate, formatReportQuantity } from "@/lib/kagu/report-format";

type PageProps = {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    projectId?: string;
    warehouseId?: string;
  }>;
};

export default async function ProjectStockMovementsPrintPage({ searchParams }: PageProps) {
  const params = await searchParams;

  if (!params.projectId) {
    notFound();
  }

  const report = await getDbProjectStockMovementReport(params.projectId, params);

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
          { label: "Depo Filtresi", value: params.warehouseId ?? "-" },
        ]}
        subject={projectLabel(report.project)}
        title="Proje Stok Hareketleri Ekstresi"
      />
      <ReportPrintTable>
        <thead>
          <tr>
            <th style={{ width: "9%" }}>Tarih</th>
            <th style={{ width: "11%" }}>Fis No</th>
            <th style={{ width: "14%" }}>Fis Turu</th>
            <th style={{ width: "12%" }}>Depo</th>
            <th style={{ width: "11%" }}>Malzeme Kodu</th>
            <th style={{ width: "16%" }}>Malzeme</th>
            <th style={{ width: "7%" }}>Giris</th>
            <th style={{ width: "7%" }}>Cikis</th>
            <th style={{ width: "13%" }}>Aciklama</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td>{formatReportDate(row.docDate)}</td>
              <td>{row.displayDocNo ?? row.docNo}</td>
              <td>{row.voucherTypeLabel ?? row.docType}</td>
              <td>{row.warehouseName}</td>
              <td>{row.itemCode}</td>
              <td>{row.itemName}</td>
              <td className="kagu-report-num">{formatReportQuantity(row.qtyIn)}</td>
              <td className="kagu-report-num">{formatReportQuantity(row.qtyOut)}</td>
              <td className="kagu-report-desc">{row.description ?? "-"}</td>
            </tr>
          ))}
          {!report.rows.length ? (
            <tr>
              <td className="kagu-report-empty" colSpan={9}>
                Bu tarih araliginda stok hareketi bulunamadi.
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr className="kagu-report-total-row">
            <td colSpan={6}>Toplam</td>
            <td className="kagu-report-num">{formatReportQuantity(report.summary.totalQtyIn)}</td>
            <td className="kagu-report-num">{formatReportQuantity(report.summary.totalQtyOut)}</td>
            <td />
          </tr>
        </tfoot>
      </ReportPrintTable>
    </ReportPrintLayout>
  );
}

function projectLabel(project: Record<string, unknown>) {
  return `${String(project.code ?? "")} / ${String(project.name ?? "")}`;
}
