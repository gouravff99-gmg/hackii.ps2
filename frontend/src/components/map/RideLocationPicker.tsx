import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  INDIA_CENTER,
  type LatLng,
  type NearbyDriver,
  type RouteResult,
} from "@ps02/shared";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { MapCanvas, type MapMarker } from "./MapCanvas";
import { PlaceSearch } from "./PlaceSearch";
import type { useRideLocations } from "../../hooks/useRideLocations";
import { formatMinutes } from "../../utils/format";

interface RideLocationPickerProps {
  locations: ReturnType<typeof useRideLocations>;
  nearby: NearbyDriver[];
  route?: RouteResult["polyline"];
  onReset?: () => void;
  bookingPanel?: ReactNode;
}

export function RideLocationPicker({
  locations,
  nearby,
  route = [],
  onReset,
  bookingPanel,
}: RideLocationPickerProps) {
  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = nearby.map((driver) => ({
      id: driver.id,
      lat: driver.lat,
      lng: driver.lng,
      kind: "driver",
      label: `${driver.name} · ${formatMinutes(driver.etaMin)}`,
    }));
    if (locations.pickup) {
      list.push({
        id: "pickup",
        lat: locations.pickup.lat,
        lng: locations.pickup.lng,
        kind: "pickup",
        label: locations.pickupAddress || "Pickup",
      });
    }
    if (locations.drop) {
      list.push({
        id: "drop",
        lat: locations.drop.lat,
        lng: locations.drop.lng,
        kind: "drop",
        label: locations.dropAddress || "Destination",
      });
    }
    return list;
  }, [nearby, locations.pickup, locations.drop, locations.pickupAddress, locations.dropAddress]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card className="overflow-hidden">
        <CardHeader
          title={`Tap the map to set ${locations.activeField === "pickup" ? "pickup" : "destination"}`}
          subtitle="India-wide map · choose pickup or destination"
          action={
            <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
              {(["pickup", "drop"] as const).map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => locations.setActiveField(field)}
                  aria-pressed={locations.activeField === field}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    locations.activeField === field
                      ? "bg-white text-ink-900 shadow-sm"
                      : "text-ink-500"
                  }`}
                >
                  {field === "pickup" ? "Pickup" : "Destination"}
                </button>
              ))}
            </div>
          }
        />
        <div className="h-[380px] sm:h-[480px]">
          <MapCanvas
            center={locations.pickup ?? INDIA_CENTER}
            zoom={locations.pickup ? 13 : 4}
            markers={markers}
            route={route}
            onMapClick={locations.handleMapClick}
            recenter={locations.mapRecenter}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Trip locations" subtitle="Search an address or select a point on the map" />
        <CardBody className="flex flex-col gap-4">
          <div>
            <PlaceSearch
              label="Search pickup"
              value={locations.pickupAddress}
              onSelect={(place) => locations.selectPlace("pickup", place)}
              onQueryChange={() => locations.clearLocation("pickup")}
            />
            <SelectedLocation
              point={locations.pickup}
              address={locations.pickupAddress}
              error={locations.pickupAddressError}
              label="pickup"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={locations.useCurrentLocation}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <Icon name="navigation" size={13} />
                Use my current location
              </button>
            </div>
          </div>

          <div>
            <PlaceSearch
              label="Search destination"
              value={locations.dropAddress}
              onSelect={(place) => locations.selectPlace("drop", place)}
              onQueryChange={() => locations.clearLocation("drop")}
            />
            <SelectedLocation
              point={locations.drop}
              address={locations.dropAddress}
              error={locations.dropAddressError}
              label="destination"
            />
          </div>

          <details className="rounded-lg border border-ink-100 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-ink-600">
              Enter coordinates manually
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <Input
                label="Pickup coordinates"
                value={locations.pickupText}
                onChange={(event) => locations.setCoordinateText("pickup", event.target.value)}
                onBlur={() => {
                  if (locations.pickup) locations.resolveAddress("pickup", locations.pickup);
                }}
                placeholder="12.9716, 77.5946"
                hint="Latitude, longitude"
              />
              <Input
                label="Destination coordinates"
                value={locations.dropText}
                onChange={(event) => locations.setCoordinateText("drop", event.target.value)}
                onBlur={() => {
                  if (locations.drop) locations.resolveAddress("drop", locations.drop);
                }}
                placeholder="12.9352, 77.6245"
                hint="Latitude, longitude"
              />
            </div>
          </details>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={locations.centerPickup}
            >
              Centre pickup
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                locations.reset();
                onReset?.();
              }}
            >
              Reset
            </Button>
          </div>
          {bookingPanel}
        </CardBody>
      </Card>
    </div>
  );
}

function SelectedLocation({
  point,
  address,
  error,
  label,
}: {
  point: LatLng | null;
  address: string;
  error: string | null;
  label: string;
}) {
  if (!point) {
    return <p className="mt-1.5 text-xs text-ink-500">Choose a {label} address or tap the map.</p>;
  }
  return (
    <div className="mt-1.5">
      <p className="text-xs text-ink-600">
        {address || "Selected location"} · {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
      </p>
      {error ? (
        <p className="mt-1 text-xs text-amber-700">
          Address lookup failed; the selected coordinates are still usable.
        </p>
      ) : null}
    </div>
  );
}
