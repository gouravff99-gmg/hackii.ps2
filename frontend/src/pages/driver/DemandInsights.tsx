import { useState } from "react";
import { useAsync } from "../../hooks/useAsync";
import { driverApi } from "../../services/driverApi";
import { errorMessage } from "../../services/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { StatCard } from "../../components/ui/StatCard";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";

function peakLabel(start: number, end: number) {
  const format = (hour: number) => `${String(hour % 12 || 12)}${hour < 12 ? "am" : "pm"}`;
  return `${format(start)}–${format(end)}`;
}

export function DemandInsights() {
  const { data, loading, error, reload } = useAsync(() => driverApi.demand(), []);
  const [acceptedZone, setAcceptedZone] = useState<string | null>(null);
  const [dismissedZone, setDismissedZone] = useState<string | null>(null);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Spinner className="h-6 w-6" /></div>;
  }
  if (error || !data) {
    return <ErrorState message={error ?? "Demand intelligence unavailable"} onRetry={() => void reload()} />;
  }

  const { currentZone, nearbyZones, recommendation, peakPeriods } = data;
  const activePeak = peakPeriods.find(({ startHour, endHour }) => data.hourOfDay >= startHour && data.hourOfDay <= endHour);
  const recommendationVisible = recommendation && dismissedZone !== recommendation.targetZone;
  const mapUrl = recommendation
    ? `https://www.openstreetmap.org/?mlat=${recommendation.center.lat}&mlon=${recommendation.center.lng}#map=14/${recommendation.center.lat}/${recommendation.center.lng}`
    : undefined;
  const openRecommendation = () => {
    if (!recommendation || !mapUrl) return;
    setAcceptedZone(recommendation.targetZone);
    window.open(mapUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Demand intelligence"
        description="Use recent requests and model forecasts to understand demand near your position."
        actions={<Button variant="secondary" loading={loading} onClick={() => void reload()}>Refresh</Button>}
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone={data.driverIsSimulated ? "warning" : "success"}>{data.driverIsSimulated ? "Simulator driver" : "Live driver"}</Badge>
        <Badge tone={activePeak ? "warning" : "neutral"}>{activePeak ? `Expected peak now · ${peakLabel(activePeak.startHour, activePeak.endHour)}` : `Bengaluru local hour · ${String(data.hourOfDay).padStart(2, "0")}:00`}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Your zone" value={currentZone.zoneId} hint={`${currentZone.distanceKm.toFixed(1)} km to zone centre`} icon="navigation" tone="brand" />
        <StatCard label={`Observed requests · ${data.observedWindowMinutes} min`} value={currentZone.recentRequests15m} hint={`${currentZone.measuredRequests15m} measured · ${currentZone.simulatedRequests15m} simulated`} icon="activity" tone="success" />
        <StatCard label="Forecast demand" value={currentZone.predictedDemand === undefined ? "—" : currentZone.predictedDemand.toFixed(1)} hint={currentZone.predictedDemand === undefined ? "No model forecast for this hour" : "Model estimate · requests per hour"} icon="chart" tone="violet" />
        <StatCard label="Demand / supply" value={currentZone.ratio.toFixed(2)} hint={`${currentZone.supply} available drivers · surge ×${currentZone.surge.toFixed(2)}`} icon="layers" tone={currentZone.ratio > 1.25 ? "warning" : "brand"} />
      </div>

      <Card>
        <CardHeader title="Recommended repositioning" subtitle="Suggestions are based on current zone supply and demand. Moving is optional." />
        <CardBody>
          {recommendationVisible ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-ink-900">Head toward {recommendation.targetZone}</p>
                  <Badge tone="warning">{recommendation.distanceKm.toFixed(1)} km away</Badge>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-ink-600">{recommendation.reason}</p>
                <p className="mt-2 text-xs text-ink-500">Target zone centre: {recommendation.center.lat.toFixed(4)}, {recommendation.center.lng.toFixed(4)} · Refreshes with live zone data.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button onClick={openRecommendation}>Accept &amp; open map</Button>
                <Button variant="secondary" onClick={() => setDismissedZone(recommendation.targetZone)}>Dismiss</Button>
              </div>
            </div>
          ) : acceptedZone === recommendation?.targetZone ? (
            <p role="status" className="text-sm text-emerald-800">Recommendation accepted. Follow the map to {acceptedZone}; update your position in the dashboard when you arrive.</p>
          ) : (
            <EmptyState icon="navigation" title="No repositioning needed" description={data.driverStatus === "AVAILABLE" ? "No surplus-to-deficit move is recommended from your current zone right now." : "Go online and refresh to receive repositioning guidance."} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Nearby zones" subtitle="Highest demand-to-supply ratios within 5 km of your current position." />
        {nearbyZones.length ? (
          <div className="overflow-x-auto px-5 pb-4">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-400">
                <th className="py-2 pr-3 font-medium">Zone</th><th className="py-2 pr-3 font-medium">Distance</th>
                <th className="py-2 pr-3 font-medium">Observed · 15m</th><th className="py-2 pr-3 font-medium">Forecast · /hr</th>
                <th className="py-2 pr-3 font-medium">Supply</th><th className="py-2 font-medium">Surge</th>
              </tr></thead>
              <tbody className="divide-y divide-ink-100">
                {nearbyZones.map((zone) => <tr key={zone.zoneId}>
                  <td className="py-2.5 pr-3 font-medium text-ink-900">{zone.zoneId}{zone.ratio > 1.25 ? <span className="ml-2 text-xs text-amber-700">High demand</span> : null}</td>
                  <td className="py-2.5 pr-3 text-ink-600">{zone.distanceKm.toFixed(1)} km</td>
                  <td className="py-2.5 pr-3 text-ink-600">{zone.measuredRequests15m} measured · {zone.simulatedRequests15m} simulated</td>
                  <td className="py-2.5 pr-3 text-ink-600">{zone.predictedDemand?.toFixed(1) ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-ink-600">{zone.supply}</td>
                  <td className="py-2.5"><Badge tone={zone.surge > 1.5 ? "danger" : zone.surge > 1.05 ? "warning" : "success"}>×{zone.surge.toFixed(2)}</Badge></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        ) : (
          <CardBody><EmptyState icon="layers" title="No nearby zone data" description="Your current location may be outside the configured service area." /></CardBody>
        )}
      </Card>

      <Card>
        <CardHeader title="Expected peak periods" subtitle="Peak windows used by the demand profile, shown separately from measured requests." />
        <CardBody className="flex flex-wrap gap-2">
          {peakPeriods.map((period) => <Badge key={period.startHour} tone={activePeak === period ? "warning" : "neutral"}>{peakLabel(period.startHour, period.endHour)} · expected demand peak</Badge>)}
          <p className="basis-full text-xs text-ink-500">Observed requests are counts in the trailing {data.observedWindowMinutes} minutes. Forecast values are model estimates, not guaranteed ride volume. Simulator traffic is reported separately from measured requests.</p>
        </CardBody>
      </Card>
    </div>
  );
}
