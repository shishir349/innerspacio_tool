import { Skeleton } from "@/components/ui/skeleton";

/** Shown the instant a Studio link is clicked, while the next page renders on the server. */
export default function Loading() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading">
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-14 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="hidden h-44 rounded-3xl lg:block" />
      </div>
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}
