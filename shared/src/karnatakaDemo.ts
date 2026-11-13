export interface KarnatakaDistrictDemo {
  id: string;
  name: string;
  headquarters: string;
  center: { lat: number; lng: number };
  activity: number;
}

export type KarnatakaDemoScenario = "normal" | "low" | "peak" | "weekend" | "event";

export interface KarnatakaDistrictMetrics extends KarnatakaDistrictDemo {
  demandScore: number;
  simulatedRequests: number;
  availableDrivers: number;
  pendingRequests: number;
  opportunityScore: number;
}

export const KARNATAKA_DEMO_DISTRICTS: readonly KarnatakaDistrictDemo[] = [
  { id: "bagalkote", name: "Bagalkote", headquarters: "Bagalkote", center: { lat: 16.1867, lng: 75.6961 }, activity: 46 },
  { id: "ballari", name: "Ballari", headquarters: "Ballari", center: { lat: 15.1394, lng: 76.9214 }, activity: 58 },
  { id: "belagavi", name: "Belagavi", headquarters: "Belagavi", center: { lat: 15.8497, lng: 74.4977 }, activity: 69 },
  { id: "bengaluru-rural", name: "Bengaluru Rural", headquarters: "Devanahalli", center: { lat: 13.2477, lng: 77.7139 }, activity: 64 },
  { id: "bengaluru-south", name: "Bengaluru South", headquarters: "Ramanagara", center: { lat: 12.7200, lng: 77.2800 }, activity: 56 },
  { id: "bengaluru-urban", name: "Bengaluru Urban", headquarters: "Bengaluru", center: { lat: 12.9716, lng: 77.5946 }, activity: 96 },
  { id: "bidar", name: "Bidar", headquarters: "Bidar", center: { lat: 17.9104, lng: 77.5199 }, activity: 45 },
  { id: "chamarajanagar", name: "Chamarajanagar", headquarters: "Chamarajanagar", center: { lat: 11.9231, lng: 76.9395 }, activity: 34 },
  { id: "chikkaballapura", name: "Chikkaballapura", headquarters: "Chikkaballapura", center: { lat: 13.4355, lng: 77.7315 }, activity: 42 },
  { id: "chikkamagaluru", name: "Chikkamagaluru", headquarters: "Chikkamagaluru", center: { lat: 13.3161, lng: 75.7720 }, activity: 47 },
  { id: "chitradurga", name: "Chitradurga", headquarters: "Chitradurga", center: { lat: 14.2251, lng: 76.3980 }, activity: 41 },
  { id: "dakshina-kannada", name: "Dakshina Kannada", headquarters: "Mangaluru", center: { lat: 12.9141, lng: 74.8560 }, activity: 77 },
  { id: "davanagere", name: "Davanagere", headquarters: "Davanagere", center: { lat: 14.4644, lng: 75.9218 }, activity: 58 },
  { id: "dharwad", name: "Dharwad", headquarters: "Dharwad", center: { lat: 15.4589, lng: 75.0078 }, activity: 63 },
  { id: "gadag", name: "Gadag", headquarters: "Gadag", center: { lat: 15.4167, lng: 75.6167 }, activity: 39 },
  { id: "hassan", name: "Hassan", headquarters: "Hassan", center: { lat: 13.0068, lng: 76.0996 }, activity: 51 },
  { id: "haveri", name: "Haveri", headquarters: "Haveri", center: { lat: 14.7951, lng: 75.3991 }, activity: 40 },
  { id: "kalaburagi", name: "Kalaburagi", headquarters: "Kalaburagi", center: { lat: 17.3297, lng: 76.8343 }, activity: 65 },
  { id: "kodagu", name: "Kodagu", headquarters: "Madikeri", center: { lat: 12.4244, lng: 75.7382 }, activity: 43 },
  { id: "kolar", name: "Kolar", headquarters: "Kolar", center: { lat: 13.1367, lng: 78.1292 }, activity: 47 },
  { id: "koppal", name: "Koppal", headquarters: "Koppal", center: { lat: 15.3505, lng: 76.1548 }, activity: 42 },
  { id: "mandya", name: "Mandya", headquarters: "Mandya", center: { lat: 12.5221, lng: 76.9009 }, activity: 51 },
  { id: "mysuru", name: "Mysuru", headquarters: "Mysuru", center: { lat: 12.2958, lng: 76.6394 }, activity: 78 },
  { id: "raichur", name: "Raichur", headquarters: "Raichur", center: { lat: 16.2120, lng: 77.3439 }, activity: 49 },
  { id: "shivamogga", name: "Shivamogga", headquarters: "Shivamogga", center: { lat: 13.9299, lng: 75.5681 }, activity: 55 },
  { id: "tumakuru", name: "Tumakuru", headquarters: "Tumakuru", center: { lat: 13.3392, lng: 77.1017 }, activity: 57 },
  { id: "udupi", name: "Udupi", headquarters: "Udupi", center: { lat: 13.3409, lng: 74.7421 }, activity: 57 },
  { id: "uttara-kannada", name: "Uttara Kannada", headquarters: "Karwar", center: { lat: 14.8136, lng: 74.1297 }, activity: 45 },
  { id: "vijayapura", name: "Vijayapura", headquarters: "Vijayapura", center: { lat: 16.8302, lng: 75.7100 }, activity: 52 },
  { id: "vijayanagara", name: "Vijayanagara", headquarters: "Hosapete", center: { lat: 15.2695, lng: 76.3871 }, activity: 50 },
  { id: "yadgir", name: "Yadgir", headquarters: "Yadgir", center: { lat: 16.7700, lng: 77.1400 }, activity: 36 },
];

const SCENARIO_MULTIPLIER: Record<KarnatakaDemoScenario, number> = {
  low: 0.62,
  normal: 1,
  peak: 1.42,
  weekend: 1.16,
  event: 1.68,
};

function stableUnit(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function timeMultiplier(hour: number): number {
  if ((hour >= 7 && hour < 10) || (hour >= 17 && hour < 21)) return 1.3;
  if (hour >= 0 && hour < 5) return 0.58;
  if (hour >= 11 && hour < 15) return 0.84;
  return 1;
}

export function generateKarnatakaDistrictDemo(
  hour: number,
  isWeekend: boolean,
  scenario: KarnatakaDemoScenario,
): KarnatakaDistrictMetrics[] {
  const safeHour = Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.floor(hour))) : 12;
  const dayMultiplier = isWeekend ? 1.08 : 1;
  const scenarioMultiplier = SCENARIO_MULTIPLIER[scenario];
  return KARNATAKA_DEMO_DISTRICTS.map((district) => {
    const variation = 0.86 + stableUnit(`${district.id}:${safeHour}`) * 0.28;
    const demandScore = Math.min(100, Math.round(
      district.activity * timeMultiplier(safeHour) * dayMultiplier * scenarioMultiplier * variation,
    ));
    const simulatedRequests = Math.max(0, Math.round(demandScore * (0.32 + stableUnit(district.id) * 0.2)));
    const availableDrivers = Math.max(0, Math.round(
      district.activity * (0.13 + stableUnit(`${district.id}:supply`) * 0.16) *
      (scenario === "low" ? 1.2 : scenarioMultiplier > 1.3 ? 0.88 : 1),
    ));
    const pendingRequests = Math.max(0, simulatedRequests - availableDrivers);
    const opportunityScore = Math.min(100, Math.max(0, Math.round(
      demandScore * 0.65 + (pendingRequests / Math.max(1, simulatedRequests)) * 35,
    )));
    return {
      ...district,
      demandScore,
      simulatedRequests,
      availableDrivers,
      pendingRequests,
      opportunityScore,
    };
  });
}
