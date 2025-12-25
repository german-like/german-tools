const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

// ===== パラメータ =====
const PLATE_COUNT = 12;
const NOISE_SCALE = 0.03;
const NOISE_POWER = 25;
const SEA_LEVEL = 0;

// ===== プレート生成 =====
const plates = Array.from({ length: PLATE_COUNT }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  continental: Math.random() < 0.5, // 大陸 or 海洋
  vx: Math.random() * 2 - 1,
  vy: Math.random() * 2 - 1,
  baseHeight: 0 // 後で決定
}));

for (const p of plates) {
  p.baseHeight = p.continental ? 30 : -30;
}

// ===== ノイズ =====
function hashNoise(x, y) {
  return (
    Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  ) % 1;
}

// ===== 最近プレート探索 =====
function nearestPlates(x, y) {
  let a = null, b = null;
  let da = Infinity, db = Infinity;

  for (const p of plates) {
    const dx = x - p.x;
    const dy = y - p.y;
    const d = dx * dx + dy * dy;

    if (d < da) {
      db = da; b = a;
      da = d;  a = p;
    } else if (d < db) {
      db = d;  b = p;
    }
  }
  return { a, b, edge: Math.sqrt(db) - Math.sqrt(da) };
}

// ===== メイン生成 =====
function generate() {
  const img = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {

      const { a, b, edge } = nearestPlates(x, y);

      let height = a.baseHeight;

      // --- 境界効果 ---
      if (edge < 12) {
        const dot = a.vx * b.vx + a.vy * b.vy;

        if (dot < -0.2) {
          // 衝突 → 山
          height += (12 - edge) * 4;
        } else if (dot > 0.5) {
          // 離反 → 海溝/谷
          height -= (12 - edge) * 3;
        }
      }

      // --- ノイズ ---
      height += hashNoise(x * NOISE_SCALE, y * NOISE_SCALE) * NOISE_POWER;

      const i = (y * W + x) * 4;

      if (height > SEA_LEVEL) {
        // 陸
        img.data[i]     = 60 + height * 1.2;
        img.data[i + 1] = 160 + height * 0.5;
        img.data[i + 2] = 80;
      } else {
        // 海
        img.data[i]     = 30;
        img.data[i + 1] = 70;
        img.data[i + 2] = 140 - height;
      }

      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
}

// ===== ダウンロード =====
function downloadMap() {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "plate_map.png";
  a.click();
}

generate();
