import { useMemo, useState } from "react";
import {
  ChaosAction,
  RideStatus,
  SIM,
  SOCKET_EVENTS,
  Strategy,
  type DriverAdminView,
  type RideStatusPayload,
  type SimStatusResponse,
  type SimTickPayload,
} from "@ps02/shared";
import { useAsync } from "../../hooks/useAsync";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useToast } from "../../hooks/useToast";
import { adminApi } from "../../services/adminApi";
import { errorMessage } from "../../services/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorState } from "../../components/ui/EmptyState";
import { StatCard } from "../../components/ui/StatCard";
import { formatTime } from "../../utils/format";
import { Icon } from "../../components/ui/Icon";

const CHAOS_ACTIONS: { value: ChaosAction; label: string; description: string }[] = [
  {
    value: ChaosAction.KILL_DRIVER,
    label: "Kill driver",
    description: "Takes a driver offline. Any active ride is reassigned immediately.",
  },
  {
    value: ChaosAction.DELAY_DRIVER,
    label: "Delay driver",
    description: "Inflates the arrival ETA past the delay threshold to force a reassignment.",
  },
  {
    value: ChaosAction.FORCE_REJECT,
    label: "Force reject",
    description: "Rejects the active offer for a ride, exercising the rejection path.",
  },
];

interface SimulationData {
  status: SimStatusResponse;
  drivers: DriverAdminView[];
  rides: Awaited<ReturnType<typeof adminApi.rides>>["rides"];
}

export function Simulation() {
  const toast = useToast();
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [strategy, setStrategy] = useState<Strategy>(Strategy.SMART);
  const [speed, setSpeed] = useState<number>(SIM.speed);
  const [numDrivers, setNumDrivers] = useState<number>(SIM.numDrivers);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [chaosAction, setChaosAction] = useState<ChaosAction>(ChaosAction.KILL_DRIVER);
  const [chaosDriverId, setChaosDriverId] = useState("");
  const [chaosRideId, setChaosRideId] = useState("");
  const [applyingChaos, setApplyingChaos] = useState(false);

  const { data, loading, error, reload, setData } = useAsync<SimulationData>(async () => {
    const [status, drivers, rides] = await Promise.all([
      adminApi.simStatus(),
      adminApi.drivers(),
      adminApi.rides(50),
    ]);
    return { status, drivers: drivers.drivers, rides: rides.rides };
  }, []);

  useSocketEvent<SimTickPayload>(SOCKET_EVENTS.SIM_TICK, (payload) => {
    setData((current) => (current ? { ...current, status: payload } : current));
  });

  useSocketEvent<RideStatusPayload>(SOCKET_EVENTS.RIDE_STATUS, () => void reload());

  const status = data?.status ?? null;
  const drivers = data?.drivers ?? [];
  const rides = data?.rides ?? [];

  const activeRides = useMemo(
    () =>
      rides.filter((ride) =>
        [RideStatus.REQUESTED, RideStatus.ACCEPTED, RideStatus.ARRIVING, RideStatus.ONGOING].includes(
          ride.status,
        ),
      ),
    [rides],
  );

  const runAction = async (action: "start" | "stop" | "reset") => {
    setBusyAction(action);
    try {
      const next =
        action === "start"
          ? await adminApi.startSim({ seed, strategy, speed, numDrivers })
          : action === "stop"
            ? await adminApi.stopSim()
            : await adminApi.resetSim();
      setData((current) => (current ? { ...current, status: next } : current));
      toast.push(
        action === "start" ? "success" : "info",
        action === "start" ? "Simulator started" : action === "stop" ? "Simulator stopped" : "Simulator reset",
        action === "start"
          ? `Running with seed ${next.seed} at ${next.speed}× speed.`
          : action === "stop"
            ? "The fleet is no longer moving."
            : "Simulated drivers were set offline and in-memory state was cleared.",
      );
      await reload();
    } catch (err) {
      toast.push("error", "Simulator action failed", errorMessage(err));
    } finally {
      setBusyAction(null);
    }
  };

  const applyChaos = async () => {
    if (chaosAction === ChaosAction.KILL_DRIVER && !chaosDriverId) {
      toast.push("warning", "Choose a driver", "Kill driver needs a driver to take offline.");
      return;
    }
    if (chaosAction !== ChaosAction.KILL_DRIVER && !chaosRideId) {
      toast.push("warning", "Choose a ride", "This action needs a ride id.");
      return;
    }

    setApplyingChaos(true);
    try {
      const result = await adminApi.chaos({
        action: chaosAction,
        driverId: chaosAction === ChaosAction.KILL_DRIVER ? chaosDriverId : undefined,
        rideId: chaosAction === ChaosAction.KILL_DRIVER ? undefined : chaosRideId,
      });
      toast.push(result.reassigned ? "warning" : "info", "Chaos applied", result.detail);
      await reload();
    } catch (err) {
      toast.push("error", "Chaos action failed", errorMessage(err));
    } finally {
      setApplyingChaos(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !status) {
    return <ErrorState message={error ?? "Simulator status unavailable"} onRetry={() => void reload()} />;
  }

  const chaosMeta = CHAOS_ACTIONS.find((action) => action.value === chaosAction) ?? CHAOS_ACTIONS[0];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Simulator & chaos"
        description="Drive a seeded fleet, watch it move, and inject failures to see reassignment in action."
        actions={
          <Badge tone={status.running ? "success" : "neutral"} dot>
            {status.running ? "Running" : "Stopped"}
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="State"
          value={status.running ? "Running" : "Stopped"}
          hint={`Strategy ${status.strategy} · ${status.speed}× speed`}
          icon="play"
          tone={status.running ? "success" : "neutral"}
        />
        <StatCard
          label="Sim time"
          value={status.simTime ? formatTime(status.simTime) : "—"}
          hint={`Seed ${status.seed}`}
          icon="clock"
          tone="brand"
        />
        <StatCard label="Fleet" value={status.drivers} hint="Drivers in the run" icon="car" tone="violet" />
        <StatCard
          label="Active rides"
          value={status.activeRides}
          hint="Across the whole platform"
          icon="route"
          tone="warning"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Run configuration"
            subtitle="Seed makes runs reproducible; strategy controls how drivers are ranked."
          />
          <CardBody className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Seed"
                type="number"
                min={0}
                value={seed}
                onChange={(event) => setSeed(Number(event.target.value))}
                hint="Same seed = same request stream"
              />
              <Select
                label="Strategy"
                value={strategy}
                onChange={(event) => setStrategy(event.target.value as Strategy)}
              >
                <option value={Strategy.SMART}>SMART (live default)</option>
                <option value={Strategy.NEAREST}>NEAREST (baseline)</option>
              </Select>
              <Input
                label="Speed multiplier"
                type="number"
                min={1}
                max={60}
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                hint="Simulated minutes per real minute"
              />
              <Input
                label="Drivers"
                type="number"
                min={1}
                max={60}
                value={numDrivers}
                onChange={(event) => setNumDrivers(Number(event.target.value))}
                hint="Simulated drivers in the fleet"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                loading={busyAction === "start"}
                disabled={status.running || Boolean(busyAction)}
                onClick={() => void runAction("start")}
              >
                <Icon name="play" size={15} />
                Start
              </Button>
              <Button
                variant="secondary"
                loading={busyAction === "stop"}
                disabled={!status.running || Boolean(busyAction)}
                onClick={() => void runAction("stop")}
              >
                <Icon name="stop" size={15} />
                Stop
              </Button>
              <Button
                variant="ghost"
                loading={busyAction === "reset"}
                disabled={Boolean(busyAction)}
                onClick={() => void runAction("reset")}
              >
                <Icon name="refresh" size={15} />
                Reset
              </Button>
            </div>

            <p className="rounded-xl bg-ink-50 px-4 py-3 text-xs text-ink-500">
              Starting a run sets simulated drivers available and emits positions every second.
              Reset sets them offline and clears in-memory dispatch state. No ride or user records are
              deleted.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Chaos controls" subtitle="Every trigger flows through the real reassignment path." />
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1 rounded-lg bg-ink-100 p-1">
              {CHAOS_ACTIONS.map((action) => (
                <button
                  key={action.value}
                  type="button"
                  onClick={() => setChaosAction(action.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    chaosAction === action.value ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>

            <p className="text-sm text-ink-500">{chaosMeta.description}</p>

            {chaosAction === ChaosAction.KILL_DRIVER ? (
              <Select
                label="Driver"
                value={chaosDriverId}
                onChange={(event) => setChaosDriverId(event.target.value)}
              >
                <option value="">Choose a driver…</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} · {driver.status}
                    {driver.isSimulated ? " · simulated" : ""}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                label="Ride"
                value={chaosRideId}
                onChange={(event) => setChaosRideId(event.target.value)}
              >
                <option value="">Choose a ride…</option>
                {activeRides.map((ride) => (
                  <option key={ride.id} value={ride.id}>
                    {ride.id.slice(-6)} · {ride.status} · {ride.passengerName}
                  </option>
                ))}
              </Select>
            )}

            <Button variant="danger" loading={applyingChaos} onClick={() => void applyChaos()}>
              <Icon name="zap" size={15} />
              Apply chaos
            </Button>

            <p className="text-xs text-ink-400">
              Delay and force-reject need an active ride. Force-reject additionally needs a live
              driver offer, which exists while a ride is waiting for a response.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
