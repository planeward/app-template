import type { Metadata } from "next";

import { PlanewardProvider, PlanewardThemeSync } from "@repo/planeward/client";
import { Toaster } from "@repo/ui/components/sonner";

import "@repo/ui/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Planeward Community App",
    template: "%s · Planeward Community App",
  },
  description:
    "A starter app that runs inside a Planeward community: member view, staff dashboard, API and webhooks.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // PlanewardThemeSync sets data-theme on <html> from the host after hydration.
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <PlanewardProvider>
          <PlanewardThemeSync />
          {children}
          <Toaster position="bottom-center" />
        </PlanewardProvider>
      </body>
    </html>
  );
}
