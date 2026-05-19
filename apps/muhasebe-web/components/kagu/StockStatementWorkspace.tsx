"use client";

import { App, Button, Card, DatePicker, Empty, Select, Space, Table } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";

import { fetchStockStatement } from "@/lib/kagu/api";
import type { LookupEntity, LookupItem, StockStatementReport } from "@/lib/kagu/contracts";
import { formatDate, formatQuantity, selectableLookupOptions } from "@/lib/kagu/helpers";

type LookupMap = Partial<Record<LookupEntity, LookupItem[]>>;

export function StockStatementWorkspace({ lookups }: { lookups: LookupMap }) {
  const { message } = App.useApp();
  const [accountId, setAccountId] = useState<string | undefined>(
    () => initialSearchParam("accountId"),
  );
  const [projectId, setProjectId] = useState<string | undefined>(
    () => initialSearchParam("projectId"),
  );
  const [warehouseId, setWarehouseId] = useState<string | undefined>(
    () => initialSearchParam("warehouseId"),
  );
  const [itemId, setItemId] = useState<string | undefined>(
    () => initialSearchParam("itemId"),
  );
  const [dateRange, setDateRange] = useState<[string | undefined, string | undefined]>([
    initialSearchParam("dateFrom") ?? dayjs().startOf("month").format("YYYY-MM-DD"),
    initialSearchParam("dateTo") ?? dayjs().format("YYYY-MM-DD"),
  ]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<StockStatementReport | null>(null);
  const accountOptions = useMemo(
    () => selectableLookupOptions(lookups.accounts, accountId),
    [accountId, lookups.accounts],
  );
  const projectOptions = useMemo(
    () => selectableLookupOptions(lookups.projects, projectId),
    [lookups.projects, projectId],
  );
  const warehouseOptions = useMemo(
    () => selectableLookupOptions(lookups.warehouses, warehouseId),
    [lookups.warehouses, warehouseId],
  );
  const itemOptions = useMemo(
    () => selectableLookupOptions(lookups.items, itemId),
    [itemId, lookups.items],
  );
  const query = useMemo(
    () => ({
      accountId,
      dateFrom: dateRange[0],
      dateTo: dateRange[1],
      itemId,
      projectId,
      warehouseId,
    }),
    [accountId, dateRange, itemId, projectId, warehouseId],
  );

  useEffect(() => {
    void loadReport();
    // Initial URL filters should show a preview without another click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPrint() {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value) {
        params.set(key, value);
      }
    }

    window.open(`/app/reports/stock-statement?${params.toString()}`, "_blank");
  }

  async function loadReport() {
    setLoading(true);

    try {
      setReport(await fetchStockStatement(query));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Stok ekstresi getirilemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="kagu-card" title="Stok / Malzeme Hareketleri Ekstresi">
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Space size={8} wrap>
          <DatePicker.RangePicker
            format="DD.MM.YYYY"
            onChange={(value) =>
              setDateRange([
                value?.[0]?.format("YYYY-MM-DD"),
                value?.[1]?.format("YYYY-MM-DD"),
              ])
            }
            value={[
              dateRange[0] ? dayjs(dateRange[0]) : null,
              dateRange[1] ? dayjs(dateRange[1]) : null,
            ]}
          />
          <Select
            allowClear
            onChange={setAccountId}
            options={accountOptions}
            placeholder="Cari"
            showSearch
            style={{ minWidth: 220 }}
            value={accountId}
          />
          <Select
            allowClear
            onChange={setProjectId}
            options={projectOptions}
            placeholder="Proje"
            showSearch
            style={{ minWidth: 220 }}
            value={projectId}
          />
          <Select
            allowClear
            onChange={setWarehouseId}
            options={warehouseOptions}
            placeholder="Depo"
            showSearch
            style={{ minWidth: 190 }}
            value={warehouseId}
          />
          <Select
            allowClear
            onChange={setItemId}
            options={itemOptions}
            placeholder="Malzeme"
            showSearch
            style={{ minWidth: 240 }}
            value={itemId}
          />
          <Button loading={loading} onClick={() => void loadReport()}>
            Filtrele
          </Button>
          <Button onClick={openPrint} type="primary">
            PDF / Yazdır
          </Button>
        </Space>
        <Table
          columns={[
            { dataIndex: "label", key: "label", title: "Filtre" },
            { dataIndex: "value", key: "value", title: "Deger" },
          ]}
          dataSource={[
            { key: "date", label: "Tarih", value: `${formatDate(dateRange[0])} - ${formatDate(dateRange[1])}` },
            { key: "account", label: "Cari", value: selectedLabel(accountOptions, accountId) },
            { key: "project", label: "Proje", value: selectedLabel(projectOptions, projectId) },
            { key: "warehouse", label: "Depo", value: selectedLabel(warehouseOptions, warehouseId) },
            { key: "item", label: "Malzeme", value: selectedLabel(itemOptions, itemId) },
            { key: "balance", label: "Bakiye", value: "Malzeme bazinda yurur" },
          ]}
          pagination={false}
          rowKey="key"
          size="small"
        />
        <Table
          columns={[
            { dataIndex: "docDate", key: "docDate", render: formatDate, title: "Tarih", width: 104 },
            { dataIndex: "displayDocNo", key: "displayDocNo", title: "Fis No", width: 140 },
            { dataIndex: "voucherTypeLabel", key: "voucherTypeLabel", title: "Fis Turu", width: 180 },
            { dataIndex: "accountLabel", key: "accountLabel", title: "Cari", width: 220 },
            { dataIndex: "projectLabel", key: "projectLabel", title: "Proje", width: 200 },
            { dataIndex: "itemName", key: "itemName", title: "Malzeme", width: 240 },
            {
              dataIndex: "qtyIn",
              key: "qtyIn",
              render: (value: unknown) => formatQuantity(value),
              title: "Giriş",
              width: 100,
            },
            {
              dataIndex: "qtyOut",
              key: "qtyOut",
              render: (value: unknown) => formatQuantity(value),
              title: "Çıkış",
              width: 100,
            },
            {
              dataIndex: "runningBalance",
              key: "runningBalance",
              render: (value: unknown) => formatQuantity(value),
              title: "Bakiye",
              width: 110,
            },
          ]}
          dataSource={report?.rows ?? []}
          loading={loading}
          locale={{ emptyText: <Empty description="Filtreye uygun stok hareketi yok" /> }}
          pagination={{ pageSize: 20 }}
          rowKey="id"
          scroll={{ x: 1394 }}
          size="small"
        />
      </Space>
    </Card>
  );
}

function selectedLabel(options: Array<{ label: string; value: string }>, value?: string) {
  return options.find((option) => option.value === value)?.label ?? "-";
}

function initialSearchParam(key: string) {
  if (typeof window === "undefined") {
    return undefined;
  }

  return new URLSearchParams(window.location.search).get(key) ?? undefined;
}
