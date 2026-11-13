import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Strategy,
  type EvaluationHistoryItem,
  type Metrics,
} from "@ps02/shared";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../hooks/useToast";
import { adminApi } from "../../services/adminApi";
import { errorMessage } from "../../services/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { formatDateTime, formatWait } from "../../utils/format";
import { Icon } from "../../components/ui/Icon";

interface MetricRow {
  label: string;
  value: (metrics: Metrics) => number;
  format: (value: number) => string;
  better: "higher" | "lower";
}

const ROWS: MetricRow[] = [
  { label: "Rides requested", value: (m) => m.ridesRequested, format: (v) => v.toFixed(0), better: "higher" },
  { label: "Rides completed", value: (m) => m.ridesCompleted, format: (v) => v.toFixed(0), better: "higher" },
  { label: "Rides cancelled", value: (m) => m.ridesCancelled, format: (v) => v.toFixed(0), better: "lower" },
  { label: "Avg passenger wait", value: (m) => m.avgPassengerWaitSec, format: (v) => `${v.toFixed(1)} s`, better: "lower" },
  { label: "Avg pickup ETA", value: (m) => m.avgPickupEtaMin, format: (v) => `${v.toFixed(2)} min`, better: "lower" },
  { label: "Driver utilization", value: (m) => m.driverUtilization, format: (v) => `${(v * 100).toFixed(1)}%`, better: "higher" },
  { label: "Completion rate", value: (m) => m.completionRate, format: (v) => `${(v * 100).toFixed(1)}%`, better: "higher" },
  { label: "Reassignments", value: (m) => m.reassignmentCount, format: (v) => v.toFixed(0), better: "lower" },
  { label: "Fairness std dev", value: (m) => m.fairnessStdDev, format: (v) => v.toFixed(2), better: "lower" },
];

export function Evaluation() {
  const toast = useToast();
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [simulatedMinutes, setSimulatedMinutes] = useState(30);
  const [numDrivers, setNumDrivers] = useState(25);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ nearest: Metrics; smart: Metrics } | null>(null);

  const runsState = useAsync<{ runs: EvaluationHistoryItem[] }>(() => adminApi.simRuns(), []);
  const runs = runsState.data?.runs ?? [];

  const experienceData = useMemo(() => {
    if (!result) return [];
    return [
      {
        metric: "Avg wait",
        nearest: result.nearest.avgPassengerWaitSec,
        smart: result.smart.avgPassengerWaitSec,
      },
      {
        metric: "Avg pickup ETA",
        nearest: result.nearest.avgPickupEtaMin * 60,
        smart: result.smart.avgPickupEtaMin * 60,
      },
    ];
  }, [result]);

  const reliabilityData = useMemo(() => {
    if (!result) return [];
    return [
      {
        metric: "Completion rate",
        nearest: result.nearest.completionRate * 100,
        smart: result.smart.completionRate * 100,
      },
      {
        metric: "Utilization",
        nearest: result.nearest.driverUtilization * 100,
        smart: result.smart.driverUtilization * 100,
      },
    ];
  }, [result]);

  const runEvaluation = async () => {
    setRunning(true);
    try {
      const response = await adminApi.evaluate({ seed, simulatedMinutes, numDrivers });
      setResult({ nearest: response.nearest, smart: response.smart });
      toast.push(
        "success",
        "Evaluation complete",
        `Seed ${seed} · NEAREST vs SMART across ${simulatedMinutes} simulated minutes.`,
      );
      await runsState.reload();
    } catch (err) {
      toast.push("error", "Evaluation failed", errorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Evaluation"
        description="Run the same seeded request stream twice and compare NEAREST matching with SMART allocation."
      />

      <Card>
        <CardHeader
          title="Run configuration"
          subtitle="Both strategies share the seed, driver count and duration so the comparison is fair."
        />
        <CardBody className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Seed"
              type="number"
              min={0}
              value={seed}
              onChange={(event) => setSeed(Number(event.target.value))}
              hint="Same seed = identical requests"
            />
            <Input
              label="Simulated minutes"
              type="number"
              min={5}
              max={120}
              value={simulatedMinutes}
              onChange={(event) => setSimulatedMinutes(Number(event.target.value))}
              hint="5–120 minutes"
            />
            <Input
              label="Drivers"
              type="number"
              min={5}
              max={60}
              value={numDrivers}
              onChange={(event) => setNumDrivers(Number(event.target.value))}
              hint="5–60 drivers"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button loading={running} onClick={() => void runEvaluation()}>
              <Icon name="activity" size={15} />
              Run evaluation
            </Button>
            <Button
              variant="ghost"
              disabled={running}
              onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}
            >
              <Icon name="refresh" size={15} />
              New seed
            </Button>
            <span className="text-xs text-ink-400">
              Persists two SimRun rows so results stay comparable over time.
            </span>
          </div>
        </CardBody>
      </Card>

      {running ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-500">
            <Spinner className="h-7 w-7 text-brand-500" />
            <p className="text-sm">Running both strategies headlessly…</p>
            <p className="text-xs text-ink-400">
              {simulatedMinutes} simulated minutes × {numDrivers} drivers
            </p>
          </div>
        </Card>
      ) : result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OutcomeCard
              label="Completion"
              nearest={result.nearest.completionRate}
              smart={result.smart.completionRate}
              format={(value) => `${(value * 100).toFixed(1)}%`}
              better="higher"
            />
            <OutcomeCard
              label="Avg passenger wait"
              nearest={result.nearest.avgPassengerWaitSec}
              smart={result.smart.avgPassengerWaitSec}
              format={formatWait}
              better="lower"
            />
            <OutcomeCard
              label="Avg pickup ETA"
              nearest={result.nearest.avgPickupEtaMin}
              smart={result.smart.avgPickupEtaMin}
              format={(value) => `${value.toFixed(2)} min`}
              better="lower"
            />
            <OutcomeCard
              label="Fairness std dev"
              nearest={result.nearest.fairnessStdDev}
              smart={result.smart.fairnessStdDev}
              format={(value) => value.toFixed(2)}
              better="lower"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Passenger experience" subtitle="Lower is better · seconds" />
              <CardBody>
                <ComparisonChart data={experienceData} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Fleet reliability" subtitle="Higher is better · percent" />
              <CardBody>
                <ComparisonChart data={reliabilityData} />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Side-by-side metrics"
              subtitle={`Seed ${result.nearest.seed} · ${result.nearest.simulatedMinutes} simulated minutes`}
            />
            <CardBody>
              <MetricsTable nearest={result.nearest} smart={result.smart} />
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            icon="chart"
            title="No evaluation in this session yet"
            description="Pick a seed and run the comparison. Results and charts appear here, and every run is persisted."
          />
        </Card>
      )}

      <Card>
        <CardHeader
          title="Run history"
          subtitle={`${runs.length} persisted runs`}
          action={
            <Button
              variant="ghost"
              size="sm"
              loading={runsState.loading}
              onClick={() => void runsState.reload()}
            >
              <Icon name="refresh" size={15} />
              Refresh
            </Button>
          }
        />
        {runsState.loading ? (
          <div className="flex items-center justify-center py-12 text-ink-400">
            <Spinner className="h-5 w-5" />
          </div>
        ) : runsState.error ? (
          <ErrorState message={runsState.error} onRetry={() => void runsState.reload()} />
        ) : runs.length === 0 ? (
          <EmptyState
            icon="activity"
            title="No runs recorded"
            description="Run an evaluation to create the first two SimRun records."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Strategy</th>
                  <th className="px-5 py-3 font-medium">Seed</th>
                  <th className="px-5 py-3 font-medium">Wait</th>
                  <th className="px-5 py-3 font-medium">Pickup ETA</th>
                  <th className="px-5 py-3 font-medium">Completion</th>
                  <th className="px-5 py-3 font-medium">Utilization</th>
                  <th className="px-5 py-3 text-right font-medium">Reassignments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-5 py-3 text-ink-600">{formatDateTime(run.createdAt)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={run.strategy === Strategy.SMART ? "info" : "neutral"}>
                        {run.strategy}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-ink-600">{run.seed}</td>
                    <td className="px-5 py-3 text-ink-600">{formatWait(run.metrics.avgPassengerWaitSec)}</td>
                    <td className="px-5 py-3 text-ink-600">{run.metrics.avgPickupEtaMin.toFixed(2)} min</td>
                    <td className="px-5 py-3 text-ink-600">
                      {(run.metrics.completionRate * 100).toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 text-ink-600">
                      {(run.metrics.driverUtilization * 100).toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 text-right text-ink-600">{run.metrics.reassignmentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function OutcomeCard({
  label,
  nearest,
  smart,
  format,
  better,
}: {
  label: string;
  nearest: number;
  smart: number;
  format: (value: number) => string;
  better: "higher" | "lower";
}) {
  const smartWins = better === "higher" ? smart > nearest : smart < nearest;
  const equal = Math.abs(smart - nearest) < 0.0001;

  return (
    <div className="rounded-xl2 border border-ink-200/80 bg-white px-4 py-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-ink-900">{format(smart)}</p>
          <p className="text-xs text-ink-500">SMART</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-ink-500">{format(nearest)}</p>
          <p className="text-xs text-ink-400">NEAREST</p>
        </div>
      </div>
      <p className={`mt-2 text-xs font-medium ${equal ? "text-ink-400" : smartWins ? "text-emerald-600" : "text-red-600"}`}>
        {equal ? "No difference" : smartWins ? "SMART is better" : "NEAREST is better"}
      </p>
    </div>
  );
}

function ComparisonChart({
  data,
}: {
  data: { metric: string; nearest: number; smart: number }[];
}) {
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
          <XAxis dataKey="metric" tick={{ fontSize: 11, fill: "#8d97a8" }} />
          <YAxis tick={{ fontSize: 11, fill: "#8d97a8" }} />
          <ChartTooltip
            formatter={(value) => Number(value).toFixed(1)}
            contentStyle={{ borderRadius: 12, borderColor: "#dfe3ea", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="nearest" name="NEAREST" fill="#8d97a8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="smart" name="SMART" fill="#3566f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricsTable({ nearest, smart }: { nearest: Metrics; smart: Metrics }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="py-2.5 pr-4 font-medium">Metric</th>
            <th className="py-2.5 pr-4 text-right font-medium">NEAREST</th>
            <th className="py-2.5 pr-4 text-right font-medium">SMART</th>
            <th className="py-2.5 text-right font-medium">Δ SMART − NEAREST</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {ROWS.map((row) => {
            const nearestValue = row.value(nearest);
            const smartValue = row.value(smart);
            const delta = smartValue - nearestValue;
            const improved =
              Math.abs(delta) < 0.0001
                ? null
                : row.better === "higher"
                  ? delta > 0
                  : delta < 0;
            return (
              <tr key={row.label}>
                <td className="py-2.5 pr-4 text-ink-700">{row.label}</td>
                <td className="py-2.5 pr-4 text-right text-ink-600">{row.format(nearestValue)}</td>
                <td className="py-2.5 pr-4 text-right font-medium text-ink-900">
                  {row.format(smartValue)}
                </td>
                <td
                  className={`py-2.5 text-right font-medium ${
                    improved === null
                      ? "text-ink-400"
                      : improved
                        ? "text-emerald-600"
                        : "text-red-600"
                  }`}
                >
                  {improved === null ? "—" : `${delta > 0 ? "+" : ""}${row.format(delta)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
