import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { Logo } from "@/components/layout/logo";

/** Showroom chrome: a slim header that reads like innerspacio.com, Lenis smooth scrolling underneath. */
export default function GetQuoteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[88rem] items-center justify-between px-5 md:px-10">
          <a href="https://innerspacio.com" aria-label="InnerSpacio home">
            <Logo studio={false} size="sm" />
          </a>
          <a
            href="https://innerspacio.com"
            className="font-caps link-draw text-[0.78rem] tracking-[0.14em] text-muted-foreground uppercase hover:text-foreground"
          >
            innerspacio.com
          </a>
        </div>
      </header>
      {children}
    </SmoothScroll>
  );
}
