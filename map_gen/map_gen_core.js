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
    
    for (let i = 0; i < grid.length; i++) {
        const h = grid[i];
        const y = Math.floor(i / width);
        const latNormalized = Math.abs((y / height) * 2 - 1);
        
        let r, g, b;
        if (h < seaLevel) {
            // 海：深さによる青の塗り分け
            const d = h / seaLevel;
            r = 30; g = 60 + (d * 40); b = 120 + (d * 60);
        } else {
            // 陸：標高と緯度による塗り分け
            const e = (h - seaLevel) / (1 - seaLevel);
            
            if (e < 0.05) { // 砂浜
                r = 230; g = 210; b = 160;
            } else if (e < 0.4) { // 平原
                r = 80 + (e * 50); g = 150 - (e * 30); b = 70;
            } else if (e < 0.7) { // 山岳
                r = 120; g = 110; b = 100;
            }
        }
        
        const idx = i * 4;
        imgData.data[idx] = r;
        imgData.data[idx+1] = g;
        imgData.data[idx+2] = b;
        imgData.data[idx+3] = 255;
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
