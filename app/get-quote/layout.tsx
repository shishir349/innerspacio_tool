import { SmoothScroll } from "@/components/motion/smooth-scroll";

export default function GetQuoteLayout({ children }: { children: React.ReactNode }) {
  return <SmoothScroll>{children}</SmoothScroll>;
}
