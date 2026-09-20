/**
 * Cricket Pitch Calibration & Video Tracking Application Main Entry Point
 * Designed to match the exact mobile UI from the reference screenshot:
 * - Top-left status pill ("PITCH CALIBRATED - Ready for tracking")
 * - 3 Metric cards (Pitch 22yd, Camera Locked, FPS)
 * - Main action pill button ("START TRACKING")
 * - Right-side small button for Saved Recordings drawer
 */

import { CalibrationState } from "./calibration_state.js";
import { CalibrationCanvas } from "./calibration_canvas.js";
import { PitchOverlay } from "./pitch_overlay.js";
import { VideoRecorder } from "./recorder.js";

class PitchApp {
  constructor() {
    this.video = document.getElementById("mainVideo");
    this.calibCanvas = document.getElementById("calibrationCanvas");
    this.overlayCanvas = document.getElementById("overlayCanvas");
    this.overlayCtx = this.overlayCanvas.getContext("2d");

    // Core Engines
    this.state = new CalibrationState();
    this.canvasController = new CalibrationCanvas(
      this.calibCanvas,
      this.state,
      () => this.onPinsUpdated()
    );
    this.recorder = new VideoRecorder(
      this.video,
      (blob, url) => this.onDeliveryRecorded(blob, url)
    );

    // App State
    this.appState = "calibrate"; // "calibrate" | "ready" | "recording" | "review"
    this.savedRecordings = [];
    this.activeRecordingIndex = -1;
    this.recTimerInterval = null;

    // FPS calculation
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.currentFps = 30;

    this.bindDomElements();
    this.init();
  }

  bindDomElements() {
    // Top Bar elements
    this.statusPill = document.getElementById("statusPill");
    this.statusDot = document.getElementById("statusDot");
    this.statusTitle = document.getElementById("statusTitle");
    this.statusSubtitle = document.getElementById("statusSubtitle");
    this.valFPS = document.getElementById("valFPS");
    this.btnSourceMenu = document.getElementById("btnSourceMenu");

    // Action Controls
    this.btnMainAction = document.getElementById("btnMainAction");
    this.mainActionText = document.getElementById("mainActionText");
    this.btnOpenRecordings = document.getElementById("btnOpenRecordings");
    this.recordingsCountBadge = document.getElementById("recordingsCountBadge");
    this.bottomHint = document.getElementById("bottomHint");

    // Live Recording Pill
    this.recIndicator = document.getElementById("recIndicator");
    this.recTimerText = document.getElementById("recTimerText");

    // Playback timeline
    this.playbackTimeline = document.getElementById("playbackTimeline");
    this.btnPlayPause = document.getElementById("btnPlayPause");
    this.videoScrubber = document.getElementById("videoScrubber");
    this.timeDisplay = document.getElementById("timeDisplay");

    // Modals & Drawers
    this.sourceModal = document.getElementById("sourceModal");
    this.btnCloseSourceModal = document.getElementById("btnCloseSourceModal");
    this.btnSelectLiveCamera = document.getElementById("btnSelectLiveCamera");
    this.btnSelectSampleVideo = document.getElementById("btnSelectSampleVideo");
    this.fileUploadInput = document.getElementById("fileUploadInput");

    this.segBowlerBottom = document.getElementById("segBowlerBottom");
    this.segBowlerTop = document.getElementById("segBowlerTop");

    this.recordingsDrawer = document.getElementById("recordingsDrawer");
    this.btnCloseDrawer = document.getElementById("btnCloseDrawer");
    this.recordingsList = document.getElementById("recordingsList");
    this.recordingsEmptyState = document.getElementById("recordingsEmptyState");
    this.drawerCountBadge = document.getElementById("drawerCountBadge");

    this.btnGrantCamera = document.getElementById("btnGrantCamera");
    if (this.btnGrantCamera) {
      this.btnGrantCamera.addEventListener("click", () => this.startLiveCamera());
    }

    // Allow clicking status pill to re-calibrate anytime
    this.statusPill.addEventListener("click", () => {
      if (this.appState === "ready" || this.appState === "review") {
        this.appState = "calibrate";
        this.updateUIState();
      }
    });

    // Event Listeners
    this.btnMainAction.addEventListener("click", () => this.handleMainAction());
    this.btnOpenRecordings.addEventListener("click", () => this.openRecordingsDrawer());
    this.btnSourceMenu.addEventListener("click", () => this.openSourceModal());
    this.btnCloseSourceModal.addEventListener("click", () => this.closeSourceModal());
    this.btnCloseDrawer.addEventListener("click", () => this.closeRecordingsDrawer());

    this.btnSelectLiveCamera.addEventListener("click", () => this.startLiveCamera());
    this.btnSelectSampleVideo.addEventListener("click", () => this.loadSampleVideo());
    this.fileUploadInput.addEventListener("change", (e) => this.handleFileUpload(e));

    this.segBowlerBottom.addEventListener("click", () => this.setBowlerEnd("bottom"));
    this.segBowlerTop.addEventListener("click", () => this.setBowlerEnd("top"));

    this.btnPlayPause.addEventListener("click", () => this.togglePlayPause());
    this.videoScrubber.addEventListener("input", () => this.handleScrubbing());

    this.video.addEventListener("loadedmetadata", () => this.onVideoMetadataLoaded());
    this.video.addEventListener("timeupdate", () => this.updateScrubber());
    this.video.addEventListener("play", () => this.btnPlayPause.textContent = "⏸");
    this.video.addEventListener("pause", () => this.btnPlayPause.textContent = "▶");
    this.video.addEventListener("ended", () => this.btnPlayPause.textContent = "▶");

    window.addEventListener("resize", () => this.syncCanvasDimensions());
  }

  async init() {
    await this.startLiveCamera();
    this.startRenderLoop();
  }

  async loadSampleVideo() {
    this.recorder.stopCamera();
    this.closeSourceModal();
    const promptEl = document.getElementById("cameraPermissionPrompt");
    if (promptEl) promptEl.style.display = "none";

    this.video.srcObject = null;
    this.video.src = "/samples/sample_bowling.mp4";
    this.video.loop = true;
    this.appState = "calibrate";
    this.updateUIState();
    this.video.play().catch(e => console.warn("Sample play caught:", e));
  }

  async startLiveCamera() {
    this.closeSourceModal();
    this.updateHint("Starting back camera...");
    const promptEl = document.getElementById("cameraPermissionPrompt");

    const res = await this.recorder.startCamera();

    if (!res.success) {
      console.warn("Camera start failed, displaying permission prompt:", res.error);
      this.updateHint("Tap screen to allow back-camera access");
      if (promptEl) promptEl.style.display = "flex";
      return;
    }

    if (promptEl) promptEl.style.display = "none";

    const vw = this.video.videoWidth || 1080;
    const vh = this.video.videoHeight || 1920;

    this.syncCanvasDimensions();
    this.state.initDefaultPins(vw, vh);

    if (this.state.isConfirmed) {
      this.appState = "ready";
    } else {
      this.appState = "calibrate";
    }

    this.updateUIState();
  }

  handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.recorder.stopCamera();
    this.closeSourceModal();
    this.video.srcObject = null;
    this.video.src = URL.createObjectURL(file);
    this.video.loop = true;
    this.appState = "calibrate";
    this.updateUIState();
  }

  onVideoMetadataLoaded() {
    const vw = this.video.videoWidth || 1080;
    const vh = this.video.videoHeight || 1920;

    this.state.updateNativePoints(vw, vh);
    this.syncCanvasDimensions();
    this.updateUIState();
  }

  syncCanvasDimensions() {
    const video = this.video;
    const stage = document.getElementById("stageContainer");
    if (!stage) return;

    const containerW = stage.clientWidth;
    const containerH = stage.clientHeight;
    const vw = video.videoWidth || 1080;
    const vh = video.videoHeight || 1920;

    const videoAspect = vw / vh;
    const containerAspect = containerW / containerH;

    let displayW, displayH, left, top;

    if (containerAspect > videoAspect) {
      displayW = containerW;
      displayH = containerW / videoAspect;
      left = 0;
      top = (containerH - displayH) / 2;
    } else {
      displayH = containerH;
      displayW = containerH * videoAspect;
      top = 0;
      left = (containerW - displayW) / 2;
    }

    // Lock both video and canvas to the exact same physical coordinates
    video.style.position = "absolute";
    video.style.width = `${displayW}px`;
    video.style.height = `${displayH}px`;
    video.style.left = `${left}px`;
    video.style.top = `${top}px`;
    video.style.objectFit = "fill";

    const calib = this.calibCanvas;
    calib.style.position = "absolute";
    calib.style.width = `${displayW}px`;
    calib.style.height = `${displayH}px`;
    calib.style.left = `${left}px`;
    calib.style.top = `${top}px`;

    const overlay = this.overlayCanvas;
    overlay.style.position = "absolute";
    overlay.style.width = `${displayW}px`;
    overlay.style.height = `${displayH}px`;
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;

    this.canvasController.setVideoResolution(vw, vh);
    overlay.width = vw;
    overlay.height = vh;

    this.canvasController.render();
    this.renderOverlay();
  }

  onPinsUpdated() {
    this.updateUIState();
  }

  setBowlerEnd(end) {
    this.state.setBowlerEnd(end);
    if (end === "bottom") {
      this.segBowlerBottom.classList.add("active");
      this.segBowlerTop.classList.remove("active");
    } else {
      this.segBowlerTop.classList.add("active");
      this.segBowlerBottom.classList.remove("active");
    }
    this.canvasController.render();
    this.renderOverlay();
  }

  async handleMainAction() {
    if (this.appState === "calibrate") {
      // 1. Confirm Calibration
      const res = this.state.confirm();
      if (!res.success) {
        alert(res.message);
        return;
      }
      this.appState = "ready";
      this.updateUIState();
    } else if (this.appState === "ready") {
      // 2. Start Live Tracking / Recording
      this.startRecordingDelivery();
    } else if (this.appState === "recording") {
      // 3. Stop Recording
      this.stopRecordingDelivery();
    } else if (this.appState === "review") {
      // 4. Return to live camera for next delivery with PRESERVED calibration!
      this.updateHint("Restarting camera for next delivery...");
      await this.startLiveCamera();
    }
  }

  startRecordingDelivery() {
    if (!this.recorder.mediaStream) {
      this.recorder.mediaStream = this.video.captureStream ? this.video.captureStream() : null;
    }

    this.appState = "recording";
    this.recorder.startRecording();

    let sec = 0;
    this.recTimerText.textContent = "REC 00:00";
    this.recTimerInterval = setInterval(() => {
      sec++;
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      this.recTimerText.textContent = `REC ${mm}:${ss}`;
    }, 1000);

    this.updateUIState();
  }

  stopRecordingDelivery() {
    clearInterval(this.recTimerInterval);
    this.recorder.stopRecording();
    this.updateHint("Saving delivery with fixed pitch zones...");
  }

  onDeliveryRecorded(blob, url) {
    const deliveryIndex = this.savedRecordings.length + 1;
    const duration = this.recorder.getRecordingDurationSeconds() || 3.5;

    const recordingItem = {
      id: `delivery_${Date.now()}`,
      title: `Delivery #${deliveryIndex}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      duration: `${duration.toFixed(1)}s`,
      blob,
      url,
      calibration: this.state.exportNormalized()
    };

    this.savedRecordings.push(recordingItem);
    this.activeRecordingIndex = this.savedRecordings.length - 1;

    // Load recorded video into player
    this.video.srcObject = null;
    this.video.src = url;
    this.video.loop = true;
    this.video.play().catch(e => console.warn("Auto-play error:", e));

    this.appState = "review";
    this.updateRecordingsBadge();
    this.updateUIState();
  }

  updateUIState() {
    const val = this.state.validate();

    if (this.appState === "calibrate") {
      // Calibrating 4 points
      this.statusDot.className = val.valid ? "status-dot" : "status-dot uncalibrated";
      this.statusTitle.textContent = val.valid ? "PITCH DETECTED" : "CALIBRATING PITCH";
      this.statusSubtitle.textContent = val.valid ? "Tap Confirm Calibration" : "Drag 4 corners";

      this.mainActionText.textContent = "CONFIRM CALIBRATION";
      this.btnMainAction.className = "main-action-pill";
      this.bottomHint.textContent = "Drag 4 glowing corners to fit pitch • Tap Confirm";

      this.calibCanvas.style.display = "block";
      this.overlayCanvas.style.display = "none";
      this.recIndicator.style.display = "none";
      this.playbackTimeline.style.display = "none";

      this.canvasController.render();
    } else if (this.appState === "ready") {
      // Ready for tracking (matches screenshot)
      this.statusDot.className = "status-dot";
      this.statusTitle.textContent = "PITCH CALIBRATED";
      this.statusSubtitle.textContent = "Ready for tracking";

      this.mainActionText.textContent = "START TRACKING";
      this.btnMainAction.className = "main-action-pill";
      this.bottomHint.textContent = "Pitch calibrated • Tap to start tracking delivery";

      this.calibCanvas.style.display = "none";
      this.overlayCanvas.style.display = "none";
      this.recIndicator.style.display = "none";
      this.playbackTimeline.style.display = "none";
    } else if (this.appState === "recording") {
      // Recording delivery (completely clean screen as requested)
      this.statusDot.className = "status-dot";
      this.statusTitle.textContent = "RECORDING DELIVERY";
      this.statusSubtitle.textContent = "Tracking active";

      this.mainActionText.textContent = "STOP TRACKING";
      this.btnMainAction.className = "main-action-pill recording";
      this.bottomHint.textContent = "Recording live delivery cleanly • Tap to stop";

      this.calibCanvas.style.display = "none";
      this.overlayCanvas.style.display = "none";
      this.recIndicator.style.display = "flex";
      this.playbackTimeline.style.display = "none";
    } else if (this.appState === "review") {
      // Reviewing recorded delivery with broadcast zones overlay
      this.statusDot.className = "status-dot";
      this.statusTitle.textContent = "DELIVERY SAVED";
      this.statusSubtitle.textContent = "Reviewing pitch zones";

      this.mainActionText.textContent = "NEXT DELIVERY";
      this.btnMainAction.className = "main-action-pill";
      this.bottomHint.textContent = "Tap right button to view all saved recordings";

      this.calibCanvas.style.display = "none";
      this.overlayCanvas.style.display = "block";
      this.recIndicator.style.display = "none";
      this.playbackTimeline.style.display = "flex";

      this.renderOverlay();
    }
  }

  updateHint(text) {
    if (this.bottomHint) this.bottomHint.textContent = text;
  }

  updateRecordingsBadge() {
    const count = this.savedRecordings.length;
    this.recordingsCountBadge.textContent = count;
    this.drawerCountBadge.textContent = `${count} recorded`;
  }

  openRecordingsDrawer() {
    this.recordingsDrawer.style.display = "flex";
    this.renderRecordingsList();
  }

  closeRecordingsDrawer() {
    this.recordingsDrawer.style.display = "none";
  }

  openSourceModal() {
    this.sourceModal.style.display = "flex";
  }

  closeSourceModal() {
    this.sourceModal.style.display = "none";
  }

  renderRecordingsList() {
    if (this.savedRecordings.length === 0) {
      this.recordingsEmptyState.style.display = "block";
      this.recordingsList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🏏</span>
          <p>No recorded deliveries yet.</p>
          <small>Calibrate the pitch and tap "START TRACKING" to record a delivery.</small>
        </div>
      `;
      return;
    }

    this.recordingsEmptyState.style.display = "none";
    this.recordingsList.innerHTML = "";

    this.savedRecordings.forEach((rec, idx) => {
      const card = document.createElement("div");
      card.className = "delivery-card";
      card.innerHTML = `
        <div class="delivery-info">
          <span class="delivery-title">${rec.title}</span>
          <span class="delivery-meta">${rec.time} • ${rec.duration}</span>
        </div>
        <div class="delivery-actions">
          <button class="btn-card-action" data-play="${idx}">▶ Review</button>
          <button class="btn-card-action" style="background:#475569;" data-dl="${idx}">⬇ Save</button>
          <button class="btn-card-del" data-del="${idx}">🗑</button>
        </div>
      `;

      card.querySelector(`[data-play="${idx}"]`).addEventListener("click", () => {
        this.playSavedRecording(idx);
        this.closeRecordingsDrawer();
      });

      card.querySelector(`[data-dl="${idx}"]`).addEventListener("click", () => {
        this.downloadRecording(idx);
      });

      card.querySelector(`[data-del="${idx}"]`).addEventListener("click", () => {
        this.deleteRecording(idx);
      });

      this.recordingsList.appendChild(card);
    });
  }

  playSavedRecording(idx) {
    const rec = this.savedRecordings[idx];
    if (!rec) return;

    this.activeRecordingIndex = idx;
    if (rec.calibration) {
      this.state.importNormalized(rec.calibration);
    }

    this.video.srcObject = null;
    this.video.src = rec.url;
    this.video.loop = true;
    this.video.play().catch(e => console.warn("Review play:", e));

    this.appState = "review";
    this.updateUIState();
  }

  downloadRecording(idx) {
    const rec = this.savedRecordings[idx];
    if (!rec) return;

    const a = document.createElement("a");
    a.href = rec.url;
    a.download = `cricket_delivery_${idx + 1}_${Date.now()}.webm`;
    a.click();
  }

  deleteRecording(idx) {
    this.savedRecordings.splice(idx, 1);
    this.updateRecordingsBadge();
    this.renderRecordingsList();
  }

  togglePlayPause() {
    if (this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
  }

  updateScrubber() {
    if (!this.video.duration) return;
    const pct = (this.video.currentTime / this.video.duration) * 100;
    this.videoScrubber.value = pct;

    const cur = this.formatTime(this.video.currentTime);
    const dur = this.formatTime(this.video.duration);
    this.timeDisplay.textContent = `${cur} / ${dur}`;
  }

  handleScrubbing() {
    if (!this.video.duration) return;
    const target = (this.videoScrubber.value / 100) * this.video.duration;
    this.video.currentTime = target;
    this.renderOverlay();
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  renderOverlay() {
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (!this.state.pitchZones || this.appState === "recording" || this.appState === "calibrate") return;

    PitchOverlay.render(this.overlayCtx, this.state.pitchZones, {
      showLabels: true,
      showLines: true,
    });
  }

  startRenderLoop() {
    const loop = (now) => {
      // Calculate real FPS
      this.frameCount++;
      if (now - this.lastFrameTime >= 1000) {
        this.currentFps = this.frameCount;
        this.frameCount = 0;
        this.lastFrameTime = now;
        if (this.valFPS) this.valFPS.textContent = this.currentFps;
      }

      if (!this.video.paused && !this.video.ended && this.appState === "review") {
        this.renderOverlay();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new PitchApp();
});
