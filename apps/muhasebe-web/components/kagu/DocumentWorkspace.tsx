"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TablePaginationConfig } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";

import { FieldInput } from "./FieldInput";
import type { DocumentModuleConfig, FieldConfig } from "@/lib/kagu/config";
import {
  approveDocumentRecord,
  fetchDocumentDetail,
  fetchDocuments,
  fetchInvoiceMetrics,
  saveDocumentDraft,
  voidDocumentRecord,
} from "@/lib/kagu/api";
import type {
  DataRecord,
  DocumentDetail,
  DocumentEntity,
  DocumentPayload,
  InvoiceMetrics,
  Currency,
  ListQuery,
  LookupEntity,
  LookupItem,
} from "@/lib/kagu/contracts";
import {
  camelToSnake,
  formatBoolean,
  formatMinor,
  formatQuantity,
  humanizeEnum,
  parseMoneyToMinor,
  relationLookupByColumn,
  selectableLookupOptions,
} from "@/lib/kagu/helpers";

type LookupMap = Partial<Record<LookupEntity, LookupItem[]>>;

interface DocumentWorkspaceProps {
  module: DocumentModuleConfig;
  lookups: LookupMap;
  onDataChanged?: () => void | Promise<void>;
}

type DocumentFormValues = DocumentPayload & {
  lines?: Array<Record<string, unknown>>;
};

export function DocumentWorkspace({
  module,
  lookups,
  onDataChanged,
}: DocumentWorkspaceProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<DocumentFormValues>();
  const [rows, setRows] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<DataRecord | null>(null);
  const [detail, setDetail] = useState<DocumentDetail<DataRecord> | null>(null);
  const [invoiceMetrics, setInvoiceMetrics] = useState<InvoiceMetrics | null>(null);
  const [voidTarget, setVoidTarget] = useState<DataRecord | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [filters, setFilters] = useState<ListQuery>({});
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const watchedAccountId = Form.useWatch("accountId", form) as string | undefined;
  const watchedProjectId = Form.useWatch("projectId", form) as string | undefined;
  const watchedFromAccountId = Form.useWatch("fromAccountId", form) as
    | string
    | undefined;
  const watchedToAccountId = Form.useWatch("toAccountId", form) as string | undefined;
  const watchedInvoiceType = Form.useWatch("invoiceType", form) as
    | string
    | undefined;
  const selectedAccount = useMemo(
    () => findLookup(lookups.accounts, watchedAccountId),
    [lookups.accounts, watchedAccountId],
  );
  const selectedFromAccount = useMemo(
    () => findLookup(lookups.accounts, watchedFromAccountId),
    [lookups.accounts, watchedFromAccountId],
  );
  const selectedToAccount = useMemo(
    () => findLookup(lookups.accounts, watchedToAccountId),
    [lookups.accounts, watchedToAccountId],
  );
  const availableProjects = useMemo(
    () => filterProjectsByAccount(lookups.projects ?? [], selectedAccount),
    [lookups.projects, selectedAccount],
  );
  const filterAccount = useMemo(
    () => findLookup(lookups.accounts, filters.accountId),
    [filters.accountId, lookups.accounts],
  );
  const availableFilterProjects = useMemo(
    () => filterProjectsByAccount(lookups.projects ?? [], filterAccount),
    [filterAccount, lookups.projects],
  );
  const lockedCurrency =
    module.entity === "transfers" ? selectedFromAccount?.currency : selectedAccount?.currency;
  const transferNeedsCrossRate = Boolean(
    module.entity === "transfers" &&
      selectedFromAccount?.currency &&
      selectedToAccount?.currency &&
      selectedFromAccount.currency !== selectedToAccount.currency,
  );
  const isRevisionMode = editing?.status === "APPROVED";
  const isHistoryView = editing?.status === "VOID" || editing?.status === "SUPERSEDED";

  useEffect(() => {
    let active = true;

    fetchDocuments(module.entity, {
      ...filters,
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
          message.error(error instanceof Error ? error.message : "Belgeler alinamadi");
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
    filters,
    message,
    module.entity,
    pagination.page,
    pagination.pageSize,
    reloadKey,
  ]);

  useEffect(() => {
    if (!lockedCurrency) {
      return;
    }

    if (module.entity === "invoices" || module.entity === "receipts") {
      form.setFieldValue("currency", lockedCurrency);
    }

    if (module.entity === "transfers") {
      form.setFieldValue("currency", lockedCurrency);
    }
  }, [form, lockedCurrency, module.entity]);

  useEffect(() => {
    if (module.entity !== "deliveryNotes" || !selectedAccount?.currency) {
      return;
    }

    const lines = (form.getFieldValue("lines") ?? []) as Array<Record<string, unknown>>;

    if (!lines.length) {
      return;
    }

    form.setFieldValue(
      "lines",
      lines.map((line) => ({ ...line, currency: selectedAccount.currency })),
    );
  }, [form, module.entity, selectedAccount?.currency]);

  useEffect(() => {
    if (!watchedProjectId || !selectedAccount) {
      return;
    }

    if (!availableProjects.some((project) => project.id === watchedProjectId)) {
      form.setFieldValue("projectId", undefined);
    }
  }, [availableProjects, form, selectedAccount, watchedProjectId]);

  useEffect(() => {
    if (module.entity !== "invoices" || watchedInvoiceType !== "STAR") {
      return;
    }

    const lines = (form.getFieldValue("lines") ?? []) as Array<Record<string, unknown>>;

    form.setFieldValue(
      "lines",
      lines.map((line) => ({ ...line, vatRateBps: 0 })),
    );
  }, [form, module.entity, watchedInvoiceType]);

  function openNewDraft() {
    setEditing(null);
    setDetail(null);
    setInvoiceMetrics(null);
    form.resetFields();
    form.setFieldsValue(defaultDocumentValues(module));
    setDrawerOpen(true);
  }

  async function openExistingDraft(record: DataRecord) {
    setEditing(record);
    setSaving(true);

    try {
      const [detail, metrics] = await Promise.all([
        fetchDocumentDetail(module.entity, String(record.id)),
        module.entity === "invoices"
          ? fetchInvoiceMetrics(String(record.id))
          : Promise.resolve(null),
      ]);

      form.resetFields();
      form.setFieldsValue(toFormValues(module, detail.header, detail.lines));
      form.setFieldValue("editReason", "");
      setDetail(detail);
      setInvoiceMetrics(metrics);
      setDrawerOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Belge detayi alinamadi");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    setSaving(true);

    try {
      const values = await form.validateFields();
      const payload = prepareDocumentPayload(module, values, editing, {
        lockedCurrency,
        selectedAccount,
        selectedFromAccount,
      });

      await saveDocumentDraft(module.entity, payload);
      message.success("Taslak saklandi");
      setDrawerOpen(false);
      setLoading(true);
      setReloadKey((value) => value + 1);
      void onDataChanged?.();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function approveRow(id: string) {
    setLoading(true);

    try {
      await approveDocumentRecord(module.entity, id);
      message.success("Belge onaylandi");
      setReloadKey((value) => value + 1);
      void onDataChanged?.();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Onay basarisiz");
      setLoading(false);
    }
  }

  async function voidRow(id: string, reason: string) {
    setLoading(true);

    try {
      await voidDocumentRecord(module.entity, id, reason);
      message.success("Belge iptal edildi");
      setVoidTarget(null);
      setVoidReason("");
      setReloadKey((value) => value + 1);
      void onDataChanged?.();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Iptal basarisiz");
      setLoading(false);
    }
  }

  function handleTableChange(nextPagination: TablePaginationConfig) {
    setLoading(true);
    setPagination({
      page: nextPagination.current ?? 1,
      pageSize: nextPagination.pageSize ?? 20,
    });
  }

  function updateFilter(key: keyof ListQuery, value: ListQuery[keyof ListQuery]) {
    updateFilters({
      [key]: value || undefined,
      ...(key === "accountId" ? { projectId: undefined } : {}),
    });
  }

  function updateFilters(patch: Partial<ListQuery>) {
    setLoading(true);
    setPagination((current) => ({ ...current, page: 1 }));
    setFilters((current) => ({
      ...current,
      ...patch,
    }));
  }

  function clearFilters() {
    setLoading(true);
    setPagination((current) => ({ ...current, page: 1 }));
    setFilters({});
  }

  return (
    <Card
      className="kagu-card"
      extra={
        <Space>
          <Tag color="green">Belge engine aktif</Tag>
          <Button onClick={openNewDraft} type="primary">
            Yeni Taslak
          </Button>
        </Space>
      }
      title={module.title}
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          description="Taslak, onay ve iptal API'leri belge numarasi, ledger entry ve stock movement uretir. Bu ekran artik taslak formlarini da server engine'e gonderiyor."
          showIcon
          title="Legacy belge davranisi web server tarafina tasiniyor"
          type="info"
        />
        <DocumentListFilters
          availableProjects={availableFilterProjects}
          clearFilters={clearFilters}
          filters={filters}
          lookups={lookups}
          module={module}
          updateFilter={updateFilter}
          updateFilters={updateFilters}
        />
        <Table<DataRecord>
          columns={[
            ...module.columns.map((column) => ({
              dataIndex: column.key,
              key: column.key,
              render: (value: unknown, record: DataRecord) =>
                renderDocumentCell(column.key, value, record, lookups),
              title: column.title,
            })),
            {
              key: "actions",
              render: (_value: unknown, record: DataRecord) => (
                <Space>
                  <Button
                    disabled={record.status === "VOID"}
                    onClick={() => openExistingDraft(record)}
                    size="small"
                    type="link"
                  >
                    Ac
                  </Button>
                  <Button
                    disabled={record.status !== "DRAFT"}
                    onClick={() => approveRow(String(record.id))}
                    size="small"
                    type="link"
                  >
                    Onayla
                  </Button>
                  <Button
                    danger
                    disabled={record.status === "VOID"}
                    onClick={() => {
                      setVoidTarget(record);
                      setVoidReason("");
                    }}
                    size="small"
                    type="link"
                  >
                    Iptal
                  </Button>
                </Space>
              ),
              title: "",
              width: 190,
            },
          ]}
          dataSource={rows}
          loading={loading || saving}
          locale={{ emptyText: <Empty description="Henuz belge kaydi yok" /> }}
          onChange={handleTableChange}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            total,
          }}
          rowClassName={(record) =>
            record.status === "VOID" || record.status === "SUPERSEDED"
              ? "kagu-row-muted"
              : ""
          }
          rowKey={(record) => String(record.id)}
        />
      </Space>
      <Drawer
        destroyOnHidden
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        size="min(1080px, 98vw)"
        title={editing ? `${module.title} Taslak` : `${module.title} Yeni Taslak`}
      >
        <Form disabled={isHistoryView} form={form} layout="vertical">
          {isRevisionMode ? (
            <Alert
              description="Onayli belge dogrudan degistirilmez. Kayit, eski belgeyi etkisiz birakarak yeni bir revizyon taslagi olusturur."
              message="Revizyon modundasiniz"
              showIcon
              style={{ marginBottom: 16 }}
              type="warning"
            />
          ) : null}
          <Typography.Text className="kagu-section-kicker">
            Belge Basligi
          </Typography.Text>
          <div className="kagu-document-form-grid">
            {module.headerFields.map((field) => (
              <DocumentHeaderField
                availableProjects={availableProjects}
                field={field}
                key={field.name}
                lockedCurrency={lockedCurrency}
                lookups={lookups}
                transferNeedsCrossRate={transferNeedsCrossRate}
              />
            ))}
          </div>
          {module.lineFields?.length ? (
            <>
              <Typography.Text className="kagu-section-kicker">
                Satirlar
              </Typography.Text>
              <Form.List name="lines">
                {(fields, { add, remove }) => (
                  <EditableLineTable
                    addLine={() =>
                      add(
                        defaultLineValues(module, {
                          currency: selectedAccount?.currency,
                          invoiceType: watchedInvoiceType,
                        }),
                      )
                    }
                    fields={fields}
                    invoiceType={watchedInvoiceType}
                    lineFields={module.lineFields ?? []}
                    lookups={lookups}
                    moduleEntity={module.entity}
                    removeLine={remove}
                    selectedAccountCurrency={selectedAccount?.currency}
                  />
                )}
              </Form.List>
            </>
          ) : null}
          {isRevisionMode ? (
            <Form.Item
              label="Degisiklik Notu"
              name="editReason"
              rules={[{ required: true, message: "Degisiklik nedeni gerekli" }]}
            >
              <Input.TextArea
                autoSize={{ minRows: 3 }}
                placeholder="Bu degisiklik neden yapildi?"
              />
            </Form.Item>
          ) : null}
        </Form>
        <Space className="kagu-drawer-actions">
          <Button onClick={() => setDrawerOpen(false)}>Vazgec</Button>
          {!isHistoryView ? (
            <Button loading={saving} onClick={handleSaveDraft} type="primary">
              {isRevisionMode ? "Revizyon Taslagi Kaydet" : "Taslak Kaydet"}
            </Button>
          ) : null}
        </Space>
        <DocumentPostingDetail detail={detail} invoiceMetrics={invoiceMetrics} />
      </Drawer>
      <Modal
        okButtonProps={{ danger: true, disabled: !voidReason.trim() }}
        okText="Iptal Et"
        onCancel={() => setVoidTarget(null)}
        onOk={() => {
          if (voidTarget) {
            void voidRow(String(voidTarget.id), voidReason);
          }
        }}
        open={Boolean(voidTarget)}
        title="Belge Iptal Nedeni"
      >
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          <Typography.Text>
            KAGU-ERP-D1 mantiginda iptal ve onayli belge degisikligi gerekce ile izlenir.
          </Typography.Text>
          <Input.TextArea
            autoSize={{ minRows: 3 }}
            onChange={(event) => setVoidReason(event.target.value)}
            placeholder="Iptal nedeni"
            value={voidReason}
          />
        </Space>
      </Modal>
    </Card>
  );
}

function DocumentListFilters({
  availableProjects,
  clearFilters,
  filters,
  lookups,
  module,
  updateFilter,
  updateFilters,
}: {
  availableProjects: LookupItem[];
  clearFilters: () => void;
  filters: ListQuery;
  lookups: LookupMap;
  module: DocumentModuleConfig;
  updateFilter: (key: keyof ListQuery, value: ListQuery[keyof ListQuery]) => void;
  updateFilters: (patch: Partial<ListQuery>) => void;
}) {
  const dateRangeValue: [ReturnType<typeof dayjs> | null, ReturnType<typeof dayjs> | null] | null =
    filters.dateFrom || filters.dateTo
      ? [
          filters.dateFrom ? dayjs(filters.dateFrom) : null,
          filters.dateTo ? dayjs(filters.dateTo) : null,
        ]
      : null;
  const directionField = module.headerFields.find((field) => field.name === "direction");
  const invoiceKindField = module.headerFields.find(
    (field) => field.name === "invoiceKind",
  );
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => !["page", "pageSize"].includes(key) && Boolean(value),
  );

  return (
    <Space className="kagu-document-filters" size={8} wrap>
      <Input.Search
        allowClear
        onSearch={(value) => updateFilter("search", value.trim())}
        placeholder="Belge ara"
        style={{ width: 220 }}
      />
      <Select
        allowClear
        onChange={(value) => updateFilter("status", value)}
        options={[
          { label: "Taslak", value: "DRAFT" },
          { label: "Onayli", value: "APPROVED" },
          { label: "Degistirildi", value: "SUPERSEDED" },
          { label: "Iptal", value: "VOID" },
        ]}
        placeholder="Durum"
        style={{ width: 150 }}
        value={filters.status}
      />
      {module.filterLookups?.includes("accounts") ? (
        <Select
          allowClear
          onChange={(value) => updateFilter("accountId", value)}
          optionFilterProp="label"
          options={selectableLookupOptions(lookups.accounts)}
          placeholder={module.entity === "transfers" ? "Cari (giris/cikis)" : "Cari"}
          showSearch
          style={{ minWidth: 240 }}
          value={filters.accountId}
        />
      ) : null}
      {module.filterLookups?.includes("projects") ? (
        <Select
          allowClear
          disabled={!availableProjects.length}
          onChange={(value) => updateFilter("projectId", value)}
          optionFilterProp="label"
          options={availableProjects.map((item) => ({
            label: item.label,
            value: item.id,
          }))}
          placeholder="Proje"
          showSearch
          style={{ minWidth: 220 }}
          value={filters.projectId}
        />
      ) : null}
      {module.filterLookups?.includes("warehouses") ? (
        <Select
          allowClear
          onChange={(value) => updateFilter("warehouseId", value)}
          optionFilterProp="label"
          options={selectableLookupOptions(lookups.warehouses)}
          placeholder="Depo"
          showSearch
          style={{ minWidth: 200 }}
          value={filters.warehouseId}
        />
      ) : null}
      {directionField?.options ? (
        <Select
          allowClear
          onChange={(value) => updateFilter("direction", value)}
          options={directionField.options}
          placeholder="Yon"
          style={{ width: 130 }}
          value={filters.direction}
        />
      ) : null}
      {invoiceKindField?.options ? (
        <Select
          allowClear
          onChange={(value) => updateFilter("invoiceKind", value)}
          options={invoiceKindField.options}
          placeholder="Fatura turu"
          style={{ width: 160 }}
          value={filters.invoiceKind}
        />
      ) : null}
      <DatePicker.RangePicker
        format="YYYY-MM-DD"
        onChange={(dates) =>
          updateFilters({
            dateFrom: dates?.[0]?.format("YYYY-MM-DD") ?? undefined,
            dateTo: dates?.[1]?.format("YYYY-MM-DD") ?? undefined,
          })
        }
        placeholder={["Baslangic", "Bitis"]}
        value={dateRangeValue}
      />
      <Button disabled={!hasFilters} onClick={clearFilters}>
        Temizle
      </Button>
    </Space>
  );
}

function DocumentPostingDetail({
  detail,
  invoiceMetrics,
}: {
  detail: DocumentDetail<DataRecord> | null;
  invoiceMetrics: InvoiceMetrics | null;
}) {
  if (!detail) {
    return null;
  }

  const currency =
    typeof detail.header.currency === "string" ? detail.header.currency : "TRY";
  const status = String(detail.header.status ?? "");

  return (
    <Space orientation="vertical" size={14} style={{ marginTop: 20, width: "100%" }}>
      <Typography.Text className="kagu-section-kicker">
        Muhasebe / Stok Etkisi
      </Typography.Text>
      <Card size="small" title="Belge Gecmisi">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Durum">
            <Tag
              color={
                status === "APPROVED"
                  ? "green"
                  : status === "VOID"
                    ? "red"
                    : status === "SUPERSEDED"
                      ? "purple"
                      : "gold"
              }
            >
              {humanizeEnum(status)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Etkili">
            {detail.header.is_effective === false ? "Hayir" : "Evet"}
          </Descriptions.Item>
          <Descriptions.Item label="Yerine Gecen Belge">
            {String(detail.header.superseded_by_id ?? "-")}
          </Descriptions.Item>
          <Descriptions.Item label="Kaynak Belge">
            {String(detail.header.supersedes_id ?? "-")}
          </Descriptions.Item>
          <Descriptions.Item label="Degisiklik Notu" span={2}>
            {String(detail.header.change_note ?? "-")}
          </Descriptions.Item>
          <Descriptions.Item label="Degistiren Kullanici">
            {String(detail.header.changed_by_user_id ?? "-")}
          </Descriptions.Item>
          <Descriptions.Item label="Degistirilme Zamani">
            {String(detail.header.superseded_at ?? detail.header.voided_at ?? "-")}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      {invoiceMetrics ? (
        <Card size="small" title="Fatura Metrikleri">
          <Space wrap>
            <Tag color="blue">
              Net {formatMinor(invoiceMetrics.invoiceNetTotalMinor, currency)}
            </Tag>
            <Tag color="gold">
              Brut {formatMinor(invoiceMetrics.invoiceGrossTotalMinor, currency)}
            </Tag>
            <Tag color="default">
              Maliyet {formatMinor(invoiceMetrics.costTotalMinor, currency)}
            </Tag>
            <Tag color={invoiceMetrics.profitMinor >= 0 ? "green" : "red"}>
              Kar {formatMinor(invoiceMetrics.profitMinor, currency)}
            </Tag>
            <Tag>
              Marj{" "}
              {invoiceMetrics.marginPercent === null
                ? "-"
                : `${invoiceMetrics.marginPercent}%`}
            </Tag>
          </Space>
        </Card>
      ) : null}
      <Table<(typeof detail.ledgerEntries)[number]>
        columns={[
          { dataIndex: "docNo", key: "docNo", title: "Evrak No" },
          { dataIndex: "accountId", key: "accountId", title: "Cari" },
          { dataIndex: "relatedAccountId", key: "relatedAccountId", title: "Ilgili Cari" },
          { dataIndex: "description", key: "description", title: "Aciklama" },
          {
            dataIndex: "debitMinor",
            key: "debitMinor",
            render: (value: unknown, record: { currency?: unknown }) =>
              formatMinor(value, String(record.currency ?? "TRY")),
            title: "Borc",
          },
          {
            dataIndex: "creditMinor",
            key: "creditMinor",
            render: (value: unknown, record: { currency?: unknown }) =>
              formatMinor(value, String(record.currency ?? "TRY")),
            title: "Alacak",
          },
        ]}
        dataSource={detail.ledgerEntries.map((entry) => ({ ...entry }))}
        locale={{ emptyText: <Empty description="Ledger entry yok" /> }}
        pagination={false}
        rowClassName={(record) => (record.isEffective === false ? "kagu-row-muted" : "")}
        rowKey="id"
        size="small"
      />
      <Table<(typeof detail.stockMovements)[number]>
        columns={[
          { dataIndex: "docNo", key: "docNo", title: "Evrak No" },
          { dataIndex: "warehouseId", key: "warehouseId", title: "Depo" },
          { dataIndex: "itemId", key: "itemId", title: "Malzeme" },
          { dataIndex: "qtyIn", key: "qtyIn", title: "Giris" },
          { dataIndex: "qtyOut", key: "qtyOut", title: "Cikis" },
        ]}
        dataSource={detail.stockMovements}
        locale={{ emptyText: <Empty description="Stok hareketi yok" /> }}
        pagination={false}
        rowClassName={(record) => (record.isEffective === false ? "kagu-row-muted" : "")}
        rowKey="id"
        size="small"
      />
      <Table
        columns={[
          { dataIndex: "createdAt", key: "createdAt", title: "Zaman" },
          { dataIndex: "action", key: "action", title: "Islem" },
          { dataIndex: "actorUserId", key: "actorUserId", title: "Kullanici" },
        ]}
        dataSource={detail.auditEvents}
        locale={{ emptyText: <Empty description="Audit kaydi yok" /> }}
        pagination={false}
        rowKey="id"
        size="small"
        title={() => "Kayit Izi"}
      />
    </Space>
  );
}

function DocumentHeaderField({
  availableProjects,
  field,
  lockedCurrency,
  lookups,
  transferNeedsCrossRate,
}: {
  availableProjects: LookupItem[];
  field: FieldConfig;
  lockedCurrency?: Currency;
  lookups: LookupMap;
  transferNeedsCrossRate: boolean;
}) {
  const rules = field.required
    ? [{ required: true, message: `${field.label} gerekli` }]
    : undefined;

  if (field.name === "projectId" && field.type === "select") {
    return (
      <Form.Item label={field.label} name={field.name} rules={rules}>
        <Select
          allowClear
          disabled={!availableProjects.length}
          optionFilterProp="label"
          options={availableProjects.map((item) => ({
            label: item.label,
            value: item.id,
          }))}
          placeholder={
            availableProjects.length
              ? "Cari projesi sec"
              : "Once cari secin veya cari projesi tanimlayin"
          }
          showSearch
        />
      </Form.Item>
    );
  }

  if (field.name === "currency" && field.type === "select") {
    const options = lockedCurrency
      ? [{ label: lockedCurrency, value: lockedCurrency }]
      : field.options;

    return (
      <Form.Item label={field.label} name={field.name} rules={rules}>
        <Select disabled={Boolean(lockedCurrency)} options={options} />
      </Form.Item>
    );
  }

  if (field.name === "crossRate" && field.type === "number") {
    return (
      <Form.Item
        label={field.label}
        name={field.name}
        rules={
          transferNeedsCrossRate
            ? [{ required: true, message: "Capraz kur gerekli" }]
            : undefined
        }
      >
        <InputNumber
          decimalSeparator=","
          disabled={!transferNeedsCrossRate}
          min={field.min}
          step={field.step}
          style={{ width: "100%" }}
        />
      </Form.Item>
    );
  }

  return <FieldInput field={field} lookups={lookups} />;
}

type FormListField = {
  key: number;
  name: number;
};

function EditableLineTable({
  addLine,
  fields,
  invoiceType,
  lineFields,
  lookups,
  moduleEntity,
  removeLine,
  selectedAccountCurrency,
}: {
  addLine: () => void;
  fields: FormListField[];
  invoiceType?: string;
  lineFields: FieldConfig[];
  lookups: LookupMap;
  moduleEntity: DocumentEntity;
  removeLine: (index: number | number[]) => void;
  selectedAccountCurrency?: Currency;
}) {
  const form = Form.useFormInstance<DocumentFormValues>();

  function setLineField(rowIndex: number, fieldName: string, value: unknown) {
    const lines = [...((form.getFieldValue("lines") ?? []) as Array<Record<string, unknown>>)];

    lines[rowIndex] = { ...(lines[rowIndex] ?? {}), [fieldName]: value };
    form.setFieldValue("lines", lines);
  }

  return (
    <Table<FormListField>
      className="kagu-line-table"
      columns={[
        {
          fixed: "left",
          key: "row",
          render: (_value: unknown, field: FormListField, index: number) => (
            <>
              {index + 1}
              <Form.Item hidden name={[field.name, "id"]}>
                <Input />
              </Form.Item>
            </>
          ),
          title: "#",
          width: 48,
        },
        ...lineFields.map((lineField) => ({
          key: lineField.name,
          render: (_value: unknown, field: FormListField) => (
            <Form.Item
              name={[field.name, lineField.name]}
              rules={lineFieldRules(lineField, {
                invoiceType,
              })}
              style={{ margin: 0 }}
              valuePropName={lineField.type === "switch" ? "checked" : "value"}
            >
              {renderLineControl(lineField, lookups, {
                invoiceType,
                moduleEntity,
                onItemChange: (itemId) => {
                  const item = findLookup(lookups.items, itemId);
                  const vatRate = invoiceType === "STAR"
                    ? 0
                    : (item?.defaultVatRateBps ?? 0) / 100;

                  setLineField(field.name, "vatRateBps", vatRate);
                },
                selectedAccountCurrency,
              })}
            </Form.Item>
          ),
          title: lineField.label,
          width: lineColumnWidth(lineField),
        })),
        {
          fixed: "right",
          key: "actions",
          render: (_value: unknown, field: FormListField) => (
            <Button danger onClick={() => removeLine(field.name)} size="small" type="link">
              Sil
            </Button>
          ),
          title: "",
          width: 72,
        },
      ]}
      dataSource={fields}
      footer={() => (
        <Button onClick={addLine} type="dashed">
          Satir Ekle
        </Button>
      )}
      pagination={false}
      rowKey="key"
      scroll={{ x: "max-content" }}
      size="small"
    />
  );
}

function renderLineControl(
  field: FieldConfig,
  lookups: LookupMap,
  context: {
    invoiceType?: string;
    moduleEntity: DocumentEntity;
    onItemChange: (itemId: string | undefined) => void;
    selectedAccountCurrency?: Currency;
  },
) {
  if (field.name === "vatRateBps") {
    return (
      <Select
        allowClear
        disabled={context.moduleEntity === "invoices" && context.invoiceType === "STAR"}
        options={(lookups.vatRates ?? [])
          .filter((item) => item.isActive !== false)
          .map((item) => ({
            label: item.label,
            value: (item.rateBps ?? 0) / 100,
          }))}
      />
    );
  }

  if (field.type === "select") {
    const options = field.name === "currency" && context.selectedAccountCurrency
      ? [{ label: context.selectedAccountCurrency, value: context.selectedAccountCurrency }]
      : field.lookupEntity
      ? selectableLookupOptions(lookups[field.lookupEntity])
      : field.options;

    return (
      <Select
        allowClear={!field.required}
        disabled={field.name === "currency" && Boolean(context.selectedAccountCurrency)}
        onChange={
          field.name === "itemId"
            ? (value) => context.onItemChange(value as string | undefined)
            : undefined
        }
        options={options}
        showSearch
        optionFilterProp="label"
      />
    );
  }

  if (field.type === "text") {
    return <Input />;
  }

  return (
    <InputNumber
      decimalSeparator=","
      min={field.min}
      precision={field.moneyMinor ? 2 : undefined}
      step={field.step ?? (field.moneyMinor ? 0.01 : 1)}
      style={{ width: "100%" }}
    />
  );
}

function lineFieldRules(
  field: FieldConfig,
  context: { invoiceType?: string },
) {
  if (field.name === "vatRateBps" && context.invoiceType === "STAR") {
    return undefined;
  }

  return field.required
    ? [{ required: true, message: `${field.label} gerekli` }]
    : undefined;
}

function lineColumnWidth(field: FieldConfig) {
  if (field.lookupEntity === "items") {
    return 260;
  }

  if (field.name === "description") {
    return 220;
  }

  if (field.moneyMinor) {
    return 150;
  }

  if (field.type === "select") {
    return 150;
  }

  return 130;
}

function renderDocumentCell(
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

  if (key === "status") {
    const status = String(value ?? "");
    const color =
      status === "APPROVED"
        ? "green"
        : status === "VOID"
          ? "red"
          : status === "SUPERSEDED"
            ? "purple"
            : "gold";

    return <Tag color={color}>{humanizeEnum(value)}</Tag>;
  }

  if (typeof value === "boolean") {
    return formatBoolean(value);
  }

  if (typeof value === "number") {
    return formatQuantity(value);
  }

  return value ? String(value) : "-";
}

function defaultDocumentValues(module: DocumentModuleConfig): DocumentFormValues {
  const values: DocumentFormValues = {
    docDate: dayjs(),
  };

  for (const field of module.headerFields) {
    if (field.type === "date") {
      values[field.name] = dayjs();
    }

    if (field.name === "currency") {
      values[field.name] = "TRY";
    }

    if (field.name === "direction") {
      values[field.name] = "OUT";
    }

    if (field.name === "invoiceKind") {
      values[field.name] = "SALES";
    }

    if (field.name === "invoiceType") {
      values[field.name] = "STANDARD";
    }

    if (field.name === "receiptKind") {
      values[field.name] = "COLLECTION";
    }
  }

  if (module.lineFields?.length) {
    values.lines = [defaultLineValues(module)];
  }

  return values;
}

function defaultLineValues(
  module: DocumentModuleConfig,
  context: { currency?: Currency; invoiceType?: string } = {},
) {
  const values: Record<string, unknown> = {};

  for (const field of module.lineFields ?? []) {
    if (field.name === "quantity") {
      values[field.name] = 1;
    }

    if (field.name === "vatRateBps") {
      values[field.name] = context.invoiceType === "STAR" ? 0 : undefined;
    }

    if (field.name === "discountBps") {
      values[field.name] = 0;
    }

    if (field.name === "currency" && context.currency) {
      values[field.name] = context.currency;
    }
  }

  return values;
}

function toFormValues(
  module: DocumentModuleConfig,
  header: DataRecord,
  lines: DataRecord[],
) {
  const values: DocumentFormValues = { id: String(header.id) };

  for (const field of module.headerFields) {
    values[field.name] = fromStoredValue(field, header[camelToSnake(field.name)]);
  }

  if (module.lineFields?.length) {
    values.lines = lines.map((line) => {
      const next: Record<string, unknown> = { id: line.id };

      for (const field of module.lineFields ?? []) {
        next[field.name] = fromStoredValue(field, line[camelToSnake(field.name)]);
      }

      return next;
    });
  }

  return values;
}

function fromStoredValue(field: FieldConfig, value: unknown) {
  if (field.type === "date" && typeof value === "string") {
    return dayjs(value);
  }

  if (field.moneyMinor) {
    return Number(value ?? 0) / 100;
  }

  if (field.name.endsWith("Bps")) {
    return Number(value ?? 0) / 100;
  }

  return value;
}

function prepareDocumentPayload(
  module: DocumentModuleConfig,
  values: DocumentFormValues,
  editing: DataRecord | null,
  context: {
    lockedCurrency?: Currency;
    selectedAccount?: LookupItem | null;
    selectedFromAccount?: LookupItem | null;
  },
) {
  const isRevisionMode = editing?.status === "APPROVED";
  const payload: DocumentPayload = {
    id: isRevisionMode ? undefined : typeof editing?.id === "string" ? editing.id : undefined,
  };

  if (isRevisionMode && typeof editing?.id === "string") {
    payload.supersedesId = editing.id;
    payload.editReason =
      typeof values.editReason === "string" ? values.editReason.trim() : undefined;
  }

  for (const field of module.headerFields) {
    payload[field.name] = toStoredValue(field, values[field.name]);
  }

  if (
    (module.entity === "invoices" || module.entity === "receipts") &&
    context.selectedAccount?.currency
  ) {
    payload.currency = context.selectedAccount.currency;
  }

  if (module.entity === "transfers" && context.selectedFromAccount?.currency) {
    payload.currency = context.selectedFromAccount.currency;
  }

  if (module.lineFields?.length) {
    payload.lines = (values.lines ?? []).map((line) => {
      const next: Record<string, unknown> = {
        id: typeof line.id === "string" ? line.id : undefined,
      };

      for (const field of module.lineFields ?? []) {
        next[field.name] = toStoredValue(field, line[field.name]);
      }

      if (module.entity === "deliveryNotes" && context.lockedCurrency) {
        next.currency = context.lockedCurrency;
      }

      return next;
    });
  }

  return payload;
}

function toStoredValue(field: FieldConfig, value: unknown) {
  if (
    field.type === "date" &&
    value &&
    typeof value === "object" &&
    "format" in value &&
    typeof value.format === "function"
  ) {
    return value.format("YYYY-MM-DD");
  }

  if (field.moneyMinor) {
    return parseMoneyToMinor(value);
  }

  if (field.name.endsWith("Bps")) {
    return Math.round(Number(value ?? 0) * 100);
  }

  return value;
}

function findLookup(items: LookupItem[] | undefined, id: unknown) {
  return (items ?? []).find((item) => item.id === id) ?? null;
}

function filterProjectsByAccount(
  projects: LookupItem[],
  account: LookupItem | null,
) {
  const activeProjects = projects.filter((project) => project.isActive !== false);

  if (!account) {
    return activeProjects;
  }

  return activeProjects.filter(
    (project) =>
      project.accountId === account.id ||
      (project.accountCode && project.accountCode === account.code),
  );
}
