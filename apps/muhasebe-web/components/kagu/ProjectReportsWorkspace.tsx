"use client";

import { Alert, App, Button, Card, DatePicker, Empty, Select, Space, Statistic, Table, Tabs, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";

import {
  fetchProjectEstimatedMargin,
  fetchProjectInvoices,
  fetchProjectMaterialUsage,
  fetchProjectStockMovements,
} from "@/lib/kagu/api";
import type {
  LookupEntity,
  LookupItem,
  ProjectEstimatedMarginReport,
  ProjectInvoiceListReport,
  ProjectMaterialUsageReport,
  ProjectStockMovementReport,
} from "@/lib/kagu/contracts";
import { formatMinor, formatQuantity, selectableLookupOptions } from "@/lib/kagu/helpers";

type LookupMap = Partial<Record<LookupEntity, LookupItem[]>>;
type ReportTab = "stock" | "invoices" | "usage" | "margin";

export function ProjectReportsWorkspace({ lookups }: { lookups: LookupMap }) {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState<ReportTab>("stock");
  const [projectId, setProjectId] = useState<string>();
  const [warehouseId, setWarehouseId] = useState<string>();
  const [invoiceKind, setInvoiceKind] = useState<"SALES" | "PURCHASE">("SALES");
  const [dateRange, setDateRange] = useState<[string | undefined, string | undefined]>([
    undefined,
    undefined,
  ]);
  const [loading, setLoading] = useState(false);
  const [stockReport, setStockReport] = useState<ProjectStockMovementReport | null>(null);
  const [invoiceReport, setInvoiceReport] = useState<ProjectInvoiceListReport | null>(null);
  const [usageReport, setUsageReport] = useState<ProjectMaterialUsageReport | null>(null);
  const [marginReport, setMarginReport] = useState<ProjectEstimatedMarginReport | null>(null);
  const projectOptions = useMemo(
    () => selectableLookupOptions(lookups.projects),
    [lookups.projects],
  );
  const warehouseOptions = useMemo(
    () => selectableLookupOptions(lookups.warehouses, warehouseId),
    [lookups.warehouses, warehouseId],
  );
  const handleProjectChange = (value?: string) => {
    setProjectId(value);

    if (!value) {
      setLoading(false);
      setStockReport(null);
      setInvoiceReport(null);
      setUsageReport(null);
      setMarginReport(null);
    }
  };

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let active = true;
    queueMicrotask(() => {
      if (active) {
        setLoading(true);
      }
    });

    const [dateFrom, dateTo] = dateRange;
    const sharedQuery = { dateFrom, dateTo, warehouseId };

    const promise =
      activeTab === "stock"
        ? fetchProjectStockMovements(projectId, sharedQuery)
        : activeTab === "invoices"
          ? fetchProjectInvoices(projectId, { dateFrom, dateTo, invoiceKind })
          : activeTab === "usage"
            ? fetchProjectMaterialUsage(projectId, sharedQuery)
            : fetchProjectEstimatedMargin(projectId, { dateFrom, dateTo });

    promise
      .then((payload) => {
        if (!active) {
          return;
        }

        if (activeTab === "stock") {
          setStockReport(payload as ProjectStockMovementReport);
        } else if (activeTab === "invoices") {
          setInvoiceReport(payload as ProjectInvoiceListReport);
        } else if (activeTab === "usage") {
          setUsageReport(payload as ProjectMaterialUsageReport);
        } else {
          setMarginReport(payload as ProjectEstimatedMarginReport);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          message.error(error instanceof Error ? error.message : "Proje raporu alinamadi");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeTab, dateRange, invoiceKind, message, projectId, warehouseId]);

  return (
    <Card
      className="kagu-card"
      title="Proje Raporlari"
      extra={<Typography.Text type="secondary">v1 operasyon gorunumu</Typography.Text>}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          description="Bu yuzey proje bazli hareketi tek noktada toplar. Tahmini brut marj raporu tam P&L degil; iscilik, genel gider ve tahsilat akisi dahil edilmez."
          showIcon
          type="info"
        />
        <Space size={8} wrap>
          <Select
            allowClear
            onChange={handleProjectChange}
            options={projectOptions}
            placeholder="Proje sec"
            showSearch
            style={{ minWidth: 260 }}
            value={projectId}
          />
          <Select
            allowClear
            disabled={activeTab === "margin"}
            onChange={(value) => setWarehouseId(value)}
            options={warehouseOptions}
            placeholder="Depo"
            showSearch
            style={{ minWidth: 220 }}
            value={warehouseId}
          />
          <Select
            disabled={activeTab !== "invoices"}
            onChange={(value) => setInvoiceKind(value)}
            options={[
              { label: "Satis", value: "SALES" },
              { label: "Alis", value: "PURCHASE" },
            ]}
            placeholder="Fatura turu"
            style={{ width: 150 }}
            value={invoiceKind}
          />
          <DatePicker.RangePicker
            format="YYYY-MM-DD"
            onChange={(value) =>
              setDateRange([
                value?.[0]?.format("YYYY-MM-DD"),
                value?.[1]?.format("YYYY-MM-DD"),
              ])
            }
            value={
              dateRange[0] || dateRange[1]
                ? [
                    dateRange[0] ? dayjs(dateRange[0]) : null,
                    dateRange[1] ? dayjs(dateRange[1]) : null,
                  ]
                : null
            }
          />
          <Button
            onClick={() => {
              setWarehouseId(undefined);
              setInvoiceKind("SALES");
              setDateRange([undefined, undefined]);
            }}
          >
            Temizle
          </Button>
        </Space>
        <Tabs
          activeKey={activeTab}
          items={[
            { key: "stock", label: "Proje stok hareketleri" },
            { key: "invoices", label: "Proje bazli fatura listesi" },
            { key: "usage", label: "Proje bazli malzeme kullanimi" },
            { key: "margin", label: "Tahmini Proje Brut Marji" },
          ]}
          onChange={(value) => setActiveTab(value as ReportTab)}
        />
        {!projectId ? <Empty description="Rapor gormek icin bir proje secin" /> : null}
        {projectId && activeTab === "stock" ? (
          <StockReportPane loading={loading} report={stockReport} />
        ) : null}
        {projectId && activeTab === "invoices" ? (
          <InvoiceReportPane loading={loading} report={invoiceReport} />
        ) : null}
        {projectId && activeTab === "usage" ? (
          <UsageReportPane loading={loading} report={usageReport} />
        ) : null}
        {projectId && activeTab === "margin" ? (
          <MarginReportPane loading={loading} report={marginReport} />
        ) : null}
      </Space>
    </Card>
  );
}

function StockReportPane({
  loading,
  report,
}: {
  loading: boolean;
  report: ProjectStockMovementReport | null;
}) {
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <SummaryRow
        items={[
          { label: "Hareket", value: report?.summary.movementCount ?? 0 },
          { label: "Malzeme", value: report?.summary.distinctItemCount ?? 0 },
          { label: "Depo", value: report?.summary.distinctWarehouseCount ?? 0 },
        ]}
      />
      <Table
        columns={[
          { dataIndex: "docDate", key: "docDate", title: "Tarih" },
          { dataIndex: "docType", key: "docType", title: "Belge Tipi" },
          { dataIndex: "docNo", key: "docNo", title: "Belge No" },
          { dataIndex: "warehouseName", key: "warehouseName", title: "Depo" },
          { dataIndex: "itemCode", key: "itemCode", title: "Malzeme Kodu" },
          { dataIndex: "itemName", key: "itemName", title: "Malzeme" },
          {
            dataIndex: "qtyIn",
            key: "qtyIn",
            render: (value: unknown) => formatQuantity(value),
            title: "Giris",
          },
          {
            dataIndex: "qtyOut",
            key: "qtyOut",
            render: (value: unknown) => formatQuantity(value),
            title: "Cikis",
          },
        ]}
        dataSource={report?.rows ?? []}
        loading={loading}
        locale={{ emptyText: <Empty description="Hareket yok" /> }}
        pagination={false}
        rowKey="id"
        size="small"
      />
    </Space>
  );
}

function InvoiceReportPane({
  loading,
  report,
}: {
  loading: boolean;
  report: ProjectInvoiceListReport | null;
}) {
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <SummaryRow
        items={[
          { label: "Fatura", value: report?.summary.invoiceCount ?? 0 },
          { label: "Satis", value: report?.summary.salesCount ?? 0 },
          { label: "Alis", value: report?.summary.purchaseCount ?? 0 },
        ]}
      />
      <CurrencySummaryCard
        grossTotals={report?.summary.grossTotalsByCurrency}
        netTotals={report?.summary.netTotalsByCurrency}
      />
      <Table
        columns={[
          { dataIndex: "docDate", key: "docDate", title: "Tarih" },
          { dataIndex: "docNo", key: "docNo", title: "Fatura No" },
          { dataIndex: "invoiceKind", key: "invoiceKind", title: "Tur" },
          { dataIndex: "accountLabel", key: "accountLabel", title: "Cari" },
          { dataIndex: "warehouseLabel", key: "warehouseLabel", title: "Depo" },
          { dataIndex: "currency", key: "currency", title: "Doviz" },
          {
            dataIndex: "netTotalMinor",
            key: "netTotalMinor",
            render: (value: unknown, row: { currency: string }) => formatMinor(value, row.currency),
            title: "Net",
          },
          {
            dataIndex: "vatTotalMinor",
            key: "vatTotalMinor",
            render: (value: unknown, row: { currency: string }) => formatMinor(value, row.currency),
            title: "KDV",
          },
          {
            dataIndex: "grossTotalMinor",
            key: "grossTotalMinor",
            render: (value: unknown, row: { currency: string }) => formatMinor(value, row.currency),
            title: "Brut",
          },
          { dataIndex: "status", key: "status", title: "Durum" },
        ]}
        dataSource={report?.rows ?? []}
        loading={loading}
        locale={{ emptyText: <Empty description="Fatura yok" /> }}
        pagination={false}
        rowKey="id"
        size="small"
      />
    </Space>
  );
}

function UsageReportPane({
  loading,
  report,
}: {
  loading: boolean;
  report: ProjectMaterialUsageReport | null;
}) {
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <SummaryRow
        items={[
          { label: "Malzeme", value: report?.summary.distinctItemCount ?? 0 },
          { label: "Hareket Satiri", value: report?.summary.totalMovementCount ?? 0 },
        ]}
      />
      <Table
        columns={[
          { dataIndex: "itemCode", key: "itemCode", title: "Malzeme Kodu" },
          { dataIndex: "itemName", key: "itemName", title: "Malzeme" },
          { dataIndex: "unitLabel", key: "unitLabel", title: "Birim" },
          {
            dataIndex: "qtyOut",
            key: "qtyOut",
            render: (value: unknown) => formatQuantity(value),
            title: "Toplam Cikis",
          },
          {
            dataIndex: "qtyIn",
            key: "qtyIn",
            render: (value: unknown) => formatQuantity(value),
            title: "Toplam Iade/Giris",
          },
          {
            dataIndex: "netUsage",
            key: "netUsage",
            render: (value: unknown) => formatQuantity(value),
            title: "Net Kullanim",
          },
        ]}
        dataSource={report?.rows ?? []}
        loading={loading}
        locale={{ emptyText: <Empty description="Malzeme kullanimi yok" /> }}
        pagination={false}
        rowKey="itemId"
        size="small"
      />
    </Space>
  );
}

function MarginReportPane({
  loading,
  report,
}: {
  loading: boolean;
  report: ProjectEstimatedMarginReport | null;
}) {
  const currency = report?.summary.currency ?? undefined;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        description="Bu rapor tahmini brut marj verir. Iscilik, genel gider, tahsilat/odeme akisi ve tam proje P&L kapsam disidir."
        showIcon
        type="warning"
      />
      <SummaryRow
        items={[
          {
            label: "Satis Net",
            value: formatMinor(report?.summary.salesNetTotalMinor ?? 0, currency),
          },
          {
            label: "Tahmini Maliyet",
            value: formatMinor(report?.summary.estimatedCostTotalMinor ?? 0, currency),
          },
          {
            label: "Tahmini Brut Kar",
            value: formatMinor(report?.summary.estimatedGrossProfitMinor ?? 0, currency),
          },
          {
            label: "Tahmini Marj",
            value:
              report?.summary.estimatedMarginPercent == null
                ? "-"
                : `${report.summary.estimatedMarginPercent}%`,
          },
        ]}
      />
      <Table
        columns={[
          { dataIndex: "docDate", key: "docDate", title: "Tarih" },
          { dataIndex: "docNo", key: "docNo", title: "Fatura No" },
          {
            dataIndex: "invoiceNetTotalMinor",
            key: "invoiceNetTotalMinor",
            render: (value: unknown, row: { currency: string }) => formatMinor(value, row.currency),
            title: "Net",
          },
          {
            dataIndex: "costTotalMinor",
            key: "costTotalMinor",
            render: (value: unknown, row: { currency: string }) => formatMinor(value, row.currency),
            title: "Tahmini Maliyet",
          },
          {
            dataIndex: "profitMinor",
            key: "profitMinor",
            render: (value: unknown, row: { currency: string }) => formatMinor(value, row.currency),
            title: "Tahmini Brut Kar",
          },
          {
            dataIndex: "marginPercent",
            key: "marginPercent",
            render: (value: unknown) => (value == null ? "-" : `${value}%`),
            title: "Tahmini Marj",
          },
        ]}
        dataSource={report?.rows ?? []}
        loading={loading}
        locale={{ emptyText: <Empty description="Tahmini marj verisi yok" /> }}
        pagination={false}
        rowKey="id"
        size="small"
      />
    </Space>
  );
}

function SummaryRow({
  items,
}: {
  items: Array<{ label: string; value: number | string }>;
}) {
  return (
    <Space wrap>
      {items.map((item) => (
        <Card className="kagu-card" key={item.label} size="small">
          <Statistic title={item.label} value={item.value} />
        </Card>
      ))}
    </Space>
  );
}

function CurrencySummaryCard({
  grossTotals,
  netTotals,
}: {
  grossTotals?: Record<string, number>;
  netTotals?: Record<string, number>;
}) {
  const currencies = [...new Set([
    ...Object.keys(netTotals ?? {}),
    ...Object.keys(grossTotals ?? {}),
  ])].filter((currency) => Math.abs((netTotals?.[currency] ?? 0) + (grossTotals?.[currency] ?? 0)) > 0);

  if (!currencies.length) {
    return null;
  }

  return (
    <Card className="kagu-card" size="small" title="Doviz Bazli Ozet">
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        {currencies.map((currency) => (
          <Typography.Text key={currency}>
            {currency} net: {formatMinor(netTotals?.[currency] ?? 0, currency)} | {currency} brut:{" "}
            {formatMinor(grossTotals?.[currency] ?? 0, currency)}
          </Typography.Text>
        ))}
      </Space>
    </Card>
  );
}
