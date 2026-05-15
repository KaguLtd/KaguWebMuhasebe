"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  SettingsRole,
  SettingsUser,
} from "@/lib/kagu/contracts";
import {
  createSettingsUser,
  fetchSettingsRoles,
  fetchSettingsUsers,
  updateSettingsUser,
} from "@/lib/kagu/api";

interface SettingsUsersPanelProps {
  mode: "users" | "roles";
}

interface UserFormValues {
  email?: string;
  fullName?: string;
  isActive: boolean;
  password?: string;
  roleIds?: string[];
  username: string;
}

interface UserPayloadDraft {
  email?: string;
  fullName?: string;
  isActive: boolean;
  password?: string;
  roleIds: string[];
  username: string;
}

export function SettingsUsersPanel({ mode }: SettingsUsersPanelProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<UserFormValues>();
  const [users, setUsers] = useState<SettingsUser[]>([]);
  const [roles, setRoles] = useState<SettingsRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SettingsUser | null>(null);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    try {
      const [nextUsers, nextRoles] = await Promise.all([
        fetchSettingsUsers(),
        fetchSettingsRoles(),
      ]);

      setUsers(nextUsers);
      setRoles(nextRoles);
      setError(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Kullanici ve rol bilgileri alinamadi.",
      );
    } finally {
      setLoading(false);
    }
  }

  function openCreateDrawer() {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, roleIds: [] });
    setDrawerOpen(true);
  }

  function openEditDrawer(user: SettingsUser) {
    setEditingUser(user);
    form.resetFields();
    form.setFieldsValue({
      email: user.email ?? "",
      fullName: user.fullName ?? "",
      isActive: resolveUserActive(user),
      roleIds: user.roleIds ?? matchRoleIds(user, roles),
      username: user.username,
    });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);

    try {
      const values = await form.validateFields();
      const payload = toUserPayload(values);

      if (editingUser) {
        await updateSettingsUser(editingUser.id, payload);
        message.success("Kullanici guncellendi.");
      } else {
        await createSettingsUser({
          password: payload.password ?? "",
          username: payload.username,
          fullName: payload.fullName,
          email: payload.email,
          isActive: payload.isActive,
          roleIds: payload.roleIds,
        });
        message.success("Kullanici eklendi.");
      }

      setDrawerOpen(false);
      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("tr-TR");

    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      const haystack = [
        user.username,
        user.fullName,
        user.email,
        ...(user.roleNames ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(keyword);
    });
  }, [search, users]);

  const roleOptions = roles.map((role) => ({
    label: role.name,
    value: role.id,
  }));

  if (mode === "roles") {
    return (
      <Card className="kagu-card">
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Space orientation="vertical" size={0}>
            <Typography.Text className="kagu-section-kicker">
              Settings
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Roller
            </Typography.Title>
          </Space>
          <Alert
            description="Rol ekrani draft durumda. Bu sekme simdilik backend'den gelen rol sozlugunu gorunur kilar; detayli izin matrisi ayri bir iterasyonda acilacak."
            showIcon
            title="Yetki matrisi hazirlaniyor"
            type="info"
          />
          <Table<SettingsRole>
            columns={[
              {
                dataIndex: "name",
                key: "name",
                title: "Rol",
              },
              {
                dataIndex: "key",
                key: "key",
                title: "Kod",
                render: (value: string | null | undefined) => value || "-",
              },
              {
                dataIndex: "description",
                key: "description",
                title: "Aciklama",
                render: (value: string | null | undefined) => value || "-",
              },
              {
                dataIndex: "userCount",
                key: "userCount",
                title: "Kullanici",
                width: 120,
              },
              {
                dataIndex: "isSystem",
                key: "isSystem",
                title: "Tip",
                render: (value: boolean | undefined) => (
                  <Tag color={value ? "gold" : "default"}>
                    {value ? "Sistem" : "Ozel"}
                  </Tag>
                ),
                width: 120,
              },
            ]}
            dataSource={roles}
            loading={loading}
            locale={{ emptyText: <Empty description="Rol kaydi bulunamadi" /> }}
            pagination={false}
            rowKey="id"
          />
        </Space>
      </Card>
    );
  }

  return (
    <Card
      className="kagu-card"
      extra={
        <Space>
          <Button onClick={() => void loadData()}>Yenile</Button>
          <Button onClick={openCreateDrawer} type="primary">
            Yeni Kullanici
          </Button>
        </Space>
      }
      title={
        <Space orientation="vertical" size={0}>
          <Typography.Text className="kagu-section-kicker">
            Settings
          </Typography.Text>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Kullanici Yonetimi
          </Typography.Title>
        </Space>
      }
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Kullanici kayitlari, rol atamalari ve aktiflik durumu bu panelden
          yonetilir.
        </Typography.Paragraph>
        {error ? <Alert showIcon title={error} type="warning" /> : null}
        <Input.Search
          allowClear
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Kullanici adi, ad soyad, e-posta veya rol ara"
          value={search}
        />
        <Table<SettingsUser>
          columns={[
            {
              dataIndex: "username",
              key: "username",
              title: "Kullanici Adi",
              width: 180,
            },
            {
              dataIndex: "fullName",
              key: "fullName",
              title: "Ad Soyad",
              render: (value: string | null | undefined) => value || "-",
            },
            {
              dataIndex: "email",
              key: "email",
              title: "E-posta",
              render: (value: string | null | undefined) => value || "-",
            },
            {
              key: "roles",
              render: (_value: unknown, user: SettingsUser) => {
                const names = user.roleNames ?? matchRoleNames(user, roles);

                return names.length ? (
                  <Space size={[4, 4]} wrap>
                    {names.map((name) => (
                      <Tag key={name}>{name}</Tag>
                    ))}
                  </Space>
                ) : (
                  "-"
                );
              },
              title: "Roller",
            },
            {
              key: "status",
              render: (_value: unknown, user: SettingsUser) => (
                <Tag color={resolveUserActive(user) ? "green" : "default"}>
                  {resolveUserActive(user) ? "Aktif" : "Pasif"}
                </Tag>
              ),
              title: "Durum",
              width: 110,
            },
            {
              dataIndex: "lastLoginAt",
              key: "lastLoginAt",
              title: "Son Giris",
              render: (value: string | null | undefined) =>
                value ? formatDateTime(value) : "-",
              width: 180,
            },
            {
              key: "actions",
              render: (_value: unknown, user: SettingsUser) => (
                <Button onClick={() => openEditDrawer(user)} type="link">
                  Duzenle
                </Button>
              ),
              title: "",
              width: 96,
            },
          ]}
          dataSource={filteredUsers}
          loading={loading}
          locale={{ emptyText: <Empty description="Kullanici kaydi bulunamadi" /> }}
          pagination={{ pageSize: 10 }}
          rowKey="id"
        />
      </Space>
      <Drawer
        destroyOnHidden
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        size="min(640px, 96vw)"
        title={editingUser ? "Kullaniciyi Duzenle" : "Yeni Kullanici"}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Kullanici Adi"
            name="username"
            rules={[{ required: true, message: "Kullanici adi gerekli" }]}
          >
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item label="Ad Soyad" name="fullName">
            <Input />
          </Form.Item>
          <Form.Item
            label="E-posta"
            name="email"
            rules={[{ type: "email", message: "Gecerli bir e-posta girin" }]}
          >
            <Input autoComplete="email" />
          </Form.Item>
          <Form.Item
            label="Sifre"
            name="password"
            rules={
              editingUser
                ? undefined
                : [{ required: true, message: "Yeni kullanici icin sifre gerekli" }]
            }
          >
            <Input.Password
              autoComplete={editingUser ? "new-password" : "current-password"}
              placeholder={
              editingUser ? "Bos birakirsaniz mevcut sifre korunur" : undefined
              }
            />
          </Form.Item>
          <Form.Item label="Roller" name="roleIds">
            <Select
              mode="multiple"
              optionFilterProp="label"
              options={roleOptions}
              placeholder="Rol secin"
              showSearch
            />
          </Form.Item>
          <Form.Item label="Aktif Kullanici" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
        <Space className="kagu-drawer-actions">
          <Button onClick={() => setDrawerOpen(false)}>Vazgec</Button>
          <Button disabled={saving} loading={saving} onClick={() => void handleSave()} type="primary">
            Kaydet
          </Button>
        </Space>
      </Drawer>
    </Card>
  );
}

function toUserPayload(values: UserFormValues): UserPayloadDraft {
  const payload: UserPayloadDraft = {
    email: values.email?.trim() || undefined,
    fullName: values.fullName?.trim() || undefined,
    isActive: values.isActive,
    roleIds: values.roleIds ?? [],
    username: values.username.trim(),
  };

  if (values.password?.trim()) {
    payload.password = values.password.trim();
  }

  return payload;
}

function matchRoleIds(user: SettingsUser, roles: SettingsRole[]) {
  if (!user.roleNames?.length) {
    return [];
  }

  return roles
    .filter((role) => user.roleNames?.includes(role.name))
    .map((role) => role.id);
}

function matchRoleNames(user: SettingsUser, roles: SettingsRole[]) {
  if (user.roleNames?.length) {
    return user.roleNames;
  }

  if (!user.roleIds?.length) {
    return [];
  }

  return user.roleIds
    .map((roleId) => roles.find((role) => role.id === roleId)?.name)
    .filter((name): name is string => Boolean(name));
}

function resolveUserActive(user: SettingsUser) {
  if (typeof user.isActive === "boolean") {
    return user.isActive;
  }

  return user.status?.toUpperCase() !== "PASSIVE";
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
