// =====================
// シード付きハッシュノイズ
// =====================
function hash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695041;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 0xffffffff;
}

// =====================
// スムーズノイズ
// =====================
function smoothNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const n00 = hash(xi,     yi,     seed);
  const n10 = hash(xi + 1, yi,     seed);
  const n01 = hash(xi,     yi + 1, seed);
  const n11 = hash(xi + 1, yi + 1, seed);

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const x1 = n00 * (1 - u) + n10 * u;
  const x2 = n01 * (1 - u) + n11 * u;

  return x1 * (1 - v) + x2 * v;
}

// =====================
// FBM（多段ノイズ）
// =====================
function fbm(x, y, seed) {
  let value = 0;
  let amp = 1;
  let freq = 1;

  for (let i = 0; i < 5; i++) {
    value += smoothNoise(x * freq, y * freq, seed + i * 1000) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value;
}

// =====================
// 地形生成
// =====================
function generateTerrain(seed) {
  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const img = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {

      const nx = x / W - 0.5;
      const ny = y / H - 0.5;
      const d = Math.sqrt(nx * nx + ny * ny);

      // 大陸マスク
      const continent = Math.max(0, 1 - d * 1.8);

      // ノイズ地形
      const n = fbm(x * 0.01, y * 0.01, seed);

      const h = continent + n * 0.8 - 0.4;
      const i = (y * W + x) * 4;

      if (h <= 0) {
        // 海
        img.data[i]     = 30;
        img.data[i + 1] = 80;
        img.data[i + 2] = 160;
      } else {
        // 陸
        img.data[i]     = 60 + h * 80;
        img.data[i + 1] = 140 + h * 50;
        img.data[i + 2] = 60;
      }

      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
}
