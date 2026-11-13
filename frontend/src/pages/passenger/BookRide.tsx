import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { INDIA_BOUNDS, INDIA_CENTER, VehicleCategory, type EstimateResponse, type LatLng, type NearbyDriver } from "@ps02/shared";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Spinner } from "../../components/ui/Spinner";
import { RideLocationPicker } from "../../components/map/RideLocationPicker";
import { PassengerAreaDemand } from "./PassengerAreaDemand";
import { useAuth } from "../../hooks/useAuth";
import { useRideLocations } from "../../hooks/useRideLocations";
import { useToast } from "../../hooks/useToast";
import { driverApi } from "../../services/driverApi";
import { ApiClientError, errorMessage } from "../../services/api";
import { rideApi } from "../../services/rideApi";
import { formatCurrency, formatKm, formatMinutes } from "../../utils/format";

type BookingState =
  | "IDLE"
  | "PICKUP_SELECTED"
  | "DESTINATION_SELECTED"
  | "CALCULATING_ROUTE"
  | "ROUTE_READY"
  | "BOOKING"
  | "ERROR";

function isValidPoint(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= INDIA_BOUNDS.south &&
    point.lat <= INDIA_BOUNDS.north &&
    point.lng >= INDIA_BOUNDS.west &&
    point.lng <= INDIA_BOUNDS.east
  );
}

function routeKey(pickup: LatLng, drop: LatLng, category: VehicleCategory): string {
  return `${pickup.lat},${pickup.lng}|${drop.lat},${drop.lng}|${category}`;
}

const CATEGORY_OPTIONS: { id: VehicleCategory; label: string; hint: string }[] = [
  { id: VehicleCategory.BIKE, label: "Bike", hint: "Fast, low fare" },
  { id: VehicleCategory.CAR, label: "Car", hint: "Private car" },
  { id: VehicleCategory.POOL, label: "Pooling", hint: "Shared car, lower fare" },
];

function validEstimate(estimate: EstimateResponse): boolean {
  return (
    Number.isFinite(estimate.distanceKm) &&
    estimate.distanceKm > 0 &&
    Number.isFinite(estimate.etaMin) &&
    estimate.etaMin > 0 &&
    Number.isFinite(estimate.durationMin) &&
    estimate.durationMin > 0 &&
    Number.isFinite(estimate.fare) &&
    estimate.fare >= 0 &&
    Number.isFinite(estimate.surge) &&
    estimate.surge >= 1
  );
}

export function BookRide() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, logout } = useAuth();
  const locations = useRideLocations();
  const [category, setCategory] = useState<VehicleCategory>(VehicleCategory.CAR);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [estimateKey, setEstimateKey] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyDriver[]>([]);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingState, setBookingState] = useState<BookingState>("IDLE");
  const [routeRetry, setRouteRetry] = useState(0);
  const submitting = useRef(false);

  const pickup = locations.pickup;
  const drop = locations.drop;
  const currentRouteKey = pickup && drop ? routeKey(pickup, drop, category) : null;
  const routeReady =
    Boolean(estimate && currentRouteKey && estimateKey === currentRouteKey) &&
    !estimating &&
    !estimateError;

  useEffect(() => {
    setEstimate(null);
    setEstimateKey(null);
    setEstimateError(null);
    setEstimating(false);
    setBookingError(null);

    if (!pickup && !drop) {
      setBookingState("IDLE");
      return;
    }
    if (pickup && !drop) {
      setBookingState("PICKUP_SELECTED");
      return;
    }
    if (!pickup || !drop) {
      setBookingState("DESTINATION_SELECTED");
      return;
    }

    if (!isValidPoint(pickup) || !isValidPoint(drop)) {
      setEstimateError("Choose pickup and destination within India.");
      setBookingState("ERROR");
      return;
    }
    if (pickup.lat === drop.lat && pickup.lng === drop.lng) {
      setEstimateError("Pickup and destination must be different locations.");
      setBookingState("ERROR");
      return;
    }

    const controller = new AbortController();
    const key = routeKey(pickup, drop, category);
    setBookingState("CALCULATING_ROUTE");
    setEstimating(true);
    rideApi
      .estimate(pickup, drop, category, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (!validEstimate(response)) {
          throw new Error("The route service returned an invalid distance, duration or fare. Please retry.");
        }
        setEstimate(response);
        setEstimateKey(key);
        setBookingState("ROUTE_READY");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setEstimate(null);
        setEstimateKey(null);
        setEstimateError(errorMessage(error));
        setBookingState("ERROR");
      })
      .finally(() => {
        if (!controller.signal.aborted) setEstimating(false);
      });

    return () => {
      controller.abort();
    };
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng, category, routeRetry]);

  useEffect(() => {
    if (!pickup) {
      setNearby([]);
      setNearbyError(null);
      return;
    }
    const controller = new AbortController();
    setNearbyError(null);
    driverApi
      .nearby(pickup.lat, pickup.lng, 8, category, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setNearby(response.drivers);
          setNearbyError(null);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setNearby([]);
        setNearbyError(errorMessage(error));
      });
    return () => {
      controller.abort();
    };
  }, [pickup?.lat, pickup?.lng, category]);

  const book = async () => {
    if (submitting.current) return;
    if (!user) {
      setBookingError("Your session has expired. Sign in again to book a ride.");
      return;
    }
    if (!pickup || !drop || !isValidPoint(pickup) || !isValidPoint(drop)) {
      setBookingError("Choose valid pickup and destination coordinates before booking.");
      return;
    }
    if (pickup.lat === drop.lat && pickup.lng === drop.lng) {
      setBookingError("Pickup and destination must be different locations.");
      return;
    }
    if (!routeReady || !estimate || !validEstimate(estimate)) {
      setBookingError("The route and fare are not ready yet. Retry the route calculation.");
      return;
    }

    submitting.current = true;
    setBooking(true);
    setBookingError(null);
    setBookingState("BOOKING");
    try {
      const { ride } = await rideApi.create(pickup, drop, category);
      if (!ride.id) throw new Error("The server did not confirm the ride request.");
      toast.push("success", "Ride request confirmed", "Your ride is saved. Searching for an available driver.");
      navigate("/passenger/rides", { state: { rideId: ride.id } });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        logout();
        navigate("/login", { state: { from: "/passenger/book" } });
        return;
      }
      setBookingError(errorMessage(error));
      setBookingState("ERROR");
    } finally {
      submitting.current = false;
      setBooking(false);
    }
  };

  const pickupLabel =
    locations.pickupAddress ||
    (pickup ? `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}` : "Pickup not selected");
  const dropLabel =
    locations.dropAddress ||
    (drop ? `${drop.lat.toFixed(5)}, ${drop.lng.toFixed(5)}` : "Destination not selected");
  const bookingPanel = (
    <Card
      className={`shadow-card ${
        routeReady ? "motion-safe:animate-slide-up" : ""
      }`}
    >
      <CardHeader
        title="Your ride"
        subtitle="The booking button becomes available as soon as the route and fare are ready."
      />
      <CardBody className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">
            Ride type
          </p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Ride type">
            {CATEGORY_OPTIONS.map((option) => {
              const active = category === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={booking}
                  onClick={() => setCategory(option.id)}
                  className={`rounded-xl border px-2 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? "border-brand-400 bg-brand-50 ring-1 ring-brand-200"
                      : "border-ink-200 bg-white hover:bg-ink-50"
                  }`}
                >
                  <span className={`block text-sm font-semibold ${active ? "text-brand-700" : "text-ink-900"}`}>
                    {option.label}
                  </span>
                  <span className="block text-[10px] leading-4 text-ink-500">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {routeReady && estimate ? (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-ink-400">Pickup</dt>
                <dd className="mt-1 break-words font-medium text-ink-900">{pickupLabel}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-ink-400">Destination</dt>
                <dd className="mt-1 break-words font-medium text-ink-900">{dropLabel}</dd>
              </div>
            </dl>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 p-4">
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-ink-500">Distance</p>
                  <p className="font-semibold text-ink-900">{formatKm(estimate.distanceKm)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">Travel time</p>
                  <p className="font-semibold text-ink-900">{formatMinutes(estimate.etaMin)}</p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">Estimated fare</p>
                  <p
                    key={estimate.fare}
                    className="font-semibold text-ink-900 motion-safe:animate-fade-in motion-reduce:transition-none"
                  >
                    {formatCurrency(estimate.fare, 0)}
                  </p>
                </div>
              </div>
              <Badge tone={estimate.surge > 1.05 ? "warning" : "success"}>
                {estimate.surge > 1.05 ? `Surge ×${estimate.surge.toFixed(2)}` : "No surge"}
              </Badge>
            </div>
            <p className="text-xs text-ink-500">
              {CATEGORY_OPTIONS.find((option) => option.id === category)?.label ?? "Car"} fare · route source:{" "}
              {estimate.source === "osrm" ? "OSRM road network" : "Haversine fallback"}.
            </p>
          </>
        ) : estimating ? (
          <div className="flex items-center justify-center gap-2 py-5 text-sm text-ink-500" aria-live="polite">
            <Spinner className="h-5 w-5 text-brand-500" />
            Calculating route and fare…
          </div>
        ) : estimateError ? (
          <div className="flex flex-col gap-3">
            <ErrorState message={estimateError} />
            {pickup && drop && isValidPoint(pickup) && isValidPoint(drop) ? (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setRouteRetry((attempt) => attempt + 1)}
              >
                Retry route calculation
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="py-2 text-sm text-ink-500" aria-live="polite">
            {bookingState === "PICKUP_SELECTED"
              ? "Pickup selected. Choose a destination anywhere in India to calculate your route and fare."
              : bookingState === "DESTINATION_SELECTED"
                ? "Choose a pickup location anywhere in India to calculate your route and fare."
                : "Select pickup and destination locations to see your ride details."}
          </p>
        )}
      </CardBody>
    </Card>
  );

  return (
    <div className={`flex flex-col gap-5 ${routeReady ? "pb-24 lg:pb-0" : ""}`}>
      <PageHeader
        title="Book a ride"
        description="Choose pickup and destination. Your route, duration and fare will be calculated automatically."
      />
      <RideLocationPicker
        locations={locations}
        nearby={nearby}
        nearbyError={nearbyError}
        disabled={booking}
        route={routeReady ? estimate?.polyline : undefined}
        onReset={() => {
          setEstimate(null);
          setEstimateKey(null);
          setEstimateError(null);
          setBookingError(null);
        }}
        bookingPanel={bookingPanel}
      />

      <PassengerAreaDemand category={category} pickup={pickup} />

      {routeReady ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-200 bg-white/95 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-raised backdrop-blur lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[420px] lg:rounded-2xl lg:border">
          <div className="mx-auto flex max-w-3xl items-center gap-3 lg:max-w-none">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-500">
                {CATEGORY_OPTIONS.find((option) => option.id === category)?.label ?? "Car"} ·{" "}
                {formatKm(estimate!.distanceKm)} · {formatMinutes(estimate!.etaMin)}
              </p>
              <p className="text-lg font-semibold text-ink-900">{formatCurrency(estimate!.fare, 0)}</p>
            </div>
            <Button
              size="lg"
              loading={booking}
              disabled={!routeReady || booking}
              className="min-h-12 shrink-0 transition-all hover:-translate-y-0.5 hover:shadow-raised motion-reduce:transform-none motion-reduce:transition-none"
              onClick={() => void book()}
            >
              {booking ? "Booking…" : "Confirm & Book Ride"}
            </Button>
          </div>
          {bookingError ? <p role="alert" className="mx-auto mt-2 max-w-3xl text-sm text-red-700">{bookingError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
