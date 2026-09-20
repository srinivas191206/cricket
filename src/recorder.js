/**
 * Video & Camera Recording Manager (Dedicated Back-Camera Stream)
 * Queries device video inputs to prioritize the rear/environment camera for cricket pitch analysis,
 * handles live MediaRecorder video packaging, and ensures zero play buttons appear.
 */

export class VideoRecorder {
  constructor(videoElement, onRecordingStopped) {
    this.videoElement = videoElement;
    this.onRecordingStopped = onRecordingStopped;
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.startTime = 0;
    this.recordedBlob = null;
    this.recordedUrl = null;
  }

  /**
   * Starts the live rear/back camera feed.
   */
  async startCamera() {
    try {
      let stream = null;

      // 1. Try finding an explicit rear/environment camera by device enumeration
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(d => d.kind === "videoinput");
          const backDevice = videoDevices.find(d => 
            d.label && (
              d.label.toLowerCase().includes("back") ||
              d.label.toLowerCase().includes("rear") ||
              d.label.toLowerCase().includes("environment") ||
              d.label.toLowerCase().includes("0")
            )
          );
          if (backDevice && backDevice.deviceId) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: backDevice.deviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
              },
              audio: false
            });
          }
        }
      } catch (devErr) {
        console.warn("Device enumeration back-camera selection failed:", devErr);
      }

      // 2. If not obtained, request facingMode: { ideal: "environment" }
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          });
        } catch (e1) {
          console.warn("High-res environment camera failed, trying simple environment camera:", e1);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "environment" },
              audio: false
            });
          } catch (e2) {
            console.warn("Simple environment camera failed, trying default camera:", e2);
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          }
        }
      }

      if (!stream) {
        throw new Error("Unable to start phone back camera.");
      }

      this.mediaStream = stream;

      // Ensure no previous video file is bound
      this.videoElement.pause();
      this.videoElement.removeAttribute("src");
      this.videoElement.src = "";
      this.videoElement.srcObject = stream;

      this.videoElement.setAttribute("autoplay", "");
      this.videoElement.setAttribute("playsinline", "");
      this.videoElement.setAttribute("webkit-playsinline", "");
      this.videoElement.muted = true;

      try {
        await this.videoElement.play();
      } catch (playErr) {
        console.warn("Video play caught:", playErr);
      }

      // Await dimensions
      if (!this.videoElement.videoWidth) {
        await new Promise((resolve) => {
          this.videoElement.onloadedmetadata = () => resolve();
          setTimeout(resolve, 600);
        });
      }

      return {
        success: true,
        width: this.videoElement.videoWidth || 1080,
        height: this.videoElement.videoHeight || 1920
      };
    } catch (err) {
      console.error("Camera acquisition failed:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Begins recording the live camera stream cleanly.
   */
  startRecording() {
    if (!this.mediaStream) {
      throw new Error("No active camera stream to record.");
    }

    this.recordedChunks = [];

    let mimeType = "video/webm;codecs=vp9";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm;codecs=vp8";
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm";
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/mp4";
    }

    const options = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined;
    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.isRecording = false;
      const type = this.mediaRecorder.mimeType || "video/webm";
      this.recordedBlob = new Blob(this.recordedChunks, { type });
      if (this.recordedUrl) URL.revokeObjectURL(this.recordedUrl);
      this.recordedUrl = URL.createObjectURL(this.recordedBlob);

      // Stop live camera stream when recording stops
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      this.videoElement.srcObject = null;

      if (this.onRecordingStopped) {
        this.onRecordingStopped(this.recordedBlob, this.recordedUrl);
      }
    };

    this.mediaRecorder.start(100);
    this.isRecording = true;
    this.startTime = Date.now();
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
  }

  getRecordingDurationSeconds() {
    if (!this.isRecording) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement.srcObject) {
      this.videoElement.srcObject = null;
    }
  }
}
