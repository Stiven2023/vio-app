import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";

import { Providers } from "./providers";

import { ToastProvider } from "@/components/toast-provider";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";

import { RouteLoader } from "@/components/route-loader";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: [{ url: "/STICKER%20VIOMAR.png", type: "image/png" }],
    shortcut: [{ url: "/STICKER%20VIOMAR.png", type: "image/png" }],
    apple: [{ url: "/STICKER%20VIOMAR.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <head />
      <body
        className={clsx(
          "min-h-screen text-foreground font-sans antialiased",
          fontSans.variable,
        )}
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
          <ToastProvider />
          <SessionBootstrap />
          <Suspense fallback={null}>
            <RouteLoader />
          </Suspense>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
