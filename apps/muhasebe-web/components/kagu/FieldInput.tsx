"use client";

import { DatePicker, Form, Input, InputNumber, Select, Switch } from "antd";

import type { FieldConfig } from "@/lib/kagu/config";
import type { LookupEntity, LookupItem } from "@/lib/kagu/contracts";

type LookupMap = Partial<Record<LookupEntity, LookupItem[]>>;

interface FieldInputProps {
  field: FieldConfig;
  lookups: LookupMap;
}

export function FieldInput({ field, lookups }: FieldInputProps) {
  const rules = field.required
    ? [{ required: true, message: `${field.label} gerekli` }]
    : undefined;

  if (field.type === "switch") {
    return (
      <Form.Item
        label={field.label}
        name={field.name}
        rules={rules}
        tooltip={field.hint}
        valuePropName="checked"
      >
        <Switch checkedChildren="Aktif" unCheckedChildren="Pasif" />
      </Form.Item>
    );
  }

  return (
    <Form.Item
      label={field.label}
      name={field.name}
      rules={rules}
      tooltip={field.hint}
    >
      {renderControl(field, lookups)}
    </Form.Item>
  );
}

function renderControl(field: FieldConfig, lookups: LookupMap) {
  if (field.type === "textarea") {
    return <Input.TextArea autoSize={{ minRows: 3 }} />;
  }

  if (field.type === "number") {
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

  if (field.type === "date") {
    return <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />;
  }

  if (field.type === "select") {
    return (
      <Select
        allowClear={!field.required}
        options={selectOptions(field, lookups)}
        showSearch
        optionFilterProp="label"
      />
    );
  }

  return <Input />;
}

function selectOptions(field: FieldConfig, lookups: LookupMap) {
  if (field.lookupEntity) {
    return (lookups[field.lookupEntity] ?? []).map((item) => ({
      label: item.label,
      value: item.id,
    }));
  }

  return field.options ?? [];
}
