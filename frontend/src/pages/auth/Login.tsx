import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { errorMessage } from "../../services/api";
import { homeForRole } from "../../utils/roles";
import { Icon } from "../../components/ui/Icon";

const DEMO_ACCOUNTS = [
  { label: "Passenger", email: "passenger@demo.com" },
  { label: "Driver", email: "driver@demo.com" },
  { label: "Administrator", email: "admin@demo.com" },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      navigate(from ?? homeForRole(user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-14 sm:py-20">
      <div className="rounded-xl2 border border-ink-200/80 bg-white p-6 shadow-card sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">Sign in</h1>
        <p className="mt-1 text-sm text-ink-500">
          One account, one workspace — passengers, drivers and administrators all sign in here.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />

          {error ? (
            <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}

          <Button type="submit" size="lg" loading={busy} fullWidth>
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-500">
          New here?{" "}
          <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
            Create an account
          </Link>
        </p>
      </div>

      <div className="mt-5 rounded-xl2 border border-dashed border-ink-200 bg-white/60 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
          Seeded demo accounts
        </p>
        <p className="mt-1 text-xs text-ink-500">
          Password for all demo accounts: <span className="font-mono text-ink-700">password123</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword("password123");
                setError(null);
              }}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
