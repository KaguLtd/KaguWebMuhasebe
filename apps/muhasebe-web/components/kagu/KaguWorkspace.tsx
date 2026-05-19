"use client";

import {
  AppstoreOutlined,
  BankOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  ProfileOutlined,
  SettingOutlined,
  ShopOutlined,
  SwapOutlined,
  TableOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  ConfigProvider,
  Layout,
  Menu,
  Row,
  Space,
  Spin,
  Table,
  Tabs,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";

import { DocumentWorkspace } from "./DocumentWorkspace";
import { MasterWorkspace } from "./MasterWorkspace";
import { ProjectReportsWorkspace } from "./ProjectReportsWorkspace";
import { SettingsPeriodLockPanel } from "./SettingsPeriodLockPanel";
import { SettingsUsersPanel } from "./SettingsUsersPanel";
import { StockStatementWorkspace } from "./StockStatementWorkspace";
import {
  documentModules,
  type DocumentModuleConfig,
  type MasterModuleConfig,
  primaryMasterModules,
  settingsMasterModules,
  settingsWorkspaceTabs,
  workspaceMenu,
} from "@/lib/kagu/config";
import type { BootstrapPayload } from "@/lib/kagu/api";
import { fetchBootstrap, fetchLookups, logoutSession } from "@/lib/kagu/api";
import type { Currency, LookupEntity, LookupItem } from "@/lib/kagu/contracts";
import { formatMinor } from "@/lib/kagu/helpers";

const { Header, Sider, Content } = Layout;

type LookupMap = Partial<Record<LookupEntity, LookupItem[]>>;

interface KaguWorkspaceProps {
  initialMenu?: string;
}

export function KaguWorkspace({ initialMenu = "dashboard" }: KaguWorkspaceProps) {
  const router = useRouter();
  const resolvedInitialMenu = resolveInitialMenu(initialMenu);
  const [activeMenu, setActiveMenu] = useState(resolvedInitialMenu);
  const [settingsMenu, setSettingsMenu] = useState(resolveInitialSettingsMenu(initialMenu));
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [lookups, setLookups] = useState<LookupMap>({});
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const masterModule = primaryMasterModules.find((module) => module.key === activeMenu);
  const documentModule = documentModules.find((module) => module.key === activeMenu);
  const settingsModule =
    activeMenu === "settings"
      ? settingsMasterModules.find((module) => module.key === settingsMenu)
      : undefined;

  useEffect(() => {
    void reloadBootstrap();

    async function reloadBootstrap() {
      setLoading(true);

      try {
        const payload = await fetchBootstrap();

        setBootstrap(payload);
        setBootstrapError(null);
      } catch (error) {
        setBootstrap(null);
        setBootstrapError(
          error instanceof Error ? error.message : "Bootstrap verisi alınamadı",
        );
        setLookups({});
      } finally {
        setLoading(false);
      }
    }
  }, []);

  async function refreshBootstrap() {
    try {
      const payload = await fetchBootstrap();

      setBootstrap(payload);
      setBootstrapError(null);
    } catch (error) {
      setBootstrapError(
            error instanceof Error ? error.message : "Bootstrap verisi alınamadı",
      );
    }
  }

  useEffect(() => {
    if (loading || bootstrapError) {
      return;
    }

    const requiredEntities = resolveRequiredLookups({
      activeMenu,
      documentModule,
      masterModule,
      settingsMenu,
      settingsModule,
    });
    const missingEntities = requiredEntities.filter((entity) => !lookups[entity]);

    if (!missingEntities.length) {
      return;
    }

    let active = true;

    void (async () => {
      try {
        const entries = await Promise.all(
          missingEntities.map(async (entity) => [entity, await fetchLookups(entity)] as const),
        );

        if (!active) {
          return;
        }

        setLookups((current) => {
          const next = { ...current };

          for (const [entity, items] of entries) {
            next[entity] = items;
          }

          return next;
        });
      } catch (error) {
        if (active) {
          setBootstrapError(
            error instanceof Error ? error.message : "Lookup verisi alınamadı",
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    activeMenu,
    bootstrapError,
    documentModule,
    loading,
    lookups,
    masterModule,
    settingsMenu,
    settingsModule,
  ]);

  function handleMenu(key: string) {
    startTransition(() => {
      setActiveMenu(key);
      router.push(key === "dashboard" ? "/dashboard" : `/app/${key}`);
    });
  }

  function handleLogout() {
    startTransition(async () => {
      try {
        await logoutSession();
      } finally {
        router.push("/login");
        router.refresh();
      }
    });
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 3,
          colorBgBase: "#f3f0ea",
          colorBorder: "rgba(106, 95, 84, 0.18)",
          colorInfo: "#7b6d5e",
          colorPrimary: "#7b6d5e",
          colorText: "#161412",
          fontFamily: "Segoe UI, Tahoma, sans-serif",
        },
        components: {
          Button: { primaryShadow: "none" },
          Layout: {
            bodyBg: "#f3f0ea",
            headerBg: "#4f453a",
            siderBg: "#fcfaf6",
          },
          Menu: {
            itemSelectedBg: "#e7ddd0",
            itemSelectedColor: "#4f453a",
          },
        },
      }}
    >
      <AntApp>
        <Layout className="kagu-shell">
          <Sider className="kagu-sider" width={244}>
            <div className="kagu-brand">
              <span className="kagu-brand-mark">K</span>
              <div>
                <strong>KAGU Operasyon Paneli</strong>
                <span>Stok • Cari • Proje • Evrak Takibi</span>
              </div>
            </div>
            <Menu
              items={workspaceMenu.map((item) => ({
                icon: iconByKey[item.key],
                key: item.key,
                label: item.title,
              }))}
              mode="inline"
              onClick={({ key }) => handleMenu(String(key))}
              selectedKeys={[activeMenu]}
            />
          </Sider>
          <Layout>
            <Header className="kagu-header">
              <div>
                <Typography.Title level={4} style={{ color: "white", margin: 0 }}>
                  {workspaceMenu.find((item) => item.key === activeMenu)?.title}
                </Typography.Title>
              </div>
              <Space wrap>
                <Button onClick={handleLogout}>Çıkış</Button>
              </Space>
            </Header>
            <Content className="kagu-content">
              {loading ? (
                <div className="kagu-loader">
                  <Spin />
                </div>
              ) : null}
              {!loading && bootstrapError ? (
                <Alert
                  description={bootstrapError}
                  showIcon
                  title="Veritabanı bağlantısı gerekli"
                  type="warning"
                />
              ) : null}
              {!loading && activeMenu === "dashboard" ? (
                <DashboardPane bootstrap={bootstrap} />
              ) : null}
              {!loading && activeMenu === "projectReports" ? (
                <ProjectReportsWorkspace lookups={lookups} />
              ) : null}
              {!loading && activeMenu === "stockStatement" ? (
                <StockStatementWorkspace lookups={lookups} />
              ) : null}
              {!loading && masterModule ? (
                <MasterWorkspace
                  config={masterModule}
                  key={masterModule.key}
                  lookups={lookups}
                  onDataChanged={refreshBootstrap}
                />
              ) : null}
              {!loading && activeMenu === "settings" ? (
                <SettingsPane
                  activeKey={settingsMenu}
                  lookups={lookups}
                  onChange={setSettingsMenu}
                  onDataChanged={refreshBootstrap}
                />
              ) : null}
              {!loading && documentModule ? (
                <DocumentWorkspace
                  lookups={lookups}
                  module={documentModule}
                  onDataChanged={refreshBootstrap}
                />
              ) : null}
            </Content>
          </Layout>
        </Layout>
        <div className={isPending ? "kagu-route-pending" : undefined} />
      </AntApp>
    </ConfigProvider>
  );
}

function DashboardPane({ bootstrap }: { bootstrap: BootstrapPayload | null }) {
  const totals = bootstrap?.dashboard.invoiceTotalsByCurrency ?? emptyInvoiceTotalsByCurrency();

  return (
    <Space orientation="vertical" size={18} style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        {(["TRY", "USD", "EUR", "GBP"] as Currency[]).map((currency) => (
          <Col key={currency} lg={12} md={12} xs={24}>
            <CurrencyInvoiceTotalsCard currency={currency} totals={totals[currency]} />
          </Col>
        ))}
      </Row>
    </Space>
  );
}

function CurrencyInvoiceTotalsCard({
  currency,
  totals,
}: {
  currency: Currency;
  totals: { monthlyMinor: number; weeklyMinor: number; yearlyMinor: number };
}) {
  return (
    <Card className="kagu-card" size="small" title={currency}>
      <Table
        columns={[
          { dataIndex: "period", key: "period", title: "Dönem" },
          {
            align: "right",
            dataIndex: "amount",
            key: "amount",
            render: (value: number) => formatMinor(value, currency),
            title: "Toplam",
          },
        ]}
        dataSource={[
          { amount: totals.weeklyMinor, key: "weekly", period: "Haftalık" },
          { amount: totals.monthlyMinor, key: "monthly", period: "Aylık" },
          { amount: totals.yearlyMinor, key: "yearly", period: "Yıllık" },
        ]}
        pagination={false}
        rowKey="key"
        size="small"
      />
    </Card>
  );
}

function emptyInvoiceTotalsByCurrency(): BootstrapPayload["dashboard"]["invoiceTotalsByCurrency"] {
  return {
    TRY: { monthlyMinor: 0, weeklyMinor: 0, yearlyMinor: 0 },
    USD: { monthlyMinor: 0, weeklyMinor: 0, yearlyMinor: 0 },
    EUR: { monthlyMinor: 0, weeklyMinor: 0, yearlyMinor: 0 },
    GBP: { monthlyMinor: 0, weeklyMinor: 0, yearlyMinor: 0 },
  };
}

function SettingsPane({
  activeKey,
  lookups,
  onChange,
  onDataChanged,
}: {
  activeKey: string;
  lookups: LookupMap;
  onChange: (key: string) => void;
  onDataChanged: () => void;
}) {
  const activeModule = settingsMasterModules.find((module) => module.key === activeKey);

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Card className="kagu-card">
        <Tabs
          activeKey={activeKey}
          items={settingsWorkspaceTabs.map((module) => ({
            key: module.key,
            label: module.title,
          }))}
          onChange={onChange}
        />
      </Card>
      {activeModule ? (
        <MasterWorkspace
          compact
          config={activeModule}
          key={activeModule.key}
          lookups={lookups}
          onDataChanged={onDataChanged}
        />
      ) : null}
      {activeKey === "settingsUsers" ? <SettingsUsersPanel mode="users" /> : null}
      {activeKey === "settingsRoles" ? <SettingsUsersPanel mode="roles" /> : null}
      {activeKey === "periodLock" ? (
        <SettingsPeriodLockPanel onDataChanged={onDataChanged} />
      ) : null}
    </Space>
  );
}

function resolveInitialMenu(value: string) {
  if (settingsWorkspaceTabs.some((module) => module.key === value)) {
    return "settings";
  }

  return workspaceMenu.some((item) => item.key === value) ? value : "dashboard";
}

function resolveInitialSettingsMenu(value: string) {
  return settingsWorkspaceTabs.some((module) => module.key === value)
    ? value
    : settingsWorkspaceTabs[0].key;
}

function resolveRequiredLookups({
  activeMenu,
  documentModule,
  masterModule,
  settingsMenu,
  settingsModule,
}: {
  activeMenu: string;
  documentModule?: DocumentModuleConfig;
  masterModule?: MasterModuleConfig;
  settingsMenu: string;
  settingsModule?: MasterModuleConfig;
}): LookupEntity[] {
  if (activeMenu === "dashboard") {
    return [] as LookupEntity[];
  }

  if (activeMenu === "projectReports") {
    return ["projects", "warehouses"];
  }

  if (activeMenu === "stockStatement") {
    return ["accounts", "projects", "warehouses", "items"];
  }

  if (masterModule) {
    return uniqueLookups(masterModule.fields.map((field) => field.lookupEntity));
  }

  if (documentModule) {
    return uniqueLookups([
      ...documentModule.headerFields.map((field) => field.lookupEntity),
      ...(documentModule.lineFields ?? []).map((field) => field.lookupEntity),
      ...(documentModule.filterLookups ?? []),
    ]);
  }

  if (activeMenu === "settings" && settingsModule) {
    return uniqueLookups(settingsModule.fields.map((field) => field.lookupEntity));
  }

  if (activeMenu === "settings" && settingsMenu.startsWith("settings")) {
    return [] as LookupEntity[];
  }

  return [] as LookupEntity[];
}

function uniqueLookups(entities: Array<LookupEntity | undefined>) {
  return Array.from(
    new Set(entities.filter((entity): entity is LookupEntity => Boolean(entity))),
  );
}

const iconByKey: Record<string, ReactNode> = {
  accounts: <BankOutlined />,
  dashboard: <AppstoreOutlined />,
  deliveryNotes: <ProfileOutlined />,
  invoices: <FileTextOutlined />,
  items: <InboxOutlined />,
  projects: <FolderOpenOutlined />,
  receipts: <ShopOutlined />,
  projectReports: <TableOutlined />,
  settings: <SettingOutlined />,
  stockStatement: <TableOutlined />,
  transfers: <SwapOutlined />,
  warehouses: <DeploymentUnitOutlined />,
};
