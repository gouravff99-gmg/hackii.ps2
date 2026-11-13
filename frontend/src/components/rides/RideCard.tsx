import type { Ride } from "@ps02/shared";
import { Badge } from "../ui/Badge";
import { formatCurrency, formatDateTime, formatKm, rideStatusLabel, rideStatusTone } from "../../utils/format";

export function RideCard({
  ride,
  onSelect,
  driverName,
}: {
  ride: Ride;
  onSelect?: () => void;
  driverName?: string | null;
}) {
  const fare = ride.fareFinal ?? ride.fareEstimate;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">
            {formatKm(ride.distanceKm)} · {Math.round(ride.etaMin)} min
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {formatDateTime(ride.requestedAt)}
            {driverName ? ` · ${driverName}` : ""}
          </p>
        </div>
        <Badge tone={rideStatusTone(ride.status)} dot>
          {rideStatusLabel(ride.status)}
        </Badge>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 text-xs text-ink-500">
          <p className="truncate">
            <span className="font-medium text-ink-600">From</span> {ride.pickupLat.toFixed(4)},{" "}
            {ride.pickupLng.toFixed(4)}
          </p>
          <p className="truncate">
            <span className="font-medium text-ink-600">To</span> {ride.dropLat.toFixed(4)},{" "}
            {ride.dropLng.toFixed(4)}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-ink-900">
          {formatCurrency(fare, 0)}
          {ride.surgeMultiplier > 1.05 ? (
            <span className="ml-1 text-xs font-medium text-amber-600">
              ×{ride.surgeMultiplier.toFixed(2)}
            </span>
          ) : null}
        </p>
      </div>
    </>
  );

  if (!onSelect) {
    return <div className="rounded-xl border border-ink-200 bg-white px-4 py-3">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-left transition hover:border-brand-300 hover:shadow-card"
    >
      {body}
    </button>
  );
}
