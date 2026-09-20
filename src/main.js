/**
 * TrackAI / FullTrack - Main Application Controller
 * Features:
 * - 4-Tab Navigation (Home, Track, Sessions, Insights)
 * - FullTrack AI Session Browser in Track tab with Yellow '+' FAB
 * - Create Session modal: session name, ball type, multi-bowler setup with Fast/Spin order
 * - Real-time active bowler HUD and delivery logging
 * - Pitch calibration & delivery review with perspective broadcast zones
 */

import { CalibrationState } from "./calibration_state.js";
import { CalibrationCanvas } from "./calibration_canvas.js";
import { PitchOverlay } from "./pitch_overlay.js";
import { VideoRecorder } from "./recorder.js";
import { SessionManager } from "./session_manager.js";

class TrackAIApp {
  constructor() {
    // DOM Elements - Video & Stages
    this.video = document.getElementById("mainVideo");
    this.calibCanvas = document.getElementById("calibrationCanvas");
    this.overlayCanvas = document.getElementById("overlayCanvas");
    this.overlayCtx = this.overlayCanvas.getContext("2d");

    // Core Engines
    this.sessionMgr = new SessionManager();
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

    // App & Tab State
    this.activeTab = "tabHome"; // "tabHome" | "tabTrack" | "tabSessions" | "tabInsights"
    this.trackViewMode = "browser"; // "browser" (FullTrack Grid) | "stage" (Camera/Pitch Calibration)
    this.appState = "calibrate"; // "calibrate" | "ready" | "recording" | "review"
    this.recTimerInterval = null;

    // Temporary create session state
    this.createSessionMode = "solo"; // "solo" (1 player) | "team" (multiple players)
    this.createSessionBowlers = [
      { id: "b1", name: "Player 1", style: "fast" }
    ];

    // FPS calculation
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.currentFps = 48;

    this.bindDomElements();
    this.init();
  }

  bindDomElements() {
    // Tabs & Navigation
    this.tabHome = document.getElementById("tabHome");
    this.tabTrack = document.getElementById("tabTrack");
    this.tabSessions = document.getElementById("tabSessions");
    this.tabInsights = document.getElementById("tabInsights");

    this.navButtons = {
      tabHome: document.getElementById("navHome"),
      tabTrack: document.getElementById("navTrack"),
      tabSessions: document.getElementById("navSessions"),
      tabInsights: document.getElementById("navInsights"),
    };

    // Home Tab
    this.btnHeroStartTracking = document.getElementById("btnHeroStartTracking");
    this.btnOpenProfile = document.getElementById("btnOpenProfile");
    this.profileDrawer = document.getElementById("profileDrawer");
    this.btnCloseProfileDrawer = document.getElementById("btnCloseProfileDrawer");
    this.btnViewRecentAnalysis = document.getElementById("btnViewRecentAnalysis");
    this.btnSeeProgressDetails = document.getElementById("btnSeeProgressDetails");
    this.btnViewAllWeek = document.getElementById("btnViewAllWeek");

    // Track Tab Subviews
    this.trackSessionBrowser = document.getElementById("trackSessionBrowser");
    this.stageContainer = document.getElementById("stageContainer");
    this.ftSessionsGrid = document.getElementById("ftSessionsGrid");
    this.btnOpenCreateSessionModal = document.getElementById("btnOpenCreateSessionModal");
    this.btnBackToSessionsBrowser = document.getElementById("btnBackToSessionsBrowser");

    // Create Session Modal
    this.modalCreateSession = document.getElementById("modalCreateSession");
    this.btnCloseCreateSessionModal = document.getElementById("btnCloseCreateSessionModal");
    this.btnModeSolo = document.getElementById("btnModeSolo");
    this.btnModeTeam = document.getElementById("btnModeTeam");
    this.labelBowlersHeadline = document.getElementById("labelBowlersHeadline");
    this.bowlersOrderHint = document.getElementById("bowlersOrderHint");
    this.inputSessionName = document.getElementById("inputSessionName");
    this.bowlersRosterList = document.getElementById("bowlersRosterList");
    this.btnAddBowlerRow = document.getElementById("btnAddBowlerRow");
    this.btnSubmitCreateSession = document.getElementById("btnSubmitCreateSession");

    // Active Bowler HUD & Switcher
    this.btnSwitchBowler = document.getElementById("btnSwitchBowler");
    this.hudBowlerIcon = document.getElementById("hudBowlerIcon");
    this.hudBowlerName = document.getElementById("hudBowlerName");
    this.hudBowlerStyle = document.getElementById("hudBowlerStyle");
    this.modalSwitchBowler = document.getElementById("modalSwitchBowler");
    this.btnCloseSwitchBowlerModal = document.getElementById("btnCloseSwitchBowlerModal");
    this.switchBowlerList = document.getElementById("switchBowlerList");

    // Track Stage Overlays & Controls
    this.statusPill = document.getElementById("statusPill");
    this.statusDot = document.getElementById("statusDot");
    this.statusTitle = document.getElementById("statusTitle");
    this.statusSubtitle = document.getElementById("statusSubtitle");
    this.valFPS = document.getElementById("valFPS");

    this.btnMainAction = document.getElementById("btnMainAction");
    this.mainActionText = document.getElementById("mainActionText");
    this.btnOpenRecordings = document.getElementById("btnOpenRecordings");
    this.recordingsCountBadge = document.getElementById("recordingsCountBadge");
    this.bottomHint = document.getElementById("bottomHint");

    this.recIndicator = document.getElementById("recIndicator");
    this.recTimerText = document.getElementById("recTimerText");

    this.playbackTimeline = document.getElementById("playbackTimeline");
    this.btnPlayPause = document.getElementById("btnPlayPause");
    this.videoScrubber = document.getElementById("videoScrubber");
    this.timeDisplay = document.getElementById("timeDisplay");

    // Sessions & Drawers
    this.recordingsDrawer = document.getElementById("recordingsDrawer");
    this.btnCloseDrawer = document.getElementById("btnCloseDrawer");
    this.recordingsList = document.getElementById("recordingsList");
    this.recordingsEmptyState = document.getElementById("recordingsEmptyState");
    this.drawerCountBadge = document.getElementById("drawerCountBadge");
    this.sessionDrawerTitle = document.getElementById("sessionDrawerTitle");
    this.tabSessionsList = document.getElementById("tabSessionsList");

    this.btnGrantCamera = document.getElementById("btnGrantCamera");
    if (this.btnGrantCamera) {
      this.btnGrantCamera.addEventListener("click", () => this.startLiveCamera());
    }

    // Attach Event Listeners
    // Bottom Tab Bar
    Object.entries(this.navButtons).forEach(([tabKey, btn]) => {
      if (btn) {
        btn.addEventListener("click", () => this.switchTab(tabKey));
      }
    });

    // Home Action Handlers
    this.btnHeroStartTracking.addEventListener("click", () => {
      this.switchTab("tabTrack");
      this.openCreateSessionModal();
    });

    this.btnOpenProfile.addEventListener("click", () => {
      this.profileDrawer.style.display = "flex";
    });
    this.btnCloseProfileDrawer.addEventListener("click", () => {
      this.profileDrawer.style.display = "none";
    });

    if (this.btnViewRecentAnalysis) {
      this.btnViewRecentAnalysis.addEventListener("click", () => this.switchTab("tabInsights"));
    }
    if (this.btnSeeProgressDetails) {
      this.btnSeeProgressDetails.addEventListener("click", () => this.switchTab("tabInsights"));
    }
    if (this.btnViewAllWeek) {
      this.btnViewAllWeek.addEventListener("click", () => this.switchTab("tabSessions"));
    }

    // FullTrack Session Browser Listeners
    this.btnOpenCreateSessionModal.addEventListener("click", () => {
      this.openCreateSessionModal();
    });

    this.btnBackToSessionsBrowser.addEventListener("click", () => {
      this.exitLiveStageToBrowser();
    });

    // Create Session Modal Listeners
    this.btnCloseCreateSessionModal.addEventListener("click", () => {
      this.modalCreateSession.style.display = "none";
    });

    if (this.btnModeSolo) {
      this.btnModeSolo.addEventListener("click", () => this.setCreateSessionMode("solo"));
    }
    if (this.btnModeTeam) {
      this.btnModeTeam.addEventListener("click", () => this.setCreateSessionMode("team"));
    }

    this.btnAddBowlerRow.addEventListener("click", () => {
      this.addBowlerRow();
    });

    this.btnSubmitCreateSession.addEventListener("click", () => {
      this.handleCreateSessionSubmit();
    });

    // Active Bowler Switcher
    this.btnSwitchBowler.addEventListener("click", () => {
      this.openSwitchBowlerModal();
    });
    this.btnCloseSwitchBowlerModal.addEventListener("click", () => {
      this.modalSwitchBowler.style.display = "none";
    });

    // Status pill re-calibrate
    this.statusPill.addEventListener("click", () => {
      if (this.appState === "ready" || this.appState === "review") {
        this.appState = "calibrate";
        this.updateUIState();
      }
    });

    // Stage Controls
    this.btnMainAction.addEventListener("click", () => this.handleMainAction());
    this.btnOpenRecordings.addEventListener("click", () => this.openRecordingsDrawer());
    this.btnCloseDrawer.addEventListener("click", () => this.closeRecordingsDrawer());

    this.btnPlayPause.addEventListener("click", () => this.togglePlayPause());
    this.videoScrubber.addEventListener("input", () => this.handleScrubbing());

    this.video.addEventListener("loadedmetadata", () => this.onVideoMetadataLoaded());
    this.video.addEventListener("timeupdate", () => this.updateScrubber());
    this.video.addEventListener("play", () => this.btnPlayPause.textContent = "⏸");
    this.video.addEventListener("pause", () => this.btnPlayPause.textContent = "▶");
    this.video.addEventListener("ended", () => this.btnPlayPause.textContent = "▶");

    window.addEventListener("resize", () => {
      if (this.activeTab === "tabTrack" && this.trackViewMode === "stage") {
        this.syncCanvasDimensions();
      }
    });
  }

  async init() {
    this.renderFullTrackSessionGrid();
    this.switchTab("tabHome");
    this.startRenderLoop();
  }

  /**
   * Switches active bottom navigation tab.
   */
  async switchTab(tabId) {
    this.activeTab = tabId;

    const tabs = [this.tabHome, this.tabTrack, this.tabSessions, this.tabInsights];
    tabs.forEach(tab => {
      if (tab) {
        if (tab.id === tabId) {
          tab.classList.add("active");
        } else {
          tab.classList.remove("active");
        }
      }
    });

    Object.entries(this.navButtons).forEach(([key, btn]) => {
      if (btn) {
        if (key === tabId) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    });

    if (tabId === "tabTrack") {
      this.renderFullTrackSessionGrid();
    } else {
      if (this.trackViewMode === "stage" && this.appState !== "recording") {
        this.recorder.stopCamera();
      }
    }

    if (tabId === "tabSessions") {
      this.renderTabSessionsList();
    }
  }

  // =======================================================
  // FULLTRACK SESSION BROWSER & MODAL
  // =======================================================

  renderFullTrackSessionGrid() {
    if (!this.ftSessionsGrid) return;
    const sessions = this.sessionMgr.getAllSessions();

    this.ftSessionsGrid.innerHTML = "";

    if (sessions.length === 0) {
      const emptyCard = document.createElement("div");
      emptyCard.className = "pro-empty-sessions-card";
      emptyCard.innerHTML = `
        <div class="pro-empty-illustration">
          <img src="/images/session_pitch_card.jpg" alt="Cricket Pitch" class="pro-empty-banner-img">
          <div class="pro-empty-banner-overlay"></div>
          <div class="pro-empty-badge">FULLTRACK SESSIONS</div>
        </div>
        <div class="pro-empty-content">
          <h4>No Sessions Recorded</h4>
          <p>Tap the + button to create a new bowling session and calibrate the pitch.</p>
          <button type="button" class="pro-empty-cta-btn" id="btnEmptyCreateSession">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Create First Session</span>
          </button>
        </div>
      `;

      emptyCard.querySelector("#btnEmptyCreateSession").addEventListener("click", () => {
        this.openCreateSessionModal();
      });

      this.ftSessionsGrid.appendChild(emptyCard);

      const countText = document.getElementById("ftSessionCountText");
      if (countText) {
        countText.textContent = `0 recorded`;
      }
      return;
    }

    sessions.forEach(sess => {
      const card = document.createElement("div");
      card.className = "pro-session-card";
      
      const isResume = sess.status === "in_progress" || (sess.deliveries && sess.deliveries.length > 0);
      const count = sess.deliveries ? sess.deliveries.length : 0;
      const bowlerCount = sess.bowlers ? sess.bowlers.length : 1;
      const isSolo = sess.mode === "solo" || bowlerCount === 1;
      const modeLabel = isSolo ? "Solo" : `Team (${bowlerCount} players)`;

      card.innerHTML = `
        <div class="pro-card-pitch-header">
          <img src="/images/session_pitch_card.jpg" alt="Cricket Pitch" class="pro-card-pitch-img">
          <div class="pro-card-pitch-overlay"></div>
          ${isResume ? `<span class="pro-resume-badge">Resume</span>` : ""}
        </div>
        <div class="pro-card-body">
          <span class="pro-card-title">${sess.name}</span>
          <span class="pro-card-time">${sess.date} • ${sess.time}</span>
          <div class="pro-card-meta-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span>${modeLabel} • ${count} ${count === 1 ? 'ball' : 'balls'}</span>
          </div>
        </div>
      `;

      card.addEventListener("click", () => {
        this.resumeSession(sess.id);
      });

      this.ftSessionsGrid.appendChild(card);
    });

    const countText = document.getElementById("ftSessionCountText");
    if (countText) {
      countText.textContent = `${sessions.length} recorded`;
    }
  }

  setCreateSessionMode(mode) {
    this.createSessionMode = mode;
    const now = new Date();
    const dayStr = now.toLocaleDateString("en-GB", { weekday: "short" });

    if (mode === "solo") {
      if (this.btnModeSolo) this.btnModeSolo.classList.add("active");
      if (this.btnModeTeam) this.btnModeTeam.classList.remove("active");
      if (this.btnAddBowlerRow) this.btnAddBowlerRow.style.display = "none";
      if (this.bowlersOrderHint) this.bowlersOrderHint.style.display = "none";
      if (this.labelBowlersHeadline) this.labelBowlersHeadline.textContent = "Player & Bowling Style";
      this.inputSessionName.value = `Solo Session ${dayStr}`;

      // Limit to 1 bowler for solo session
      if (this.createSessionBowlers.length > 1) {
        this.createSessionBowlers = [this.createSessionBowlers[0]];
      }
    } else {
      if (this.btnModeTeam) this.btnModeTeam.classList.add("active");
      if (this.btnModeSolo) this.btnModeSolo.classList.remove("active");
      if (this.btnAddBowlerRow) this.btnAddBowlerRow.style.display = "block";
      if (this.bowlersOrderHint) this.bowlersOrderHint.style.display = "flex";
      if (this.labelBowlersHeadline) this.labelBowlersHeadline.textContent = "Bowler Rotation Order & Style";
      this.inputSessionName.value = `Team Session ${dayStr}`;

      // For team session, ensure at least 2 players are seeded
      if (this.createSessionBowlers.length < 2) {
        this.createSessionBowlers.push({
          id: `b_${Date.now()}_2`,
          name: "Player 2",
          style: "spin"
        });
      }
    }

    this.renderBowlerRosterInputs();
  }

  openCreateSessionModal() {
    this.setCreateSessionMode(this.createSessionMode || "solo");
    this.modalCreateSession.style.display = "flex";
  }

  renderBowlerRosterInputs() {
    if (!this.bowlersRosterList) return;
    this.bowlersRosterList.innerHTML = "";

    const isSolo = this.createSessionMode === "solo";

    this.createSessionBowlers.forEach((b, idx) => {
      const row = document.createElement("div");
      row.className = "pro-bowler-row";
      row.innerHTML = `
        <span class="pro-order-circle" title="Bowling Order #${idx + 1}">${idx + 1}</span>
        <input type="text" class="pro-bowler-field" data-idx="${idx}" value="${b.name}" placeholder="Player Name">
        <div class="pro-style-segment">
          <button type="button" class="pro-segment-btn ${b.style === 'fast' ? 'active' : ''}" data-style="fast" data-idx="${idx}">Fast</button>
          <button type="button" class="pro-segment-btn ${b.style === 'spin' ? 'active' : ''}" data-style="spin" data-idx="${idx}">Spin</button>
        </div>
        ${(!isSolo && this.createSessionBowlers.length > 2) ? `<button type="button" class="pro-row-del-btn" data-del="${idx}" title="Remove">✕</button>` : ""}
      `;

      row.querySelector(".pro-bowler-field").addEventListener("input", (e) => {
        this.createSessionBowlers[idx].name = e.target.value.trim() || `Player ${idx + 1}`;
      });

      row.querySelectorAll(".pro-segment-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const style = btn.getAttribute("data-style");
          this.createSessionBowlers[idx].style = style;
          this.renderBowlerRosterInputs();
        });
      });

      const delBtn = row.querySelector(`[data-del="${idx}"]`);
      if (delBtn) {
        delBtn.addEventListener("click", () => {
          this.createSessionBowlers.splice(idx, 1);
          this.renderBowlerRosterInputs();
        });
      }

      this.bowlersRosterList.appendChild(row);
    });
  }

  addBowlerRow() {
    const nextNum = this.createSessionBowlers.length + 1;
    this.createSessionBowlers.push({
      id: `b_${Date.now()}_${nextNum}`,
      name: `Player ${nextNum}`,
      style: nextNum % 2 === 0 ? "spin" : "fast"
    });
    this.renderBowlerRosterInputs();
  }

  handleCreateSessionSubmit() {
    const defaultName = this.createSessionMode === "solo" ? "Solo Session" : "Team Session";
    const sessionName = this.inputSessionName.value.trim() || defaultName;
    const session = this.sessionMgr.createSession({
      name: sessionName,
      mode: this.createSessionMode,
      bowlers: this.createSessionBowlers
    });

    this.modalCreateSession.style.display = "none";
    this.startSessionLiveStage(session);
  }

  resumeSession(sessionId) {
    const session = this.sessionMgr.setActiveSession(sessionId);
    if (session) {
      this.startSessionLiveStage(session);
    }
  }

  async startSessionLiveStage(session) {
    this.trackViewMode = "stage";
    this.trackSessionBrowser.style.display = "none";
    this.stageContainer.style.display = "block";

    this.updateActiveBowlerHUD();
    this.updateRecordingsBadge();

    // Start live back camera for this session
    await this.startLiveCamera();
  }

  exitLiveStageToBrowser() {
    this.trackViewMode = "browser";
    this.stageContainer.style.display = "none";
    this.trackSessionBrowser.style.display = "block";
    this.recorder.stopCamera();
    this.renderFullTrackSessionGrid();
  }

  updateActiveBowlerHUD() {
    const bowler = this.sessionMgr.getCurrentBowler();
    const session = this.sessionMgr.getActiveSession();
    const ballNum = session ? (session.deliveries.length + 1) : 1;
    const isMultiBowler = session && session.bowlers && session.bowlers.length > 1;

    this.hudBowlerIcon.textContent = bowler.style === "spin" ? "SPIN" : "FAST";
    this.hudBowlerName.textContent = bowler.name;
    const orderText = isMultiBowler 
      ? `Order #${this.sessionMgr.currentBowlerIndex + 1}/${session.bowlers.length} • Ball #${ballNum}`
      : `Ball #${ballNum}`;
    this.hudBowlerStyle.textContent = `${bowler.style.toUpperCase()} • ${orderText}`;
  }

  openSwitchBowlerModal() {
    const session = this.sessionMgr.getActiveSession();
    if (!session || !session.bowlers) return;

    this.switchBowlerList.innerHTML = "";
    session.bowlers.forEach((b, idx) => {
      const isCurrent = idx === this.sessionMgr.currentBowlerIndex;
      const item = document.createElement("button");
      item.className = `modal-option-btn ${isCurrent ? 'active' : ''}`;
      item.innerHTML = `
        <div class="opt-text" style="text-align: left; width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #0f172a; font-size: 14px;">${b.name}</strong>
            <span style="font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px; background: ${b.style === 'spin' ? '#e0f2fe' : '#fef3c7'}; color: ${b.style === 'spin' ? '#0369a1' : '#b45309'}; text-transform: uppercase;">${b.style}</span>
          </div>
          <small style="color: #64748b; font-size: 12px; margin-top: 2px; display: block;">Bowler #${idx + 1} in order</small>
        </div>
      `;

      item.addEventListener("click", () => {
        this.sessionMgr.setBowlerIndex(idx);
        this.updateActiveBowlerHUD();
        this.modalSwitchBowler.style.display = "none";
      });

      this.switchBowlerList.appendChild(item);
    });

    this.modalSwitchBowler.style.display = "flex";
  }

  // =======================================================
  // CAMERA & PITCH CALIBRATION ENGINE
  // =======================================================

  async startLiveCamera() {
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

  async handleMainAction() {
    if (this.appState === "calibrate") {
      const res = this.state.confirm();
      if (!res.success) {
        alert(res.message);
        return;
      }
      this.appState = "ready";
      this.updateUIState();
    } else if (this.appState === "ready") {
      this.startRecordingDelivery();
    } else if (this.appState === "recording") {
      this.stopRecordingDelivery();
    } else if (this.appState === "review") {
      // Rotate to next bowler in rotation for next ball
      this.sessionMgr.rotateBowler();
      this.updateActiveBowlerHUD();
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
    this.updateHint("Saving delivery to active session...");
  }

  onDeliveryRecorded(blob, url) {
    const duration = this.recorder.getRecordingDurationSeconds() || 3.5;

    // Save into active session with current bowler & style
    const delivery = this.sessionMgr.addDelivery({
      duration: `${duration.toFixed(1)}s`,
      blob,
      url,
      calibration: this.state.exportNormalized()
    });

    // Load recorded video into player for review
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
      const session = this.sessionMgr.getActiveSession();
      const bowler = this.sessionMgr.getCurrentBowler();
      const isMultiBowler = session && session.bowlers && session.bowlers.length > 1;
      const nextBowler = this.sessionMgr.getNextBowler();

      this.statusDot.className = "status-dot";
      this.statusTitle.textContent = "DELIVERY SAVED";
      this.statusSubtitle.textContent = `${bowler.name} • ${bowler.style.toUpperCase()}`;

      if (isMultiBowler) {
        this.mainActionText.textContent = `NEXT: ${nextBowler.name.toUpperCase()}`;
        this.bottomHint.textContent = `Saved for ${bowler.name} • Up next in order: ${nextBowler.name} (${nextBowler.style.toUpperCase()})`;
      } else {
        this.mainActionText.textContent = "NEXT DELIVERY";
        this.bottomHint.textContent = `Delivery saved for ${bowler.name} • Tap Next Delivery`;
      }

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
    const session = this.sessionMgr.getActiveSession();
    const count = session && session.deliveries ? session.deliveries.length : 0;
    if (this.recordingsCountBadge) this.recordingsCountBadge.textContent = count;
    if (this.drawerCountBadge) this.drawerCountBadge.textContent = `${count} balls`;
    if (this.sessionDrawerTitle) this.sessionDrawerTitle.textContent = session ? session.name : "Session Deliveries";
  }

  openRecordingsDrawer() {
    this.recordingsDrawer.style.display = "flex";
    this.renderSessionDeliveriesList();
  }

  closeRecordingsDrawer() {
    this.recordingsDrawer.style.display = "none";
  }

  renderSessionDeliveriesList() {
    const session = this.sessionMgr.getActiveSession();
    const deliveries = session ? session.deliveries || [] : [];

    if (deliveries.length === 0) {
      this.recordingsEmptyState.style.display = "block";
      this.recordingsList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🏏</span>
          <p>No recorded deliveries yet in ${session ? session.name : 'this session'}.</p>
          <small>Tap "START TRACKING" to record a delivery.</small>
        </div>
      `;
      return;
    }

    this.recordingsEmptyState.style.display = "none";
    this.recordingsList.innerHTML = "";

    deliveries.forEach((del, idx) => {
      const card = document.createElement("div");
      card.className = "delivery-card";
      card.innerHTML = `
        <div class="delivery-info">
          <span class="delivery-title">Ball #${del.ballNumber} • ${del.bowler.name} (${del.bowler.style === 'spin' ? '🔄 Spin' : '⚡ Fast'})</span>
          <span class="delivery-meta">${del.time} • ${del.speed} km/h • ${del.lengthZone}</span>
        </div>
        <div class="delivery-actions">
          ${del.url ? `<button class="btn-card-action" data-play="${idx}">▶ Review</button>` : ""}
          ${del.url ? `<button class="btn-card-action" style="background:#475569;" data-dl="${idx}">⬇</button>` : ""}
        </div>
      `;

      if (del.url) {
        card.querySelector(`[data-play="${idx}"]`).addEventListener("click", () => {
          this.playSavedDelivery(del);
          this.closeRecordingsDrawer();
        });

        card.querySelector(`[data-dl="${idx}"]`).addEventListener("click", () => {
          this.downloadDelivery(del);
        });
      }

      this.recordingsList.appendChild(card);
    });
  }

  renderTabSessionsList() {
    if (!this.tabSessionsList) return;
    const sessions = this.sessionMgr.getAllSessions();

    this.tabSessionsList.innerHTML = "";

    if (sessions.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "pro-empty-sessions-card";
      emptyDiv.style.margin = "10px 0 20px 0";
      emptyDiv.innerHTML = `
        <div class="pro-empty-illustration">
          <img src="/images/session_pitch_card.jpg" alt="Cricket Pitch" class="pro-empty-banner-img">
          <div class="pro-empty-banner-overlay"></div>
          <div class="pro-empty-badge">SESSION LOGS</div>
        </div>
        <div class="pro-empty-content">
          <h4>No Bowling Sessions</h4>
          <p>Deliveries and stats will appear here once you track a bowling session.</p>
          <button type="button" class="pro-empty-cta-btn" id="btnTabSessionsCreate">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Start Session in Track</span>
          </button>
        </div>
      `;

      emptyDiv.querySelector("#btnTabSessionsCreate").addEventListener("click", () => {
        this.switchTab("tabTrack");
        this.openCreateSessionModal();
      });

      this.tabSessionsList.appendChild(emptyDiv);
      return;
    }

    sessions.forEach(sess => {
      const card = document.createElement("div");
      card.className = "insights-card";
      card.style.marginBottom = "14px";
      card.style.overflow = "hidden";

      const ballCount = sess.deliveries ? sess.deliveries.length : 0;
      const bowlerList = sess.bowlers ? sess.bowlers.map(b => `${b.name} (${b.style.toUpperCase()})`).join(", ") : "Srinivas";

      card.innerHTML = `
        <div style="height: 100px; position: relative; overflow: hidden; margin: -16px -16px 14px -16px;">
          <img src="/images/session_pitch_card.jpg" style="width: 100%; height: 100%; object-fit: cover;" alt="Session Cover">
          <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.5) 100%);"></div>
          <span style="position: absolute; bottom: 8px; left: 12px; color: #ffffff; font-size: 11px; font-weight: 800; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); padding: 2px 8px; border-radius: 4px;">${sess.date}</span>
        </div>
        <div class="insights-card-header">
          <div>
            <h4 style="font-size: 16px; margin-bottom: 2px;">${sess.name}</h4>
            <span style="font-size: 12px; color: #64748b;">${sess.date} • ${sess.time}</span>
          </div>
          <button class="view-analysis-pill-btn" data-resumesess="${sess.id}">
            <span>Open Session</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0066ff" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
        <div style="font-size: 12.5px; color: #334155; margin-bottom: 8px;">
          <strong>Bowlers:</strong> ${bowlerList}
        </div>
        <div style="font-size: 12px; color: #0284c7; font-weight: 700;">
          ${ballCount} ${ballCount === 1 ? 'delivery' : 'deliveries'} recorded
        </div>
      `;

      card.querySelector(`[data-resumesess="${sess.id}"]`).addEventListener("click", () => {
        this.switchTab("tabTrack");
        this.resumeSession(sess.id);
      });

      this.tabSessionsList.appendChild(card);
    });
  }

  playSavedDelivery(del) {
    if (!del.url) return;

    if (del.calibration) {
      this.state.importNormalized(del.calibration);
    }

    this.video.srcObject = null;
    this.video.src = del.url;
    this.video.loop = true;
    this.video.play().catch(e => console.warn("Review play:", e));

    this.appState = "review";
    this.updateUIState();
  }

  downloadDelivery(del) {
    if (!del.url) return;
    const a = document.createElement("a");
    a.href = del.url;
    a.download = `delivery_${del.ballNumber}_${del.bowler.name}_${Date.now()}.webm`;
    a.click();
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
      this.frameCount++;
      if (now - this.lastFrameTime >= 1000) {
        this.currentFps = this.frameCount;
        this.frameCount = 0;
        this.lastFrameTime = now;
        if (this.valFPS) this.valFPS.textContent = this.currentFps;
      }

      if (this.activeTab === "tabTrack" && this.trackViewMode === "stage" && !this.video.paused && !this.video.ended && this.appState === "review") {
        this.renderOverlay();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new TrackAIApp();
});
