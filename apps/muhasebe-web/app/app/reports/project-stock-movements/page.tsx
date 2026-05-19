import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  ReportPrintHeader,
  ReportPrintLayout,
  ReportPrintTable,
} from "@/components/kagu/print/ReportPrint";
import { StatementPrintButton } from "@/components/kagu/StatementPrintButton";
import type { ProjectStockMovementRow } from "@/lib/kagu/contracts";
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
            <th style={{ width: "7%" }}>Giriş</th>
            <th style={{ width: "7%" }}>Çıkış</th>
            <th style={{ width: "13%" }}>Açıklama</th>
          </tr>
        </thead>
        <tbody>
          {renderGroupedRows(report.rows)}
          {!report.rows.length ? (
            <tr>
              <td className="kagu-report-empty" colSpan={9}>
                Bu tarih araliginda stok hareketi bulunamadi.
              </td>
            </tr>
          ) : null}
        </tbody>
      </ReportPrintTable>
    </ReportPrintLayout>
  );
}

function renderGroupedRows(rows: ProjectStockMovementRow[]) {
  const output: ReactNode[] = [];
  let currentItemId: string | null = null;
  let currentQtyIn = 0;
  let currentQtyOut = 0;
  let currentLabel = "";

  function pushSubtotal() {
    if (!currentItemId) {
      return;
    }

    output.push(
      <tr className="kagu-report-total-row" key={`${currentItemId}-subtotal`}>
        <td colSpan={6}>{currentLabel} ara toplam</td>
        <td className="kagu-report-num">{formatReportQuantity(currentQtyIn)}</td>
        <td className="kagu-report-num">{formatReportQuantity(currentQtyOut)}</td>
        <td />
      </tr>,
      <tr className="kagu-report-group-gap" key={`${currentItemId}-gap`}>
        <td colSpan={9} />
      </tr>,
    );
  }

  for (const row of rows) {
    if (currentItemId !== row.itemId) {
      pushSubtotal();
      currentItemId = row.itemId;
      currentQtyIn = 0;
      currentQtyOut = 0;
      currentLabel = `${row.itemCode} / ${row.itemName}`;
    }

    currentQtyIn += row.qtyIn;
    currentQtyOut += row.qtyOut;
    output.push(
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
      </tr>,
    );
  }

  pushSubtotal();

  return output;
}

function projectLabel(project: Record<string, unknown>) {
  return String(project.name ?? "");
}
