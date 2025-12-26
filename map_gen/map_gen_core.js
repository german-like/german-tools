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
   大陸マスク（楕円の縁をぼかす修正）
========================= */
function generateContinentMask(width, height, rng) {
  const mask = new Float32Array(width * height);
  const continents = 2 + Math.floor(rng.next() * 3);
  const blobs = [];

  for (let i = 0; i < continents; i++) {
    blobs.push({
      x: rng.next() * width,
      y: rng.next() * height,
      rx: width * (0.2 + rng.next() * 0.25),
      ry: height * (0.2 + rng.next() * 0.25),
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
        // ここで 1-d を計算し、0以下にならないようにする
        if (d < 1) v = Math.max(v, 1 - d);
      }
      mask[y * width + x] = v;
    }
  }
  return mask;
}

/* =========================
   断層地形ジェネレーター（1次元配列版）
========================= */
class FaultMapGenerator {
  constructor(width, height, rng) {
    this.width = width;
    this.height = height;
    this.rng = rng;
    this.grid = new Float32Array(width * height).fill(0);
  }

  applyFaultCurved(displacement) {
    const cx = this.rng.next() * this.width;
    const cy = this.rng.next() * this.height;
    const angle = this.rng.next() * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const faultWidth = 20 + this.rng.next() * 40;

    for (let i = 0; i < this.grid.length; i++) {
      const x = i % this.width;
      const y = Math.floor(i / this.width);
      const px = x - cx;
      const py = y - cy;
      const dist = px * dy - py * dx;
      this.grid[i] += Math.sign(dist) * displacement * (1 - Math.exp(-Math.abs(dist) / faultWidth));
    }
  }

  // 水流浸食（少し軽量化）
  applyErosion(iterations) {
    for (let i = 0; i < iterations; i++) {
      let x = this.rng.next() * (this.width - 1);
      let y = this.rng.next() * (this.height - 1);
      let sediment = 0;
      let water = 1.0;
      let dirX = 0, dirY = 0;

      for (let step = 0; step < 20; step++) {
        const ix = Math.floor(x), iy = Math.floor(y);
        const idx = iy * this.width + ix;
        if (idx < 0 || idx >= this.grid.length - this.width - 1) break;

        const gX = this.grid[idx + 1] - this.grid[idx];
        const gY = this.grid[idx + this.width] - this.grid[idx];
        dirX = dirX * 0.2 - gX * 0.8;
        dirY = dirY * 0.2 - gY * 0.8;
        x += dirX; y += dirY;

        if (x < 0 || x >= this.width - 1 || y < 0 || y >= this.height - 1) break;

        const newIdx = Math.floor(y) * this.width + Math.floor(x);
        const diff = this.grid[newIdx] - this.grid[idx];
        const capacity = Math.max(-diff, 0.01) * water * 5.0;

        if (sediment > capacity) {
          const drop = (sediment - capacity) * 0.3;
          this.grid[idx] += drop;
          sediment -= drop;
        } else {
          const uplift = (capacity - sediment) * 0.3;
          this.grid[idx] -= uplift;
          sediment += uplift;
        }
        water *= 0.95;
      }
    }
  }

  generate(iterations = 200) {
    const mask = generateContinentMask(this.width, this.height, this.rng);

    // 1. 初期化
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = mask[i] > 0 ? mask[i] : -0.2;
    }

    // 2. 断層
    let d = 0.5;
    for (let i = 0; i < iterations; i++) {
      this.applyFaultCurved(d);
      d *= 0.998;
    }

    // 3. 浸食（重いので回数を調整）
    this.applyErosion(30000);

    // 4. マスク適用（ここで楕円の切れ端を消す）
    for (let i = 0; i < this.grid.length; i++) {
      const m = mask[i];
      // 楕円の外側（m=0）は強制的に沈めるのではなく、徐々に深くする
      const smoothMask = Math.pow(m, 0.5); 
      if (m <= 0) {
        this.grid[i] = -0.5 + (this.rng.next() * 0.05); // 深海
      } else {
        this.grid[i] *= (0.4 + smoothMask);
      }
    }

    this.normalize();
  }

  normalize() {
    let min = 100, max = -100;
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] < min) min = this.grid[i];
      if (this.grid[i] > max) max = this.grid[i];
    }
    const range = max - min || 1;
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = (this.grid[i] - min) / range;
    }
  }
}

/* =========================
   実行と描画
========================= */
function run() {
  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d");
  const seedValue = parseInt(document.getElementById("seed").value) || 12345;
  const seaLevel = parseFloat(document.getElementById("seaLevel").value);

  const rng = new RNG(seedValue);
  const gen = new FaultMapGenerator(canvas.width, canvas.height, rng);
  gen.generate();
  drawMap(canvas, ctx, gen.grid, seaLevel);
}

function randomizeAndRun() {
  document.getElementById("seed").value = Math.floor(Math.random() * 1e9);
  run();
}

function drawMap(canvas, ctx, grid, seaLevel) {
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.createImageData(w, h);

  for (let i = 0; i < grid.length; i++) {
    const height = grid[i];
    const px = (i * 4);

    let r, g, b;
    if (height < seaLevel) {
      const d = height / (seaLevel || 0.01);
      if (d < 0.4) { r = 10; g = 35; b = 90; }
      else if (d < 0.8) { r = 25; g = 70; b = 150; }
      else { r = 50; g = 120; b = 200; } // 浅瀬
    } else {
      const e = (height - seaLevel) / (1 - seaLevel || 0.01);
      if (e < 0.03) { r = 220; g = 200; b = 160; } // 砂浜
      else if (e < 0.25) { r = 70 + e*100; g = 150; b = 60; } // 草原
      else if (e < 0.6) { r = 110; g = 100; b = 80; } // 岩場
      else { const s = 220 + (e-0.6)*80; r = s; g = s; b = s+10; } // 雪
    }

    img.data[px] = r;
    img.data[px + 1] = g;
    img.data[px + 2] = b;
    img.data[px + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function downloadMap() {
  const canvas = document.getElementById("map");
  const link = document.createElement("a");
  link.download = "world.png";
  link.href = canvas.toDataURL();
  link.click();
}

// 初回実行
window.onload = run;
