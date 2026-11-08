import type { SVGProps } from 'react';

const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

type P = SVGProps<SVGSVGElement>;

export const IconLeft = (p: P) => (
  <svg {...base} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const IconRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const IconQuill = (p: P) => (
  <svg {...base} {...p}>
    <path d="M20 3c-6 1-11 6-13 13l-2 5" />
    <path d="M20 3c0 6-4 11-11 13" />
    <path d="M9 11l4 4" />
  </svg>
);
export const IconSound = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 10v4h4l5 4V6L8 10H4z" />
    <path d="M16.5 8.5a5 5 0 010 7" />
    <path d="M19 6a8.5 8.5 0 010 12" />
  </svg>
);
export const IconMute = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 10v4h4l5 4V6L8 10H4z" />
    <path d="M17 9l5 6M22 9l-5 6" />
  </svg>
);
export const IconExpand = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);
export const IconBook = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15z" />
    <path d="M4 20.5A2.5 2.5 0 016.5 18H20v3H6.5" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconUp = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);
export const IconDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
export const IconEye = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconStamp = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 3h6v5l2 4H7l2-4V3z" />
    <path d="M5 15h14v3H5zM7 21h10" />
  </svg>
);
export const IconSnow = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" />
    <path d="M9 4l3 2 3-2M9 20l3-2 3 2" />
  </svg>
);
