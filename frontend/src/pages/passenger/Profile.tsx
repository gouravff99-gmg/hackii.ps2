import { useNavigate } from "react-router-dom";
import { Role } from "@ps02/shared";
import { useAuth } from "../../hooks/useAuth";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Icon } from "../../components/ui/Icon";
import { initials, roleLabel } from "../../utils/format";

export function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Profile" description="Your account details on this device." />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-lg font-semibold text-brand-700">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-ink-900">{user.name}</p>
            <p className="text-sm text-ink-500">{user.email}</p>
            <div className="mt-2 flex gap-2">
              <Badge tone="info">{roleLabel(user.role)}</Badge>
              {user.role === Role.PASSENGER ? <Badge tone="neutral">Rider account</Badge> : null}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Account"
          subtitle="Signing out clears the session token stored by this browser."
        />
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink-900">Sign out</p>
              <p className="text-xs text-ink-500">You can sign back in at any time.</p>
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
            Profile editing (name, email, password) is not exposed by this build's API.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
