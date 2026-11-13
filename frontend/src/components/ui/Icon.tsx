import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "map-pin"
  | "car"
  | "list"
  | "user"
  | "users"
  | "chart"
  | "activity"
  | "settings"
  | "play"
  | "stop"
  | "refresh"
  | "logout"
  | "menu"
  | "close"
  | "check"
  | "alert"
  | "clock"
  | "navigation"
  | "zap"
  | "layers"
  | "wallet"
  | "shield"
  | "route"
  | "plus"
  | "arrow-right"
  | "info";

const PATHS: Record<IconName, JSX.Element> = {
  home: <path d="M4 10.5 12 3l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  "map-pin": (
    <>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  car: (
    <>
      <path d="M5 17h14" />
      <path d="M6.5 17 8 11.5h8L17.5 17" />
      <path d="M4 17v-3.2L6 9h12l2 4.8V17" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.3-3.4 4-5 7-5s5.7 1.6 7 5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c1.1-3 3.4-4.5 6-4.5s4.9 1.5 6 4.5" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M18 19c-.4-1.6-1.1-2.9-2-3.8" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V7M17 20v-9" />
    </>
  ),
  activity: <path d="M3 12h3l2.5-6 4 12 2.5-6h6" />,
  settings: (
    <>
      <path d="M4 7h9M17 7h3" />
      <path d="M4 12h4M12 12h8" />
      <path d="M4 17h9M17 17h3" />
      <circle cx="14.5" cy="7" r="1.6" />
      <circle cx="9.5" cy="12" r="1.6" />
      <circle cx="14.5" cy="17" r="1.6" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="1.5" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v4h-4" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 13 4 4L19 7" />,
  alert: (
    <>
      <path d="M12 4 2.5 20h19z" />
      <path d="M12 10v4M12 17.2v.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  navigation: <path d="m4 20 16-8L4 4l3 8z" />,
  zap: <path d="M13 2 4 14h6l-1 8 9-12h-6z" />,
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.2" />
    </>
  ),
  shield: <path d="M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6z" />,
  route: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6H14a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h5.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  "arrow-right": <path d="M5 12h13M13 6l6 6-6 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.6v.1" />
    </>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
