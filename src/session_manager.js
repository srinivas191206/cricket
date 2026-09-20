/**
 * TrackAI / FullTrack Session & Bowler Management Engine
 * Manages cricket sessions, ball specifications, multi-bowler rosters,
 * bowling order, bowling style (Fast vs Spin), and delivery archives.
 */

export class SessionManager {
  constructor() {
    this.storageKey = "trackai_sessions_data";
    this.sessions = [];
    this.activeSessionId = null;
    this.currentBowlerIndex = 0;

    this.load();
    if (this.sessions.length === 0) {
      this.initDefaultSessions();
    }
  }

  load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.sessions = JSON.parse(data);
      }
    } catch (e) {
      console.warn("SessionManager load failed:", e);
      this.sessions = [];
    }
  }

  save() {
    try {
      // Don't save blobs/URLs in localStorage directly, only metadata
      const serializable = this.sessions.map(s => ({
        ...s,
        deliveries: (s.deliveries || []).map(d => ({
          ...d,
          blob: null,
          url: null // URLs are session memory
        }))
      }));
      localStorage.setItem(this.storageKey, JSON.stringify(serializable));
    } catch (e) {
      console.warn("SessionManager save failed:", e);
    }
  }

  initDefaultSessions() {
    const todayStr = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    this.sessions = [
      {
        id: "sess_sample_1",
        name: "Session Mon",
        date: "22-7-2024",
        time: "04:02 PM",
        dateGroup: "22 Jul 2024",
        ballType: "Red Leather",
        status: "in_progress", // "in_progress" | "completed"
        bowlers: [
          { id: "b1", name: "Srinivas", style: "fast" },
          { id: "b2", name: "Rahul", style: "spin" }
        ],
        deliveries: []
      },
      {
        id: "sess_sample_2",
        name: "Session Mon",
        date: "22-7-2024",
        time: "04:01 PM",
        dateGroup: "22 Jul 2024",
        ballType: "White Leather",
        status: "completed",
        bowlers: [
          { id: "b1", name: "Srinivas", style: "fast" }
        ],
        deliveries: []
      },
      {
        id: "sess_sample_3",
        name: "Session Mon",
        date: "22-7-2024",
        time: "04:01 PM",
        dateGroup: "22 Jul 2024",
        ballType: "Red Leather",
        status: "completed",
        bowlers: [
          { id: "b1", name: "Vikram", style: "fast" },
          { id: "b2", name: "Amit", style: "spin" }
        ],
        deliveries: []
      },
      {
        id: "sess_sample_4",
        name: "Session Mon",
        date: "22-7-2024",
        time: "04:01 PM",
        dateGroup: "22 Jul 2024",
        ballType: "Tennis Ball",
        status: "completed",
        bowlers: [
          { id: "b1", name: "Srinivas", style: "fast" }
        ],
        deliveries: []
      }
    ];

    this.save();
  }

  /**
   * Creates a new session with bowlers and ball type.
   */
  createSession({ name, ballType, bowlers }) {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateGroup = now.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    const newSession = {
      id: `session_${Date.now()}`,
      name: name && name.trim() ? name.trim() : `Session ${now.toLocaleDateString("en-GB", { weekday: "short" })}`,
      date: dateStr,
      time: timeStr,
      dateGroup: dateGroup,
      ballType: ballType || "Red Leather",
      status: "in_progress",
      bowlers: bowlers && bowlers.length > 0 ? bowlers : [
        { id: "b1", name: "Srinivas", style: "fast" }
      ],
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
      this.currentBowlerIndex = 0;
      return found;
    }
    return null;
  }

  getCurrentBowler() {
    const session = this.getActiveSession();
    if (!session || !session.bowlers || session.bowlers.length === 0) {
      return { id: "b1", name: "Srinivas", style: "fast" };
    }
    return session.bowlers[this.currentBowlerIndex % session.bowlers.length];
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
      sessionName: session ? session.name : "Quick Session",
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
