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

  // X軸方向にだけループするように、次の座標(xi + 1)を「幅(periodX)」で割った余りにする
  const nextX = (xi + 1) % periodX;
  const currX = xi % periodX;

  const n00 = hash(currX, yi, seed);
  const n10 = hash(nextX, yi, seed); // 右隣が左端に繋がる
  const n01 = hash(currX, yi + 1, seed);
  const n11 = hash(nextX, yi + 1, seed);

  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const x1 = n00 * (1 - u) + n10 * u;
  const x2 = n01 * (1 - u) + n11 * u;

  return x1 * (1 - v) + x2 * v;
}

// =====================
// FBM（ループ対応版）
// =====================
function fbm(x, y, seed, baseFreqX) {
  let value = 0;
  let amp = 1;
  let freq = 1;

  for (let i = 0; i < 9; i++) {
    // 周期（periodX）は、基準となる周波数に合わせた整数値にする
    const pX = Math.max(1, Math.round(baseFreqX * freq));

    let signal = smoothNoise(x * freq, y * freq, seed + i * 1000, pX);
    
    signal = 1.0 - Math.abs(signal * 2.0 - 1.0);
    signal *= signal; // 鋭さを強調

    value += signal * amp;
    
    amp *= persistence;
    freq *= lacunarity;
  }
  return value;
}

// =====================
// 地形生成（呼び出し側の修正）
// =====================
function generateTerrain(seed) {
  const canvas = document.getElementById("map");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const img = ctx.createImageData(W, H);

  // 横方向の解像度（この値が小さいほど大陸が大きく、大きいほど細かくなる）
  const scaleX = 5; 
  const scaleY = 5;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // x / W を使うことで、0.0 ～ 1.0 の範囲にし、それに scale をかける
      // これにより、右端(x=W)が左端(x=0)と同じノイズ位置を参照するようになる
      const nx = x / W;
      const ny = y / H;

      const n = fbm(nx * scaleX, ny * scaleY, seed, scaleX);

      const h = n * 0.8 - 0.5; // -0.2 で海面を調整
      const i = (y * W + x) * 4;

      if (h <= 0) {
        img.data[i]     = 20;
        img.data[i + 1] = 40 + (n * 50); // 海にも深さを出す
        img.data[i + 2] = 120 + (n * 40);
      } else {
        // 標高が高いほど白く（雪山）、低いほど緑に
        const brightness = h * 150;
        img.data[i]     = 40 + brightness;
        img.data[i + 1] = 120 + brightness * 0.5;
        img.data[i + 2] = 40;
        // 雪山の表現（一定以上の高さ）
        if (h > 0.5) {
            img.data[i] = 200 + h * 55;
            img.data[i + 1] = 200 + h * 55;
            img.data[i + 2] = 230 + h * 25;
        }
      }
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// =====================
// ボタン用
// =====================
function run() {
  const seed = parseInt(document.getElementById("seed").value, 10);
  generateTerrain(seed);
}

// 初期表示
run();
