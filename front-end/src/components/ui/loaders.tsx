import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const InlineLoader = ({
  label = "Loading...",
  className
}: {
  label?: string;
  className?: string;
}) => (
  <div className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
    <Loader2 className="h-4 w-4 animate-spin text-current" />
    <span>{label}</span>
  </div>
);

export const PageLoader = ({
  label = "Loading data..."
}: {
  label?: string;
}) => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="rounded-xl border bg-card px-5 py-4 shadow-sm">
      <InlineLoader label={label} />
    </div>
  </div>
);

export const StatCardsLoader = ({ cards = 3 }: { cards?: number }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {Array.from({ length: cards }).map((_, idx) => (
      <div key={idx} className="rounded-xl border bg-card p-4 space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-36" />
      </div>
    ))}
  </div>
);

export const TableLoaderRows = ({
  rows = 5,
  cols = 6
}: {
  rows?: number;
  cols?: number;
}) => (
  <>
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <tr key={rowIdx} className="border-b">
        {Array.from({ length: cols }).map((__, colIdx) => (
          <td key={colIdx} className="p-3">
            <Skeleton className="h-4 w-full" />
          </td>
        ))}
      </tr>
    ))}
  </>
);
