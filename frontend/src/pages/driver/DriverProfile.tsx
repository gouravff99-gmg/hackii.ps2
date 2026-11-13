import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DriverAdminView } from "@ps02/shared";
import { useAuth } from "../../hooks/useAuth";
import { useAsync } from "../../hooks/useAsync";
import { driverApi } from "../../services/driverApi";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorState } from "../../components/ui/EmptyState";
import {
  driverStatusLabel,
  driverStatusTone,
  formatPercent,
  initials,
} from "../../utils/format";
import { Icon } from "../../components/ui/Icon";
import { errorMessage } from "../../services/api";

export function DriverProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [registration, setRegistration] = useState("");
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync<{ driver: DriverAdminView }>(
    () => driverApi.me(),
    [],
  );

  useEffect(() => {
    if (data?.driver.vehicleRegistration) {
      setRegistration(data.driver.vehicleRegistration);
    }
  }, [data?.driver.vehicleRegistration]);

  const saveRegistration = async () => {
    setSavingRegistration(true);
    setRegistrationMessage(null);
    try {
      await driverApi.updateVehicleRegistration(registration.trim());
      setRegistrationMessage("Vehicle registration saved.");
      await reload();
    } catch (saveError) {
      setRegistrationMessage(errorMessage(saveError));
    } finally {
      setSavingRegistration(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Driver profile" description="Your account and performance on this device." />

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-ink-400">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error || !data ? (
        <ErrorState message={error ?? "Driver profile unavailable"} onRetry={() => void reload()} />
      ) : (
        <>
          <Card>
            <CardBody className="flex flex-wrap items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-semibold text-emerald-700">
                {initials(user.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-ink-900">{user.name}</p>
                <p className="text-sm text-ink-500">{user.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={driverStatusTone(data.driver.status)} dot>
                    {driverStatusLabel(data.driver.status)}
                  </Badge>
                  <Badge tone="neutral">{data.driver.vehicleType}</Badge>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader title="Performance" subtitle="Today" />
              <CardBody>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-ink-400">Completed trips</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-ink-900">
                      {data.driver.completedToday}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Acceptance rate</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-ink-900">
                      {formatPercent(data.driver.acceptanceRate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Busy minutes</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-ink-900">
                      {Math.round(data.driver.busyMinutesToday)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Vehicle</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-ink-900">
                      {data.driver.vehicleType}
                    </dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Account" subtitle="Signing out clears the session on this browser." />
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">Sign out</p>
                    <p className="text-xs text-ink-500">You will stop receiving offers.</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      logout();
                      navigate("/", { replace: true });
                    }}
                  >
                    <Icon name="logout" size={16} />
                    Sign out
                  </Button>
                </div>
                <p className="text-xs text-ink-400">
                  Add your vehicle registration so passengers can identify your vehicle.
                </p>
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title="Vehicle details" subtitle="Visible to passengers assigned to your rides." />
            <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm font-medium text-ink-700">
                Registration number
                <input
                  value={registration}
                  onChange={(event) => setRegistration(event.target.value.toUpperCase())}
                  maxLength={16}
                  autoComplete="off"
                  placeholder="KA 01 AB 1234"
                  className="mt-1 h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
                  aria-describedby="registration-help"
                />
                <span id="registration-help" className="mt-1 block text-xs text-ink-400">
                  Use 5-16 letters, numbers, spaces or hyphens.
                </span>
              </label>
              <Button loading={savingRegistration} onClick={() => void saveRegistration()}>
                Save registration
              </Button>
              {registrationMessage ? (
                <p role="status" className="text-sm text-ink-600">{registrationMessage}</p>
              ) : null}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
