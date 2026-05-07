import type { Metadata } from "next";
import "antd/dist/reset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "KAGU Muhasebe Web",
  description: "KAGU ERP web yeniden insa iskeleti",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
