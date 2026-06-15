/* ============================================================
   PONG SCAN LOGO
   Canvas shader-style masked title renderer shared by all pages.
   ============================================================ */

(function () {
  const GREEN = '#00ff88';
  const RED = '#ff2a14';

  function hexToRgb(hex) {
    const n = Number.parseInt(hex.slice(1), 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
    };
  }

  class TextMask {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    resize(width, height, dpr, fontSize) {
      this.width = Math.max(1, Math.floor(width * dpr));
      this.height = Math.max(1, Math.floor(height * dpr));
      this.canvas.width = this.width;
      this.canvas.height = this.height;

      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${fontSize * dpr}px Orbitron, "Arial Black", Arial, sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${16 * dpr}px`;
      ctx.fillText('PONG', this.width / 2, this.height * 0.53, this.width * 0.94);
    }
  }

  class GridField {
    constructor() {
      this.lines = [];
      this.spacing = 18;
    }

    resize(width, height, dpr) {
      this.width = width * dpr;
      this.height = height * dpr;
      this.spacing = Math.max(12, Math.floor(width / 23)) * dpr;
      this.lines = [];

      for (let x = 0; x <= this.width + this.spacing; x += this.spacing) {
        this.lines.push({ axis: 'x', value: x, seed: Math.sin(x * 0.037) * 1000 });
      }

      for (let y = 0; y <= this.height + this.spacing; y += this.spacing) {
        this.lines.push({ axis: 'y', value: y, seed: Math.cos(y * 0.041) * 1000 });
      }
    }

    draw(ctx, color, scanX, time, intensityAt) {
      ctx.save();

      ctx.lineCap = 'butt';
      ctx.lineWidth = Math.max(1, Math.round(this.width / 240));

      for (let i = 0; i < this.lines.length; i++) {
        const line = this.lines[i];

        let alpha;

        if (line.axis === 'x') {
          // vertical lines use their x position
          alpha = intensityAt(line.value);

          if (alpha <= 0.01) continue;
        } else {
          // horizontal lines - skip base alpha check, controlled by segments
          alpha = 0.75;
        }

        const near = Math.min(1, alpha * 1.6);

        const jitter =
          (
            Math.sin(time * 0.006 + line.seed) +
            Math.sin(time * 0.011 + line.seed * 0.43)
          ) * near;

        const wave =
          Math.sin(line.value * 0.035 + time * 0.007) *
          near *
          1.2;

        const offset = (jitter + wave) * 1.4;

        ctx.globalAlpha = Math.min(0.86, alpha);
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 7 * near;

        ctx.beginPath();

        if (line.axis === 'x') {
          const x = line.value + offset;

          ctx.moveTo(x, 0);
          ctx.lineTo(x, this.height);
        } else {
            const y = line.value + offset * 0.45;

            const segmentWidth = this.spacing * 0.75;

            // Only iterate up to scan line, not entire width
            for (let sx = 0; sx < scanX; sx += segmentWidth) {
              const segmentAlpha = intensityAt(sx);

              if (segmentAlpha < 0.02) continue;

              ctx.globalAlpha =
                Math.min(0.86, alpha) *
                segmentAlpha *
                0.8;

              ctx.beginPath();
              ctx.moveTo(sx, y);
              ctx.lineTo(
                Math.min(scanX, sx + segmentWidth),
                y
              );
              ctx.stroke();
            }

            continue;
          }

        ctx.stroke();
      }

      ctx.restore();
    }
  }

  class DecayBuffer {
    constructor() {
      this.cells = new Float32Array(0);
      this.cols = 0;
      this.rows = 0;
    }

    resize(width, height, spacing) {
      this.cols = Math.max(1, Math.ceil(width / spacing) + 1);
      this.rows = Math.max(1, Math.ceil(height / spacing) + 1);
      this.spacing = spacing;
      this.cells = new Float32Array(this.cols * this.rows);
    }

    update(scanX, dt, falloffSigma, active) {
      const decay = Math.exp(-dt / 540);

      for (let y = 0; y < this.rows; y++) {
        const row = y * this.cols;
        for (let x = 0; x < this.cols; x++) {
          const idx = row + x;
          this.cells[idx] = this.cells[idx] * decay;

          if (active) {
            const cx = x * this.spacing;
            const dist = Math.abs(cx - scanX);
            const activation = Math.exp(-(dist * dist) / (2 * falloffSigma * falloffSigma));
            this.cells[idx] = Math.max(this.cells[idx], activation);
          }

          if (this.cells[idx] < 0.015) this.cells[idx] = 0;
        }
      }
    }

    sample(x, y) {
      const gx = Math.max(0, Math.min(this.cols - 1, Math.round(x / this.spacing)));
      const gy = Math.max(0, Math.min(this.rows - 1, Math.round(y / this.spacing)));
      return this.cells[gy * this.cols + gx] || 0;
    }
  }

  class ScanlineController {
    constructor(mode) {
      this.mode = mode;
      this.cycle = 0;
      this.lastWrap = false;
      this.pulse = 0;
    }

    resize(width) {
      this.width = width;
      this.duration = 6000;
    }

    update(time, dt) {
      const cycle = (time % this.duration) / this.duration;
      const scanPhase = 0.85;
      const wrapped = cycle < 0.04;

      if (wrapped && !this.lastWrap) {
        this.cycle += 1;
        this.pulse = 1;
      }

      this.lastWrap = wrapped;
      this.pulse *= Math.exp(-dt / 180);

      if (cycle < scanPhase) {
        this.x = (cycle / scanPhase) * this.width;
        this.active = true;
      } else {
        this.x = this.width;
        this.active = false;
      }
      return this.x;
    }

    getColor() {
      if (this.mode === 'static') return GREEN;
      if (this.mode === 'adaptive') return RED;
      return this.cycle % 2 === 0 ? GREEN : RED;
    }
  }

  class LogoRenderer {
    constructor(root) {
      this.root = root;
      this.canvas = root.querySelector('.pong-logo-canvas');
      this.ctx = this.canvas.getContext('2d', { alpha: true });
      this.mode = root.dataset.logoMode || 'landing';
      this.mask = new TextMask();
      this.grid = new GridField();
      this.decay = new DecayBuffer();
      this.scan = new ScanlineController(this.mode);
      this.lastTime = performance.now();
      this.resize = this.resize.bind(this);
      this.frame = this.frame.bind(this);

      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(this.root);
      window.addEventListener('resize', this.resize);

      // Always do an immediate resize so the RAF loop has valid dimensions.
      // Then re-resize once fonts are confirmed ready — Orbitron may not be
      // loaded yet on first paint, which causes the mask to render in the
      // fallback font and corrupt the composite clipping region.
      this.resize();
      const fontsReady = document.fonts
        ? document.fonts.load('900 82px Orbitron').then(() => document.fonts.ready)
        : Promise.resolve();
      fontsReady.then(() => this.resize());

      requestAnimationFrame(this.frame);
    }

    resize() {
      const rect = this.root.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cssWidth  = Math.max(220, rect.width);
      this.cssHeight = Math.max(96, this.canvas.clientHeight || rect.height);

      // If the element has no layout dimensions yet (e.g. page-content is
      // still opacity:0 before the enter animation), bail and retry next
      // frame rather than baking a zero-size mask into the canvas.
      if (rect.width === 0) {
        requestAnimationFrame(() => this.resize());
        return;
      }

      this.width  = Math.floor(this.cssWidth  * this.dpr);
      this.height = Math.floor(this.cssHeight * this.dpr);
      this.canvas.width  = this.width;
      this.canvas.height = this.height;

      const fontSize = Math.min(this.cssWidth * 0.27, 128);
      this.mask.resize(this.cssWidth, this.cssHeight, this.dpr, fontSize);
      this.grid.resize(this.cssWidth, this.cssHeight, this.dpr);
      this.decay.resize(this.width, this.height, this.grid.spacing);
      this.scan.resize(this.width);
    }

    frame(time) {
      const dt = Math.min(50, time - this.lastTime);
      this.lastTime = time;

      const scanX = this.scan.update(time, dt);
      const color = this.scan.getColor();
      const rgb = hexToRgb(color);
      const scanWidth = 60 * this.dpr;
      const falloffSigma = scanWidth * 0.5;

      this.decay.update(scanX, dt, falloffSigma, this.scan.active);

      this.draw(time, scanX, color, rgb, scanWidth);
      requestAnimationFrame(this.frame);
    }

    draw(time, scanX, color, rgb, scanWidth) {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);

      // Pass 1 — always-white base letters
      ctx.save();
      ctx.drawImage(this.mask.canvas, 0, 0);
      ctx.restore();

      // Pass 2 — colored scan effect clipped to text shape
      ctx.save();
      ctx.drawImage(this.mask.canvas, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';

      const intensityAt = (x) => {
        if (x > scanX) return 0;
        const directDist = Math.abs(x - scanX);
        const direct = Math.exp(-(directDist * directDist) / (2 * (scanWidth * 0.5) ** 2));
        const memory = this.decay.sample(x, this.height * 0.5);
        return Math.max(direct, memory * 0.72);
      };

      this.grid.draw(ctx, color, scanX, time, intensityAt, this.decay);

      const scanTrail = ctx.createLinearGradient(
        scanX - scanWidth,
        0,
        scanX,
        0
      );

      scanTrail.addColorStop(
        0,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`
      );

      scanTrail.addColorStop(
        0.75,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`
      );

      scanTrail.addColorStop(
        1,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`
      );

      ctx.fillStyle = scanTrail;

      ctx.fillRect(
        scanX - scanWidth,
        0,
        scanWidth,
        this.height
      );

      ctx.globalAlpha = 0.24 + this.scan.pulse * 0.22;
      ctx.fillStyle = color;
      for (let i = 0; i < 55; i++) {
        const nx = (Math.sin(i * 91.7 + time * 0.003) * 0.5 + 0.5) * this.width;
        const ny = (Math.cos(i * 47.3 + time * 0.002) * 0.5 + 0.5) * this.height;
        const a = intensityAt(nx) * 0.18;
        if (a <= 0.01) continue;
        ctx.globalAlpha = a;
        ctx.fillRect(nx, ny, 1.2 * this.dpr, 1.2 * this.dpr);
      }

      ctx.restore();
    }
  }

  function init() {
    document.querySelectorAll('[data-pong-logo]').forEach((root) => {
      if (!root.__pongLogoRenderer) root.__pongLogoRenderer = new LogoRenderer(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();