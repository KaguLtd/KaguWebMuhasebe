"use client";

import { Button } from "antd";

export function StatementPrintButton() {
  return (
    <Button onClick={() => window.print()} type="primary">
      Yazdir / PDF Kaydet
    </Button>
  );
}
