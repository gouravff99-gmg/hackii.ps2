import { useMemo, useState } from "react";
import { RideStatus, type Ride } from "@ps02/shared";
import { useAsync } from "../../hooks/useAsync";
import { rideApi } from "../../services/rideApi";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import {
  formatCurrency,
  formatDateTime,
  formatKm,
  formatMinutes,
  rideStatusLabel,
  rideStatusTone,
} from "../../utils/format";

const COMMISSION_RATE = 0.2;

type DriverRide = Ride & { passenger?: { id: string; name: string } | null };

type Filter = "ALL" | "COMPLETED" | "CANCELLED";

export function MyTrips() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const { data, loading, error, reload } = useAsync<{ rides: DriverRide[] }>(
    () => rideApi.driverHistory() as Promise<{ rides: DriverRide[] }>,
    [],
  );

  const rides = data?.rides ?? [];
  const completed = rides.filter((ride) => ride.status === RideStatus.COMPLETED);
  const cancelled = rides.filter((ride) => ride.status === RideStatus.CANCELLED);

  const gross = completed.reduce((sum, ride) => sum + (ride.fareFinal ?? ride.fareEstimate), 0);
  const net = gross * (1 - COMMISSION_RATE);

  const visible = useMemo(() => {
    if (filter === "COMPLETED") return completed;
    if (filter === "CANCELLED") return cancelled;
    return rides;
  }, [filter, rides, completed, cancelled]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My trips"
        description="Every ride you have been assigned, with fares and earnings."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Completed trips" value={completed.length} icon="check" tone="success" />
        <StatCard label="Gross fares" value={formatCurrency(gross, 0)} icon="wallet" tone="brand" />
        <StatCard
          label="Your earnings"
          value={formatCurrency(net, 0)}
          hint={`After ${Math.round(COMMISSION_RATE * 100)}% commission`}
          icon="activity"
          tone="violet"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Trip history"
          subtitle={`${rides.length} assigned rides`}
          action={
            <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
              {(["ALL", "COMPLETED", "CANCELLED"] as Filter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                    filter === option ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
                  }`}
                >
                  {option.toLowerCase()}
                </button>
              ))}
            </div>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-16 text-ink-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void reload()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="route"
            title="No trips in this view"
            description="Completed and cancelled rides will be listed here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Passenger</th>
                  <th className="px-5 py-3 font-medium">Route</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Fare</th>
                  <th className="px-5 py-3 text-right font-medium">Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {visible.map((ride) => {
                  const fare = ride.fareFinal ?? ride.fareEstimate;
                  return (
                    <tr key={ride.id}>
                      <td className="px-5 py-3 text-ink-600">{formatDateTime(ride.requestedAt)}</td>
                      <td className="px-5 py-3 text-ink-900">{ride.passenger?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-ink-600">
                        {formatKm(ride.distanceKm)} · {formatMinutes(ride.etaMin)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={rideStatusTone(ride.status)}>{rideStatusLabel(ride.status)}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right text-ink-900">{formatCurrency(fare, 0)}</td>
                      <td className="px-5 py-3 text-right text-ink-900">
                        {ride.status === RideStatus.COMPLETED
                          ? formatCurrency(fare * (1 - COMMISSION_RATE), 0)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
