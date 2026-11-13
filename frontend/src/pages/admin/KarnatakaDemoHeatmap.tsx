import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  generateKarnatakaDistrictDemo,
  intensityColor,
  type KarnatakaDemoScenario,
  type KarnatakaDistrictMetrics,
} from "@ps02/shared";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { HeatmapLegend } from "../../components/map/HeatmapLegend";

const STATE_CENTER = { lat: 15.1, lng: 76.2 };
const DISTRICT_ZOOM = 8;
const STATE_ZOOM = 6;

const TIME_BUCKETS = [
  { label: "12 am–3 am", hour: 1 },
  { label: "3 am–6 am", hour: 4 },
  { label: "6 am–9 am", hour: 7 },
  { label: "9 am–12 pm", hour: 10 },
  { label: "12 pm–3 pm", hour: 13 },
  { label: "3 pm–6 pm", hour: 16 },
  { label: "6 pm–9 pm", hour: 19 },
  { label: "9 pm–12 am", hour: 22 },
];

const SCENARIOS: { id: KarnatakaDemoScenario; label: string }[] = [
  { id: "low", label: "Low demand" },
  { id: "normal", label: "Normal" },
  { id: "peak", label: "Peak hour" },
  { id: "weekend", label: "Weekend" },
  { id: "event", label: "High-demand event" },
];

function FocusMap({ district }: { district: KarnatakaDistrictMetrics | null }) {
  const map = useMap();
  const districtId = district?.id ?? "state";
  useEffect(() => {
    map.flyTo(
      district ? [district.center.lat, district.center.lng] : [STATE_CENTER.lat, STATE_CENTER.lng],
      district ? DISTRICT_ZOOM : STATE_ZOOM,
      { duration: 0.6 },
    );
  }, [map, districtId]);
  return null;
}

function DistrictMarker({
  district,
  selected,
  color,
  onSelect,
}: {
  district: KarnatakaDistrictMetrics;
  selected: boolean;
  color: string;
  onSelect: () => void;
}) {
  return (
    <CircleMarker
      center={[district.center.lat, district.center.lng]}
      radius={selected ? 12 : 9}
      pathOptions={{
        color: selected ? "#111827" : "#ffffff",
        fillColor: color,
        fillOpacity: 0.78,
        opacity: 1,
        weight: selected ? 3 : 2,
      }}
      eventHandlers={{ click: onSelect }}
    >
      <Tooltip direction="top" offset={[0, -8]} opacity={1}>
        {district.name} · simulated demand {district.demandScore}/100
      </Tooltip>
    </CircleMarker>
  );
}

function DistrictList({
  districts,
  selectedId,
  onSelect,
}: {
  districts: KarnatakaDistrictMetrics[];
  selectedId: string | null;
  onSelect: (district: KarnatakaDistrictMetrics) => void;
}) {
  return (
    <div className="max-h-[390px] divide-y divide-ink-100 overflow-y-auto rounded-xl border border-ink-100">
      {districts.map((district) => (
        <button
          key={district.id}
          type="button"
          onClick={() => onSelect(district)}
          aria-pressed={district.id === selectedId}
          className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition ${
            district.id === selectedId ? "bg-brand-50" : "hover:bg-ink-50"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: intensityColor(district.demandScore, 100) }}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink-900">{district.name}</span>
              <span className="block truncate text-xs text-ink-500">{district.headquarters} · demo center</span>
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-sm font-semibold text-ink-900">{district.demandScore}</span>
            <span className="block text-[10px] text-ink-500">score</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function DistrictSummary({ district }: { district: KarnatakaDistrictMetrics | null }) {
  if (!district) {
    return (
      <div className="rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
        Select a district marker or name to view its simulated metrics.
      </div>
    );
  }
  return (
    <div className="grid gap-2 rounded-xl bg-ink-50 p-3 sm:grid-cols-4">
      <Metric label="Simulated demand" value={`${district.demandScore}/100`} />
      <Metric label="Ride requests" value={district.simulatedRequests} />
      <Metric label="Available drivers" value={district.availableDrivers} />
      <Metric label="Pending requests" value={district.pendingRequests} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}

export function KarnatakaDemoHeatmap() {
  const [hour, setHour] = useState(() => TIME_BUCKETS.find((bucket) => new Date().getHours() >= bucket.hour - 1 &&
    new Date().getHours() < bucket.hour + 2)?.hour ?? 19);
  const [isWeekend, setIsWeekend] = useState([0, 6].includes(new Date().getDay()));
  const [scenario, setScenario] = useState<KarnatakaDemoScenario>("normal");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const districts = useMemo(
    () => generateKarnatakaDistrictDemo(hour, isWeekend, scenario),
    [hour, isWeekend, scenario],
  );
  const visibleDistricts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query
      ? districts.filter((district) =>
          district.name.toLocaleLowerCase().includes(query) ||
          district.headquarters.toLocaleLowerCase().includes(query),
        )
      : districts;
  }, [districts, search]);
  const selectedDistrict = districts.find((district) => district.id === selectedId) ?? null;
  const totalRequests = districts.reduce((sum, district) => sum + district.simulatedRequests, 0);
  const totalSupply = districts.reduce((sum, district) => sum + district.availableDrivers, 0);
  const selectDistrict = (district: KarnatakaDistrictMetrics) => setSelectedId(district.id);

  return (
    <Card>
      <CardHeader
        title="Karnataka statewide demo heatmap"
        subtitle="All 31 districts · approximate district-center markers · synthetic values only"
        action={<Badge tone="warning">DEMO MODE · SIMULATED DATA</Badge>}
      />
      <CardBody className="flex flex-col gap-4">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          This is a demonstration overlay, not live ride data or an official district-boundary map.
          Markers show approximate district headquarters/operational centers; no boundary polygons are included.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
            Time period
            <select
              value={hour}
              onChange={(event) => setHour(Number(event.target.value))}
              className="h-10 min-w-36 rounded-lg border border-ink-200 bg-white px-3 text-sm"
            >
              {TIME_BUCKETS.map((bucket) => (
                <option key={bucket.hour} value={bucket.hour}>{bucket.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
            Demo scenario
            <select
              value={scenario}
              onChange={(event) => setScenario(event.target.value as KarnatakaDemoScenario)}
              className="h-10 min-w-40 rounded-lg border border-ink-200 bg-white px-3 text-sm"
            >
              {SCENARIOS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={isWeekend}
              onChange={(event) => setIsWeekend(event.target.checked)}
              className="accent-brand-600"
            />
            Weekend pattern
          </label>
          <div className="ml-auto flex gap-4 text-xs text-ink-600">
            <span><strong className="text-ink-900">{districts.length}</strong> districts</span>
            <span><strong className="text-ink-900">{totalRequests}</strong> simulated requests</span>
            <span><strong className="text-ink-900">{totalSupply}</strong> simulated drivers</span>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
          <div className="h-[420px] overflow-hidden rounded-xl border border-ink-200 sm:h-[520px]">
            <MapContainer
              center={[STATE_CENTER.lat, STATE_CENTER.lng]}
              zoom={STATE_ZOOM}
              minZoom={5}
              maxZoom={11}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FocusMap district={selectedDistrict} />
              {districts.map((district) => (
                <DistrictMarker
                  key={district.id}
                  district={district}
                  selected={district.id === selectedId}
                  color={intensityColor(district.demandScore, 100)}
                  onSelect={() => selectDistrict(district)}
                />
              ))}
            </MapContainer>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
              Find a district or headquarters
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search 31 districts"
                className="h-10 rounded-lg border border-ink-200 px-3 text-sm"
              />
            </label>
            {visibleDistricts.length ? (
              <DistrictList districts={visibleDistricts} selectedId={selectedId} onSelect={selectDistrict} />
            ) : (
              <p className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">No matching district.</p>
            )}
          </div>
        </div>

        <HeatmapLegend mode="demoDemand" />
        <DistrictSummary district={selectedDistrict} />
        <p className="text-[11px] text-ink-500">
          Same district and filter settings always produce the same demo values. Approximate center positions are for visualization only; verify district administration and boundaries against official GIS before operational use.
        </p>
      </CardBody>
    </Card>
  );
}
