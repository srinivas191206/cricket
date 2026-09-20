/**
 * Cricket Pitch Dimensions & Zone Configuration
 * Real-world ICC dimensions in metres.
 */

export const PITCH_LENGTH_M = 20.1168; // 22 yards = 20.1168 meters
export const PITCH_WIDTH_M = 3.048;    // 10 feet = 3.048 meters
export const CREASE_OFFSET_M = 1.2192; // 4 feet popping crease offset

/**
 * Standard bowling length zones as specified:
 * - 0–2 m: YORKER / FULL TOSS
 * - 2–4 m: FULL / HALF-VOLLEY
 * - 4–6 m: GOOD LENGTH
 * - 6–8 m: BACK OF A LENGTH
 * - 8–20.1168 m: SHORT / BOUNCER
 *
 * Matching the exact visual style and colors of the broadcast reference image:
 */
export const PITCH_ZONES = [
  {
    id: "full_toss",
    name: "FULL TOSS",
    shortName: "FULL TOSS",
    startM: 0.0,
    endM: 1.0,
    // Magenta / Violet (matches reference image top strip)
    fillColor: "rgba(217, 70, 239, 0.40)",
    borderColor: "rgba(217, 70, 239, 0.85)",
    tagColor: "#d946ef",
  },
  {
    id: "yorker",
    name: "YORKER",
    shortName: "YORKER",
    startM: 1.0,
    endM: 2.0,
    // Warm Yellow / Amber (matches reference image)
    fillColor: "rgba(245, 158, 11, 0.40)",
    borderColor: "rgba(245, 158, 11, 0.85)",
    tagColor: "#f59e0b",
  },
  {
    id: "half_volley",
    name: "HALF VOLLEY",
    shortName: "HALF VOLLEY",
    startM: 2.0,
    endM: 4.0,
    // Sky Blue / Cyan (matches reference image)
    fillColor: "rgba(14, 165, 233, 0.40)",
    borderColor: "rgba(14, 165, 233, 0.85)",
    tagColor: "#0ea5e9",
  },
  {
    id: "full",
    name: "FULL",
    shortName: "FULL",
    startM: 4.0,
    endM: 6.0,
    // Fresh Grass Green (matches reference image)
    fillColor: "rgba(34, 197, 94, 0.40)",
    borderColor: "rgba(34, 197, 94, 0.85)",
    tagColor: "#22c55e",
  },
  {
    id: "length",
    name: "LENGTH",
    shortName: "LENGTH",
    startM: 6.0,
    endM: 8.0,
    // Red / Coral (matches reference image)
    fillColor: "rgba(239, 68, 68, 0.40)",
    borderColor: "rgba(239, 68, 68, 0.85)",
    tagColor: "#ef4444",
  },
  {
    id: "short",
    name: "SHORT",
    shortName: "SHORT",
    startM: 8.0,
    endM: PITCH_LENGTH_M, // Clamped strictly at 20.1168 m
    // Slate / Dark Muted Gray (matches reference image)
    fillColor: "rgba(100, 116, 139, 0.35)",
    borderColor: "rgba(100, 116, 139, 0.70)",
    tagColor: "#1d4ed8",
  }
];

export const METER_MARKERS = [
  { meter: 0.0, label: "STUMPS" },
  { meter: 2.0, label: "2M" },
  { meter: 4.0, label: "4M" },
  { meter: 6.0, label: "6M" },
  { meter: 8.0, label: "8M" },
  { meter: 10.0584, label: "HALFWAY" },
];
