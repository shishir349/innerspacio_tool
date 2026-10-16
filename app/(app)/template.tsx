/** Re-mounts on every navigation, so the page-in animation (pure CSS, no JS) plays each time. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
