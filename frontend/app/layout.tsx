import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapTo3D — 3D Product Presentation for UMKM",
  description:
    "Upload a product photo and get an interactive 3D model. Built for Indonesian MSMEs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      {/* Pindahkan suppressHydrationWarning ke tag body karena di sinilah ekstensi menyuntikkan kodenya */}
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}