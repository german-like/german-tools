const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

// ===== パラメータ =====
const LAND_SEEDS = 8;
const SEA_SEEDS  = 6;
const NOISE_SCALE = 0.05;
const NOISE_POWER = 40;
const SEA_LEVEL = 0;

// ===== ユーティリティ =====
function randomSeeds(n) {
  return Array.from({ length: n }, () => ({
    x: Math.random() * W,
    y: Math.random() * H
  }));
}

function hashNoise(x, y) {
  return (
    Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  ) % 1;
}

function minDistance(x, y, seeds) {
  let min = Infinity;
  for (const s of seeds) {
    const dx = x - s.x;
    const dy = y - s.y;
    const d = Math.hypot(dx, dy);
    if (d < min) min = d;
  }
  return min;
}

// ===== メイン生成 =====
function generate() {
  const landSeeds = randomSeeds(LAND_SEEDS);
  const seaSeeds  = randomSeeds(SEA_SEEDS);

  const img = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {

      const n =
        hashNoise(x * NOISE_SCALE, y * NOISE_SCALE) * NOISE_POWER;

      const landDist = minDistance(x + n, y + n, landSeeds);
      const seaDist  = minDistance(x - n, y - n, seaSeeds);

      const value = seaDist - landDist;
      const i = (y * W + x) * 4;

      if (value > SEA_LEVEL) {
        // 陸
        img.data[i]     = 60 + value * 0.4;
        img.data[i + 1] = 170;
        img.data[i + 2] = 80;
      } else {
        // 海
        img.data[i]     = 30;
        img.data[i + 1] = 70;
        img.data[i + 2] = 160 - value * 0.4;
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
  a.download = "map.png";
  a.click();
}

// 初期生成
generate();
