import {
  ReportPrintHeader,
  ReportPrintLayout,
  ReportPrintTable,
} from "@/components/kagu/print/ReportPrint";
import { StatementPrintButton } from "@/components/kagu/StatementPrintButton";
import { getDbStockStatementReport } from "@/lib/kagu/report-repository";
import { formatReportDate, formatReportQuantity } from "@/lib/kagu/report-format";

type PageProps = {
  searchParams: Promise<{
    accountId?: string;
    dateFrom?: string;
    dateTo?: string;
    itemId?: string;
    projectId?: string;
    warehouseId?: string;
  }>;
};

export default async function StockStatementPrintPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const report = await getDbStockStatementReport(params);

  return (
    <ReportPrintLayout actions={<StatementPrintButton />}>
      <ReportPrintHeader
        meta={[
          {
            label: "Tarih Araligi",
            value: `${formatReportDate(params.dateFrom)} - ${formatReportDate(params.dateTo)}`,
          },
          { label: "Cari", value: recordLabel(report.account) },
          { label: "Proje", value: recordLabel(report.project) },
          { label: "Depo", value: recordLabel(report.warehouse) },
          { label: "Malzeme", value: recordLabel(report.item) },
        ]}
        note="Bakiye, malzeme bazinda yurur."
        subject={recordLabel(report.item) ?? recordLabel(report.project) ?? "Tum malzemeler"}
        title="Stok / Malzeme Hareketleri Ekstresi"
      />
      <ReportPrintTable>
        <thead>
          <tr>
            <th style={{ width: "7%" }}>Tarih</th>
            <th style={{ width: "9%" }}>Fis No</th>
            <th style={{ width: "12%" }}>Fis Turu</th>
            <th style={{ width: "13%" }}>Cari</th>
            <th style={{ width: "10%" }}>Proje</th>
            <th style={{ width: "9%" }}>Depo</th>
            <th style={{ width: "8%" }}>Malzeme Kodu</th>
            <th style={{ width: "13%" }}>Malzeme</th>
            <th style={{ width: "6%" }}>Giris</th>
            <th style={{ width: "6%" }}>Cikis</th>
            <th style={{ width: "7%" }}>Bakiye</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.id}>
              <td>{formatReportDate(row.docDate)}</td>
              <td>{row.displayDocNo}</td>
              <td>{row.voucherTypeLabel}</td>
              <td>{row.accountLabel ?? "-"}</td>
              <td>{row.projectLabel ?? "-"}</td>
              <td>{row.warehouseLabel}</td>
              <td>{row.itemCode}</td>
              <td>{row.itemName}</td>
              <td className="kagu-report-num">{formatReportQuantity(row.qtyIn)}</td>
              <td className="kagu-report-num">{formatReportQuantity(row.qtyOut)}</td>
              <td className="kagu-report-num">
                {formatReportQuantity(row.runningBalance, row.unitLabel)}
              </td>
            </tr>
          ))}
          {!report.rows.length ? (
            <tr>
              <td className="kagu-report-empty" colSpan={11}>
                Bu tarih araliginda stok hareketi bulunamadi.
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr className="kagu-report-total-row">
            <td colSpan={8}>Toplam</td>
            <td className="kagu-report-num">{formatReportQuantity(report.summary.totalQtyIn)}</td>
            <td className="kagu-report-num">{formatReportQuantity(report.summary.totalQtyOut)}</td>
            <td />
          </tr>
        </tfoot>
      </ReportPrintTable>
    </ReportPrintLayout>
  );
}

function recordLabel(record: Record<string, unknown> | null) {
  if (!record) {
    return undefined;
  }

  const code = typeof record.code === "string" ? record.code : "";
  const name = typeof record.name === "string" ? record.name : "";

  return code ? `${code} / ${name}` : name || undefined;
}
