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
        let displacement = 0.0001; 

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

    for (let i = 0; i < grid.length; i++) {
        const h = grid[i]; // その地点の標高 (0.0 〜 1.0)
        const y = Math.floor(i / width); // 緯度判定用
        const latNormalized = Math.abs((y / height) * 2 - 1); // 赤道(0)〜極(1)

        let r, g, b;

        if (h < seaLevel) {
            // --- 海の処理 (変更なし) ---
            const d = h / seaLevel; // 海の深さ (0 〜 1)
            r = 30; 
            g = 60 + (d * 40); 
            b = 120 + (d * 60);
        } else {
            // --- 陸地の処理 (ここが「茶色型」) ---
            const e = (h - seaLevel) / (1 - seaLevel); // 陸の比率 (0 〜 1)
            
            if (latNormalized > 0.85 - (e * 0.15)) { // 極地の雪（高緯度ほど雪）
                r = 245; g = 245; b = 255; // わずかに青みがかった雪
            } else if (e < 0.05) { // 砂浜（海岸線）
                r = 230; g = 210; b = 160; 
            } else if (e < 0.25) { // 低地〜草原
                r = 100 + (e * 80); // 緑の濃淡
                g = 180 - (e * 50);
                b = 80;
            } else if (e < 0.55) { // 中高度の丘陵地〜森林
                r = 140 + (e * 40); // 茶色味が強くなる
                g = 130 + (e * 30);
                b = 90;
            } else if (e < 0.8) { // 高い山岳地帯
                r = 180 + (e * 20); // 灰色っぽい岩肌
                g = 170 + (e * 20);
                b = 160 + (e * 20);
            } else { // 最高峰の雪（標高が高いと雪）
                r = 255; g = 255; b = 255; 
            }
        }

        // ImageData配列への書き込み
        const idx = i * 4;
        data[idx]     = r;   // 赤
        data[idx + 1] = g;   // 緑
        data[idx + 2] = b;   // 青
        data[idx + 3] = 255; // 透明度 (不透明)
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
