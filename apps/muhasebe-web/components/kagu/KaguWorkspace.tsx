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
  Statistic,
  Tabs,
  Typography,
} from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";

import { DocumentWorkspace } from "./DocumentWorkspace";
import { MasterWorkspace } from "./MasterWorkspace";
import { SettingsUsersPanel } from "./SettingsUsersPanel";
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
import type { LookupEntity, LookupItem } from "@/lib/kagu/contracts";
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
  const [lookupLoading, setLookupLoading] = useState(false);
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
          error instanceof Error ? error.message : "Bootstrap verisi alinamadi",
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
        error instanceof Error ? error.message : "Bootstrap verisi alinamadi",
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
      setLookupLoading(true);

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
            error instanceof Error ? error.message : "Lookup verisi alinamadi",
          );
        }
      } finally {
        if (active) {
          setLookupLoading(false);
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
                <strong>KAGU ERP</strong>
                <span>Muhasebe Web</span>
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
                <Typography.Text className="kagu-header-eyebrow">
                  KAGU muhasebe operasyon merkezi
                </Typography.Text>
                <Typography.Title level={4} style={{ color: "white", margin: 0 }}>
                  {workspaceMenu.find((item) => item.key === activeMenu)?.title}
                </Typography.Title>
              </div>
              <Space wrap>
                <Link href="/docs">
                  <Button>Dokumanlar</Button>
                </Link>
                <Link href="/intake">
                  <Button>Kaynak Inceleme</Button>
                </Link>
                <Button onClick={handleLogout}>Cikis</Button>
              </Space>
            </Header>
            <Content className="kagu-content">
              {loading ? (
                <div className="kagu-loader">
                  <Spin />
                </div>
              ) : null}
              {!loading && lookupLoading && activeMenu !== "dashboard" ? (
                <Alert
                  description="Bu ekran icin gerekli referans listeleri yalnizca ihtiyac duyuldugunda yukleniyor."
                  showIcon
                  type="info"
                />
              ) : null}
              {!loading && bootstrapError ? (
                <Alert
                  description={`${bootstrapError} PostgreSQL calistiginda dashboard, master data ve belge ekranlari otomatik olarak DB'den beslenecek.`}
                  showIcon
                  title="Veritabani baglantisi gerekli"
                  type="warning"
                />
              ) : null}
              {!loading && activeMenu === "dashboard" ? (
                <DashboardPane bootstrap={bootstrap} />
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
  const metrics = bootstrap?.metrics ?? [];

  return (
    <Space orientation="vertical" size={18} style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        {metrics.map((metric) => (
          <Col key={metric.key} lg={6} md={12} xs={24}>
            <Card className="kagu-card">
              <Statistic title={metric.label} value={metric.value} />
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col lg={6} md={12} xs={24}>
          <Card className="kagu-card">
            <Statistic
              title="Gunluk Satis"
              value={formatMinor(bootstrap?.dashboard.dailySalesTotalMinor, "TRY")}
            />
          </Card>
        </Col>
        <Col lg={6} md={12} xs={24}>
          <Card className="kagu-card">
            <Statistic
              title="Haftalik Satis"
              value={formatMinor(bootstrap?.dashboard.weeklySalesTotalMinor, "TRY")}
            />
          </Card>
        </Col>
        <Col lg={6} md={12} xs={24}>
          <Card className="kagu-card">
            <Statistic
              title="Aylik Satis"
              value={formatMinor(bootstrap?.dashboard.monthlySalesTotalMinor, "TRY")}
            />
          </Card>
        </Col>
        <Col lg={6} md={12} xs={24}>
          <Card className="kagu-card">
            <Statistic
              title="Stok Toplam"
              value={formatMinor(bootstrap?.dashboard.inventoryTotalMinor, "TRY")}
            />
          </Card>
        </Col>
      </Row>
      <Card className="kagu-card" title="Faz Durumu">
        <Alert
          description="Master data, belge akislari ve rapor gosterimleri ayni veri modeli uzerinden ilerler. Web paneli ayarlar, operasyon ve belge ekranlarini ortak oturum mantiginda toplar."
          showIcon
          title="Operasyon verisi merkezi olarak sunuluyor"
          type="info"
        />
      </Card>
    </Space>
  );
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
}) {
  if (activeMenu === "dashboard") {
    return [] as LookupEntity[];
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
  settings: <SettingOutlined />,
  transfers: <SwapOutlined />,
  warehouses: <DeploymentUnitOutlined />,
};
