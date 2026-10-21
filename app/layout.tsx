import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import "./globals.css";

// Faces are declared in globals.css (@font-face): Paceon for display caps, Archivo (variable, Medium default) for everything read.

export const metadata: Metadata = {
  title: "InnerSpacio AI Studio",
  description:
    "InnerSpacio AI Studio — the design workspace for client meetings. Your space, your story.",
};

export const viewport: Viewport = { themeColor: "#f8f3f0" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SmoothScroll>{children}</SmoothScroll>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
