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
   断層地形ジェネレーター
   （ノイズ一切なし）
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

  /* ---- 曲線・曲面断層 ---- */
  applyFaultCurved(displacement) {
    const cx = this.rng.next() * this.width;
    const cy = this.rng.next() * this.height;
    const angle = this.rng.next() * Math.PI * 2;

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    const width = 40 + this.rng.next() * 80;
    const bendFreq = 80 + this.rng.next() * 120;
    const bendAmp = 20 + this.rng.next() * 40;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const px = x - cx;
        const py = y - cy;

        const along = px * dx + py * dy;
        const bend = Math.sin(along / bendFreq) * bendAmp;
        const dist = px * dy - py * dx + bend;

        const influence = Math.tanh(dist / width);
        this.map[y][x] += influence * displacement;
      }
    }
  }

  /* ---- 大陸核（ドーム断層） ---- */
  applyFaultDome(displacement) {
    const cx = this.rng.next() * this.width;
    const cy = this.rng.next() * this.height;
    const radius = 200 + this.rng.next() * 400;

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

  /* ---- 生成 ---- */
  generate(iterations = 320) {
    let d = 1.0;

    // 大陸の骨格
    for (let i = 0; i < iterations * 0.2; i++) {
      this.applyFaultDome(d * 2.5);
    }

    // プレート境界・山脈
    for (let i = 0; i < iterations * 0.6; i++) {
      this.applyFaultCurved(d);
      d *= 0.997;
    }

    // 細部
    for (let i = 0; i < iterations * 0.2; i++) {
      this.applyFaultCurved(d * 0.5);
      d *= 0.995;
    }

    this.normalize();
    this.smooth(1);
  }

  /* ---- 正規化 ---- */
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

  /* ---- 平滑化 ---- */
  smooth(iterations) {
    for (let i = 0; i < iterations; i++) {
      const newMap = Array.from({ length: this.height }, () =>
        new Float32Array(this.width)
      );

      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          let sum = 0, count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (
                nx >= 0 && nx < this.width &&
                ny >= 0 && ny < this.height
              ) {
                sum += this.map[ny][nx];
                count++;
              }
            }
          }
          newMap[y][x] = sum / count;
        }
      }
      this.map = newMap;
    }
  }
}

/* =========================
   描画・UI連携
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
  const seed = Math.floor(Math.random() * 1e9);
  document.getElementById("seed").value = seed;
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
        r = 20;
        g = 60 + d * 80;
        b = 120 + d * 100;
      } else {
        const e = (h - seaLevel) / (1 - seaLevel);
        r = 50 + e * 130;
        g = 120 + e * 100;
        b = 60 + e * 60;
      }

      img.data[i]     = r;
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

/* 初回生成 */
run();
