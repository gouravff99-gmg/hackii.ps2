import { useEffect, useState } from "react";
import { type RideOfferPayload } from "@ps02/shared";
import { Card, CardBody } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";
import { formatCurrency, formatKm, formatMinutes } from "../../utils/format";

/** Seconds left on an offer, recomputed on a short interval for a smooth countdown. */
function useCountdown(expiresAt: string): number {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const update = () =>
      setRemaining(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  return remaining;
}

export function OfferCard({
  offer,
  onRespond,
  busy,
}: {
  offer: RideOfferPayload;
  onRespond: (accept: boolean) => void;
  busy: boolean;
}) {
  const remaining = useCountdown(offer.expiresAt);
  const expired = remaining <= 0;
  const pickupMapUrl = `https://www.openstreetmap.org/?mlat=${offer.pickup.lat}&mlon=${offer.pickup.lng}#map=16/${offer.pickup.lat}/${offer.pickup.lng}`;

  return (
    <Card className="overflow-hidden border-brand-200">
      <div className="flex items-center justify-between gap-3 bg-brand-600 px-5 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          <p className="text-sm font-semibold">New ride request</p>
        </div>
        <div className="flex items-center gap-2">
          {offer.demoMode ? <Badge tone="warning">DEMO MODE</Badge> : null}
          <Badge tone={expired ? "danger" : "warning"}>
            {expired ? "Expired" : `${remaining}s`}
          </Badge>
        </div>
      </div>

      <CardBody className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Pickup ETA</p>
            <p className="mt-0.5 font-medium text-ink-900">
              {formatMinutes(offer.etaMin)}
              {offer.demoMode ? " (simulated)" : ""}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Trip distance</p>
            <p className="mt-0.5 font-medium text-ink-900">{formatKm(offer.distanceKm)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Fare estimate</p>
            <p className="mt-0.5 font-medium text-ink-900">{formatCurrency(offer.fareEstimate, 0)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Response window</p>
            <p className="mt-0.5 font-medium text-ink-900">
              {Math.round(offer.timeoutMs / 1000)}s total
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-ink-50 p-3 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-ink-400">Pickup location</p>
              <p className="mt-1 break-words font-medium text-ink-900">
                {offer.pickup.lat.toFixed(5)}, {offer.pickup.lng.toFixed(5)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-ink-400">Destination</p>
              <p className="mt-1 break-words font-medium text-ink-900">
                {offer.drop.lat.toFixed(5)}, {offer.drop.lng.toFixed(5)}
              </p>
            </div>
          </div>
          <a
            href={pickupMapUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex font-medium text-brand-700 hover:text-brand-800"
          >
            Open pickup in OpenStreetMap
          </a>
        </div>

        <div className="flex gap-2">
          <Button
            fullWidth
            size="lg"
            variant="success"
            loading={busy}
            disabled={expired}
            onClick={() => onRespond(true)}
          >
            <Icon name="check" size={16} />
            Accept
          </Button>
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            disabled={busy}
            onClick={() => onRespond(false)}
          >
            <Icon name="close" size={16} />
            Reject
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
