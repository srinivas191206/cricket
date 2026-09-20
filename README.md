# Cricket Pitch Calibration & Perspective Tracking

A professional cricket video analysis application inspired by systems such as FULL TRACK AI.

This module implements **Manual Pitch Calibration & Delivery Recording**, allowing users to calibrate pitch perspective on a live back-camera feed and automatically overlay transparent, perspective-correct bowling length zones onto recorded deliveries.

---

## 🎯 Key Features

- **Direct Live Back-Camera Feed**: Automatically opens the phone's environment rear camera in full-screen mode.
- **4-Point Draggable Perspective Polygon**: Draggable concentric glowing cyan pins ($P_1, P_2, P_3, P_4$) with touch-optimized 55px hit radius and real-time visual feedback.
- **Resolution-Independent Calibration**: Points are stored as normalized coordinates ($0.0 \dots 1.0$) so calibrations remain locked across screen orientations and video recording resolutions.
- **Clean Live Recording**: Completely unhindered camera view during active bowling delivery recording.
- **Broadcast Perspective Overlays**:
  - Colored bowling zones: `FULL TOSS`, `YORKER`, `HALF VOLLEY`, `FULL`, `LENGTH`, `SHORT`.
  - Metric distance lines: `STUMPS`, `2M`, `4M`, `6M`, `8M`, `HALFWAY`.
  - Vibrant blue center crease line and glowing boundaries.
  - Visibly preserved 4 corner pins.
- **Multi-Delivery Workflow**: Calibration remains locked across multiple deliveries with a 1-tap "Next Delivery" loop.
- **Saved Deliveries Drawer**: Access, review, and save recorded deliveries anytime.

---

## 🛠 Tech Stack

- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, CSS3
- **Perspective Engine**: Direct Linear Transform (DLT) 3x3 Homography Matrix Solver
- **Mobile Runtime**: Capacitor 7 (Android WebView with WebRTC & Camera permissions)
- **Build Tool**: Vite

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Java JDK 17+ (or JDK 21)
- Android SDK (for Android APK build)

### Installation
```bash
# Clone the repository
git clone https://github.com/srinivas191206/cricket.git
cd cricket

# Install dependencies
npm install
```

### Local Web Development
```bash
# Start development server
npm run dev

# Or build and preview
npm run build
npm run preview
```

### Build Android APK
```bash
# Build web assets
npm run build

# Sync with Capacitor Android
npx cap sync android

# Build debug APK
cd android
./gradlew assembleDebug
```
The resulting APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📜 License
MIT License
