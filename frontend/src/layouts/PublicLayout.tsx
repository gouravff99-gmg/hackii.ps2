import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { homeForRole } from "../utils/roles";
import { Icon } from "../components/ui/Icon";

export function PublicLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Icon name="navigation" size={18} />
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink-900">RideOps</span>
          </Link>

          <nav className="flex items-center gap-2">
            {user ? (
              <Link
                to={homeForRole(user.role)}
                className="inline-flex h-10 items-center rounded-xl bg-ink-900 px-4 text-sm font-medium text-white transition hover:bg-ink-800"
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-ink-600 transition hover:bg-ink-50 hover:text-ink-900"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex h-10 items-center rounded-xl bg-ink-900 px-4 text-sm font-medium text-white transition hover:bg-ink-800"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>RideOps — Intelligent ride matching &amp; dynamic driver allocation.</p>
          <p>Bengaluru pilot · OpenStreetMap data</p>
        </div>
      </footer>
    </div>
  );
}
