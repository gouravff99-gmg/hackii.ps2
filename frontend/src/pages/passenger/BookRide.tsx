import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CITY,
  type EstimateResponse,
  type LatLng,
  type NearbyDriver,
} from "@ps02/shared";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorState } from "../../components/ui/EmptyState";
import { MapCanvas, type MapMarker } from "../../components/map/MapCanvas";
import { driverApi } from "../../services/driverApi";
import { rideApi } from "../../services/rideApi";
import { errorMessage } from "../../services/api";
import { useToast } from "../../hooks/useToast";
import { formatCurrency, formatKm, formatMinutes } from "../../utils/format";
import { Icon } from "../../components/ui/Icon";

type ActiveField = "pickup" | "drop";

function parseCoordinate(value: string): LatLng | null {
  const [latRaw, lngRaw] = value.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function BookRide() {
  const navigate = useNavigate();
  const toast = useToast();

  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [drop, setDrop] = useState<LatLng | null>(null);
  const [activeField, setActiveField] = useState<ActiveField>("pickup");
  const [pickupText, setPickupText] = useState("");
  const [dropText, setDropText] = useState("");

  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const [nearby, setNearby] = useState<NearbyDriver[]>([]);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    if (!pickup) {
      setNearby([]);
      return;
    }
    let alive = true;
    driverApi
      .nearby(pickup.lat, pickup.lng, 8)
      .then((response) => {
        if (alive) setNearby(response.drivers);
      })
      .catch(() => {
        if (alive) setNearby([]);
      });
    return () => {
      alive = false;
    };
  }, [pickup]);

  useEffect(() => {
    if (!pickup || !drop) {
      setEstimate(null);
      return;
    }

    let alive = true;
    setEstimating(true);
    setEstimateError(null);

    rideApi
      .estimate(pickup, drop)
      .then((response) => {
        if (alive) setEstimate(response);
      })
      .catch((err) => {
        if (alive) {
          setEstimate(null);
          setEstimateError(errorMessage(err));
        }
      })
      .finally(() => {
        if (alive) setEstimating(false);
      });

    return () => {
      alive = false;
    };
  }, [pickup, drop]);

  const handleMapClick = (point: LatLng) => {
    if (activeField === "pickup") {
      setPickup(point);
      setPickupText(`${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);
      if (!drop) setActiveField("drop");
    } else {
      setDrop(point);
      setDropText(`${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.push("warning", "Location unavailable", "This browser does not expose geolocation.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        setPickup(point);
        setPickupText(`${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);
        setActiveField("drop");
      },
      () => {
        toast.push(
          "warning",
          "Could not read your location",
          "Pick your pickup point on the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const book = async () => {
    if (!pickup || !drop) return;
    setBooking(true);
    setBookingError(null);
    try {
      const response = await rideApi.create(pickup, drop);
      toast.push("success", "Ride requested", "We are matching you with a driver now.");
      navigate("/passenger/rides", { state: { rideId: response.ride.id } });
    } catch (err) {
      setBookingError(errorMessage(err));
    } finally {
      setBooking(false);
    }
  };

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = nearby.map((driver) => ({
      id: driver.id,
      lat: driver.lat,
      lng: driver.lng,
      kind: "driver",
      label: `${driver.name} · ${formatMinutes(driver.etaMin)}`,
    }));
    if (pickup) list.push({ id: "pickup", lat: pickup.lat, lng: pickup.lng, kind: "pickup", label: "Pickup" });
    if (drop) list.push({ id: "drop", lat: drop.lat, lng: drop.lng, kind: "drop", label: "Destination" });
    return list;
  }, [nearby, pickup, drop]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Book a ride"
        description="Set a pickup and destination on the map. You will see the fare and ETA before confirming."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title={`Tap the map to set ${activeField === "pickup" ? "pickup" : "destination"}`}
            subtitle={`${CITY.name} service area`}
            action={
              <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveField("pickup")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    activeField === "pickup" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
                  }`}
                >
                  Pickup
                </button>
                <button
                  type="button"
                  onClick={() => setActiveField("drop")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    activeField === "drop" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
                  }`}
                >
                  Destination
                </button>
              </div>
            }
          />
          <div className="h-[380px] sm:h-[480px]">
            <MapCanvas
              center={pickup ?? CITY.center}
              zoom={pickup ? 13 : 12}
              markers={markers}
              route={estimate?.polyline ?? []}
              onMapClick={handleMapClick}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Trip details" subtitle="Coordinates update as you tap the map" />
            <CardBody className="flex flex-col gap-4">
              <div>
                <Input
                  label="Pickup"
                  value={pickupText}
                  onChange={(event) => {
                    setPickupText(event.target.value);
                    const parsed = parseCoordinate(event.target.value);
                    if (parsed) setPickup(parsed);
                  }}
                  placeholder="12.9716, 77.5946"
                  hint="Format: latitude, longitude"
                />
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  <Icon name="navigation" size={13} />
                  Use my current location
                </button>
              </div>

              <Input
                label="Destination"
                value={dropText}
                onChange={(event) => {
                  setDropText(event.target.value);
                  const parsed = parseCoordinate(event.target.value);
                  if (parsed) setDrop(parsed);
                }}
                placeholder="12.9352, 77.6245"
                hint="Format: latitude, longitude"
              />

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPickup(CITY.center);
                    setPickupText(`${CITY.center.lat.toFixed(4)}, ${CITY.center.lng.toFixed(4)}`);
                  }}
                >
                  Centre pickup
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPickup(null);
                    setDrop(null);
                    setPickupText("");
                    setDropText("");
                    setEstimate(null);
                    setEstimateError(null);
                    setActiveField("pickup");
                  }}
                >
                  Reset
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Fare estimate" subtitle="Before you confirm" />
            <CardBody>
              {estimating ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-500">
                  <Spinner className="h-5 w-5 text-brand-500" /> Calculating route…
                </div>
              ) : estimateError ? (
                <ErrorState message={estimateError} />
              ) : estimate ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-400">Estimated fare</p>
                      <p className="mt-1 text-2xl font-semibold text-ink-900">
                        {formatCurrency(estimate.fare, 0)}
                      </p>
                    </div>
                    {estimate.surge > 1.05 ? (
                      <Badge tone="warning">Surge ×{estimate.surge.toFixed(2)}</Badge>
                    ) : (
                      <Badge tone="success">No surge</Badge>
                    )}
                  </div>
                  <dl className="grid grid-cols-3 gap-3 border-t border-ink-100 pt-3 text-sm">
                    <div>
                      <dt className="text-xs text-ink-400">Distance</dt>
                      <dd className="mt-0.5 font-medium text-ink-900">{formatKm(estimate.distanceKm)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-400">Duration</dt>
                      <dd className="mt-0.5 font-medium text-ink-900">{formatMinutes(estimate.etaMin)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-400">Drivers</dt>
                      <dd className="mt-0.5 font-medium text-ink-900">{nearby.length}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-ink-400">
                    Route source: {estimate.source === "osrm" ? "OSRM road network" : "straight-line fallback"}.
                  </p>

                  {bookingError ? (
                    <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{bookingError}</p>
                  ) : null}

                  <Button size="lg" fullWidth loading={booking} onClick={() => void book()}>
                    Confirm and book
                  </Button>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-ink-500">
                  Set both points to see distance, ETA and fare.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
