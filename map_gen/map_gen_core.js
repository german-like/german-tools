/* =========================
   乱数（シード対応）
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
   断層流動マップ生成
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

  applyFault(displacement) {
    const cx = this.rng.next() * this.width;
    const cy = this.rng.next() * this.height;
    const angle = this.rng.next() * Math.PI * 2;

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // 曲面の幅（大きいほどなだらか）
    const width = 30 + this.rng.next() * 60;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // 断層中心線からの符号付き距離
        const px = x - cx;
        const py = y - cy;
        const dist = px * dy - py * dx;

        // S字カーブ（滑らかな断面）
        const influence = Math.tanh(dist / width);

        this.map[y][x] += influence * displacement;
      }
    }
  }
   
  generate(iterations = 300, initialDisplacement = 1.0) {
    let d = initialDisplacement;
    for (let i = 0; i < iterations; i++) {
      this.applyFault(d);
      d *= 0.995;
    }
    this.normalize();
    this.smooth(2);
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
              if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
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
  gen.generate(350, 1.0);

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
        // 海
        const d = h / seaLevel;
        r = 20;
        g = 60 + d * 80;
        b = 120 + d * 100;
      } else {
        // 陸
        const e = (h - seaLevel) / (1 - seaLevel);
        r = 40 + e * 120;
        g = 120 + e * 100;
        b = 40 + e * 60;
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
  link.download = "fault_map.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/* 初回自動生成 */
run();
