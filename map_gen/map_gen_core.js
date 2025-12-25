// =====================
// ハッシュノイズ
// =====================
function hash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695041;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

// =====================
// スムーズノイズ（ループ対応版）
// =====================
function smoothNoise(x, y, seed, periodX) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const nextX = (xi + 1) % periodX;
  const currX = xi % periodX;

  const n00 = hash(currX, yi, seed);
  const n10 = hash(nextX, yi, seed);
  const n01 = hash(currX, yi + 1, seed);
  const n11 = hash(nextX, yi + 1, seed);

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const x1 = n00 * (1 - u) + n10 * u;
  const x2 = n01 * (1 - u) + n11 * u;

  return x1 * (1 - v) + x2 * v;
}

// =====================
// FBM（うねりを抑えた標準的なフラクタル）
// =====================
function fbm(x, y, seed, baseFreqX) {
  let value = 0;
  let amp = 0.5; // 初期振幅を少し抑える
  let freq = 1.0;
  const persistence = 0.5; 
  const lacunarity = 2.0;

  for (let i = 0; i < 9; i++) {
    const pX = Math.max(1, Math.round(baseFreqX * freq));
    // リッジド処理（Math.abs）をあえて使わず、素直なスムーズノイズにする
    let signal = smoothNoise(x * freq, y * freq, seed + i * 1000, pX);
    
    value += signal * amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return value;
}

// =====================
// 地形生成（ドメイン・ワーピングを削除）
// =====================
function generateTerrain(seed) {
  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const img = ctx.createImageData(W, H);

  const scaleX = 5; 
  const scaleY = 5;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      const ny = y / H;

      // 直接 nx, ny を使って計算します
      const n = fbm(nx * scaleX, ny * scaleY, seed, scaleX);

      // 高さを調整（0.5が標準的な海面）
      const h = n - 0.35; 
      const i = (y * W + x) * 4;

      if (h <= 0) {
        // 海
        img.data[i]     = 30;
        img.data[i + 1] = 70;
        img.data[i + 2] = 150;
      } else {
        // 陸地
        const brightness = h * 100;
        img.data[i]     = 50 + brightness;
        img.data[i + 1] = 150 + brightness;
        img.data[i + 2] = 50;
        
        // 山頂（雪）
        if (h > 0.3) {
            img.data[i] = 240;
            img.data[i + 1] = 240;
            img.data[i + 2] = 250;
        }
      }
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function run() {
  const seedInput = document.getElementById("seed");
  const seed = seedInput ? parseInt(seedInput.value, 10) : 12345;
  generateTerrain(seed);
}

run();
