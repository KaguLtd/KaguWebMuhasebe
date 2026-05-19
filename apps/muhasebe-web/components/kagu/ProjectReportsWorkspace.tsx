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
import { formatDate, formatMinor, formatQuantity, selectableLookupOptions } from "@/lib/kagu/helpers";

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

  function openProjectPrint() {
    if (!projectId) {
      return;
    }

    const [dateFrom, dateTo] = dateRange;
    const params = new URLSearchParams({ projectId });
    const routeByTab: Record<ReportTab, string> = {
      invoices: "project-invoices",
      margin: "project-estimated-margin",
      stock: "project-stock-movements",
      usage: "project-material-usage",
    };

    if (dateFrom) {
      params.set("dateFrom", dateFrom);
    }

    if (dateTo) {
      params.set("dateTo", dateTo);
    }

    if (warehouseId && activeTab !== "invoices" && activeTab !== "margin") {
      params.set("warehouseId", warehouseId);
    }

    if (activeTab === "invoices") {
      params.set("invoiceKind", invoiceKind);
    }

    window.open(`/app/reports/${routeByTab[activeTab]}?${params.toString()}`, "_blank");
  }

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
      title="Proje Raporları"
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Space size={8} wrap>
          <Select
            allowClear
            onChange={handleProjectChange}
            options={projectOptions}
            placeholder="Proje seç"
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
              { label: "Satış", value: "SALES" },
              { label: "Alış", value: "PURCHASE" },
            ]}
            placeholder="Fatura türü"
            style={{ width: 150 }}
            value={invoiceKind}
          />
          <DatePicker.RangePicker
            format="DD.MM.YYYY"
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
          <Button disabled={!projectId} onClick={openProjectPrint} type="primary">
            PDF / Yazdır
          </Button>
        </Space>
        <Tabs
          activeKey={activeTab}
          items={[
            { key: "stock", label: "Proje stok etkili evrakları" },
            { key: "invoices", label: "Proje bazlı fatura listesi" },
            { key: "usage", label: "Proje bazlı malzeme kullanımı" },
            { key: "margin", label: "Tahmini Proje Brüt Marjı" },
          ]}
          onChange={(value) => setActiveTab(value as ReportTab)}
        />
        {!projectId ? <Empty description="Rapor görmek için bir proje seçin" /> : null}
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
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <SummaryRow
        items={[
          { label: "Evrak", value: report?.summary.movementCount ?? 0 },
          { label: "Malzeme", value: report?.summary.distinctItemCount ?? 0 },
          { label: "Depo", value: report?.summary.distinctWarehouseCount ?? 0 },
        ]}
      />
      <Table
        columns={[
          { dataIndex: "docDate", key: "docDate", render: formatDate, title: "Tarih" },
          { dataIndex: "docType", key: "docType", title: "Evrak Tipi" },
          { dataIndex: "docNo", key: "docNo", title: "Sistem Evrak No" },
          { dataIndex: "warehouseName", key: "warehouseName", title: "Depo" },
          { dataIndex: "itemCode", key: "itemCode", title: "Malzeme Kodu" },
          { dataIndex: "itemName", key: "itemName", title: "Malzeme" },
          {
            dataIndex: "qtyIn",
            key: "qtyIn",
            render: (value: unknown) => formatQuantity(value),
            title: "Giriş",
          },
          {
            dataIndex: "qtyOut",
            key: "qtyOut",
            render: (value: unknown) => formatQuantity(value),
            title: "Çıkış",
          },
        ]}
        dataSource={report?.rows ?? []}
        loading={loading}
        locale={{ emptyText: <Empty description="Stok etkili evrak yok" /> }}
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
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <SummaryRow
        items={[
          { label: "Fatura", value: report?.summary.invoiceCount ?? 0 },
          { label: "Satış", value: report?.summary.salesCount ?? 0 },
          { label: "Alış", value: report?.summary.purchaseCount ?? 0 },
        ]}
      />
      <CurrencySummaryCard
        grossTotals={report?.summary.grossTotalsByCurrency}
        netTotals={report?.summary.netTotalsByCurrency}
      />
      <Table
        columns={[
          { dataIndex: "docDate", key: "docDate", render: formatDate, title: "Tarih" },
          { dataIndex: "docNo", key: "docNo", title: "Sistem Evrak No" },
          { dataIndex: "invoiceKind", key: "invoiceKind", title: "Fatura Türü" },
          { dataIndex: "accountLabel", key: "accountLabel", title: "Cari" },
          { dataIndex: "warehouseLabel", key: "warehouseLabel", title: "Depo" },
          { dataIndex: "currency", key: "currency", title: "Para Birimi" },
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
            title: "Brüt",
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
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <SummaryRow
        items={[
          { label: "Malzeme", value: report?.summary.distinctItemCount ?? 0 },
          { label: "Evrak Satırı", value: report?.summary.totalMovementCount ?? 0 },
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
            title: "Toplam Çıkış",
          },
          {
            dataIndex: "qtyIn",
            key: "qtyIn",
            render: (value: unknown) => formatQuantity(value),
            title: "Toplam İade/Giriş",
          },
          {
            dataIndex: "netUsage",
            key: "netUsage",
            render: (value: unknown) => formatQuantity(value),
            title: "Net Kullanım",
          },
        ]}
        dataSource={report?.rows ?? []}
        loading={loading}
        locale={{ emptyText: <Empty description="Malzeme kullanımı yok" /> }}
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
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        showIcon
        title="Tahmini brüt marjdır; tam P&L değildir."
        type="warning"
      />
      <SummaryRow
        items={[
          {
            label: "Satış Net",
            value: formatMinor(report?.summary.salesNetTotalMinor ?? 0, currency),
          },
          {
            label: "Tahmini Maliyet",
            value: formatMinor(report?.summary.estimatedCostTotalMinor ?? 0, currency),
          },
          {
            label: "Tahmini Brüt Kâr",
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
          { dataIndex: "docDate", key: "docDate", render: formatDate, title: "Tarih" },
          { dataIndex: "docNo", key: "docNo", title: "Sistem Evrak No" },
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
            title: "Tahmini Brüt Kâr",
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
    <Card className="kagu-card" size="small" title="Para Birimi Bazlı Özet">
      <Space orientation="vertical" size={8} style={{ width: "100%" }}>
        {currencies.map((currency) => (
          <Typography.Text key={currency}>
            {currency} net: {formatMinor(netTotals?.[currency] ?? 0, currency)} | {currency} brüt:{" "}
            {formatMinor(grossTotals?.[currency] ?? 0, currency)}
          </Typography.Text>
        ))}
      </Space>
    </Card>
  );
}
