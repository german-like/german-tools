/* =========================
   RNGクラス
========================= */
class Random {
    constructor(seed) {
        this.seed = typeof seed === 'string' ? this.hashString(seed) : seed >>> 0;
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }
    next() {
        this.seed = (this.seed * 1625 + 1023) >>> 0;
        return this.seed / 0xffffffff;
    }
}

/* =========================
   テクトニクス・ジェネレーター
========================= */

function run(e) {
    if (e && e.preventDefault) e.preventDefault();

    const msg = document.getElementById('loadingMsg');
    const canvas = document.getElementById('map');
    const ctx = canvas.getContext('2d');
    
    if (msg) msg.style.display = 'inline';

    setTimeout(() => {
        const seedValue = document.getElementById('seed').value;
        const seaLevel = parseFloat(document.getElementById('seaLevel').value);
        const rng = new Random(seedValue);
        const width = canvas.width;
        const height = canvas.height;
        const grid = new Float32Array(width * height).fill(0.5);

        // --- 【高速化】事前計算テーブル ---
        const cosLon = new Float32Array(width);
        const sinLon = new Float32Array(width);
        for (let x = 0; x < width; x++) {
            const lon = (x / width) * Math.PI * 2;
            cosLon[x] = Math.cos(lon);
            sinLon[x] = Math.sin(lon);
        }

        let iterations = 800; 
        let displacement = 0.0075; 

        // --- メインループ ---
        for (let i = 0; i < iterations; i++) {
            const pPhi = rng.next() * Math.PI * 2;
            const pTheta = Math.acos(2 * rng.next() - 1);
            const px = Math.sin(pTheta) * Math.cos(pPhi);
            const py = Math.sin(pTheta) * Math.sin(pPhi);
            const pz = Math.cos(pTheta);

            for (let y = 0; y < height; y++) {
                const lat = (1.0 - y / height) * Math.PI;
                const sinLat = Math.sin(lat);
                const cosLat = Math.cos(lat);
                
                // xループ内で変わらない計算を外に出す
                const wz_pz = cosLat * pz; 
                const rowOffset = y * width;

                for (let x = 0; x < width; x++) {
                    // sin/cosの代わりにテーブルを参照
                    const wx = sinLat * cosLon[x];
                    const wy = sinLat * sinLon[x];

                    // 内積による判定
                    if (wx * px + wy * py + wz_pz > 0) {
                        grid[rowOffset + x] += displacement;
                    } else {
                        grid[rowOffset + x] -= displacement;
                    }
                }
            }
            displacement *= 0.999;
        }

        // 正規化と描画
        normalize(grid);
        draw(canvas, ctx, grid, seaLevel);

        if (msg) msg.style.display = 'none';
    }, 50);
}

// 正規化処理を別関数に分けるとスッキリします
function normalize(grid) {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < grid.length; i++) {
        if (grid[i] < min) min = grid[i];
        if (grid[i] > max) max = grid[i];
    }
    const range = max - min || 1;
    for (let i = 0; i < grid.length; i++) {
        grid[i] = (grid[i] - min) / range;
    }
}

/* =========================
   描画
========================= */
function draw(canvas, ctx, grid, seaLevel) {
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    // ご提示のカラーパレットを定義（標高, HEXカラー）
    const palette = [
        [-1500, '#4c878e'], // 深海
        [-1000, '#6fb2bd'], // 漸深海
        [-500, '#7fd5db'], // 中深海
        [-1,    '#B7E5FA'], // 浅瀬
        [0,     '#E0FEDE'], // 海岸線
        [100,   '#68E36B'], // 低地
        [150,   '#98D685'], // 草原
        [300,   '#F9EFCD'], // 丘陵
        [800,   '#E0BB7D'], // 高地
        [1000,  '#D3A62D'], // 山地
        [1500,  '#997618'], // 高山
        [3000,  '#474610'], // 険山
        [4500,  '#324228'], // 森林限界
        [5000,  '#efefff'], // 岩石・雪山
        ];

    // HEXをRGBに変換するヘルパー
    const hexToRgb = (hex) => {
        if (hex === '#FFFFFF' || hex === 'snow') return [255, 255, 255];
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
    };

    for (let i = 0; i < grid.length; i++) {
        // 0.0~1.0 を -2500~5500 の範囲にマッピング
        // ※seaLevelが0.5の時が標高0になるように調整すると使いやすいです
        const rawH = grid[i];
        const worldHeight = (rawH - seaLevel) * (rawH < seaLevel ? 5000 : 11000); 
        // 海：-2500まで / 陸：5500まで くらいになるよう適宜調整

        // パレットから色を選択
        let r = 255, g = 255, b = 255;
        for (let j = 0; j < palette.length; j++) {
            if (worldHeight <= palette[j][0] || j === palette.length - 1) {
                [r, g, b] = hexToRgb(palette[j][1]);
                break;
            }
        }

        const idx = i * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
}

function randomizeAndRun() {
    document.getElementById("seed").value = Math.floor(Math.random() * 1e9);
    run();
}

function downloadMap() {
    const canvas = document.getElementById("map");
    const link = document.createElement("a");
    link.download = "tectonic_world.png";
    link.href = canvas.toDataURL();
    link.click();
}

window.onload = run;
