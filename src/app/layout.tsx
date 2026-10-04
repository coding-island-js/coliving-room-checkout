import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import "./globals.css";

// next/font downloads these at build time and serves them from this site. No request goes to Google.
const serif = DM_Serif_Display({ variable: "--font-serif", subsets: ["latin"], weight: "400" });
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });

const SITE = process.env.BASE_URL ?? "https://coliving-demo.withmagic.ai";
const TITLE = "Co-living room checkout demo";
const DESCRIPTION =
  "Pick a room, choose weekly, every-2-weeks or monthly rent, and pay with Stripe. The room is held for 45 minutes while you pay.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "any" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE,
    type: "website",
    images: [{ url: `${SITE}/og.png`, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [`${SITE}/og.png`] },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#fbf7f1", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
