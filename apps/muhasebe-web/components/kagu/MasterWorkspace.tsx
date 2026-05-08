"use client";

import {
  App,
  Button,
  Card,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TablePaginationConfig } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useDeferredValue, useEffect, useState } from "react";

import { FieldInput } from "./FieldInput";
import type { FieldConfig, MasterModuleConfig } from "@/lib/kagu/config";
import type {
  AccountStatementReport,
  DataRecord,
  ItemMovementReport,
  LookupEntity,
  LookupItem,
  MasterEntity,
  SaveMasterPayload,
  WarehouseInventoryReport,
} from "@/lib/kagu/contracts";
import {
  fetchAccountStatement,
  fetchItemMovements,
  fetchMasters,
  fetchNextMasterCode,
  fetchWarehouseInventory,
  saveMasterRecord,
} from "@/lib/kagu/api";
import {
  camelToSnake,
  formatBoolean,
  formatMinor,
  formatQuantity,
  formatRateBps,
  humanizeEnum,
  parseMoneyToMinor,
  relationLookupByColumn,
  selectableLookupOptions,
} from "@/lib/kagu/helpers";

type LookupMap = Partial<Record<LookupEntity, LookupItem[]>>;
type MasterDetailReport =
  | AccountStatementReport
  | WarehouseInventoryReport
  | ItemMovementReport;

interface MasterWorkspaceProps {
  config: MasterModuleConfig;
  lookups: LookupMap;
  compact?: boolean;
  onDataChanged?: () => void;
}

export function MasterWorkspace({
  config,
  lookups,
  compact = false,
  onDataChanged,
}: MasterWorkspaceProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<SaveMasterPayload>();
  const [rows, setRows] = useState<DataRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState<string | undefined>();
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [editing, setEditing] = useState<DataRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailReport, setDetailReport] = useState<MasterDetailReport | null>(null);
  const [detailRecord, setDetailRecord] = useState<DataRecord | null>(null);
  const [lastSuggestedCode, setLastSuggestedCode] = useState<string | null>(null);
  const [statementRange, setStatementRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().startOf("month"),
    dayjs(),
  ]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    fetchMasters(config.entity, {
      search: deferredSearch,
      status,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
      .then((result) => {
        if (!active) {
          return;
        }

        setRows(result.items);
        setTotal(result.total);
      })
      .catch((error: unknown) => {
        if (active) {
          message.error(error instanceof Error ? error.message : "Liste alinamadi");
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
  }, [
    config.entity,
    deferredSearch,
    message,
    pagination.page,
    pagination.pageSize,
    reloadKey,
    status,
  ]);

  async function openNewRecord() {
    const defaults = defaultFormValues(config);

    setEditing(null);
    setLastSuggestedCode(null);
    form.resetFields();
    form.setFieldsValue(defaults);
    setDrawerOpen(true);

    await suggestAndApplyCode(defaults, true);
  }

  function openExistingRecord(record: DataRecord) {
    setEditing(record);
    setLastSuggestedCode(null);
    form.resetFields();
    form.setFieldsValue(toFormValues(config, record));
    setDrawerOpen(true);
  }

  async function suggestAndApplyCode(
    values: SaveMasterPayload = form.getFieldsValue(),
    forceNew = false,
  ) {
    if ((!forceNew && editing) || !hasCodeField(config)) {
      return;
    }

    const currentCode = form.getFieldValue("code");

    if (currentCode && currentCode !== lastSuggestedCode) {
      return;
    }

    try {
      const code = await fetchNextMasterCode(config.entity, {
        accountKind: values.accountKind ?? form.getFieldValue("accountKind"),
        classId: values.classId ?? form.getFieldValue("classId"),
      });

      if (!code) {
        return;
      }

      setLastSuggestedCode(code);
      form.setFieldValue("code", code);
    } catch (error) {
      window.setTimeout(() => {
        message.warning(
          error instanceof Error ? error.message : "Kod onerisi alinamadi",
        );
      }, 0);
    }
  }

  async function openDetailRecord(record: DataRecord) {
    const id = typeof record.id === "string" ? record.id : null;

    if (!id || !supportsDetail(config.entity)) {
      return;
    }

    setDetailReport(null);
    setDetailRecord(record);
    setDetailLoading(true);
    setDetailOpen(true);

    try {
      const report = await fetchMasterDetail(config.entity, id, statementRange);

      setDetailReport(report);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Hareket alinamadi");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function reloadAccountStatement(range = statementRange) {
    const id = typeof detailRecord?.id === "string" ? detailRecord.id : null;

    if (!id || config.entity !== "accounts") {
      return;
    }

    setDetailLoading(true);

    try {
      const report = await fetchMasterDetail("accounts", id, range);

      setDetailReport(report);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Cari hareketleri alinamadi");
    } finally {
      setDetailLoading(false);
    }
  }

  function openStatementPrint() {
    const id = typeof detailRecord?.id === "string" ? detailRecord.id : null;

    if (!id) {
      return;
    }

    const params = new URLSearchParams({
      accountId: id,
      dateFrom: statementRange[0].format("YYYY-MM-DD"),
      dateTo: statementRange[1].format("YYYY-MM-DD"),
    });

    window.open(`/app/reports/account-statement?${params.toString()}`, "_blank");
  }

  async function handleSave() {
    setSaving(true);

    try {
      const values = await form.validateFields();
      const payload = prepareSavePayload(config, values, editing);

      await saveMasterRecord(config.entity, payload);
      message.success("Kayit saklandi");
      setDrawerOpen(false);
      setLoading(true);
      setReloadKey((value) => value + 1);
      onDataChanged?.();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleTableChange(nextPagination: TablePaginationConfig) {
    setLoading(true);
    setPagination({
      page: nextPagination.current ?? 1,
      pageSize: nextPagination.pageSize ?? 20,
    });
  }

  const hasActiveFilter = config.fields.some((field) => field.name === "isActive");
  const hasDetail = supportsDetail(config.entity);

  return (
    <Card
      className="kagu-card"
      title={
        <Space orientation="vertical" size={0}>
          <Typography.Text className="kagu-section-kicker">
            Master Data
          </Typography.Text>
          <Typography.Title level={compact ? 5 : 3} style={{ margin: 0 }}>
            {config.title}
          </Typography.Title>
        </Space>
      }
      extra={
        <Button type="primary" onClick={openNewRecord}>
          Yeni Kayit
        </Button>
      }
    >
      <Space className="kagu-table-toolbar" wrap>
        <Input.Search
          allowClear
          onChange={(event) => {
            setLoading(true);
            setSearch(event.target.value);
            setPagination((value) => ({ ...value, page: 1 }));
          }}
          placeholder="Kod, ad veya iliskili alanda ara"
          value={search}
        />
        {hasActiveFilter ? (
          <Select
            allowClear
            onChange={(value) => {
              setLoading(true);
              setStatus(value);
              setPagination((current) => ({ ...current, page: 1 }));
            }}
            options={[
              { label: "Aktif", value: "ACTIVE" },
              { label: "Pasif", value: "PASSIVE" },
            ]}
            placeholder="Durum"
            style={{ width: 140 }}
            value={status}
          />
        ) : null}
      </Space>
      <Table<DataRecord>
        columns={[
          ...config.columns.map((column) => ({
            dataIndex: column.key,
            key: column.key,
            title: column.title,
            render: (value: unknown, record: DataRecord) =>
              renderCell(column.key, value, record, lookups),
          })),
          {
            key: "actions",
            render: (_value: unknown, record: DataRecord) => (
              <Space>
                <Button type="link" onClick={() => openExistingRecord(record)}>
                  Duzenle
                </Button>
                {hasDetail ? (
                  <Button type="link" onClick={() => openDetailRecord(record)}>
                    Hareket
                  </Button>
                ) : null}
              </Space>
            ),
            title: "",
            width: hasDetail ? 170 : 92,
          },
        ]}
        dataSource={rows}
        loading={loading}
        onChange={handleTableChange}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          showSizeChanger: true,
          total,
        }}
        rowKey={(record) => String(record.id)}
        size="middle"
      />
      <Drawer
        destroyOnHidden
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        size="min(720px, 96vw)"
        title={editing ? `${config.title} Duzenle` : `${config.title} Yeni`}
      >
        <Form form={form} layout="vertical">
          {config.fields.map((field) => (
            <MasterFieldInput
              currentRecord={editing}
              field={field}
              key={field.name}
              lookups={lookups}
              onSuggestCode={suggestAndApplyCode}
            />
          ))}
        </Form>
        <Space className="kagu-drawer-actions">
          <Button onClick={() => setDrawerOpen(false)}>Vazgec</Button>
          <Button loading={saving} onClick={handleSave} type="primary">
            Kaydet
          </Button>
        </Space>
      </Drawer>
      <Drawer
        destroyOnHidden
        onClose={() => setDetailOpen(false)}
        open={detailOpen}
        size="min(900px, 96vw)"
        title={`${config.title} Hareketleri`}
      >
        <MasterDetailPane
          entity={config.entity}
          loading={detailLoading}
          onOpenStatementPrint={openStatementPrint}
          onReloadAccountStatement={reloadAccountStatement}
          report={detailReport}
          statementRange={statementRange}
          setStatementRange={setStatementRange}
        />
      </Drawer>
    </Card>
  );
}

function MasterFieldInput({
  currentRecord,
  field,
  lookups,
  onSuggestCode,
}: {
  currentRecord: DataRecord | null;
  field: FieldConfig;
  lookups: LookupMap;
  onSuggestCode: (values?: SaveMasterPayload) => Promise<void>;
}) {
  const rules = field.required
    ? [{ required: true, message: `${field.label} gerekli` }]
    : undefined;

  if (field.name === "accountKind" && field.type === "select") {
    const isLegacyBoth = currentRecord?.account_kind === "BOTH";
    const options = (field.options ?? []).filter(
      (option) => option.value !== "BOTH" || isLegacyBoth,
    );

    return (
      <Form.Item label={field.label} name={field.name} rules={rules}>
        <Select
          onChange={(value) => {
            void onSuggestCode({ accountKind: value });
          }}
          options={options}
        />
      </Form.Item>
    );
  }

  if (field.name === "classId" && field.type === "select") {
    return (
      <Form.Item label={field.label} name={field.name} rules={rules}>
        <Select
          allowClear={!field.required}
          onChange={(value) => {
            void onSuggestCode({ classId: value });
          }}
          optionFilterProp="label"
          options={selectableLookupOptions(lookups.itemClasses)}
          showSearch
        />
      </Form.Item>
    );
  }

  return <FieldInput field={field} lookups={lookups} />;
}

function MasterDetailPane({
  entity,
  loading,
  onOpenStatementPrint,
  onReloadAccountStatement,
  report,
  statementRange,
  setStatementRange,
}: {
  entity: MasterEntity;
  loading: boolean;
  onOpenStatementPrint: () => void;
  onReloadAccountStatement: (range?: [Dayjs, Dayjs]) => Promise<void>;
  report: MasterDetailReport | null;
  statementRange: [Dayjs, Dayjs];
  setStatementRange: (range: [Dayjs, Dayjs]) => void;
}) {
  if (loading) {
    return (
      <div className="kagu-loader">
        <Spin />
      </div>
    );
  }

  if (!report) {
    return <Empty description="Hareket bulunamadi" />;
  }

  if (entity === "accounts" && "closingBalanceMinor" in report) {
    const currency = String(report.account.currency ?? "TRY");

    return (
      <Space orientation="vertical" size={14} style={{ width: "100%" }}>
        <Typography.Text className="kagu-section-kicker">
          Cari Ekstre
        </Typography.Text>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {recordTitle(report.account)}
        </Typography.Title>
        <Space wrap>
          <DatePicker.RangePicker
            format="YYYY-MM-DD"
            onChange={(value) => {
              if (value?.[0] && value[1]) {
                const nextRange: [Dayjs, Dayjs] = [value[0], value[1]];

                setStatementRange(nextRange);
                void onReloadAccountStatement(nextRange);
              }
            }}
            value={statementRange}
          />
          <Button onClick={() => void onReloadAccountStatement()}>
            Cari Hareketleri
          </Button>
          <Button onClick={onOpenStatementPrint} type="primary">
            Ekstre PDF
          </Button>
        </Space>
        <Space wrap>
          <Tag color="blue">
            Borc {formatMinor(report.debitTotalMinor, currency)}
          </Tag>
          <Tag color="gold">
            Alacak {formatMinor(report.creditTotalMinor, currency)}
          </Tag>
          <Tag color="green">
            Bakiye {formatMinor(report.closingBalanceMinor, currency)}
          </Tag>
        </Space>
        <Table
          columns={[
            { dataIndex: "docDate", key: "docDate", title: "Tarih" },
            { dataIndex: "docNo", key: "docNo", title: "Evrak No" },
            { dataIndex: "description", key: "description", title: "Aciklama" },
            {
              dataIndex: "debitMinor",
              key: "debitMinor",
              render: (value: unknown) => formatMinor(value, currency),
              title: "Borc",
            },
            {
              dataIndex: "creditMinor",
              key: "creditMinor",
              render: (value: unknown) => formatMinor(value, currency),
              title: "Alacak",
            },
            {
              dataIndex: "runningBalanceMinor",
              key: "runningBalanceMinor",
              render: (value: unknown) => formatMinor(value, currency),
              title: "Bakiye",
            },
          ]}
          dataSource={report.rows}
          locale={{ emptyText: <Empty description="Cari hareketi yok" /> }}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </Space>
    );
  }

  if (entity === "warehouses" && "warehouse" in report) {
    return (
      <Space orientation="vertical" size={14} style={{ width: "100%" }}>
        <Typography.Text className="kagu-section-kicker">
          Depo Stok Durumu
        </Typography.Text>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {recordTitle(report.warehouse)}
        </Typography.Title>
        <Table
          columns={[
            { dataIndex: "itemCode", key: "itemCode", title: "Kod" },
            { dataIndex: "itemName", key: "itemName", title: "Malzeme" },
            { dataIndex: "unitLabel", key: "unitLabel", title: "Birim" },
            {
              dataIndex: "quantity",
              key: "quantity",
              render: (value: unknown) => formatQuantity(value),
              title: "Miktar",
            },
          ]}
          dataSource={report.rows}
          locale={{ emptyText: <Empty description="Bu depoda hareket yok" /> }}
          pagination={false}
          rowKey="itemId"
          size="small"
        />
      </Space>
    );
  }

  if (entity === "items" && "item" in report) {
    return (
      <Space orientation="vertical" size={14} style={{ width: "100%" }}>
        <Typography.Text className="kagu-section-kicker">
          Malzeme Hareketleri
        </Typography.Text>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {recordTitle(report.item)}
        </Typography.Title>
        <Table
          columns={[
            { dataIndex: "docDate", key: "docDate", title: "Tarih" },
            { dataIndex: "docNo", key: "docNo", title: "Evrak No" },
            { dataIndex: "warehouseName", key: "warehouseName", title: "Depo" },
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
          dataSource={report.rows}
          locale={{ emptyText: <Empty description="Malzeme hareketi yok" /> }}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </Space>
    );
  }

  return <Empty description="Bu kart icin hareket raporu hazir degil" />;
}

function renderCell(
  key: string,
  value: unknown,
  record: DataRecord,
  lookups: LookupMap,
) {
  const lookupEntity = relationLookupByColumn[key];
  const rowCurrency = typeof record.currency === "string" ? record.currency : null;

  if (lookupEntity) {
    const label = (lookups[lookupEntity] ?? []).find((item) => item.id === value)?.label;

    return label ?? String(value ?? "-");
  }

  if (key.endsWith("_minor")) {
    return <span className="kagu-money">{formatMinor(value, rowCurrency)}</span>;
  }

  if (key === "rate_bps" || key.endsWith("_bps")) {
    return <Tag color="gold">{formatRateBps(value)}</Tag>;
  }

  if (key === "is_active") {
    return (
      <Tag color={value === false ? "default" : "green"}>
        {formatBoolean(value)}
      </Tag>
    );
  }

  if (key === "status") {
    return <Tag>{humanizeEnum(value)}</Tag>;
  }

  if (typeof value === "boolean") {
    return formatBoolean(value);
  }

  if (typeof value === "number") {
    return formatQuantity(value);
  }

  return value ? String(value) : "-";
}

function defaultFormValues(config: MasterModuleConfig) {
  const values: SaveMasterPayload = {};

  for (const field of config.fields) {
    if (field.type === "switch") {
      values[field.name] = true;
    }

    if (field.name === "currency") {
      values[field.name] = "TRY";
    }

    if (field.name === "accountKind") {
      values[field.name] = "CUSTOMER";
    }
  }

  return values;
}

function toFormValues(config: MasterModuleConfig, record: DataRecord) {
  const values: SaveMasterPayload = {};

  for (const field of config.fields) {
    if (field.name === "rateBps") {
      values[field.name] = Number(record.rate_bps ?? 0) / 100;
      continue;
    }

    const storageKey = camelToSnake(field.name);
    let value: unknown = record[storageKey];

    if (field.moneyMinor) {
      value = Number(value ?? 0) / 100;
    }

    if (field.type === "switch") {
      value = value !== false;
    }

    values[field.name] = value as SaveMasterPayload[string];
  }

  return values;
}

function prepareSavePayload(
  config: MasterModuleConfig,
  values: SaveMasterPayload,
  editing: DataRecord | null,
) {
  const payload: SaveMasterPayload = {
    ...values,
    id: typeof editing?.id === "string" ? editing.id : undefined,
  };

  for (const field of config.fields) {
    if (field.moneyMinor) {
      payload[field.name] = parseMoneyToMinor(payload[field.name]);
    }
  }

  return payload;
}

function supportsDetail(entity: MasterEntity) {
  return entity === "accounts" || entity === "warehouses" || entity === "items";
}

function fetchMasterDetail(
  entity: MasterEntity,
  id: string,
  statementRange?: [Dayjs, Dayjs],
) {
  if (entity === "accounts") {
    return fetchAccountStatement(id, {
      dateFrom: statementRange?.[0].format("YYYY-MM-DD"),
      dateTo: statementRange?.[1].format("YYYY-MM-DD"),
    });
  }

  if (entity === "warehouses") {
    return fetchWarehouseInventory(id);
  }

  if (entity === "items") {
    return fetchItemMovements(id);
  }

  throw new Error("Hareket raporu desteklenmiyor");
}

function hasCodeField(config: MasterModuleConfig) {
  return config.fields.some((field) => field.name === "code");
}

function recordTitle(record: DataRecord) {
  const code = typeof record.code === "string" ? record.code : "";
  const name = typeof record.name === "string" ? record.name : "";

  return code ? `${code} - ${name}` : name || String(record.id ?? "");
}
