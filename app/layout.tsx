import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";

import { Providers } from "./providers";

import { ToastProvider } from "@/components/toast-provider";
import { SessionBootstrap } from "@/components/session-bootstrap";
import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";
import { Suspense } from "react";

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
  const currentYear = new Date().getFullYear();

  return (
    <html suppressHydrationWarning lang="es">
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
          <div className="relative flex min-h-screen flex-col">
            <Suspense fallback={null}>
              <RouteLoader />
            </Suspense>
            <Navbar />
            <main className="container mx-auto max-w-7xl pt-16 px-6 flex-grow">
              {children}
            </main>
            <footer className="border-t border-default-200/80 bg-content1/70 backdrop-blur">
              <div className="container mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 text-sm text-default-600 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-medium text-default-700">
                  © {currentYear} Viomar · ERP Operativo y Comercial
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <a className="hover:text-default-900" href="/dashboard">
                    Dashboard
                  </a>
                  <a className="hover:text-default-900" href="/envios">
                    Envíos
                  </a>
                  <a className="hover:text-default-900" href="/options">
                    Opciones
                  </a>
                  <span className="text-default-400">Versión interna v1</span>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
