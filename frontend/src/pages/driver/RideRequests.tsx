import { useState } from "react";
import { Link } from "react-router-dom";
import {
  DriverStatus,
  SOCKET_EVENTS,
  TIMEOUTS,
  type DriverAdminView,
  type NotificationPayload,
  type RideDetailView,
  type RideStatusPayload,
} from "@ps02/shared";
import { useAsync } from "../../hooks/useAsync";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useToast } from "../../hooks/useToast";
import { useDriverOffer } from "../../hooks/useDriverOffer";
import { driverApi } from "../../services/driverApi";
import { rideApi } from "../../services/rideApi";
import { errorMessage } from "../../services/api";
import { clearOffer } from "../../features/driver/offerStore";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { OfferCard } from "../../components/rides/OfferCard";
import { RideStatusStepper } from "../../components/rides/RideStatusStepper";
import { driverStatusLabel, driverStatusTone, formatKm, formatMinutes } from "../../utils/format";
import { Icon } from "../../components/ui/Icon";

interface RequestsData {
  driver: DriverAdminView;
  active: RideDetailView | null;
}

export function RideRequests() {
  const toast = useToast();
  const offer = useDriverOffer();
  const [responding, setResponding] = useState(false);

  const { data, loading, error, reload } = useAsync<RequestsData>(async () => {
    const [profile, active] = await Promise.all([driverApi.me(), rideApi.driverActive()]);
    return { driver: profile.driver, active: active.ride };
  }, []);

  useSocketEvent<RideStatusPayload>(SOCKET_EVENTS.RIDE_STATUS, () => void reload());
  useSocketEvent<NotificationPayload>(SOCKET_EVENTS.NOTIFICATION, (payload) => {
    toast.push(payload.kind, payload.title, payload.message);
  });

  const respond = async (accept: boolean) => {
    if (!offer) return;
    setResponding(true);
    try {
      await rideApi.respond(offer.rideId, accept);
      clearOffer();
      toast.push(
        accept ? "success" : "info",
        accept ? "Ride accepted" : "Ride declined",
        accept ? "Your trip appears on the dashboard." : "Waiting for the next offer.",
      );
      await reload();
    } catch (err) {
      toast.push("error", "Could not respond", errorMessage(err));
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message={error ?? "Could not load requests"} onRetry={() => void reload()} />;
  }

  const { driver, active } = data;
  const online = driver.status !== DriverStatus.OFFLINE;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ride requests"
        description="Offers arrive in real time and expire if you do not respond."
        actions={
          <Badge tone={driverStatusTone(driver.status)} dot>
            {driverStatusLabel(driver.status)}
          </Badge>
        }
      />

      {offer ? (
        <OfferCard offer={offer} onRespond={respond} busy={responding} />
      ) : (
        <Card>
          <CardHeader
            title={online ? "Waiting for the next request" : "You are offline"}
            subtitle={
              online
                ? "Keep this tab open. New offers appear instantly."
                : "Go online from the dashboard to receive offers."
            }
          />
          <CardBody>
            {online ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand-200 opacity-40" />
                  <Icon name="zap" size={22} />
                </span>
                <p className="text-sm font-medium text-ink-800">Listening for ride offers…</p>
                <p className="max-w-sm text-sm text-ink-500">
                  You have {Math.round(TIMEOUTS.driverResponseMs / 1000)} seconds to answer each
                  offer. Quick responses protect your acceptance rate.
                </p>
              </div>
            ) : (
              <EmptyState
                icon="car"
                title="Go online first"
                description="Only available drivers receive ride offers."
                action={
                  <Link
                    to="/driver"
                    className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    Open dashboard
                  </Link>
                }
              />
            )}
          </CardBody>
        </Card>
      )}

      {active ? (
        <Card>
          <CardHeader
            title="Your accepted ride"
            subtitle={`${active.passenger.name} · ${formatKm(active.distanceKm)} · pickup ETA ${formatMinutes(active.promisedEtaMin)}`}
            action={<Badge tone="info">{active.status}</Badge>}
          />
          <CardBody className="flex flex-col gap-4">
            <RideStatusStepper status={active.status} />
            <Link
              to="/driver"
              className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-ink-200 px-4 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
            >
              Manage this trip
              <Icon name="arrow-right" size={15} />
            </Link>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
