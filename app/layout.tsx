import type { Metadata } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

const rounded = M_PLUS_Rounded_1c({
  variable: "--font-rounded",
  weight: ["500", "700", "800", "900"],
  preload: false,
});

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
      <body className={`${rounded.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
