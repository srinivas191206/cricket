/**
 * Pitch Broadcast Overlay Renderer
 * Renders the perspective-correct bowling length zones onto the video canvas
 * matching the authentic broadcast graphics style from the user reference image:
 *
 * - Translucent colored bands overlaid directly onto the perspective pitch:
 *   (FULL TOSS, YORKER, HALF VOLLEY, FULL, LENGTH, SHORT)
 * - Transverse boundary lines with left-side metric labels:
 *   (STUMPS, 2M, 4M, 6M, 8M, HALFWAY)
 * - Blue center crease line
 * - Glowing cyan boundary
 * - Fixed 4 corner pins (P1, P2, P3, P4) visibly preserved on the recorded video
 */

export class PitchOverlay {
  /**
   * Draws the complete broadcast pitch zones, distance lines, and fixed corner pins.
   * @param {CanvasRenderingContext2D} ctx
   * @param {PitchZones} pitchZones
   * @param {Object} options - { showLabels, showLines, opacity, isDebug }
   */
  static render(ctx, pitchZones, options = {}) {
    if (!pitchZones || !pitchZones.transform || !pitchZones.transform.isValid) {
      return;
    }

    const {
      showLabels = true,
      showLines = true,
    } = options;

    const zones = pitchZones.getProjectedZones();
    const distanceLines = pitchZones.getProjectedDistanceLines();
    const canvasWidth = ctx.canvas.width || 1080;

    // Dynamic typography scaling based on canvas resolution
    const fontScale = Math.max(1.0, canvasWidth / 540);
    const meterFontSize = Math.round(13 * fontScale);
    const zoneFontSize = Math.round(12 * fontScale);

    ctx.save();

    // 1. Draw each perspective colored zone polygon
    for (const zone of zones) {
      const [p1, p2, p3, p4] = zone.polygon;

      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]);
      ctx.lineTo(p4[0], p4[1]);
      ctx.closePath();

      // Fill with semi-transparent color
      ctx.fillStyle = zone.fillColor;
      ctx.fill();

      // Subtle border between zones
      ctx.lineWidth = Math.max(1.5, canvasWidth * 0.0015);
      ctx.strokeStyle = zone.borderColor;
      ctx.stroke();
    }

    // 2. Center Crease Line down the middle (Vibrant Blue as in calibration)
    const src = pitchZones.transform.srcPoints;
    if (src && src.length === 4) {
      const [P1, P2, P3, P4] = src;
      const midTop = [(P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2];
      const midBot = [(P4[0] + P3[0]) / 2, (P4[1] + P3[1]) / 2];

      ctx.beginPath();
      ctx.moveTo(midTop[0], midTop[1]);
      ctx.lineTo(midBot[0], midBot[1]);
      ctx.lineWidth = Math.max(3.5, canvasWidth * 0.004);
      ctx.strokeStyle = "rgba(0, 136, 255, 0.75)";
      ctx.stroke();
    }

    // 3. Draw Transverse Boundary Lines across the pitch
    if (showLines) {
      for (const line of distanceLines) {
        const [xL, yL] = line.leftPoint;
        const [xR, yR] = line.rightPoint;

        ctx.beginPath();
        ctx.moveTo(xL, yL);
        ctx.lineTo(xR, yR);
        ctx.lineWidth = Math.max(2.0, canvasWidth * 0.002);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.stroke();

        // White crease dash / tick marks on edges
        const dotRadius = Math.max(3.0, canvasWidth * 0.003);
        ctx.beginPath();
        ctx.arc(xL, yL, dotRadius, 0, Math.PI * 2);
        ctx.arc(xR, yR, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    }

    // 4. Glowing Cyan Pitch Boundary
    if (src && src.length === 4) {
      const [P1, P2, P3, P4] = src;
      ctx.beginPath();
      ctx.moveTo(P1[0], P1[1]);
      ctx.lineTo(P2[0], P2[1]);
      ctx.lineTo(P3[0], P3[1]);
      ctx.lineTo(P4[0], P4[1]);
      ctx.closePath();
      ctx.lineWidth = Math.max(2.0, canvasWidth * 0.0025);
      ctx.strokeStyle = "rgba(0, 210, 255, 0.85)";
      ctx.stroke();
    }

    // 5. Draw Left-side Meter Labels (STUMPS, 2M, 4M, 6M, 8M, HALFWAY) matching reference image
    if (showLabels) {
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      for (const line of distanceLines) {
        const [xL, yL] = line.leftPoint;

        const labelX = xL - Math.max(8, canvasWidth * 0.012);
        const labelY = yL;

        ctx.font = `900 ${meterFontSize}px 'Inter', 'Segoe UI', Arial, sans-serif`;
        ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.fillStyle = "#ffffff";
        ctx.fillText(line.label, labelX, labelY);

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      // 6. Draw Right/Center Zone Names (FULL TOSS, YORKER, HALF VOLLEY, FULL, LENGTH, SHORT)
      for (const zone of zones) {
        const [xR, yR] = zone.rightMid;

        const labelX = xR - Math.max(12, canvasWidth * 0.016);
        const labelY = yR;

        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.font = `800 ${zoneFontSize}px 'Inter', 'Segoe UI', Arial, sans-serif`;
        ctx.shadowColor = "rgba(0, 0, 0, 0.90)";
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.fillStyle = "rgba(255, 255, 255, 0.90)";
        ctx.fillText(zone.name, labelX, labelY);

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
    }

    // 7. Draw the 4 FIXED CORNER PINS (Concentric cyan rings + white center)
    // As requested: the saved video clearly shows the user's fixed points!
    if (src && src.length === 4) {
      const pinRadius = Math.max(12, canvasWidth * 0.016);
      for (const pt of src) {
        const [px, py] = pt;

        // Outer cyan glow
        ctx.beginPath();
        ctx.arc(px, py, pinRadius + 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 210, 255, 0.25)";
        ctx.fill();

        // Outer cyan ring
        ctx.beginPath();
        ctx.arc(px, py, pinRadius, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(2.0, canvasWidth * 0.0025);
        ctx.strokeStyle = "#00d2ff";
        ctx.stroke();

        // Inner white dot
        ctx.beginPath();
        ctx.arc(px, py, Math.max(3.5, pinRadius * 0.28), 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
