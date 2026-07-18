import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "カラタチの最果てのセンセイ！ 切り抜きサンプラー",
  description: "番組の切り抜きとランダムに出会える音声サンプラー。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
