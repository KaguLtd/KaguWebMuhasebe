import { notFound } from "next/navigation";

import {
  ReportPrintHeader,
  ReportPrintLayout,
  ReportPrintTable,
} from "@/components/kagu/print/ReportPrint";
import { StatementPrintButton } from "@/components/kagu/StatementPrintButton";
import { getDbProjectMaterialUsageReport } from "@/lib/kagu/report-repository";
import { formatReportDate, formatReportQuantity } from "@/lib/kagu/report-format";

type PageProps = {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    projectId?: string;
    warehouseId?: string;
  }>;
};

export default async function ProjectMaterialUsagePrintPage({ searchParams }: PageProps) {
  const params = await searchParams;

  if (!params.projectId) {
    notFound();
  }

  const report = await getDbProjectMaterialUsageReport(params.projectId, params);

  if (!report) {
    notFound();
  }

  return (
    <ReportPrintLayout actions={<StatementPrintButton />}>
      <ReportPrintHeader
        meta={projectMeta(report.project, params)}
        subject={projectLabel(report.project)}
        title="Proje Malzeme Kullanim Raporu"
      />
      <ReportPrintTable>
        <thead>
          <tr>
            <th style={{ width: "14%" }}>Malzeme Kodu</th>
            <th style={{ width: "32%" }}>Malzeme</th>
            <th style={{ width: "9%" }}>Birim</th>
            <th style={{ width: "11%" }}>Giriş</th>
            <th style={{ width: "11%" }}>Çıkış</th>
            <th style={{ width: "13%" }}>Net Kullanim</th>
            <th style={{ width: "10%" }}>Hareket Sayisi</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.itemId}>
              <td>{row.itemCode}</td>
              <td>{row.itemName}</td>
              <td>{row.unitLabel ?? "-"}</td>
              <td className="kagu-report-num">{formatReportQuantity(row.qtyIn)}</td>
              <td className="kagu-report-num">{formatReportQuantity(row.qtyOut)}</td>
              <td className="kagu-report-num">{formatReportQuantity(row.netUsage)}</td>
              <td className="kagu-report-num">{row.movementCount}</td>
            </tr>
          ))}
          {!report.rows.length ? emptyRow(7, "Bu tarih araliginda malzeme kullanimi bulunamadi.") : null}
        </tbody>
      </ReportPrintTable>
    </ReportPrintLayout>
  );
}

function projectMeta(project: Record<string, unknown>, params: { dateFrom?: string; dateTo?: string; warehouseId?: string }) {
  return [
    {
      label: "Tarih Araligi",
      value: `${formatReportDate(params.dateFrom)} - ${formatReportDate(params.dateTo)}`,
    },
    { label: "Proje", value: projectLabel(project) },
    { label: "Cari Hesap", value: String(project.account_label ?? "-") },
    { label: "Depo Filtresi", value: params.warehouseId ? params.warehouseId : "-" },
  ];
}

function projectLabel(project: Record<string, unknown>) {
  return String(project.name ?? "");
}

function emptyRow(colSpan: number, text: string) {
  return (
    <tr>
      <td className="kagu-report-empty" colSpan={colSpan}>{text}</td>
    </tr>
  );
}
