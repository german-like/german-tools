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
// FBM（リッジド・フラクタル対応）
// =====================
function fbm(x, y, seed, baseFreqX) {
  let value = 0;
  let amp = 1.0;
  let freq = 1.0;
  // 未定義だった変数を追加
  const persistence = 0.5; 
  const lacunarity = 2.0;

  for (let i = 0; i < 9; i++) {
    const pX = Math.max(1, Math.round(baseFreqX * freq));
    let signal = smoothNoise(x * freq, y * freq, seed + i * 1000, pX);
    
    // リッジド（鋭い山脈）処理
    signal = 1.0 - Math.abs(signal * 2.0 - 1.0);
    signal *= signal; 

    value += signal * amp;
    amp *= persistence;
    freq *= lacunarity;
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

  const scaleX = 4; // ここの値を調整すると大陸の大きさが変わる
  const scaleY = 4;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      const ny = y / H;

      // --- ドメイン・ワーピング（フラクタルな歪み） ---
      // 座標自体をノイズでゆがませることで、より自然な海岸線になります
      const qx = fbm(nx * scaleX + 1.1, ny * scaleY + 1.1, seed + 10, scaleX);
      const qy = fbm(nx * scaleX + 3.3, ny * scaleY + 3.3, seed + 20, scaleX);
      
      // ゆがんだ座標を使って最終的な高さを計算
      const n = fbm((nx + qx * 0.1) * scaleX, (ny + qy * 0.1) * scaleY, seed, scaleX);

      const h = n - 0.45; // 0.4～0.6あたりで陸地の量を調整
      const i = (y * W + x) * 4;

      if (h <= 0) {
        // 海：深さによって青の濃さを変える
        const depth = Math.max(0, 1 + h * 2); 
        img.data[i]     = 20;
        img.data[i + 1] = 30 + depth * 50;
        img.data[i + 2] = 100 + depth * 60;
      } else {
        // 陸地
        const brightness = h * 150;
        if (h > 0.5) {
          // 雪山
          const snow = (h - 0.5) * 200;
          img.data[i]     = 200 + snow;
          img.data[i + 1] = 200 + snow;
          img.data[i + 2] = 220 + snow;
        } else {
          // 森・草原
          img.data[i]     = 40 + brightness;
          img.data[i + 1] = 100 + brightness * 0.5;
          img.data[i + 2] = 30;
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
