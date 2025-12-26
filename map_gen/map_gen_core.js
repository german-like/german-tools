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
   断層地形ジェネレーター（浸食対応版）
========================= */
class FaultMapGenerator {
  constructor(width, height, rng) {
    this.width = width;
    this.height = height;
    this.rng = rng;
    // 高速化のため1次元配列に変更
    this.grid = new Float32Array(width * height).fill(0);
  }

  // 断層処理 (Curved)
  applyFaultCurved(displacement) {
    const cx = this.rng.next() * this.width;
    const cy = this.rng.next() * this.height;
    const angle = this.rng.next() * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const width = 20 + this.rng.next() * 40;

    for (let i = 0; i < this.grid.length; i++) {
      const x = i % this.width;
      const y = Math.floor(i / this.width);
      const px = x - cx;
      const py = y - cy;
      const dist = px * dy - py * dx; // 簡易版の距離計算
      this.grid[i] += Math.sign(dist) * displacement * (1 - Math.exp(-Math.abs(dist) / width));
    }
  }

  // ★ 水流浸食シミュレーション
  // 雨粒を落として、高い所から低い所へ「土砂」を運ぶ
  applyErosion(iterations) {
    for (let i = 0; i < iterations; i++) {
      let x = this.rng.next() * (this.width - 1);
      let y = this.rng.next() * (this.height - 1);
      let dirX = 0, dirY = 0;
      let sediment = 0;
      let water = 1.0;
      let speed = 1.0;

      for (let step = 0; step < 30; step++) {
        const ix = Math.floor(x), iy = Math.floor(y);
        const idx = iy * this.width + ix;

        // 周囲との傾斜（勾配）を計算
        const gX = this.grid[idx + 1] - this.grid[idx];
        const gY = this.grid[idx + this.width] - this.grid[idx];

        // 移動方向を決定
        dirX = dirX * 0.1 - gX * 0.9;
        dirY = dirY * 0.1 - gY * 0.9;
        x += dirX; y += dirY;

        if (x < 0 || x >= this.width - 1 || y < 0 || y >= this.height - 1) break;

        const newIdx = Math.floor(y) * this.width + Math.floor(x);
        const diff = this.grid[newIdx] - this.grid[idx];

        // 土砂の運搬
        const capacity = Math.max(-diff, 0) * speed * water * 4.0;
        if (sediment > capacity) {
          const drop = (sediment - capacity) * 0.1;
          this.grid[idx] += drop;
          sediment -= drop;
        } else {
          const uplift = (capacity - sediment) * 0.1;
          this.grid[idx] -= uplift;
          sediment += uplift;
        }
        water *= 0.99;
      }
    }
  }

  generate(iterations = 320) {
    const continentMask = generateContinentMask(this.width, this.height, this.rng);

    // 1. 初期化
    for (let i = 0; i < this.grid.length; i++) {
      const m = continentMask[i];
      this.grid[i] = m > 0 ? (m * 0.5) : -0.2;
    }

    // 2. 断層形成
    let d = 0.5;
    for (let i = 0; i < iterations; i++) {
      this.applyFaultCurved(d);
      d *= 0.998;
    }

    // 3. 浸食処理 (これを加えると川のような筋ができる)
    this.applyErosion(50000); 

    // 4. マスクで海を広げる
    for (let i = 0; i < this.grid.length; i++) {
      const m = continentMask[i];
      const smoothMask = Math.pow(m, 0.4);
      if (m <= 0) this.grid[i] -= 0.5;
      else this.grid[i] *= (0.3 + smoothMask);
    }

    this.normalize();
  }

  normalize() {
    let min = Math.min(...this.grid), max = Math.max(...this.grid);
    const range = max - min || 1;
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = (this.grid[i] - min) / range;
    }
  }
}

// ※ drawMap 関数内での map[y][x] は map[y * w + x] に書き換えてください

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
      const height = map[y * w + x];
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
