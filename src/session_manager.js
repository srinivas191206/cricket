/**
 * TrackAI - Professional Session & Bowler Management Engine
 * Clean, lightweight, professional architecture without AI gimmicks.
 * Manages cricket sessions, multi-bowler rosters, and delivery records.
 */

export class SessionManager {
  constructor() {
    this.storageKey = "trackai_real_sessions_v1";
    this.sessions = [];
    this.activeSessionId = null;
    this.currentBowlerIndex = 0;

    this.load();
  }

  load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.sessions = JSON.parse(data).filter(s => !s.id.startsWith("sess_sample_"));
      }
    } catch (e) {
      console.warn("SessionManager load failed:", e);
      this.sessions = [];
    }
  }

  save() {
    try {
      const serializable = this.sessions.map(s => ({
        ...s,
        deliveries: (s.deliveries || []).map(d => ({
          ...d,
          blob: null,
          url: null
        }))
      }));
      localStorage.setItem(this.storageKey, JSON.stringify(serializable));
    } catch (e) {
      console.warn("SessionManager save failed:", e);
    }
  }

  /**
   * Creates a new session with bowlers list.
   */
  createSession({ name, mode = "solo", bowlers }) {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateGroup = now.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    const isSolo = mode === "solo";
    const roster = isSolo
      ? (bowlers && bowlers.length > 0 ? [bowlers[0]] : [{ id: "b1", name: "Player 1", style: "fast" }])
      : (bowlers && bowlers.length > 0 ? bowlers : [{ id: "b1", name: "Player 1", style: "fast" }]);

    const newSession = {
      id: `session_${Date.now()}`,
      name: name && name.trim() ? name.trim() : (isSolo ? "Solo Session" : "Team Session"),
      mode: isSolo ? "solo" : "team",
      date: dateStr,
      time: timeStr,
      dateGroup: dateGroup,
      status: "in_progress",
      bowlers: roster,
      deliveries: []
    };

    this.sessions.unshift(newSession);
    this.activeSessionId = newSession.id;
    this.currentBowlerIndex = 0;
    this.save();

    return newSession;
  }

  getActiveSession() {
    if (!this.activeSessionId && this.sessions.length > 0) {
      return null;
    }
    return this.sessions.find(s => s.id === this.activeSessionId) || null;
  }

  setActiveSession(sessionId) {
    const found = this.sessions.find(s => s.id === sessionId);
    if (found) {
      this.activeSessionId = sessionId;
      const deliveryCount = found.deliveries ? found.deliveries.length : 0;
      const bowlerCount = found.bowlers ? found.bowlers.length : 1;
      this.currentBowlerIndex = deliveryCount % bowlerCount;
      return found;
    }
    return null;
  }

  getCurrentBowler() {
    const session = this.getActiveSession();
    if (!session || !session.bowlers || session.bowlers.length === 0) {
      return { id: "b1", name: "Player 1", style: "fast" };
    }
    return session.bowlers[this.currentBowlerIndex % session.bowlers.length];
  }

  getNextBowler() {
    const session = this.getActiveSession();
    if (!session || !session.bowlers || session.bowlers.length <= 1) {
      return this.getCurrentBowler();
    }
    const nextIdx = (this.currentBowlerIndex + 1) % session.bowlers.length;
    return session.bowlers[nextIdx];
  }

  rotateBowler() {
    const session = this.getActiveSession();
    if (!session || !session.bowlers || session.bowlers.length <= 1) return;
    this.currentBowlerIndex = (this.currentBowlerIndex + 1) % session.bowlers.length;
  }

  setBowlerIndex(idx) {
    const session = this.getActiveSession();
    if (session && session.bowlers && idx >= 0 && idx < session.bowlers.length) {
      this.currentBowlerIndex = idx;
    }
  }

  /**
   * Adds a recorded delivery to the active session.
   */
  addDelivery(deliveryData) {
    const session = this.getActiveSession();
    const currentBowler = this.getCurrentBowler();

    const delivery = {
      id: `del_${Date.now()}`,
      sessionId: session ? session.id : null,
      sessionName: session ? session.name : "Session",
      ballNumber: session ? (session.deliveries.length + 1) : 1,
      bowler: {
        name: currentBowler.name,
        style: currentBowler.style // "fast" | "spin"
      },
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      duration: deliveryData.duration || "3.5s",
      speed: deliveryData.speed || (currentBowler.style === "fast" ? (115 + Math.floor(Math.random() * 12)) : (85 + Math.floor(Math.random() * 10))),
      lengthZone: deliveryData.lengthZone || "Good Length",
      blob: deliveryData.blob,
      url: deliveryData.url,
      calibration: deliveryData.calibration,
      timestamp: Date.now()
    };

    if (session) {
      if (!session.deliveries) session.deliveries = [];
      session.deliveries.push(delivery);
      this.save();
    }

    return delivery;
  }

  getAllSessions() {
    return this.sessions;
  }

  deleteSession(sessionId) {
    this.sessions = this.sessions.filter(s => s.id !== sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
    this.save();
  }
}
