/* ==========================================================================
   Icons — consistent inline SVG set (stroke 1.8, round caps), 24 viewBox.
   Never use emojis as icons. Decorative usage: default aria-hidden.
   ========================================================================== */

import type { ComponentType, ReactNode, SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  } as const;
}

function icon(children: ReactNode, fill = false) {
  return function IconComponent(props: IconProps) {
    return (
      <svg {...base(props)} fill={fill ? "currentColor" : "none"}>
        {children}
      </svg>
    );
  };
}

/* --- Navigation --- */
export const IconSun = icon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </>,
);

export const IconTarget = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.2" />
  </>,
);

export const IconHistory = icon(
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7v5l3.5 2" />
  </>,
);

export const IconChart = icon(
  <>
    <path d="M3 3v18h18" />
    <path d="M7.5 15.5v3M12 10.5v8M16.5 6v12.5" />
  </>,
);

export const IconBookmark = icon(
  <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1Z" />,
);

export const IconChat = icon(
  <path d="M21 14.5a2 2 0 0 1-2 2H8l-4.5 4V5a2 2 0 0 1 2-2h13.5a2 2 0 0 1 2 2Z" />,
);

export const IconSettings = icon(
  <>
    <path d="M4 21v-6M4 9V3M12 21v-9M12 6V3M20 21v-4M20 11V3" />
    <path d="M1.5 15h5M9.5 6h5M17.5 17h5" />
  </>,
);

export const IconMore = icon(
  <>
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </>,
  true,
);

/* --- Actions --- */
export const IconPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IconX = icon(<path d="M18 6 6 18M6 6l12 12" />);
export const IconCheck = icon(<path d="m20 6-11 11-5-5" />);
export const IconChevronDown = icon(<path d="m6 9 6 6 6-6" />);
export const IconChevronLeft = icon(<path d="m15 18-6-6 6-6" />);
export const IconChevronRight = icon(<path d="m9 18 6-6-6-6" />);
export const IconArrowLeft = icon(<path d="M19 12H5M12 19l-7-7 7-7" />);
export const IconTrash = icon(
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
    <path d="m19 6-.9 13a2 2 0 0 1-2 1.9H7.9a2 2 0 0 1-2-1.9L5 6" />
    <path d="M10 11v6M14 11v6" />
  </>,
);
export const IconPencil = icon(
  <path d="M17 3.5a2.8 2.8 0 0 1 4 4L8.5 20 3 21.5 4.5 16Z" />,
);
export const IconPin = icon(
  <>
    <path d="M12 17v4" />
    <path d="m8 2 8 .5-1.5 6.5 3 3.5h-11l3-3.5Z" />
    <path d="M5.5 20h13" />
  </>,
);
export const IconArchive = icon(
  <>
    <path d="M21 8v12.5H3V8" />
    <path d="M1 3h22v5H1z" />
    <path d="M10 12h4" />
  </>,
);
export const IconDownload = icon(
  <>
    <path d="M21 15v4.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5V15" />
    <path d="m7 10 5 5 5-5M12 15V3" />
  </>,
);
export const IconUpload = icon(
  <>
    <path d="M21 15v4.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5V15" />
    <path d="m17 8-5-5-5 5M12 3v12" />
  </>,
);
export const IconRefresh = icon(
  <>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </>,
);
export const IconSend = icon(
  <>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4Z" />
  </>,
);
export const IconAlert = icon(
  <>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </>,
);
export const IconInfo = icon(
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 16v-5M12 8h.01" />
  </>,
);
export const IconSparkle = icon(
  <>
    <path d="M12 3l1.9 5.4 5.6 1.6-5.6 1.6L12 17l-1.9-5.4L4.5 10l5.6-1.6Z" />
    <path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
  </>,
);
export const IconStar = icon(
  <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.6l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9Z" />,
);
export const IconClock = icon(
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 7v5l3.5 2" />
  </>,
);
export const IconCalendar = icon(
  <>
    <rect x="3" y="4.5" width="18" height="17" rx="2" />
    <path d="M16 2.5v4M8 2.5v4M3 10h18" />
  </>,
);
export const IconMoon = icon(
  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
);
export const IconEye = icon(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const IconEyeOff = icon(
  <>
    <path d="M2 2l20 20" />
    <path d="M6.7 6.7A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5-1.4" />
    <path d="M9.9 4.2A9.7 9.7 0 0 1 12 4c6.5 0 10 8 10 8a17.7 17.7 0 0 1-2.2 3.2" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </>,
);
export const IconKey = icon(
  <>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.8 12.2 9.7-9.7M16.5 6.5l3 3M13.5 9.5l2 2" />
  </>,
);
export const IconBot = icon(
  <>
    <rect x="4" y="7" width="16" height="13" rx="3" />
    <path d="M12 7V3M8 4h8" />
    <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
  </>,
);
export const IconQuote = icon(
  <>
    <path d="M3 21c3.5 0 6-2.6 6-6V6H3v9h3c0 3-1 4.5-3 6ZM13 21c3.5 0 6-2.6 6-6V6h-6v9h3c0 3-1 4.5-3 6Z" />
  </>,
);
export const IconArrowUp = icon(<>
  <path d="M12 19V5" />
  <path d="m5 12 7-7 7 7" />
</>);
export const IconArrowDown = icon(<>
  <path d="M12 5v14" />
  <path d="m19 12-7 7-7-7" />
</>);

export type IconName =
  | "sun"
  | "target"
  | "history"
  | "chart"
  | "bookmark"
  | "chat"
  | "settings"
  | "more"
  | "plus"
  | "x"
  | "check"
  | "chevronDown"
  | "chevronLeft"
  | "chevronRight"
  | "arrowLeft"
  | "trash"
  | "pencil"
  | "pin"
  | "archive"
  | "download"
  | "upload"
  | "refresh"
  | "send"
  | "alert"
  | "info"
  | "sparkle"
  | "star"
  | "clock"
  | "calendar"
  | "moon"
  | "eye"
  | "eyeOff"
  | "key"
  | "quote"
  | "arrowUp"
  | "arrowDown";

export const ICONS: Record<IconName, ComponentType<IconProps>> = {
  sun: IconSun,
  target: IconTarget,
  history: IconHistory,
  chart: IconChart,
  bookmark: IconBookmark,
  chat: IconChat,
  settings: IconSettings,
  more: IconMore,
  plus: IconPlus,
  x: IconX,
  check: IconCheck,
  chevronDown: IconChevronDown,
  chevronLeft: IconChevronLeft,
  chevronRight: IconChevronRight,
  arrowLeft: IconArrowLeft,
  trash: IconTrash,
  pencil: IconPencil,
  pin: IconPin,
  archive: IconArchive,
  download: IconDownload,
  upload: IconUpload,
  refresh: IconRefresh,
  send: IconSend,
  alert: IconAlert,
  info: IconInfo,
  sparkle: IconSparkle,
  star: IconStar,
  clock: IconClock,
  calendar: IconCalendar,
  moon: IconMoon,
  eye: IconEye,
  eyeOff: IconEyeOff,
  key: IconKey,
  quote: IconQuote,
  arrowUp: IconArrowUp,
  arrowDown: IconArrowDown,
};

/** Dynamic icon lookup — used by nav/menus with runtime names. */
export function DynIcon({
  name,
  ...props
}: IconProps & { name: IconName }) {
  const Cmp = ICONS[name];
  return <Cmp {...props} />;
}
