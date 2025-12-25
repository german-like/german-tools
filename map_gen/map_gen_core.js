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
  let amp = 1.0; // 0.5 から 1.0 に戻す
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
// 地形生成
// =====================
let currentSeaLevel = 0.35;

// スライダーの動作を設定
document.getElementById("seaLevel").addEventListener("input", (e) => {
  let val = parseFloat(e.target.value);
  
  // 入力された値を 1/20 (0.05) 単位に強制的に丸める場合
  currentSeaLevel = Math.round(val * 20) / 20;
  
  document.getElementById("levelValue").innerText = currentSeaLevel.toFixed(2);
  run(); // 再描画
});

function generateTerrain(seed) {
  const canvas = document.getElementById("map");
  if (!canvas) return; // キャンバスがない場合のエラー回避
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

      // n はだいたい 0.2 〜 0.8 くらいに分布します
      const n = fbm(nx * scaleX, ny * scaleY, seed, scaleX);

      // 海水面の基準を n の分布に合わせる（少し調整）
      // n をそのまま使うより、少し増幅させると陸地がはっきりします
      const h = (n * 1.2) - currentSeaLevel; 
      
      const i = (y * W + x) * 4;

      if (h <= 0) {
        // 海（少し深く、暗めに）
        img.data[i]     = 20;
        img.data[i + 1] = 50;
        img.data[i + 2] = 120;
      } else {
        // 陸地
        // hが小さいほど海岸（砂浜っぽく）、大きいほど山
        if (h < 0.05) { 
          // 砂浜
          img.data[i] = 220; img.data[i + 1] = 200; img.data[i + 2] = 150;
        } else if (h > 0.4) { 
          // 雪山
          img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
        } else {
          // 森
          const brightness = h * 120;
          img.data[i]     = 40 + brightness;
          img.data[i + 1] = 120 + brightness;
          img.data[i + 2] = 40;
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
