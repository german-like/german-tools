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
   大陸マスク
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
        const d = (lx * lx) / (b.rx * b.rx) + (ly * ly) / (b.ry * b.ry);
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
    this.map = Array.from({ length: height }, () => new Float32Array(width).fill(0));
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
        if (this.map[y][x] < -1.5) continue;

        const px = x - cx;
        const py = y - cy;
        const along = px * dx + py * dy;
        const bend = Math.sin(along / bendFreq) * bendAmp;
        const dist = px * dy - py * dx + bend;

        const influence = Math.sign(dist) * (1 - Math.exp(-Math.abs(dist) / (width * 0.35)));
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
          const influence = Math.cos((r / radius) * Math.PI) * 0.5 + 0.5;
          this.map[y][x] += influence * displacement;
        }
      }
    }
  }

  generate(iterations = 320) {
    const continentMask = generateContinentMask(this.width, this.height, this.rng);

    // ★ 1. 初期状態の設定を少しマイルドにする
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const m = continentMask[y * this.width + x];
        // マスクがある場所は少し高く、ない場所も極端に深くしすぎない
        this.map[y][x] = m > 0 ? m * 1.0 : -0.5;
      }
    }

    let d = 1.0;
    for (let i = 0; i < iterations * 0.08; i++) this.applyFaultDome(d * 1.4);
    for (let i = 0; i < iterations * 0.65; i++) { this.applyFaultCurved(d); d *= 0.997; }
    for (let i = 0; i < iterations * 0.27; i++) { this.applyFaultCurved(d * 0.5); d *= 0.995; }

    // ★ 2. マスクによる最終制御（ここが重要！）
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        const m = continentMask[idx];
        
        // 楕円の境界でパキッと消さない工夫：
        // マスクの値をそのまま使うのではなく、少しゲインをかけて滑らかに沈み込ませる
        const smoothMask = Math.pow(m, 0.5); // ルートを取ることで縁を広げる
        
        if (m <= 0) {
          // マスク外は「断層で盛り上がった分」を大幅に削るが、少しだけ地形を残す
          this.map[y][x] -= 2.0; 
        } else {
          // マスク内は地形を活かしつつ、端に行くほど緩やかに海へ沈める
          this.map[y][x] *= (0.5 + smoothMask);
        }

        // 微細なノイズで海岸線をさらにガタガタにする
        this.map[y][x] += (this.rng.next() - 0.5) * 0.05;
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
   描画・実行制御
========================= */
// ページ読み込み完了後に実行
window.onload = () => {
  run();
};

function run() {
  const canvas = document.getElementById("map");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  
  const seedValue = parseInt(document.getElementById("seed").value) || 12345;
  const seaLevel = parseFloat(document.getElementById("seaLevel").value);

  const rng = new RNG(seedValue);
  const gen = new FaultMapGenerator(canvas.width, canvas.height, rng);
  gen.generate(320);
  drawMap(canvas, ctx, gen.map, seaLevel);
}

function randomizeAndRun() {
  document.getElementById("seed").value = Math.floor(Math.random() * 1e9);
  run();
}

function drawMap(canvas, ctx, map, seaLevel) {
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const height = map[y][x];
      const i = (y * w + x) * 4;

      let r, g, b;
      if (height < seaLevel) {
        const d = height / (seaLevel || 0.001);
        if (d < 0.4) { r = 10; g = 30; b = 80; }
        else if (d < 0.8) { r = 20; g = 60; b = 130; }
        else { r = 40; g = 100; b = 180; }
      } else {
        const e = (height - seaLevel) / (1 - seaLevel || 0.001);
        if (e < 0.05) { r = 210; g = 190; b = 150; }
        else if (e < 0.3) { r = 70 + e * 50; g = 140; b = 60; }
        else if (e < 0.6) { r = 120; g = 100; b = 80; }
        else { const snow = 200 + (e - 0.6) * 130; r = snow; g = snow; b = snow + 20; }
      }
      img.data[i] = r; img.data[i+1] = g; img.data[i+2] = b; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function downloadMap() {
  const canvas = document.getElementById("map");
  const link = document.createElement("a");
  link.download = "fault_world.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
