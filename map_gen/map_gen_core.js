/* =========================
   RNG & Simplex Noise クラス
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
        this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
        return this.seed / 0xffffffff;
    }
}

class SimplexNoise {
    constructor(random) {
        this.p = new Uint8Array(256);
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);
        for (let i = 0; i < 256; i++) this.p[i] = i;
        for (let i = 255; i > 0; i--) {
            const r = Math.floor(random.next() * (i + 1));
            [this.p[i], this.p[r]] = [this.p[r], this.p[i]];
        }
        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
        this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    }
    dot(g, x, y, z) { return g[0]*x + g[1]*y + g[2]*z; }
    noise3D(xin, yin, zin) {
        let n0, n1, n2, n3;
        const F3 = 1.0/3.0;
        const s = (xin+yin+zin)*F3;
        const i = Math.floor(xin+s), j = Math.floor(yin+s), k = Math.floor(zin+s);
        const G3 = 1.0/6.0;
        const t = (i+j+k)*G3;
        const x0 = xin-(i-t), y0 = yin-(j-t), z0 = zin-(k-t);
        let i1, j1, k1, i2, j2, k2;
        if(x0>=y0) {
            if(y0>=z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
            else if(x0>=z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
            else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
        } else {
            if(y0<z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
            else if(x0<z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
            else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
        }
        const x1 = x0-i1+G3, y1 = y0-j1+G3, z1 = z0-k1+G3;
        const x2 = x0-i2+2.0*G3, y2 = y0-j2+2.0*G3, z2 = z0-k2+2.0*G3;
        const x3 = x0-1.0+3.0*G3, y3 = y0-1.0+3.0*G3, z3 = z0-1.0+3.0*G3;
        const ii = i&255, jj = j&255, kk = k&255;
        const g0 = this.grad3[this.permMod12[ii+this.perm[jj+this.perm[kk]]]];
        const g1 = this.grad3[this.permMod12[ii+i1+this.perm[jj+j1+this.perm[kk+k1]]]];
        const g2 = this.grad3[this.permMod12[ii+i2+this.perm[jj+j2+this.perm[kk+k2]]]];
        const g3 = this.grad3[this.permMod12[ii+1+this.perm[jj+1+this.perm[kk+1]]]];
        let t0 = 0.6-x0*x0-y0*y0-z0*z0; n0 = t0<0 ? 0 : Math.pow(t0,4)*this.dot(g0,x0,y0,z0);
        let t1 = 0.6-x1*x1-y1*y1-z1*z1; n1 = t1<0 ? 0 : Math.pow(t1,4)*this.dot(g1,x1,y1,z1);
        let t2 = 0.6-x2*x2-y2*y2-z2*z2; n2 = t2<0 ? 0 : Math.pow(t2,4)*this.dot(g2,x2,y2,z2);
        let t3 = 0.6-x3*x3-y3*y3-z3*z3; n3 = t3<0 ? 0 : Math.pow(t3,4)*this.dot(g3,x3,y3,z3);
        return 32.0 * (n0 + n1 + n2 + n3);
    }
}

/* =========================
   メインジェネレーター
========================= */
const PALETTE = {
    deep: [20, 50, 120], sea: [50, 100, 190], shallow: [80, 150, 220],
    sand: [240, 230, 180], grass: [100, 180, 80], forest: [50, 120, 40],
    rock: [140, 130, 120], snow: [255, 255, 255]
};

function run() {
    const canvas = document.getElementById('map');
    const ctx = canvas.getContext('2d');
    const seed = document.getElementById('seed').value;
    const seaLevel = parseFloat(document.getElementById('seaLevel').value);
    
    const rng = new Random(seed);
    const noise = new SimplexNoise(rng);
    const width = canvas.width;
    const height = canvas.height;
    const grid = new Float32Array(width * height);

    // 1. Simplex Noise による生成 (Octaves: 6)
    const octaves = 6;
    for (let y = 0; y < height; y++) {
        const ny = (y / height) * 2 - 1;
        const cy = ny * 1.5; // 縦の歪み調整
        for (let x = 0; x < width; x++) {
            const theta = (x / width) * Math.PI * 2;
            const cx = Math.cos(theta);
            const cz = Math.sin(theta);
            
            let amplitude = 1, frequency = 0.8, noiseValue = 0, maxValue = 0;
            for (let o = 0; o < octaves; o++) {
                noiseValue += noise.noise3D(cx * frequency, cy * frequency, cz * frequency) * amplitude;
                maxValue += amplitude;
                amplitude *= 0.5; frequency *= 2.1;
            }
            grid[y * width + x] = (noiseValue / maxValue + 1) / 2;
        }
    }

    // 2. 描画
    const imgData = ctx.createImageData(width, height);
    for (let i = 0; i < grid.length; i++) {
        const h = grid[i];
        const y = Math.floor(i / width);
        const lat = Math.abs((y / height) * 2 - 1); // 南北の緯度
        let color;

        if (h < seaLevel) {
            const d = h / seaLevel;
            color = d < 0.4 ? PALETTE.deep : (d < 0.8 ? PALETTE.sea : PALETTE.shallow);
        } else {
            const l = (h - seaLevel) / (1 - seaLevel);
            // 緯度が高い（両極）ほど雪が降りやすい
            if (lat > 0.85 - (l * 0.1)) color = PALETTE.snow;
            else if (l < 0.05) color = PALETTE.sand;
            else if (l < 0.4) color = PALETTE.grass;
            else if (l < 0.7) color = PALETTE.forest;
            else color = PALETTE.rock;
        }

        const px = i * 4;
        imgData.data[px] = color[0];
        imgData.data[px+1] = color[1];
        imgData.data[px+2] = color[2];
        imgData.data[px+3] = 255;
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
    link.download = "simplex_world.png";
    link.href = canvas.toDataURL();
    link.click();
}

window.onload = run();
