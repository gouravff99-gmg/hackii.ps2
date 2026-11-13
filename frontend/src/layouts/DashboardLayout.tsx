import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import type { AuthUser } from "@ps02/shared";
import { useAuth } from "../hooks/useAuth";
import { initials } from "../utils/format";
import { Icon, type IconName } from "../components/ui/Icon";

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

export function DashboardLayout({
  nav,
  roleLabel,
  workspaceName,
  accent = "brand",
}: {
  nav: NavItem[];
  roleLabel: string;
  workspaceName: string;
  accent?: "brand" | "emerald" | "violet";
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const accentClasses: Record<string, string> = {
    brand: "bg-brand-600",
    emerald: "bg-emerald-600",
    violet: "bg-violet-600",
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const navList = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setDrawerOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              isActive
                ? "bg-brand-50 font-medium text-brand-700"
                : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
            }`
          }
        >
          <Icon name={item.icon} size={18} />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  const brand = (
    <Link to="/" className="flex items-center gap-2.5 px-5 py-5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${accentClasses[accent]}`}>
        <Icon name="navigation" size={18} />
      </span>
      <span>
        <span className="block text-sm font-semibold leading-tight text-ink-900">RideOps</span>
        <span className="block text-xs text-ink-400">{workspaceName}</span>
      </span>
    </Link>
  );

  const account = (
    <div className="border-t border-ink-100 p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
          {initialsOf(user)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">{user?.name ?? "Account"}</p>
          <p className="truncate text-xs text-ink-400">{roleLabel}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
          aria-label="Sign out"
          title="Sign out"
        >
          <Icon name="logout" size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-ink-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-ink-200 bg-white lg:flex">
        {brand}
        {navList}
        {account}
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-raised animate-slide-in">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-100"
                aria-label="Close navigation"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            {navList}
            {account}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Icon name="menu" size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-900">{workspaceName}</p>
            <p className="truncate text-xs text-ink-400">{roleLabel} workspace</p>
          </div>
          <span className="hidden items-center gap-2 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live
          </span>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function initialsOf(user: AuthUser | null): string {
  return user ? initials(user.name) : "··";
}
