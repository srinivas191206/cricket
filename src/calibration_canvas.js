/**
 * Calibration Canvas Controller (Full Track AI / Screenshot Style)
 * Supports ultra-responsive mobile touch/mouse dragging using Pointer Events & Screen CSS Hit Testing.
 * Renders glowing neon cyan pins with concentric rings, blue center crease line,
 * transverse perspective grid lines, and smooth touch drag interaction.
 */

export class CalibrationCanvas {
  constructor(canvasElement, calibrationState, onUpdate) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.state = calibrationState;
    this.onUpdate = onUpdate;

    this.activePin = null;
    this.activePointerId = null;
    this.hoverPin = null;

    // Radius for visual rendering
    this.handleRadius = 18;
    // Touch hit radius in CSS screen pixels (finger friendly!)
    this.touchHitRadiusCss = 55;

    this.videoWidth = 1080;
    this.videoHeight = 1920;

    this.initEvents();
  }

  setVideoResolution(w, h) {
    if (w > 0 && h > 0) {
      this.videoWidth = w;
      this.videoHeight = h;
      this.canvas.width = w;
      this.canvas.height = h;
      this.state.updateNativePoints(w, h);
    }
  }

  clientToNative(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.videoWidth / (rect.width || 1);
    const scaleY = this.videoHeight / (rect.height || 1);

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return [
      Math.max(0, Math.min(this.videoWidth, x)),
      Math.max(0, Math.min(this.videoHeight, y)),
    ];
  }

  nativeToClient(nx, ny) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = (rect.width || 1) / this.videoWidth;
    const scaleY = (rect.height || 1) / this.videoHeight;

    return [
      rect.left + nx * scaleX,
      rect.top + ny * scaleY,
    ];
  }

  initEvents() {
    // Modern Pointer Events API (Touch, Mouse, Pen unified)
    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const hit = this.findPinAtScreenCoords(e.clientX, e.clientY);
      if (hit) {
        this.activePin = hit;
        this.activePointerId = e.pointerId;
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch (err) {
          // ignore if capture unsupported
        }
        const [nx, ny] = this.clientToNative(e.clientX, e.clientY);
        this.state.setPoint(hit, nx, ny);
        this.render();
        if (this.onUpdate) this.onUpdate();
      }
    }, { passive: false });

    this.canvas.addEventListener("pointermove", (e) => {
      if (this.activePin && e.pointerId === this.activePointerId) {
        e.preventDefault();
        const [nx, ny] = this.clientToNative(e.clientX, e.clientY);
        this.state.setPoint(this.activePin, nx, ny);
        this.render();
        if (this.onUpdate) this.onUpdate();
        return;
      }

      // Hover feedback (desktop / mouse)
      const hit = this.findPinAtScreenCoords(e.clientX, e.clientY);
      if (hit !== this.hoverPin) {
        this.hoverPin = hit;
        this.canvas.style.cursor = hit ? "grab" : "default";
        this.render();
      }
    }, { passive: false });

    const endPointer = (e) => {
      if (this.activePin && (!this.activePointerId || e.pointerId === this.activePointerId)) {
        try {
          if (this.canvas.hasPointerCapture && this.canvas.hasPointerCapture(e.pointerId)) {
            this.canvas.releasePointerCapture(e.pointerId);
          }
        } catch (err) {}
        this.activePin = null;
        this.activePointerId = null;
        this.render();
        if (this.onUpdate) this.onUpdate();
      }
    };

    this.canvas.addEventListener("pointerup", endPointer);
    this.canvas.addEventListener("pointercancel", endPointer);
    window.addEventListener("pointerup", endPointer);

    // Fallback standard touch listeners for older WebViews
    this.canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        const hit = this.findPinAtScreenCoords(touch.clientX, touch.clientY);
        if (hit) {
          this.activePin = hit;
          const [nx, ny] = this.clientToNative(touch.clientX, touch.clientY);
          this.state.setPoint(hit, nx, ny);
          this.render();
          if (this.onUpdate) this.onUpdate();
        }
      }
    }, { passive: false });

    window.addEventListener("touchmove", (e) => {
      if (this.activePin && e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        const [nx, ny] = this.clientToNative(touch.clientX, touch.clientY);
        this.state.setPoint(this.activePin, nx, ny);
        this.render();
        if (this.onUpdate) this.onUpdate();
      }
    }, { passive: false });

    window.addEventListener("touchend", () => {
      if (this.activePin) {
        this.activePin = null;
        this.render();
        if (this.onUpdate) this.onUpdate();
      }
    });
  }

  /**
   * Hit tests pins in Screen CSS Pixels so finger touches never miss.
   */
  findPinAtScreenCoords(clientX, clientY) {
    let closestKey = null;
    let minDistance = Infinity;

    for (const [key, pt] of Object.entries(this.state.points)) {
      if (!pt) continue;
      const [screenX, screenY] = this.nativeToClient(pt[0], pt[1]);
      const dist = Math.hypot(screenX - clientX, screenY - clientY);

      if (dist <= this.touchHitRadiusCss && dist < minDistance) {
        minDistance = dist;
        closestKey = key;
      }
    }

    return closestKey;
  }

  /**
   * Renders the pitch pins and perspective geometry.
   */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const { P1, P2, P3, P4 } = this.state.points;
    if (!P1 || !P2 || !P3 || !P4) return;

    ctx.save();

    // 1. Semi-transparent pitch surface tint
    ctx.beginPath();
    ctx.moveTo(P1[0], P1[1]);
    ctx.lineTo(P2[0], P2[1]);
    ctx.lineTo(P3[0], P3[1]);
    ctx.lineTo(P4[0], P4[1]);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 160, 255, 0.20)";
    ctx.fill();

    // 2. Center Crease Line down the middle (Vibrant Blue)
    const midTop = [(P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2];
    const midBot = [(P4[0] + P3[0]) / 2, (P4[1] + P3[1]) / 2];

    ctx.beginPath();
    ctx.moveTo(midTop[0], midTop[1]);
    ctx.lineTo(midBot[0], midBot[1]);
    ctx.lineWidth = Math.max(4, this.videoWidth * 0.005);
    ctx.strokeStyle = "#0088ff";
    ctx.stroke();

    // 3. Transverse perspective guide lines
    if (this.state.pitchZones) {
      const lines = this.state.pitchZones.getProjectedDistanceLines();
      for (const line of lines) {
        ctx.beginPath();
        ctx.moveTo(line.leftPoint[0], line.leftPoint[1]);
        ctx.lineTo(line.rightPoint[0], line.rightPoint[1]);
        ctx.lineWidth = Math.max(1.5, this.videoWidth * 0.002);
        ctx.strokeStyle = "rgba(0, 210, 255, 0.50)";
        ctx.stroke();
      }
    }

    // 4. Glowing Cyan Pitch Boundary Lines
    ctx.beginPath();
    ctx.moveTo(P1[0], P1[1]);
    ctx.lineTo(P2[0], P2[1]);
    ctx.lineTo(P3[0], P3[1]);
    ctx.lineTo(P4[0], P4[1]);
    ctx.closePath();

    ctx.lineWidth = Math.max(2.5, this.videoWidth * 0.003);
    ctx.strokeStyle = "#00d2ff";
    ctx.shadowColor = "rgba(0, 210, 255, 0.8)";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 5. Draggable Concentric Rings Pins matching reference screenshot
    const pins = [
      { key: "P1", pt: P1, label: "P1" },
      { key: "P2", pt: P2, label: "P2" },
      { key: "P3", pt: P3, label: "P3" },
      { key: "P4", pt: P4, label: "P4" },
    ];

    // Scale visual pin radius dynamically with resolution so it looks sharp on mobile
    const baseRadius = Math.max(16, this.videoWidth * 0.022);

    for (const pin of pins) {
      const [px, py] = pin.pt;
      const isActive = this.activePin === pin.key;
      const isHover = this.hoverPin === pin.key;

      // Outer glow pulse when active/hover
      ctx.beginPath();
      ctx.arc(px, py, baseRadius + (isActive ? 12 : isHover ? 6 : 2), 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "rgba(0, 210, 255, 0.40)" : "rgba(0, 210, 255, 0.22)";
      ctx.fill();

      // Outer cyan ring
      ctx.beginPath();
      ctx.arc(px, py, baseRadius, 0, Math.PI * 2);
      ctx.lineWidth = isActive ? 4.0 : 2.5;
      ctx.strokeStyle = "#00d2ff";
      ctx.stroke();

      // Inner white center circle
      ctx.beginPath();
      ctx.arc(px, py, Math.max(4.5, baseRadius * 0.28), 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // If active, draw floating badge so finger doesn't block point location
      if (isActive) {
        ctx.font = "bold 18px 'Inter', sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 6;
        ctx.textAlign = "center";
        ctx.fillText(pin.label, px, py - baseRadius - 12);
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  }
}
