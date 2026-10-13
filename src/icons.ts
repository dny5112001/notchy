// 24px stroke icons drawn in currentColor.
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  bolt: svg('<path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2Z" fill="currentColor" stroke="none"/>'),
  plug: svg('<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0V7ZM12 17v5"/>'),
  battery: svg('<rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3"/><path d="M5 10h6v4H5z" fill="currentColor" stroke="none"/>'),
  batteryFull: svg('<rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3"/><path d="M5 10h11v4H5z" fill="currentColor" stroke="none"/>'),
  batteryLow: svg('<rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3"/><path d="M5 10h2.5v4H5z" fill="currentColor" stroke="none"/>'),
  headphones: svg('<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4ZM3 19a2 2 0 0 0 2 2h1v-6H3v4Z"/>'),
  bluetooth: svg('<path d="m7 7 10 10-5 5V2l5 5L7 17"/>'),
  mouse: svg('<rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M12 6.5v3.5"/>'),
  phone: svg('<rect x="6.5" y="2" width="11" height="20" rx="2.5"/><path d="M11 18.5h2"/>'),
  speaker: svg('<rect x="5" y="2" width="14" height="20" rx="2.5"/><circle cx="12" cy="14" r="3.5"/><path d="M12 6.5h.01"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  unlock: svg('<rect x="4" y="11" width="16" height="10.5" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 7.8-1.2"/>'),
  drive: svg('<path d="M22 12H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-7Z"/><path d="M6 16h.01M10 16h.01"/>'),
  eject: svg('<path d="M12 4 4 14h16L12 4ZM4 19h16"/>'),
  flame: svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.3 1.3 1.1 2.7 2.5 2.7Z"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
  wave: svg('<path d="M7 11.5V6.5a1.5 1.5 0 0 1 3 0V11M10 10.5V4.5a1.5 1.5 0 0 1 3 0v6M13 10.5v-4a1.5 1.5 0 0 1 3 0v6M16 10.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-5-2.1L3.3 17a1.5 1.5 0 0 1 2.2-2.1L7 16.5"/>'),
  chat: svg('<path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.5-5.4A8.5 8.5 0 1 1 21 12Z"/>'),
  play: svg('<path d="M7 4.5v15l12.5-7.5L7 4.5Z" fill="currentColor"/>'),
  shuffle: svg('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  voice: svg('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>'),
  globe: svg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>'),
  bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  sparkle: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>'),
} as const;

export type IconName = keyof typeof ICONS;
