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
        <Badge tone={expired ? "danger" : "warning"}>
          {expired ? "Expired" : `${remaining}s`}
        </Badge>
      </div>

      <CardBody className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Pickup ETA</p>
            <p className="mt-0.5 font-medium text-ink-900">{formatMinutes(offer.etaMin)}</p>
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
