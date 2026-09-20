"""
Automated unit tests for cricket pitch calibration and perspective transformations.
"""

import unittest
import numpy as np
from src.pitch_calibration import CricketPitchCalibration, PITCH_LENGTH_M, PITCH_WIDTH_M

class TestPitchCalibration(unittest.TestCase):
    def setUp(self):
        # 4 realistic trapezoid pins for a 1920x1080 cricket broadcast frame
        self.pins = [
            [750.0, 300.0],   # P1: Top-Left
            [1170.0, 300.0],  # P2: Top-Right
            [1450.0, 950.0],  # P3: Bottom-Right
            [470.0, 950.0],   # P4: Bottom-Left
        ]
        self.calib_bottom = CricketPitchCalibration(self.pins, bowler_end="bottom")
        self.calib_top = CricketPitchCalibration(self.pins, bowler_end="top")

    def test_corner_mappings_bottom(self):
        """When bowler is at bottom, P4 should map to (0, 0) and P2 should map to (W, L)"""
        p4_metric = self.calib_bottom.image_to_pitch(self.pins[3])
        self.assertAlmostEqual(p4_metric[0], 0.0, places=3)
        self.assertAlmostEqual(p4_metric[1], 0.0, places=3)

        p2_metric = self.calib_bottom.image_to_pitch(self.pins[1])
        self.assertAlmostEqual(p2_metric[0], PITCH_WIDTH_M, places=3)
        self.assertAlmostEqual(p2_metric[1], PITCH_LENGTH_M, places=3)

    def test_corner_mappings_top(self):
        """When bowler is at top, P1 should map to (0, 0) and P3 should map to (W, L)"""
        p1_metric = self.calib_top.image_to_pitch(self.pins[0])
        self.assertAlmostEqual(p1_metric[0], 0.0, places=3)
        self.assertAlmostEqual(p1_metric[1], 0.0, places=3)

        p3_metric = self.calib_top.image_to_pitch(self.pins[2])
        self.assertAlmostEqual(p3_metric[0], PITCH_WIDTH_M, places=3)
        self.assertAlmostEqual(p3_metric[1], PITCH_LENGTH_M, places=3)

    def test_roundtrip_precision(self):
        """Verify image -> pitch -> image round trip has sub-pixel precision"""
        test_points = [
            [800.0, 450.0],
            [960.0, 600.0],
            [1100.0, 800.0],
        ]
        for pt in test_points:
            metric = self.calib_bottom.image_to_pitch(pt)
            reprojected = self.calib_bottom.pitch_to_image(metric)
            self.assertAlmostEqual(pt[0], reprojected[0], places=3)
            self.assertAlmostEqual(pt[1], reprojected[1], places=3)

    def test_zone_classification(self):
        """Verify metric distances correctly map to zones"""
        self.assertEqual(self.calib_bottom.classify_zone(0.5), "FULL TOSS (0–1m)")
        self.assertEqual(self.calib_bottom.classify_zone(1.5), "YORKER (1–2m)")
        self.assertEqual(self.calib_bottom.classify_zone(3.0), "HALF VOLLEY (2–4m)")
        self.assertEqual(self.calib_bottom.classify_zone(5.0), "FULL (4–6m)")
        self.assertEqual(self.calib_bottom.classify_zone(7.0), "LENGTH (6–8m)")
        self.assertEqual(self.calib_bottom.classify_zone(12.0), "SHORT (8m+)")

if __name__ == "__main__":
    unittest.main()
