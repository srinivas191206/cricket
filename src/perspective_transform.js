/**
 * Perspective Transformation & Homography Engine
 * Computes 3x3 Homography Matrix mapping between Image Pixel Coordinates (u, v)
 * and Real-World Ground Pitch Coordinates (x, y in metres).
 *
 * Implements bidirectional mapping:
 * - imageToPitch(point): [u_px, v_px] -> [x_meters, y_meters]
 * - pitchToImage(point): [x_meters, y_meters] -> [u_px, v_px]
 */

export class PerspectiveTransform {
  constructor(srcPoints, dstPoints) {
    this.srcPoints = srcPoints; // [[u0, v0], [u1, v1], [u2, v2], [u3, v3]]
    this.dstPoints = dstPoints; // [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]
    this.H = null;              // Image -> Pitch
    this.H_inv = null;          // Pitch -> Image
    this.isValid = false;

    if (srcPoints && dstPoints && srcPoints.length === 4 && dstPoints.length === 4) {
      this.compute();
    }
  }

  /**
   * Computes 3x3 homography matrix H such that:
   * dst = H * src
   * Using Direct Linear Transformation (DLT) solved via Gaussian elimination with partial pivoting.
   */
  compute() {
    try {
      const H = PerspectiveTransform.findHomography(this.srcPoints, this.dstPoints);
      if (!H) {
        this.isValid = false;
        return false;
      }
      const H_inv = PerspectiveTransform.invert3x3(H);
      if (!H_inv) {
        this.isValid = false;
        return false;
      }

      this.H = H;
      this.H_inv = H_inv;
      this.isValid = true;
      return true;
    } catch (err) {
      console.error("Failed to compute homography:", err);
      this.isValid = false;
      return false;
    }
  }

  /**
   * Maps an image pixel [u, v] to ground pitch coordinates [x, y] in metres.
   * @param {[number, number]} pt - [u, v] in pixel space
   * @returns {[number, number]} [x, y] in metres
   */
  imageToPitch(pt) {
    if (!this.isValid || !this.H) {
      throw new Error("PerspectiveTransform: Homography matrix not available or invalid.");
    }
    const [u, v] = pt;
    const x_num = this.H[0] * u + this.H[1] * v + this.H[2];
    const y_num = this.H[3] * u + this.H[4] * v + this.H[5];
    const denom = this.H[6] * u + this.H[7] * v + this.H[8];

    if (Math.abs(denom) < 1e-9) {
      return [0, 0];
    }
    return [x_num / denom, y_num / denom];
  }

  /**
   * Maps a ground pitch coordinate [x, y] in metres to image pixel [u, v].
   * @param {[number, number]} pt - [x, y] in metres
   * @returns {[number, number]} [u, v] in pixel space
   */
  pitchToImage(pt) {
    if (!this.isValid || !this.H_inv) {
      throw new Error("PerspectiveTransform: Inverse homography matrix not available or invalid.");
    }
    const [x, y] = pt;
    const u_num = this.H_inv[0] * x + this.H_inv[1] * y + this.H_inv[2];
    const v_num = this.H_inv[3] * x + this.H_inv[4] * y + this.H_inv[5];
    const denom = this.H_inv[6] * x + this.H_inv[7] * y + this.H_inv[8];

    if (Math.abs(denom) < 1e-9) {
      return [0, 0];
    }
    return [u_num / denom, v_num / denom];
  }

  /**
   * Solves for 3x3 homography matrix given 4 pairs of points.
   * System of 8 linear equations with 8 unknowns (setting H[8] = 1).
   */
  static findHomography(src, dst) {
    const A = [];
    const B = [];

    for (let i = 0; i < 4; i++) {
      const [u, v] = src[i];
      const [x, y] = dst[i];

      // Eq 1: u*h11 + v*h12 + h13 - u*x*h31 - v*x*h32 = x
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
      B.push(x);

      // Eq 2: u*h21 + v*h22 + h23 - u*y*h31 - v*y*h32 = y
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
      B.push(y);
    }

    const h = PerspectiveTransform.solveGaussian(A, B);
    if (!h) return null;

    return [
      h[0], h[1], h[2],
      h[3], h[4], h[5],
      h[6], h[7], 1.0
    ];
  }

  /**
   * Solves A * x = B using Gaussian elimination with partial pivoting.
   */
  static solveGaussian(A, B) {
    const n = B.length;
    const M = A.map((row, i) => [...row, B[i]]);

    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxEl = Math.abs(M[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > maxEl) {
          maxEl = Math.abs(M[k][i]);
          maxRow = k;
        }
      }

      if (maxEl < 1e-12) {
        return null; // Singular matrix
      }

      // Swap rows
      const tmp = M[maxRow];
      M[maxRow] = M[i];
      M[i] = tmp;

      // Pivot normalization
      for (let k = i + 1; k < n; k++) {
        const factor = M[k][i] / M[i][i];
        for (let j = i; j <= n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }

    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = M[i][n];
      for (let j = i + 1; j < n; j++) {
        sum -= M[i][j] * x[j];
      }
      x[i] = sum / M[i][i];
    }

    return x;
  }

  /**
   * Inverts a 3x3 matrix represented as a 9-element flat array.
   */
  static invert3x3(M) {
    const [
      m00, m01, m02,
      m10, m11, m12,
      m20, m21, m22
    ] = M;

    const det =
      m00 * (m11 * m22 - m12 * m21) -
      m01 * (m10 * m22 - m12 * m20) +
      m02 * (m10 * m21 - m11 * m20);

    if (Math.abs(det) < 1e-12) {
      return null;
    }

    const invDet = 1.0 / det;

    return [
      (m11 * m22 - m12 * m21) * invDet,
      (m02 * m21 - m01 * m22) * invDet,
      (m01 * m12 - m02 * m11) * invDet,

      (m12 * m20 - m10 * m22) * invDet,
      (m00 * m22 - m02 * m20) * invDet,
      (m02 * m10 - m00 * m12) * invDet,

      (m10 * m21 - m11 * m20) * invDet,
      (m01 * m20 - m00 * m21) * invDet,
      (m00 * m11 - m01 * m10) * invDet
    ];
  }
}
