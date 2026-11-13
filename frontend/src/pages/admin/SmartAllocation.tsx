import { useMemo, useState } from "react";
import {
  ALLOC_WEIGHTS,
  type AllocationBreakdown,
  type AllocationSnapshot,
  type PoolCandidateGroupView,
} from "@ps02/shared";
import { useAsync } from "../../hooks/useAsync";
import { adminApi } from "../../services/adminApi";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { StatCard } from "../../components/ui/StatCard";
import {
  formatCurrency,
  formatDateTime,
  formatKm,
  formatMinutes,
  formatPercent,
} from "../../utils/format";
import { Icon } from "../../components/ui/Icon";

type Tab = "allocation" | "pooling";

const WEIGHTS: { key: keyof typeof ALLOC_WEIGHTS; label: string }[] = [
  { key: "eta", label: "Pickup ETA" },
  { key: "workload", label: "Workload" },
  { key: "acceptance", label: "Acceptance" },
  { key: "idle", label: "Idle time" },
];

export function SmartAllocation() {
  const [tab, setTab] = useState<Tab>("allocation");

  const allocationsState = useAsync(() => adminApi.allocations(), []);
  const poolsState = useAsync(() => adminApi.poolCandidates(), []);

  const allocations = allocationsState.data?.allocations ?? [];
  const groups = poolsState.data?.groups ?? [];
  const candidates = poolsState.data?.candidates ?? [];

  const validGroups = groups.filter((group) => group.plan.ok);
  const totalSavings = validGroups.reduce(
    (sum, group) =>
      sum + group.plan.perRider.reduce((inner, rider) => inner + (rider.soloFare - rider.pooledFare), 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Smart allocation"
        description="Explainable driver ranking and pooled ride planning, computed with the same functions the dispatcher uses."
        actions={
          <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
            {(["allocation", "pooling"] as Tab[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTab(option)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                  tab === option ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Score weights
          </span>
          {WEIGHTS.map((weight) => (
            <Badge key={weight.key} tone="neutral">
              {weight.label} {ALLOC_WEIGHTS[weight.key].toFixed(2)}
            </Badge>
          ))}
          <span className="text-xs text-ink-400">
            Lower score wins. Acceptance is inverted (1 − rate) so reliable drivers rank higher.
          </span>
        </CardBody>
      </Card>

      {tab === "allocation" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Decisions stored"
              value={allocations.length}
              hint="Rides with a persisted score breakdown"
              icon="zap"
              tone="brand"
            />
            <StatCard
              label="Candidates shown"
              value={allocations[0]?.scores.length ?? 0}
              hint="Top ranked drivers per decision"
              icon="users"
              tone="violet"
            />
            <StatCard
              label="Strategy"
              value="SMART"
              hint="NEAREST is reserved for the evaluation baseline"
              icon="activity"
              tone="success"
            />
          </div>

          {allocationsState.loading ? (
            <SpinnerBlock />
          ) : allocationsState.error ? (
            <Card>
              <ErrorState message={allocationsState.error} onRetry={() => void allocationsState.reload()} />
            </Card>
          ) : allocations.length === 0 ? (
            <Card>
              <EmptyState
                icon="zap"
                title="No allocation decisions yet"
                description="Book a ride or start the simulator. Every assignment stores its full ranking breakdown here."
              />
            </Card>
          ) : (
            <AllocationExplorer allocations={allocations} />
          )}
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Pending rides"
              value={candidates.length}
              hint="Requested and not yet pooled"
              icon="route"
              tone="brand"
            />
            <StatCard
              label="Valid groups"
              value={validGroups.length}
              hint="Within radius and detour limits"
              icon="users"
              tone="success"
            />
            <StatCard
              label="Potential savings"
              value={formatCurrency(totalSavings, 0)}
              hint={`Pooled fare = solo × ${formatPercent(0.75)}`}
              icon="wallet"
              tone="violet"
            />
            <StatCard
              label="Riders pooled"
              value={validGroups.reduce((sum, group) => sum + group.plan.rideIds.length, 0)}
              icon="check"
              tone="warning"
            />
          </div>

          {poolsState.loading ? (
            <SpinnerBlock />
          ) : poolsState.error ? (
            <Card>
              <ErrorState message={poolsState.error} onRetry={() => void poolsState.reload()} />
            </Card>
          ) : groups.length === 0 ? (
            <Card>
              <EmptyState
                icon="users"
                title="No pool candidates"
                description="Pooling scans pending requested rides every 30 seconds. Candidates appear when two or more rides are close enough to share a car."
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <PoolGroupCard key={group.rideIds.join("-")} group={group} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SpinnerBlock() {
  return (
    <Card>
      <div className="flex items-center justify-center py-16 text-ink-400">
        <Spinner className="h-6 w-6" />
      </div>
    </Card>
  );
}

function AllocationExplorer({ allocations }: { allocations: AllocationSnapshot[] }) {
  const [selectedId, setSelectedId] = useState(allocations[0]?.rideId ?? null);
  const selected = allocations.find((entry) => entry.rideId === selectedId) ?? allocations[0];

  const assigned = useMemo(
    () =>
      selected.scores.find((score) => score.driverId === selected.assignedDriverId) ??
      selected.scores[0],
    [selected],
  );
  const alternates = useMemo(
    () => selected.scores.filter((score) => score.driverId !== assigned?.driverId).slice(0, 2),
    [selected, assigned],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
      <Card className="overflow-hidden">
        <CardHeader title="Recent decisions" subtitle={`${allocations.length} rides`} />
        <CardBody className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
          {allocations.map((allocation) => (
            <button
              key={allocation.rideId}
              type="button"
              onClick={() => setSelectedId(allocation.rideId)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                allocation.rideId === selected.rideId
                  ? "border-brand-300 bg-brand-50/60 ring-2 ring-brand-100"
                  : "border-ink-200 bg-white hover:border-ink-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink-900">
                  {allocation.assignedDriverName ?? "Unassigned"}
                </p>
                <Badge tone={allocation.status === "COMPLETED" ? "success" : "info"}>
                  {allocation.status}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-ink-500">
                {formatDateTime(allocation.requestedAt)} · {allocation.scores.length} candidates
              </p>
            </button>
          ))}
        </CardBody>
      </Card>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader
            title="Why this driver"
            subtitle={
              assigned
                ? `${assigned.driverName ?? assigned.driverId} ranked #${assigned.rank} with score ${assigned.score.toFixed(3)}`
                : "No candidates"
            }
          />
          <CardBody className="flex flex-col gap-4">
            {assigned ? (
              <>
                <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
                  <span className="font-semibold">{assigned.driverName ?? assigned.driverId}</span> was
                  chosen because it had the best weighted combination of a {formatMinutes(assigned.raw.etaMin)}{" "}
                  pickup ETA, workload {assigned.raw.workload.toFixed(1)}, acceptance{" "}
                  {formatPercent(assigned.raw.acceptanceRate)} and {Math.round(assigned.raw.idleMin)} min idle.
                </p>
                <ScoreTable scores={selected.scores} assignedDriverId={selected.assignedDriverId} />
              </>
            ) : (
              <EmptyState title="No candidates" description="No driver scores were stored for this ride." />
            )}
          </CardBody>
        </Card>

        {alternates.length > 0 ? (
          <Card>
            <CardHeader
              title="Next best alternates"
              subtitle="Used automatically if the top driver rejects, times out or is delayed"
            />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              {alternates.map((alternate) => (
                <div key={alternate.driverId} className="rounded-xl border border-ink-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink-900">
                      {alternate.driverName ?? alternate.driverId}
                    </p>
                    <Badge tone="neutral">#{alternate.rank}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    Score {alternate.score.toFixed(3)} · ETA {formatMinutes(alternate.raw.etaMin)} ·
                    acceptance {formatPercent(alternate.raw.acceptanceRate)}
                  </p>
                </div>
              ))}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function ScoreTable({
  scores,
  assignedDriverId,
}: {
  scores: AllocationBreakdown[];
  assignedDriverId: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="py-2.5 pr-3 font-medium">#</th>
            <th className="py-2.5 pr-3 font-medium">Driver</th>
            <th className="py-2.5 pr-3 font-medium">ETA</th>
            <th className="py-2.5 pr-3 font-medium">Workload</th>
            <th className="py-2.5 pr-3 font-medium">Accept.</th>
            <th className="py-2.5 pr-3 font-medium">Idle</th>
            <th className="py-2.5 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {scores.map((score) => (
            <tr key={score.driverId} className={score.driverId === assignedDriverId ? "bg-emerald-50/50" : ""}>
              <td className="py-2.5 pr-3 text-ink-500">{score.rank}</td>
              <td className="py-2.5 pr-3">
                <span className="font-medium text-ink-900">{score.driverName ?? score.driverId}</span>
                {score.driverId === assignedDriverId ? (
                  <Badge tone="success">Assigned</Badge>
                ) : null}
              </td>
              <td className="py-2.5 pr-3 text-ink-600">{formatMinutes(score.raw.etaMin)}</td>
              <td className="py-2.5 pr-3 text-ink-600">{score.raw.workload.toFixed(1)}</td>
              <td className="py-2.5 pr-3 text-ink-600">{formatPercent(score.raw.acceptanceRate)}</td>
              <td className="py-2.5 pr-3 text-ink-600">{Math.round(score.raw.idleMin)} min</td>
              <td className="py-2.5 text-right font-medium text-ink-900">{score.score.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PoolGroupCard({ group }: { group: PoolCandidateGroupView }) {
  const plan = group.plan;

  return (
    <Card>
      <CardHeader
        title={`Group of ${group.rideIds.length}`}
        subtitle={group.rideIds.map((id) => id.slice(-6)).join(" · ")}
        action={<Badge tone={plan.ok ? "success" : "danger"}>{plan.ok ? "Feasible" : "Rejected"}</Badge>}
      />
      <CardBody className="flex flex-col gap-4">
        {!plan.ok ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {plan.reason ?? "This group cannot be pooled within the detour limits."}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-ink-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-ink-400">Total distance</p>
                <p className="mt-0.5 text-lg font-semibold text-ink-900">{formatKm(plan.totalDistanceKm)}</p>
              </div>
              <div className="rounded-xl bg-ink-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-ink-400">Total duration</p>
                <p className="mt-0.5 text-lg font-semibold text-ink-900">
                  {formatMinutes(plan.totalDurationMin)}
                </p>
              </div>
              <div className="rounded-xl bg-ink-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-ink-400">Stops</p>
                <p className="mt-0.5 text-lg font-semibold text-ink-900">{plan.stopOrder.length}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">Stop order</p>
              <ol className="mt-2 flex flex-wrap items-center gap-2">
                {plan.stopOrder.map((stop, index) => (
                  <li key={`${stop.kind}-${stop.rideId}-${index}`} className="flex items-center gap-2">
                    <Badge tone={stop.kind === "pickup" ? "success" : "danger"}>
                      {index + 1}. {stop.kind} {stop.rideId.slice(-6)}
                    </Badge>
                    {index < plan.stopOrder.length - 1 ? (
                      <Icon name="arrow-right" size={13} className="text-ink-300" />
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                    <th className="py-2.5 pr-3 font-medium">Rider</th>
                    <th className="py-2.5 pr-3 font-medium">Detour</th>
                    <th className="py-2.5 pr-3 text-right font-medium">Solo fare</th>
                    <th className="py-2.5 pr-3 text-right font-medium">Pooled fare</th>
                    <th className="py-2.5 text-right font-medium">Saves</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {plan.perRider.map((rider) => (
                    <tr key={rider.rideId}>
                      <td className="py-2.5 pr-3 font-mono text-xs text-ink-700">{rider.rideId.slice(-6)}</td>
                      <td className="py-2.5 pr-3 text-ink-600">{formatPercent(rider.detourRatio)}</td>
                      <td className="py-2.5 pr-3 text-right text-ink-600">
                        {formatCurrency(rider.soloFare, 0)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium text-ink-900">
                        {formatCurrency(rider.pooledFare, 0)}
                      </td>
                      <td className="py-2.5 text-right font-medium text-emerald-600">
                        {formatCurrency(rider.soloFare - rider.pooledFare, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
