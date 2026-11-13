import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Role, VehicleType } from "@ps02/shared";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { errorMessage } from "../../services/api";
import { homeForRole } from "../../utils/roles";
import { Icon } from "../../components/ui/Icon";

const ROLE_CHOICES: { value: Role; label: string; body: string }[] = [
  { value: Role.PASSENGER, label: "Passenger", body: "Book and track rides." },
  { value: Role.DRIVER, label: "Driver", body: "Accept offers, earn per trip." },
];

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(Role.PASSENGER);
  const [vehicleType, setVehicleType] = useState<string>(VehicleType.SEDAN);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        vehicleType: role === Role.DRIVER ? vehicleType : undefined,
      });
      navigate(homeForRole(user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-14 sm:py-20">
      <div className="rounded-xl2 border border-ink-200/80 bg-white p-6 shadow-card sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">Create your account</h1>
        <p className="mt-1 text-sm text-ink-500">
          Choose how you want to use RideOps. Administrator accounts are provisioned by seeding.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {ROLE_CHOICES.map((choice) => {
            const selected = role === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                onClick={() => setRole(choice.value)}
                aria-pressed={selected}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? "border-brand-400 bg-brand-50 ring-2 ring-brand-100"
                    : "border-ink-200 bg-white hover:border-ink-300"
                }`}
              >
                <p className="text-sm font-medium text-ink-900">{choice.label}</p>
                <p className="mt-0.5 text-xs text-ink-500">{choice.body}</p>
              </button>
            );
          })}
        </div>

        <form className="mt-5 flex flex-col gap-4" onSubmit={submit}>
          <Input
            label="Full name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Aditi Rao"
          />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="At least 8 characters."
            placeholder="••••••••"
          />

          {role === Role.DRIVER ? (
            <Select
              label="Vehicle type"
              name="vehicleType"
              value={vehicleType}
              onChange={(event) => setVehicleType(event.target.value)}
            >
              {Object.values(VehicleType).map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0) + value.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          ) : null}

          {error ? (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}

          <Button type="submit" size="lg" loading={busy} fullWidth>
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
