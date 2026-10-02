const K = new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298,
]);
export function sha256(data: Uint8Array): Uint8Array {
    const h = new Uint32Array([
        1779033703,
        3144134277,
        1013904242,
        2773480762,
        1359893119,
        2600822924,
        528734635,
        1541459225,
    ]);
    const bits = data.length * 8;
    const total = Math.ceil((data.length + 9) / 64) * 64;
    const m = new Uint8Array(total);
    m.set(data);
    m[data.length] = 128;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 8, Math.floor(bits / 4294967296));
    dv.setUint32(total - 4, bits >>> 0);
    const w = new Uint32Array(64);
    for (let off = 0; off < total; off += 64) {
        for (let i = 0; i < 16; i++)
            w[i] = dv.getUint32(off + i * 4);
        for (let i = 16; i < 64; i++) {
            const s15 = w[i - 15], s2 = w[i - 2];
            const r1 = ((s15 >>> 7) | (s15 << 25)) ^ ((s15 >>> 18) | (s15 << 14)) ^ (s15 >>> 3);
            const r2 = ((s2 >>> 17) | (s2 << 15)) ^ ((s2 >>> 19) | (s2 << 13)) ^ (s2 >>> 10);
            w[i] = (w[i - 16] + r1 + w[i - 7] + r2) >>> 0;
        }
        let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
        for (let i = 0; i < 64; i++) {
            const s1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + s1 + ch + K[i] + w[i]) >>> 0;
            const s0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (s0 + maj) >>> 0;
            hh = g;
            g = f;
            f = e;
            e = (d + t1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) >>> 0;
        }
        h[0] = (h[0] + a) >>> 0;
        h[1] = (h[1] + b) >>> 0;
        h[2] = (h[2] + c) >>> 0;
        h[3] = (h[3] + d) >>> 0;
        h[4] = (h[4] + e) >>> 0;
        h[5] = (h[5] + f) >>> 0;
        h[6] = (h[6] + g) >>> 0;
        h[7] = (h[7] + hh) >>> 0;
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    for (let i = 0; i < 8; i++)
        ov.setUint32(i * 4, h[i]);
    return out;
}
export function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {
    let k = key.length > 64 ? sha256(key) : key;
    const bloque = new Uint8Array(64);
    bloque.set(k);
    k = bloque;
    const ipad = new Uint8Array(64 + msg.length);
    const opad = new Uint8Array(64 + 32);
    for (let i = 0; i < 64; i++) {
        ipad[i] = k[i] ^ 54;
        opad[i] = k[i] ^ 92;
    }
    ipad.set(msg, 64);
    opad.set(sha256(ipad), 64);
    return sha256(opad);
}
let claveSesion: Uint8Array | null = null;
export function claveDeSesion(): Uint8Array {
    if (!claveSesion) {
        const k = new Uint8Array(new ArrayBuffer(32));
        globalThis.crypto.getRandomValues(k);
        claveSesion = k;
    }
    return claveSesion;
}
