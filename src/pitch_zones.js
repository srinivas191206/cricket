/**
 * Pitch Zones & Geometry Generator
 * Generates metric pitch zones and transverse distance lines in normalized pitch space,
 * then maps them through perspective transformation into image pixel coordinates.
 */

import { PITCH_LENGTH_M, PITCH_WIDTH_M, PITCH_ZONES, METER_MARKERS } from "./constants.js";

export class PitchZones {
  constructor(transform, bowlerEnd = "bottom") {
    this.transform = transform;
    this.bowlerEnd = bowlerEnd; // "top" or "bottom"
  }

  /**
   * Generates perspective-projected quadrilaterals for each pitch zone.
   * @returns {Array<Object>} Projected zones with pixel polygons, labels, and colors.
   */
  getProjectedZones() {
    if (!this.transform || !this.transform.isValid) {
      return [];
    }

    const projectedZones = [];

    for (const zone of PITCH_ZONES) {
      // In normalized pitch space:
      // X spans [0, PITCH_WIDTH_M]
      // Y spans [zone.startM, zone.endM]
      const yStart = zone.startM;
      const yEnd = Math.min(zone.endM, PITCH_LENGTH_M);

      // 4 corners in normalized pitch space (top-left, top-right, bottom-right, bottom-left)
      const c1_metric = [0, yStart];
      const c2_metric = [PITCH_WIDTH_M, yStart];
      const c3_metric = [PITCH_WIDTH_M, yEnd];
      const c4_metric = [0, yEnd];

      // Project into image pixel space
      const p1 = this.transform.pitchToImage(c1_metric);
      const p2 = this.transform.pitchToImage(c2_metric);
      const p3 = this.transform.pitchToImage(c3_metric);
      const p4 = this.transform.pitchToImage(c4_metric);

      // Center point for label placement
      const center_metric = [PITCH_WIDTH_M * 0.5, (yStart + yEnd) * 0.5];
      const center = this.transform.pitchToImage(center_metric);

      // Right boundary midpoint for zone tag
      const right_metric = [PITCH_WIDTH_M, (yStart + yEnd) * 0.5];
      const rightMid = this.transform.pitchToImage(right_metric);

      projectedZones.push({
        ...zone,
        polygon: [p1, p2, p3, p4],
        center,
        rightMid,
        yStart,
        yEnd
      });
    }

    return projectedZones;
  }

  /**
   * Generates projected transverse distance lines (2m, 4m, 6m, 8m, halfway, stumps).
   */
  getProjectedDistanceLines() {
    if (!this.transform || !this.transform.isValid) {
      return [];
    }

    const lines = [];

    for (const marker of METER_MARKERS) {
      const y = marker.meter;
      if (y > PITCH_LENGTH_M) continue;

      const pLeft = this.transform.pitchToImage([0, y]);
      const pRight = this.transform.pitchToImage([PITCH_WIDTH_M, y]);

      lines.push({
        meter: y,
        label: marker.label,
        leftPoint: pLeft,
        rightPoint: pRight
      });
    }

    return lines;
  }
}
