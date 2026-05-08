"use client";

import { DatePicker, Form, Input, InputNumber, Select, Switch } from "antd";

import type { FieldConfig } from "@/lib/kagu/config";
import type { LookupEntity, LookupItem } from "@/lib/kagu/contracts";
import { selectableLookupOptions } from "@/lib/kagu/helpers";

type LookupMap = Partial<Record<LookupEntity, LookupItem[]>>;

interface FieldInputProps {
  field: FieldConfig;
  lookups: LookupMap;
}

export function FieldInput({ field, lookups }: FieldInputProps) {
  const form = Form.useFormInstance();
  const currentValue = Form.useWatch(field.name, form);
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
      {renderControl(field, lookups, currentValue)}
    </Form.Item>
  );
}

function renderControl(field: FieldConfig, lookups: LookupMap, currentValue?: unknown) {
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
        options={selectOptions(field, lookups, currentValue)}
        showSearch
        optionFilterProp="label"
      />
    );
  }

  return <Input />;
}

function selectOptions(field: FieldConfig, lookups: LookupMap, currentValue?: unknown) {
  if (field.lookupEntity) {
    return selectableLookupOptions(lookups[field.lookupEntity], currentValue);
  }

  return field.options ?? [];
}
