import { LISTING_STATUS_LABELS, LISTING_STATUS_TONE } from "@/lib/constants";
import type { ListingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ListingStatusBadge({ status, className }: { status: ListingStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset", LISTING_STATUS_TONE[status], className)}>
      <span className="mr-1.5 size-1.5 rounded-full bg-current" />
      {LISTING_STATUS_LABELS[status]}
    </span>
  );
}
