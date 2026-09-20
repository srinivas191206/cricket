/**
 * Pitch Calibration State & Validation Manager
 * Manages the 4 corner points using normalized (0.0 - 1.0) coordinates,
 * ensuring resolution independence between camera feed and recorded video playback.
 */

import { PITCH_LENGTH_M, PITCH_WIDTH_M, PITCH_ZONES } from "./constants.js";
import { PerspectiveTransform } from "./perspective_transform.js";
import { PitchZones } from "./pitch_zones.js";

export class CalibrationState {
  constructor() {
    // 4 Draggable points in normalized coordinates [x: 0..1, y: 0..1]
    // P1: Top-Left, P2: Top-Right, P3: Bottom-Right, P4: Bottom-Left
    this.normalizedPoints = {
      P1: [0.38, 0.32],
      P2: [0.62, 0.32],
      P3: [0.74, 0.78],
      P4: [0.26, 0.78],
    };

    // Cached native pixel points for current active resolution
    this.points = {
      P1: [0, 0],
      P2: [0, 0],
      P3: [0, 0],
      P4: [0, 0],
    };

    this.currentWidth = 1080;
    this.currentHeight = 1920;

    this.bowlerEnd = "bottom"; // "top" or "bottom"
    this.isConfirmed = false;
    this.isUserCustomized = false;
    this.transform = null;
    this.pitchZones = null;

    this.updateNativePoints(this.currentWidth, this.currentHeight);
  }

  /**
   * Initializes default 4 pins if user has NOT customized them.
   */
  initDefaultPins(width, height) {
    if (width > 0 && height > 0) {
      this.currentWidth = width;
      this.currentHeight = height;
    }

    if (!this.isUserCustomized) {
      this.normalizedPoints = {
        P1: [0.38, 0.32],
        P2: [0.62, 0.32],
        P3: [0.74, 0.78],
        P4: [0.26, 0.78],
      };
      this.isConfirmed = false;
    }

    this.updateNativePoints(this.currentWidth, this.currentHeight);
  }

  /**
   * Updates resolution and recalculates native pixel coordinates.
   */
  updateNativePoints(width, height) {
    if (width > 0 && height > 0) {
      this.currentWidth = width;
      this.currentHeight = height;
    }

    const w = this.currentWidth;
    const h = this.currentHeight;

    this.points = {
      P1: [this.normalizedPoints.P1[0] * w, this.normalizedPoints.P1[1] * h],
      P2: [this.normalizedPoints.P2[0] * w, this.normalizedPoints.P2[1] * h],
      P3: [this.normalizedPoints.P3[0] * w, this.normalizedPoints.P3[1] * h],
      P4: [this.normalizedPoints.P4[0] * w, this.normalizedPoints.P4[1] * h],
    };

    this.recompute();
  }

  /**
   * Sets point from native pixel coordinates.
   */
  setPoint(key, nativeX, nativeY) {
    if (this.normalizedPoints[key]) {
      const nx = Math.max(0.01, Math.min(0.99, nativeX / this.currentWidth));
      const ny = Math.max(0.01, Math.min(0.99, nativeY / this.currentHeight));

      this.normalizedPoints[key] = [nx, ny];
      this.isUserCustomized = true;

      this.updateNativePoints(this.currentWidth, this.currentHeight);
    }
  }

  /**
   * Sets point directly from normalized coordinates [0..1].
   */
  setNormalizedPoint(key, nx, ny) {
    if (this.normalizedPoints[key]) {
      this.normalizedPoints[key] = [
        Math.max(0.01, Math.min(0.99, nx)),
        Math.max(0.01, Math.min(0.99, ny))
      ];
      this.isUserCustomized = true;
      this.updateNativePoints(this.currentWidth, this.currentHeight);
    }
  }

  setBowlerEnd(end) {
    if (end === "top" || end === "bottom") {
      this.bowlerEnd = end;
      this.recompute();
    }
  }

  /**
   * Validates the 4 points to ensure a non-degenerate, non-self-intersecting quadrilateral.
   */
  validate() {
    const { P1, P2, P3, P4 } = this.points;
    if (!P1 || !P2 || !P3 || !P4) {
      return { valid: false, message: "All 4 corner points must be set." };
    }

    const pts = [P1, P2, P3, P4];
    for (const p of pts) {
      if (!Array.isArray(p) || p.length !== 2 || isNaN(p[0]) || isNaN(p[1])) {
        return { valid: false, message: "Invalid point coordinates detected." };
      }
    }

    // Check if points are distinct
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
        if (d < 5) {
          return { valid: false, message: "Pins are too close together. Please expand the pitch boundary." };
        }
      }
    }

    // Check for self-intersection
    if (CalibrationState.segmentsIntersect(P1, P2, P3, P4)) {
      return { valid: false, message: "Adjust points so pitch edges do not cross." };
    }
    if (CalibrationState.segmentsIntersect(P2, P3, P4, P1)) {
      return { valid: false, message: "Adjust points so pitch edges do not cross." };
    }

    // Area check
    const area = 0.5 * Math.abs(
      (P1[0] * P2[1] - P2[0] * P1[1]) +
      (P2[0] * P3[1] - P3[0] * P2[1]) +
      (P3[0] * P4[1] - P4[0] * P3[1]) +
      (P4[0] * P1[1] - P1[0] * P4[1])
    );

    if (area < 50) {
      return { valid: false, message: "Pitch area is too small." };
    }

    return { valid: true, message: "Calibration: VALID" };
  }

  /**
   * Computes the homography transform.
   */
  recompute() {
    const val = this.validate();
    if (!val.valid) {
      this.transform = null;
      this.pitchZones = null;
      return false;
    }

    const { P1, P2, P3, P4 } = this.points;
    const srcPoints = [P1, P2, P3, P4];

    let dstPoints;
    if (this.bowlerEnd === "bottom") {
      // Standard camera behind bowler:
      // Batter / Stumps is at TOP (P1, P2): distance Y = 0m (Full toss / Yorker)
      // Bowler is at BOTTOM (P4, P3): distance Y = 20.1168m (Short / Bowler's crease)
      dstPoints = [
        [0, 0],                           // P1: Top-Left (Batter stumps = 0m)
        [PITCH_WIDTH_M, 0],               // P2: Top-Right (Batter stumps = 0m)
        [PITCH_WIDTH_M, PITCH_LENGTH_M],  // P3: Bottom-Right (Bowler crease = 20.1168m)
        [0, PITCH_LENGTH_M],              // P4: Bottom-Left (Bowler crease = 20.1168m)
      ];
    } else {
      dstPoints = [
        [0, PITCH_LENGTH_M],
        [PITCH_WIDTH_M, PITCH_LENGTH_M],
        [PITCH_WIDTH_M, 0],
        [0, 0],
      ];
    }

    this.transform = new PerspectiveTransform(srcPoints, dstPoints);
    if (this.transform.isValid) {
      this.pitchZones = new PitchZones(this.transform, this.bowlerEnd);
      return true;
    } else {
      this.pitchZones = null;
      return false;
    }
  }

  confirm() {
    const val = this.validate();
    if (!val.valid) {
      return { success: false, message: val.message };
    }
    if (!this.recompute()) {
      return { success: false, message: "Perspective transform calculation failed. Please check pin layout." };
    }
    this.isConfirmed = true;
    return { success: true, message: "Calibration confirmed and locked." };
  }

  exportNormalized() {
    return {
      normalizedPoints: JSON.parse(JSON.stringify(this.normalizedPoints)),
      bowlerEnd: this.bowlerEnd,
      isConfirmed: this.isConfirmed,
      isUserCustomized: this.isUserCustomized,
    };
  }

  importNormalized(data) {
    if (data && data.normalizedPoints) {
      this.normalizedPoints = JSON.parse(JSON.stringify(data.normalizedPoints));
      this.bowlerEnd = data.bowlerEnd || "bottom";
      this.isConfirmed = data.isConfirmed || true;
      this.isUserCustomized = true;
      this.updateNativePoints(this.currentWidth, this.currentHeight);
    }
  }

  toJSON() {
    return {
      normalizedCorners: this.normalizedPoints,
      pixelCorners: this.points,
      bowlerEnd: this.bowlerEnd,
      pitchLengthMeters: PITCH_LENGTH_M,
      pitchWidthMeters: PITCH_WIDTH_M,
      zones: PITCH_ZONES.map(z => ({
        name: z.name,
        startMeters: z.startM,
        endMeters: z.endM,
      })),
      homography: this.transform ? this.transform.H : null,
      inverseHomography: this.transform ? this.transform.H_inv : null,
      isConfirmed: this.isConfirmed,
      timestamp: new Date().toISOString()
    };
  }

  static segmentsIntersect(p1, p2, p3, p4) {
    function ccw(a, b, c) {
      return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
    }
    return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
  }
}
