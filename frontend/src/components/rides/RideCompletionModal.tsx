import { Link } from "react-router-dom";
import type { RideDetailView } from "@ps02/shared";
import { Button } from "../ui/Button";
import { formatCurrency, formatKm, formatMinutes } from "../../utils/format";

interface RideCompletionModalProps {
  ride: RideDetailView;
  onDismiss: () => void;
  rating: number;
  onRatingChange: (value: number) => void;
  feedback: string;
  onFeedbackChange: (value: string) => void;
  ratingBusy: boolean;
  ratingError: string | null;
  onSubmitRating: () => void;
}

function tripDuration(ride: RideDetailView): number | null {
  if (!ride.startedAt || !ride.completedAt) return null;
  const started = Date.parse(ride.startedAt);
  const completed = Date.parse(ride.completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) return null;
  return Math.max(1, Math.round((completed - started) / 60_000));
}

function TripDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-ink-50 p-3">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-ink-900">{value}</dd>
    </div>
  );
}

export function RideCompletionModal({
  ride,
  onDismiss,
  rating,
  onRatingChange,
  feedback,
  onFeedbackChange,
  ratingBusy,
  ratingError,
  onSubmitRating,
}: RideCompletionModalProps) {
  const duration = tripDuration(ride);
  const actualDistance =
    typeof ride.actualDistanceKm === "number" &&
    Number.isFinite(ride.actualDistanceKm) &&
    ride.actualDistanceKm > 0
      ? ride.actualDistanceKm
      : null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center overflow-y-auto bg-ink-950/65 p-3 backdrop-blur-sm motion-safe:animate-fade-in sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ride-completion-title"
        className="my-auto w-full max-w-xl rounded-3xl bg-white p-5 shadow-raised motion-safe:animate-slide-up sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Trip summary</p>
            <h2 id="ride-completion-title" className="mt-1 text-2xl font-bold text-ink-950">
              Ride completed!
            </h2>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-3 py-1 text-xl text-ink-500 transition hover:bg-ink-100"
            aria-label="Close ride summary"
          >
            ×
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <TripDetail
            label="Final fare"
            value={ride.fareFinal == null ? "Unavailable" : formatCurrency(ride.fareFinal, 0)}
          />
          <TripDetail
            label="Actual distance"
            value={actualDistance === null ? "Unavailable" : formatKm(actualDistance)}
          />
          <TripDetail
            label="Duration"
            value={duration === null ? "Unavailable" : formatMinutes(duration)}
          />
          <TripDetail label="Payment status" value="Not recorded" />
          <TripDetail label="Pickup coordinates" value={`${ride.pickupLat.toFixed(5)}, ${ride.pickupLng.toFixed(5)}`} />
          <TripDetail label="Destination coordinates" value={`${ride.dropLat.toFixed(5)}, ${ride.dropLng.toFixed(5)}`} />
        </dl>

        {ride.driver ? (
          <div className="mt-3 rounded-xl border border-ink-200 p-3">
            <p className="text-xs text-ink-500">Driver</p>
            <p className="mt-1 text-sm font-semibold text-ink-900">{ride.driver.user.name}</p>
            <p className="mt-0.5 text-sm text-ink-600">
              {ride.driver.vehicleType}
              {ride.driver.vehicleRegistration ? ` · ${ride.driver.vehicleRegistration}` : ""}
            </p>
          </div>
        ) : null}

        {ride.passengerRating == null ? (
          <div className="mt-5 border-t border-ink-100 pt-4">
            <p className="text-sm font-semibold text-ink-900">Rate your ride</p>
            <div className="mt-2 flex gap-2" role="group" aria-label="Ride rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  aria-pressed={rating === value}
                  onClick={() => onRatingChange(value)}
                  className={`rounded-lg px-2 py-1 text-xl transition hover:scale-110 ${
                    rating >= value ? "text-amber-500" : "text-ink-300"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={feedback}
              onChange={(event) => onFeedbackChange(event.target.value)}
              maxLength={1000}
              placeholder="Optional feedback"
              className="mt-3 min-h-20 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm"
            />
            {ratingError ? <p role="alert" className="mt-2 text-sm text-red-700">{ratingError}</p> : null}
            <Button className="mt-3 w-full" loading={ratingBusy} disabled={!rating} onClick={onSubmitRating}>
              Submit rating
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-600">Your rating: {ride.passengerRating} / 5</p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" variant="secondary" onClick={onDismiss}>View ride details</Button>
          <Link
            to="/passenger/book"
            onClick={onDismiss}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Book another ride
          </Link>
        </div>
      </section>
    </div>
  );
}
