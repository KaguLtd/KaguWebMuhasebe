"use client";

import { Alert, App, Button, Card, DatePicker, Form, Space, Switch, Typography } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useEffect, useState } from "react";

import { fetchPeriodLock, savePeriodLock } from "@/lib/kagu/api";
import type { PeriodLockConfig } from "@/lib/kagu/contracts";

interface PeriodLockFormValues {
  isActive: boolean;
  lockDate: Dayjs | null;
}

interface SettingsPeriodLockPanelProps {
  onDataChanged?: () => void | Promise<void>;
}

export function SettingsPeriodLockPanel({
  onDataChanged,
}: SettingsPeriodLockPanelProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<PeriodLockFormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PeriodLockConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);

      try {
        const nextConfig = await fetchPeriodLock();

        if (!active) {
          return;
        }

        setConfig(nextConfig);
        setError(null);
        form.setFieldsValue({
          isActive: nextConfig.isActive,
          lockDate: nextConfig.lockDate ? dayjs(nextConfig.lockDate) : null,
        });
      } catch (error) {
        if (active) {
          setError(
            error instanceof Error ? error.message : "Donem kilidi bilgileri alinamadi.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [form]);

  async function loadConfig() {
    setLoading(true);

    try {
      const nextConfig = await fetchPeriodLock();

      setConfig(nextConfig);
      setError(null);
      form.setFieldsValue({
        isActive: nextConfig.isActive,
        lockDate: nextConfig.lockDate ? dayjs(nextConfig.lockDate) : null,
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Donem kilidi bilgileri alinamadi.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);

    try {
      const values = await form.validateFields();
      const nextConfig = await savePeriodLock({
        isActive: values.isActive,
        lockDate: values.lockDate ? values.lockDate.format("YYYY-MM-DD") : null,
      });

      setConfig(nextConfig);
      message.success("Donem kilidi kaydedildi.");
      void onDataChanged?.();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      className="kagu-card"
      extra={
        <Space>
          <Button loading={loading} onClick={() => void loadConfig()}>
            Yenile
          </Button>
          <Button loading={saving} onClick={handleSave} type="primary">
            Kaydet
          </Button>
        </Space>
      }
      title={
        <Space orientation="vertical" size={0}>
          <Typography.Text className="kagu-section-kicker">
            Settings
          </Typography.Text>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Donem Kilidi
          </Typography.Title>
        </Space>
      }
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          description="Yonetici burada belirlenen tarihten onceki onayli belgelerin degistirilmesini, iptalini ve revizyonunu kapatabilir."
          showIcon
          title="Operasyonel donem kilidi"
          type="info"
        />
        {error ? (
          <Alert
            description={error}
            showIcon
            title="Donem kilidi yuklenemedi"
            type="warning"
          />
        ) : null}
        <Form form={form} initialValues={{ isActive: false, lockDate: null }} layout="vertical">
          <Form.Item label="Kilit Aktif" name="isActive" valuePropName="checked">
            <Switch checkedChildren="Aktif" unCheckedChildren="Pasif" />
          </Form.Item>
          <Form.Item
            label="Kilit Tarihi"
            name="lockDate"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!getFieldValue("isActive") || value) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error("Kilit aktifse tarih secilmelidir"));
                },
              }),
            ]}
          >
            <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
        <Space orientation="vertical" size={4}>
          <Typography.Text>
            Son degistiren: {config?.updatedByUserId ?? "-"}
          </Typography.Text>
          <Typography.Text>
            Son guncelleme: {config?.updatedAt ?? "-"}
          </Typography.Text>
        </Space>
      </Space>
    </Card>
  );
}
