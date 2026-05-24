// Lightweight canvas confetti — žádná závislost, jeden burst při splnění úkolu.
// fire() spustí ~80 částic, samo se uklidí po animaci.

const COLORS = ['#ff6a00', '#ee0979', '#f5a623', '#4caf50', '#2196f3', '#9c27b0', '#ffeb3b'];

let activeCanvas = null;

function ensureCanvas() {
  if (activeCanvas && document.body.contains(activeCanvas)) return activeCanvas;
  const c = document.createElement('canvas');
  c.className = 'confetti-canvas';
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  document.body.appendChild(c);
  activeCanvas = c;
  return c;
}

function cleanup(canvas) {
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  if (activeCanvas === canvas) activeCanvas = null;
}

export function fireConfetti({ count = 80, duration = 1400, originY = 0.45 } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // Respect reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = ensureCanvas();
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H * originY;

  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const speed = 6 + Math.random() * 6;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4 - Math.random() * 4,
      size: 6 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1,
    });
  }

  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.vy += 0.32;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life = Math.max(0, 1 - elapsed / duration);
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
      ctx.restore();
    }
    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      cleanup(canvas);
    }
  }
  requestAnimationFrame(frame);
}
