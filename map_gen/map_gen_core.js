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

function run() {
    const msg = document.getElementById('loadingMsg');
    
    // 1. メッセージを表示
    msg.style.display = 'inline';

    // 2. 画面描画を一度確定させるためにsetTimeoutを使う
    setTimeout(() => {
        const canvas = document.getElementById('map');
        const ctx = canvas.getContext('2d');
        const seed = document.getElementById('seed').value;
        const seaLevel = parseFloat(document.getElementById('seaLevel').value);
        
        const rng = new Random(seed);
        const width = canvas.width;
        const height = canvas.height;
        const grid = new Float32Array(width * height).fill(0.5);

        const iterations = 400; 
        let displacement = 0.01; 

        // --- 生成ロジック本体 ---
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
                const rowOffset = y * width;
                for (let x = 0; x < width; x++) {
                    const lon = (x / width) * Math.PI * 2;
                    const wx = sinLat * Math.cos(lon);
                    const wy = sinLat * Math.sin(lon);
                    const wz = cosLat;
                    if (wx * px + wy * py + wz * pz > 0) {
                        grid[rowOffset + x] += displacement;
                    } else {
                        grid[rowOffset + x] -= displacement;
                    }
                }
            }
            displacement *= 0.999;
        }

        // 正規化と描画
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < grid.length; i++) {
            if (grid[i] < min) min = grid[i];
            if (grid[i] > max) max = grid[i];
        }
        const range = max - min || 1;
        for (let i = 0; i < grid.length; i++) {
            grid[i] = (grid[i] - min) / range;
        }

        draw(canvas, ctx, grid, seaLevel);

        // 3. 生成が終わったらメッセージを消す
        msg.style.display = 'none';
        
    }, 10); // 10ミリ秒だけ待ってから計算開始
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
        [-1500, '#2b4787'], // 深海
        [-1000, '#50D9FB'], // 漸深海
        [-500, '#50D9FB'], // 中深海
        [-1,    '#B7E5FA'], // 浅瀬
        [0,     '#E0FEDE'], // 海岸線
        [100,   '#68E36B'], // 低地
        [150,   '#98D685'], // 草原
        [300,   '#F9EFCD'], // 丘陵
        [800,   '#E0BB7D'], // 高地
        [1000,  '#D3A62D'], // 山地
        [1500,  '#997618'], // 高山
        [3000,  '#ffffef'], // 雪山
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
