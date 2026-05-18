"use client";

import { Button, Card, DatePicker, Select, Space, Table } from "antd";
import dayjs from "dayjs";
import { useMemo, useState } from "react";

import type { LookupEntity, LookupItem } from "@/lib/kagu/contracts";
import { formatDate, selectableLookupOptions } from "@/lib/kagu/helpers";

type LookupMap = Partial<Record<LookupEntity, LookupItem[]>>;

export function StockStatementWorkspace({ lookups }: { lookups: LookupMap }) {
  const [accountId, setAccountId] = useState<string>();
  const [projectId, setProjectId] = useState<string>();
  const [warehouseId, setWarehouseId] = useState<string>();
  const [itemId, setItemId] = useState<string>();
  const [dateRange, setDateRange] = useState<[string | undefined, string | undefined]>([
    dayjs().startOf("month").format("YYYY-MM-DD"),
    dayjs().format("YYYY-MM-DD"),
  ]);
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

  function openPrint() {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries({
      accountId,
      dateFrom: dateRange[0],
      dateTo: dateRange[1],
      itemId,
      projectId,
      warehouseId,
    })) {
      if (value) {
        params.set(key, value);
      }
    }

    window.open(`/app/reports/stock-statement?${params.toString()}`, "_blank");
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
          <Button onClick={openPrint} type="primary">
            PDF / Yazdir
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
      </Space>
    </Card>
  );
}

function selectedLabel(options: Array<{ label: string; value: string }>, value?: string) {
  return options.find((option) => option.value === value)?.label ?? "-";
}
