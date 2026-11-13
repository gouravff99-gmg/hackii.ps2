import { RideStatus, type RideDetailView } from "@ps02/shared";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { RideStatusStepper } from "./RideStatusStepper";
import { formatCurrency, formatKm, formatMinutes, rideStatusLabel } from "../../utils/format";

interface RideTrackingPanelProps {
  ride: RideDetailView;
  demoMode: boolean;
  gpsAge: number | null;
  routeLoading: boolean;
  routeError: string | null;
  onRetryRoute: () => void;
  remainingDistance: number | null;
  remainingEta: number | null;
  sheetExpanded: boolean;
  onToggleSheet: () => void;
  cancelling: boolean;
  onCancel: () => void;
}

export function RideTrackingPanel({
  ride,
  demoMode,
  gpsAge,
  routeLoading,
  routeError,
  onRetryRoute,
  remainingDistance,
  remainingEta,
  sheetExpanded,
  onToggleSheet,
  cancelling,
  onCancel,
}: RideTrackingPanelProps) {
  const actualDistance =
    typeof ride.actualDistanceKm === "number" &&
    Number.isFinite(ride.actualDistanceKm) &&
    ride.actualDistanceKm > 0
      ? ride.actualDistanceKm
      : null;
  const distanceValue =
    ride.status === RideStatus.COMPLETED
      ? actualDistance !== null ? formatKm(actualDistance) : "Unavailable"
      : remainingDistance !== null ? formatKm(remainingDistance) : formatKm(ride.distanceKm);

  return (
    <Card
      className={`fixed inset-x-2 bottom-2 z-[600] max-h-[58dvh] overflow-y-auto shadow-raised transition-all lg:static lg:max-h-[78vh] lg:shadow-card ${
        sheetExpanded ? "max-h-[82dvh]" : ""
      }`}
    >
      <CardHeader
        title={ride.status === RideStatus.COMPLETED ? "Trip complete" : "Live ride"}
        subtitle={rideStatusLabel(ride.status)}
        action={
          <button
            type="button"
            onClick={onToggleSheet}
            className="rounded-lg px-3 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50 lg:hidden"
            aria-expanded={sheetExpanded}
          >
            {sheetExpanded ? "Collapse" : "Details"}
          </button>
        }
      />
      <CardBody className="flex flex-col gap-4">
        <RideStatusStepper status={ride.status} />

        {ride.driver ? (
          <div className="rounded-xl border border-ink-200 p-4">
            <p className="text-xs uppercase tracking-wide text-ink-400">Your driver</p>
            <p className="mt-1 text-base font-semibold text-ink-900">{ride.driver.user.name}</p>
            <p className="mt-1 text-sm text-ink-600">
              {ride.driver.vehicleType}
              {ride.driver.vehicleRegistration
                ? ` · ${ride.driver.vehicleRegistration}`
                : " · Registration not provided"}
            </p>
            <p className="mt-2 text-sm text-ink-600">
              {ride.status === RideStatus.ONGOING ? "Trip arrival" : "Pickup arrival"}:{" "}
              {remainingEta !== null
                ? formatMinutes(remainingEta)
                : formatMinutes(ride.promisedEtaMin)}
            </p>
          </div>
        ) : (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900" aria-live="polite">
            {ride.status === RideStatus.REASSIGNING
              ? "Your driver changed. Searching for another available driver."
              : "Searching for an available driver…"}
          </p>
        )}

        {demoMode ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Demo assignment is enabled. The marker uses the driver&apos;s last reported location; no movement is simulated.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 rounded-xl bg-ink-50 p-3 text-sm">
          <div>
            <p className="text-xs text-ink-500">
              {ride.status === RideStatus.COMPLETED
                ? "Actual distance"
                : ride.status === RideStatus.ONGOING ? "Remaining distance" : "Trip distance"}
            </p>
            <p className="font-semibold text-ink-900">{distanceValue}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">
              {ride.status === RideStatus.COMPLETED ? "Final fare" : "Fare estimate"}
            </p>
            <p className="font-semibold text-ink-900">
              {ride.status === RideStatus.COMPLETED && ride.fareFinal == null
                ? "Unavailable"
                : formatCurrency(ride.fareFinal ?? ride.fareEstimate, 0)}
            </p>
          </div>
          {gpsAge !== null ? (
            <p className="col-span-2 text-xs text-ink-500">
              {`Driver GPS updated ${gpsAge < 5 ? "just now" : `${gpsAge}s ago`}`}
              {routeLoading ? " · Updating route…" : ""}
            </p>
          ) : ride.driver && ride.status !== RideStatus.COMPLETED ? (
            <p className="col-span-2 text-xs text-ink-500">Waiting for fresh driver GPS</p>
          ) : null}
        </div>
        {routeError ? (
          <div role="status" className="flex items-center justify-between gap-3 text-xs text-amber-800">
            <span>
              Live route unavailable: {routeError}. The map continues to show the last known driver position.
            </span>
            <Button size="sm" variant="secondary" loading={routeLoading} onClick={onRetryRoute}>
              Retry
            </Button>
          </div>
        ) : null}

        {[
          RideStatus.REQUESTED,
          RideStatus.ACCEPTED,
          RideStatus.ARRIVING,
          RideStatus.ARRIVED,
          RideStatus.REASSIGNING,
        ].includes(ride.status) ? (
          <Button variant="secondary" loading={cancelling} onClick={onCancel}>
            Cancel ride
          </Button>
        ) : null}
        <p className="text-xs text-ink-400">
          Pickup {ride.pickupLat.toFixed(5)}, {ride.pickupLng.toFixed(5)} · Destination{" "}
          {ride.dropLat.toFixed(5)}, {ride.dropLng.toFixed(5)}
        </p>
      </CardBody>
    </Card>
  );
}
