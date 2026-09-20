"""
Cricket Pitch Perspective Calibration Engine (Python Module for future Ball Tracking)
Matches the exact JavaScript mathematical formulation and ICC dimensional constants.
"""

import numpy as np
import cv2

PITCH_LENGTH_M = 20.1168  # 22 yards = 20.1168 m
PITCH_WIDTH_M = 3.048     # 10 feet = 3.048 m

class CricketPitchCalibration:
    def __init__(self, src_points, bowler_end="bottom"):
        """
        src_points: 4 image coordinates [[u1, v1], [u2, v2], [u3, v3], [u4, v4]]
                    P1: Top-Left, P2: Top-Right, P3: Bottom-Right, P4: Bottom-Left
        bowler_end: 'bottom' or 'top'
        """
        self.src_points = np.array(src_points, dtype=np.float32)
        self.bowler_end = bowler_end
        self.H = None
        self.H_inv = None
        self.is_valid = False

        self._compute_homography()

    def _compute_homography(self):
        if len(self.src_points) != 4:
            raise ValueError("Exactly 4 corner points required for pitch calibration.")

        if self.bowler_end == "top":
            dst_points = np.array([
                [0, 0],
                [PITCH_WIDTH_M, 0],
                [PITCH_WIDTH_M, PITCH_LENGTH_M],
                [0, PITCH_LENGTH_M]
            ], dtype=np.float32)
        else:
            dst_points = np.array([
                [0, PITCH_LENGTH_M],
                [PITCH_WIDTH_M, PITCH_LENGTH_M],
                [PITCH_WIDTH_M, 0],
                [0, 0]
            ], dtype=np.float32)

        self.H = cv2.getPerspectiveTransform(self.src_points, dst_points)
        self.H_inv = np.linalg.inv(self.H)
        self.is_valid = True

    def image_to_pitch(self, point):
        """
        Converts image pixel point [u, v] to metric pitch ground coordinate [x, y].
        """
        if not self.is_valid:
            raise RuntimeError("Calibration is not valid.")
        pt = np.array([[[point[0], point[1]]]], dtype=np.float32)
        real_pt = cv2.perspectiveTransform(pt, self.H)
        return float(real_pt[0][0][0]), float(real_pt[0][0][1])

    def pitch_to_image(self, point):
        """
        Converts metric pitch coordinate [x, y] to image pixel coordinate [u, v].
        """
        if not self.is_valid:
            raise RuntimeError("Calibration is not valid.")
        pt = np.array([[[point[0], point[1]]]], dtype=np.float32)
        px_pt = cv2.perspectiveTransform(pt, self.H_inv)
        return float(px_pt[0][0][0]), float(px_pt[0][0][1])

    def classify_zone(self, y_meters):
        """
        Classifies bowling length zone based on distance along the pitch.
        """
        if y_meters < 1.0:
            return "FULL TOSS (0–1m)"
        elif y_meters < 2.0:
            return "YORKER (1–2m)"
        elif y_meters < 4.0:
            return "HALF VOLLEY (2–4m)"
        elif y_meters < 6.0:
            return "FULL (4–6m)"
        elif y_meters < 8.0:
            return "LENGTH (6–8m)"
        else:
            return "SHORT (8m+)"
