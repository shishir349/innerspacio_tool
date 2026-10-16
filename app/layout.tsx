import type { Metadata } from "next";
import localFont from "next/font/local";
import { Instrument_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Brand faces, subset to Latin + the rupee-adjacent range. The rupee sign itself falls back to the system font, per glyph.
const display = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "./fonts/csverdan-regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/csverdan-italic.woff2", weight: "400", style: "italic" },
  ],
  fallback: ["Georgia", "Times New Roman", "serif"],
});

// Moreus (the site's caption face) is caps-only: right for nav and labels, wrong for paragraphs and data.
// Readable text and numbers use Instrument Sans; the condensed label face carries the brand voice in small caps.
const text = Instrument_Sans({ variable: "--font-text", subsets: ["latin"], display: "swap" });

const label = localFont({
  variable: "--font-label",
  display: "swap",
  src: [
    { path: "./fonts/moho-medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/moho-bold.woff2", weight: "700", style: "normal" },
  ],
  fallback: ["Arial Narrow", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "InnerSpacio AI Studio",
  description:
    "InnerSpacio AI Studio — the design workspace for client meetings. Your space, your story.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${label.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
