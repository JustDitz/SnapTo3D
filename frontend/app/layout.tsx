import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Load JetBrains Mono for technical/metadata text (per PRD spec)
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

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
    <html lang="id" className={jetbrainsMono.variable}>
      {/* Pindahkan suppressHydrationWarning ke tag body karena di sinilah ekstensi menyuntikkan kodenya */}
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}