import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Montenegro Asset Monitor",
  description: "Мониторинг актива — Бечичи, Черногория",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
