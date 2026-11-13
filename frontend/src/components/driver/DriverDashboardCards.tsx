import { RideStatus, type DriverAdminView, type RideDetailView } from "@ps02/shared";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";
import { EmptyState } from "../ui/EmptyState";
import { StatCard } from "../ui/StatCard";
import { RideStatusStepper } from "../rides/RideStatusStepper";
import { formatCurrency, formatKm, formatMinutes, formatPercent } from "../../utils/format";

export function DriverStatsCards({
  driver,
  todayEarnings,
  commissionRate,
}: {
  driver: DriverAdminView;
  todayEarnings: number;
  commissionRate: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Trips today" value={driver.completedToday} hint="Completed rides" icon="check" tone="success" />
      <StatCard
        label="Earnings today"
        value={formatCurrency(todayEarnings, 0)}
        hint={`After ${Math.round(commissionRate * 100)}% commission`}
        icon="wallet"
        tone="brand"
      />
      <StatCard
        label="Acceptance"
        value={formatPercent(driver.acceptanceRate)}
        hint="Rolling acceptance rate"
        icon="activity"
        tone="violet"
      />
      <StatCard label="Busy minutes" value={Math.round(driver.busyMinutesToday)} hint="Today" icon="clock" tone="warning" />
    </div>
  );
}

export function DriverAvailabilityCard({
  driver,
  isOnline,
  isBusy,
  busy,
  hasActiveRide,
  onToggleOnline,
  onCancelRide,
}: {
  driver: DriverAdminView;
  isOnline: boolean;
  isBusy: boolean;
  busy: boolean;
  hasActiveRide: boolean;
  onToggleOnline: (online: boolean) => void;
  onCancelRide: () => void;
}) {
  return (
    <Card>
      <CardHeader title="Availability" subtitle="Only available drivers receive offers." />
      <CardBody className="flex flex-col gap-4">
        <Toggle
          checked={isOnline}
          onChange={onToggleOnline}
          label="Online"
          description={
            isBusy
              ? "Finish the current ride before going offline."
              : isOnline
                ? "You are visible to passengers nearby."
                : "Go online to start receiving ride offers."
          }
          disabled={busy || isBusy}
        />
        <div className="rounded-xl bg-ink-50 px-4 py-3 text-xs text-ink-500">
          Vehicle: <span className="font-medium text-ink-700">{driver.vehicleType}</span> · Acceptance
          rate adjusts automatically as you accept or reject offers.
        </div>
        {hasActiveRide ? (
          <Button fullWidth variant="secondary" onClick={onCancelRide}>
            Cancel current ride
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function DriverCurrentRideCard({
  ride,
  isOnline,
  advancing,
  onAdvance,
}: {
  ride: RideDetailView | null;
  isOnline: boolean;
  advancing: boolean;
  onAdvance: (next: "ARRIVING" | "ARRIVED" | "ONGOING" | "COMPLETED") => void;
}) {
  return (
    <Card>
      <CardHeader title="Current ride" subtitle={ride ? "Passenger details and trip stages" : "No ride assigned"} />
      <CardBody>
        {ride ? (
          <div className="flex flex-col gap-4">
            <RideStatusStepper status={ride.status} />
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <Detail label="Passenger" value={ride.passenger.name} />
              <Detail label="Distance" value={formatKm(ride.distanceKm)} />
              <Detail label="Fare estimate" value={formatCurrency(ride.fareEstimate, 0)} />
              <Detail label="Pickup" value={`${ride.pickupLat.toFixed(4)}, ${ride.pickupLng.toFixed(4)}`} />
              <Detail label="Destination" value={`${ride.dropLat.toFixed(4)}, ${ride.dropLng.toFixed(4)}`} />
              <Detail label="Promised ETA" value={formatMinutes(ride.promisedEtaMin)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {ride.status === RideStatus.ACCEPTED ? (
                <Button loading={advancing} onClick={() => onAdvance("ARRIVING")}>Start driving to pickup</Button>
              ) : null}
              {ride.status === RideStatus.ARRIVING ? (
                <Button loading={advancing} onClick={() => onAdvance("ARRIVED")}>I have arrived</Button>
              ) : null}
              {ride.status === RideStatus.ARRIVED ? (
                <Button loading={advancing} onClick={() => onAdvance("ONGOING")}>Start trip</Button>
              ) : null}
              {ride.status === RideStatus.ONGOING ? (
                <Button loading={advancing} onClick={() => onAdvance("COMPLETED")}>Complete trip</Button>
              ) : null}
            </div>
          </div>
        ) : (
          <EmptyState
            icon="car"
            title="Waiting for a ride"
            description={
              isOnline
                ? "Stay online. Incoming offers appear here and on the Ride requests page."
                : "Go online to start receiving ride offers."
            }
          />
        )}
      </CardBody>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-0.5 font-medium text-ink-900">{value}</p>
    </div>
  );
}
