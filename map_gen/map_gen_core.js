/* =========================
   RNG（シード対応）
========================= */
class RNG {
  constructor(seed) {
    this.seed = seed >>> 0;
  }
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 0xffffffff;
  }
}

/* =========================
   大陸マスク（ノイズなし）
========================= */
function generateContinentMask(width, height, rng) {
  const mask = new Float32Array(width * height);
  const continents = 2 + Math.floor(rng.next() * 2);

  const blobs = [];
  for (let i = 0; i < continents; i++) {
    blobs.push({
      x: rng.next() * width,
      y: rng.next() * height,
      rx: width * (0.25 + rng.next() * 0.2),
      ry: height * (0.25 + rng.next() * 0.2),
      rot: rng.next() * Math.PI
    });
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 0;
      for (const b of blobs) {
        const dx = x - b.x;
        const dy = y - b.y;
        const cos = Math.cos(b.rot);
        const sin = Math.sin(b.rot);
        const lx = dx * cos + dy * sin;
        const ly = -dx * sin + dy * cos;
        const d =
          (lx * lx) / (b.rx * b.rx) +
          (ly * ly) / (b.ry * b.ry);
        if (d < 1) v = Math.max(v, 1 - d);
      }
      mask[y * width + x] = v;
    }
  }
  return mask;
}

/* =========================
   断層地形ジェネレーター
========================= */
class FaultMapGenerator {
  constructor(width, height, rng) {
    this.width = width;
    this.height = height;
    this.rng = rng;
    this.map = Array.from({ length: height }, () =>
      new Float32Array(width).fill(0)
    );
  }

  applyFaultCurved(displacement) {
    const cx = this.rng.next() * this.width;
    const cy = this.rng.next() * this.height;
    const angle = this.rng.next() * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    const width = 20 + this.rng.next() * 40;
    const bendFreq = 80 + this.rng.next() * 120;
    const bendAmp = 10 + this.rng.next() * 25;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {

        // ★ 海底は断層を通さない
        if (this.map[y][x] < -1.5) continue;

        const px = x - cx;
        const py = y - cy;
        const along = px * dx + py * dy;
        const bend = Math.sin(along / bendFreq) * bendAmp;
        const dist = px * dy - py * dx + bend;

        const influence =
          Math.sign(dist) *
          (1 - Math.exp(-Math.abs(dist) / (width * 0.35)));

        this.map[y][x] += influence * displacement;

        if (Math.abs(dist) < width * 0.15) {
          this.map[y][x] += Math.sign(dist) * displacement * 0.4;
        }
      }
    }
  }

  applyFaultDome(displacement) {
    const cx = this.rng.next() * this.width;
    const cy = this.rng.next() * this.height;
    const radius = 200 + this.rng.next() * 300;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < radius) {
          const influence =
            Math.cos((r / radius) * Math.PI) * 0.5 + 0.5;
          this.map[y][x] += influence * displacement;
        }
      }
    }
  }

  generate(iterations = 320) {
    const continentMask =
      generateContinentMask(this.width, this.height, this.rng);

    // ★ 初期状態：陸と海を確定
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const m = continentMask[y * this.width + x];
        this.map[y][x] = m > 0 ? m * 1.5 : -2.5;
      }
    }

    let d = 1.0;

    for (let i = 0; i < iterations * 0.08; i++) {
      this.applyFaultDome(d * 1.4);
    }

    for (let i = 0; i < iterations * 0.65; i++) {
      this.applyFaultCurved(d);
      d *= 0.997;
    }

    for (let i = 0; i < iterations * 0.27; i++) {
      this.applyFaultCurved(d * 0.5);
      d *= 0.995;
    }

    // ★ マスクで最終制御
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        const m = continentMask[idx];
        if (m <= 0) this.map[y][x] = -3.0;
        else this.map[y][x] *= (0.7 + m);
      }
    }

    this.normalize();
  }

  normalize() {
    let min = Infinity, max = -Infinity;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const v = this.map[y][x];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const range = max - min || 1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.map[y][x] = (this.map[y][x] - min) / range;
      }
    }
  }
}

/* =========================
   描画
========================= */
const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");

function run() {
  const seedValue = parseInt(document.getElementById("seed").value);
  const seaLevel = parseFloat(document.getElementById("seaLevel").value);

  const rng = new RNG(seedValue);
  const gen = new FaultMapGenerator(canvas.width, canvas.height, rng);
  gen.generate(320);
  drawMap(gen.map, seaLevel);
}

function randomizeAndRun() {
  document.getElementById("seed").value =
    Math.floor(Math.random() * 1e9);
  run();
}

function drawMap(map, seaLevel) {
  const img = ctx.createImageData(canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const h = map[y][x];
      const i = (y * canvas.width + x) * 4;

      let r, g, b;
      if (h < seaLevel) {
        const d = h / seaLevel;
        r = 15;
        g = 50 + d * 70;
        b = 110 + d * 110;
      } else {
        const e = (h - seaLevel) / (1 - seaLevel);
        r = 60 + e * 140;
        g = 120 + e * 100;
        b = 60 + e * 50;
      }

      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function downloadMap() {
  const link = document.createElement("a");
  link.download = "fault_world.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

run();
