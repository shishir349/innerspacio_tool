"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A royal line that starts the moment an internal link is clicked and finishes when the new page
 * arrives: the click always answers instantly, even while the server is still rendering.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [seen, setSeen] = useState(pathname);

  // Path changed: the navigation landed. (Adjusting state during render, not in an effect.)
  if (seen !== pathname) {
    setSeen(pathname);
    setPhase("done");
  }

  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => setPhase("idle"), 450);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      const href = a?.getAttribute("href");
      if (!a || !href || !href.startsWith("/") || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setPhase("loading");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
      style={{ opacity: phase === "idle" ? 0 : 1, transition: "opacity 0.3s ease 0.15s" }}
    >
      <div
        className="h-full origin-left bg-royal"
        style={{
          transform: `scaleX(${phase === "loading" ? 0.85 : phase === "done" ? 1 : 0})`,
          transition: phase === "loading" ? "transform 6s cubic-bezier(0.1, 0.7, 0.2, 1)" : phase === "done" ? "transform 0.25s ease-out" : "none",
        }}
      />
    </div>
  );
}
