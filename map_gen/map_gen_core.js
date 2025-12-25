// =====================
// シード付きPRNG
// =====================
class PRNG {
  constructor(seed) {
    this.seed = seed >>> 0;
  }
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 0xffffffff;
  }
}

// =====================
// 初期設定
// =====================
const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

// =====================
// 高さマップ生成
// =====================
function generateHeightMap(rng) {
  const map = new Float32Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {

      const nx = x / W - 0.5;
      const ny = y / H - 0.5;
      const d = Math.sqrt(nx * nx + ny * ny);

      // 大陸形状
      let h = Math.max(0, 1 - d * 1.7);

      // FBMノイズ
      let amp = 1;
      let freq = 1;
      let n = 0;

      for (let i = 0; i < 4; i++) {
        n += (rng.next() * 2 - 1) * amp;
        amp *= 0.5;
        freq *= 2;
      }

      map[y * W + x] = h + n * 0.35;
    }
  }
  return map;
}

// =====================
// 河川生成（勾配追跡）
// =====================
function generateRivers(heightMap, rng) {
  const rivers = [];
  const riverCount = 12;

  for (let i = 0; i < riverCount; i++) {
    let x = Math.floor(rng.next() * W);
    let y = Math.floor(rng.next() * H);

    if (heightMap[y * W + x] < 0.4) continue;

    const river = [];

    for (let step = 0; step < 300; step++) {
      river.push({ x, y });

      let lowest = heightMap[y * W + x];
      let nx = x, ny = y;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= W || py >= H) continue;

          const h = heightMap[py * W + px];
          if (h < lowest) {
            lowest = h;
            nx = px;
            ny = py;
          }
        }
      }

      if (nx === x && ny === y) break;
      x = nx;
      y = ny;
      if (heightMap[y * W + x] <= 0) break;
    }

    rivers.push(river);
  }

  return rivers;
}

// =====================
// 都市生成
// =====================
function generateCities(heightMap, rivers, rng) {
  const cities = [];
  const cityCount = 10;

  for (let i = 0; i < cityCount; i++) {
    for (let tries = 0; tries < 1000; tries++) {
      const x = Math.floor(rng.next() * W);
      const y = Math.floor(rng.next() * H);

      const h = heightMap[y * W + x];
      if (h < 0.1 || h > 0.6) continue;

      let nearRiver = false;
      for (const river of rivers) {
        for (const p of river) {
          if (Math.abs(p.x - x) + Math.abs(p.y - y) < 5) {
            nearRiver = true;
            break;
          }
        }
        if (nearRiver) break;
      }

      if (nearRiver) {
        cities.push({ x, y });
        break;
      }
    }
  }

  return cities;
}

// =====================
// 描画
// =====================
function render(heightMap, rivers, cities) {
  const img = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h = heightMap[y * W + x];
      const i = (y * W + x) * 4;

      if (h <= 0) {
        img.data[i] = 30;
        img.data[i + 1] = 80;
        img.data[i + 2] = 160;
      } else {
        img.data[i] = 60 + h * 80;
        img.data[i + 1] = 140 + h * 40;
        img.data[i + 2] = 60;
      }

      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  // 河川
  ctx.strokeStyle = "#4cc";
  for (const river of rivers) {
    ctx.beginPath();
    for (let i = 0; i < river.length; i++) {
      const p = river[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // 都市
  ctx.fillStyle = "#fff";
  for (const c of cities) {
    ctx.fillRect(c.x - 2, c.y - 2, 4, 4);
  }
}

// =====================
// メイン
// =====================
function run() {
  const seed = parseInt(document.getElementById("seed").value, 10);
  const rng = new PRNG(seed);

  const heightMap = generateHeightMap(rng);
  const rivers = generateRivers(heightMap, rng);
  const cities = generateCities(heightMap, rivers, rng);

  render(heightMap, rivers, cities);
}

function download() {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "world.png";
  a.click();
}

// 初期生成
run();
