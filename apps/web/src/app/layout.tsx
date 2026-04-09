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
    default: "Cred Vault",
    template: "%s | Cred Vault",
  },
  description: "Secure project credentials manager for your team.",
  applicationName: "Cred Vault",
  robots: { index: false, follow: false },  // internal tool — no indexing
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={inter.variable}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
