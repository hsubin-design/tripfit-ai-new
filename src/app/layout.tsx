import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripFit AI",
  description: "두 여행 일정을 같은 기준으로 비교합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
