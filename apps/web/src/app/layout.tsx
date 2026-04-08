import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--vault-font-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VaultStack",
    template: "%s | VaultStack",
  },
  description: "Secure project credentials manager for your team.",
  applicationName: "VaultStack",
  robots: { index: false, follow: false },  // internal tool — no indexing
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
