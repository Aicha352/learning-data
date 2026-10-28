import type { Metadata, Viewport } from "next";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Learning Data — Apprends ce qui compte pour toi",
    template: "%s · Learning Data",
  },
  description:
    "Plateforme de formation en ligne : recommandations personnalisées, suivi de progression et détection du risque d'abandon.",
  applicationName: "Learning Data",
};

export const viewport: Viewport = {
  themeColor: "#2D5BE3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
