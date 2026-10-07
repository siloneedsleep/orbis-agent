export interface Point {
  x: number;
  y: number;
}

const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/**
 * Lấy mẫu quỹ đạo Bézier bậc 2 (đường cong) từ `from` tới `to`.
 * Easing được áp vào tham số u, nên khi animate với ease "linear"
 * chuyển động vẫn có gia tốc/giảm tốc mượt.
 */
export function arcPath(from: Point, to: Point, steps = 24, bend = 0.25) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const ctrl: Point = {
    x: (from.x + to.x) / 2 - dy * bend,
    y: (from.y + to.y) / 2 + dx * bend,
  };

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = easeInOut(i / steps);
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    const c = u * u;
    xs.push(a * from.x + b * ctrl.x + c * to.x);
    ys.push(a * from.y + b * ctrl.y + c * to.y);
  }

  const distance = Math.hypot(dx, dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const duration = Math.min(1.2, Math.max(0.45, 0.45 + distance / 2500));

  return { xs, ys, duration, angleDeg };
}
