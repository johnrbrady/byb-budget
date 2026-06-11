import React from "react";

// Inline SVG icon set (stroke-based, 24px grid) — replaces emoji and PNG
// icons. No external dependency, inherits colour from CSS `currentColor`.

function Base({ size = 20, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p) => (
  <Base {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></Base>
);

export const IconList = (p) => (
  <Base {...p}><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3.5 6h.01" /><path d="M3.5 12h.01" /><path d="M3.5 18h.01" /></Base>
);

export const IconEnvelope = (p) => (
  <Base {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Base>
);

export const IconRepeat = (p) => (
  <Base {...p}><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></Base>
);

export const IconChart = (p) => (
  <Base {...p}><path d="M3 3v18h18" /><path d="M7 15v3" /><path d="M11 11v7" /><path d="M15 7v11" /><path d="M19 12v6" /></Base>
);

export const IconPlus = (p) => (
  <Base {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Base>
);

export const IconClose = (p) => (
  <Base {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Base>
);

export const IconEdit = (p) => (
  <Base {...p}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></Base>
);

export const IconTrash = (p) => (
  <Base {...p}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Base>
);

export const IconMoon = (p) => (
  <Base {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Base>
);

export const IconSun = (p) => (
  <Base {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></Base>
);

export const IconLogout = (p) => (
  <Base {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Base>
);

export const IconArrowLeft = (p) => (
  <Base {...p}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></Base>
);

export const IconArrowDown = (p) => (
  <Base {...p}><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></Base>
);

export const IconTransfer = (p) => (
  <Base {...p}><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></Base>
);

export const IconZap = (p) => (
  <Base {...p}><path d="M13 2 3 14h7l-1 8 11-13h-7l0-7Z" /></Base>
);

export const IconCheck = (p) => (
  <Base {...p}><path d="M20 6 9 17l-5-5" /></Base>
);

export const IconDrag = (p) => (
  <Base {...p}><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></Base>
);

export const IconWallet = (p) => (
  <Base {...p}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></Base>
);

export const IconFilter = (p) => (
  <Base {...p}><path d="M22 3H2l8 9.46V19l4 2v-8.54Z" /></Base>
);

export const IconHistory = (p) => (
  <Base {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 3" /></Base>
);

export const NAV_ICONS = {
  dashboard: IconHome,
  transactions: IconList,
  categories: IconEnvelope,
  recurring: IconRepeat,
  reports: IconChart,
};
