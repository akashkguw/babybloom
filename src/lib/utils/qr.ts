/**
 * Minimal QR Code generator — byte mode, EC level L.
 * Supports versions 1–20 (up to ~858 bytes of data).
 * No external dependencies.
 */

// Version capacities for byte mode, EC level L (data codewords)
const VERSION_CAP: number[] = [
  0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271,
  321, 367, 425, 458, 520, 586, 644, 718, 792, 858,
];

// EC codewords per block for each version (level L)
const EC_PER_BLOCK: number[] = [
  0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18,
  20, 24, 26, 30, 22, 24, 28, 30, 28, 28,
];

// Number of EC blocks for each version (level L)
const NUM_BLOCKS: number[] = [
  0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2,
  4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
];

// Total data codewords per version
const TOTAL_CW: number[] = [
  0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
  404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
];

// Alignment pattern positions by version
const ALIGN_POS: number[][] = [
  [], [], [6,18], [6,22], [6,26], [6,30], [6,34],
  [6,22,38], [6,24,42], [6,26,46], [6,28,50],
  [6,30,54], [6,32,58], [6,34,62], [6,26,46,66],
  [6,26,48,70], [6,26,50,74], [6,30,54,78],
  [6,30,56,82], [6,30,58,86], [6,34,62,90],
];

// GF(256) tables
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/** Generate Reed-Solomon EC codewords */
function rsEncode(data: number[], ecLen: number): number[] {
  // Build generator polynomial
  const gen = new Uint8Array(ecLen + 1);
  gen[0] = 1;
  for (let i = 0; i < ecLen; i++) {
    for (let j = ecLen; j > 0; j--) {
      gen[j] = gen[j] ^ gfMul(gen[j - 1], EXP[i]);
    }
    gen[0] = gfMul(gen[0], EXP[i]);
  }

  const msg = new Uint8Array(data.length + ecLen);
  for (let i = 0; i < data.length; i++) msg[i] = data[i];

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j <= ecLen; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }

  return Array.from(msg.slice(data.length));
}

/** Encode string to QR byte-mode bit stream */
function encodeData(str: string, version: number): number[] {
  const bytes = new TextEncoder().encode(str);
  const bits: number[] = [];

  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  // Mode indicator: 0100 (byte mode)
  push(4, 4);
  // Character count (8 bits for v1-9, 16 bits for v10+)
  push(bytes.length, version <= 9 ? 8 : 16);
  // Data
  for (const b of bytes) push(b, 8);
  // Terminator (up to 4 bits)
  const totalBits = TOTAL_CW[version] * 8 - (TOTAL_CW[version] - VERSION_CAP[version]) * 8;
  const dataCW = VERSION_CAP[version];
  const needed = dataCW * 8;
  const termLen = Math.min(4, needed - bits.length);
  push(0, termLen);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad codewords
  const pads = [0xEC, 0x11];
  let pi = 0;
  while (bits.length < needed) {
    push(pads[pi], 8);
    pi = 1 - pi;
  }

  // Convert to codewords
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let cw = 0;
    for (let j = 0; j < 8; j++) cw = (cw << 1) | (bits[i + j] || 0);
    codewords.push(cw);
  }
  return codewords;
}

function getSize(version: number): number {
  return 17 + version * 4;
}

/** Create empty matrix */
function createMatrix(size: number): (number | null)[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

/** Place finder pattern */
function placeFinder(m: (number | null)[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r, cc = col + c;
      if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
      const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                      (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                      (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      m[rr][cc] = isBlack ? 1 : 0;
    }
  }
}

/** Place alignment pattern */
function placeAlignment(m: (number | null)[][], row: number, col: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      if (m[row + r][col + c] !== null) return; // Skip if overlaps finder
    }
  }
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const isBlack = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
      m[row + r][col + c] = isBlack ? 1 : 0;
    }
  }
}

/** Place timing patterns */
function placeTiming(m: (number | null)[][]) {
  const size = m.length;
  for (let i = 8; i < size - 8; i++) {
    if (m[6][i] === null) m[6][i] = i % 2 === 0 ? 1 : 0;
    if (m[i][6] === null) m[i][6] = i % 2 === 0 ? 1 : 0;
  }
}

/** Reserve format info areas */
function reserveFormat(m: (number | null)[][]) {
  const size = m.length;
  for (let i = 0; i < 8; i++) {
    if (m[8][i] === null) m[8][i] = 0;
    if (m[i][8] === null) m[i][8] = 0;
    if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = 0;
    if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = 0;
  }
  m[8][8] = 0; // Always dark
  m[size - 8][8] = 1; // Dark module
}

/** Reserve version info areas (v7+) */
function reserveVersion(m: (number | null)[][], version: number) {
  if (version < 7) return;
  const size = m.length;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      if (m[i][size - 11 + j] === null) m[i][size - 11 + j] = 0;
      if (m[size - 11 + j][i] === null) m[size - 11 + j][i] = 0;
    }
  }
}

/** Place data bits in the matrix */
function placeData(m: (number | null)[][], dataBits: number[]) {
  const size = m.length;
  let bitIdx = 0;
  let upward = true;

  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5; // Skip timing column
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (m[row][cc] === null) {
          m[row][cc] = bitIdx < dataBits.length ? dataBits[bitIdx] : 0;
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }
}

/** Apply mask pattern */
function applyMask(m: number[][], pattern: number, reserved: (number | null)[][]) {
  const size = m.length;
  const maskFn = [
    (r: number, c: number) => (r + c) % 2 === 0,
    (r: number, _c: number) => r % 2 === 0,
    (_r: number, c: number) => c % 3 === 0,
    (r: number, c: number) => (r + c) % 3 === 0,
    (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r: number, c: number) => (r * c) % 2 + (r * c) % 3 === 0,
    (r: number, c: number) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
    (r: number, c: number) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
  ][pattern];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c] !== null) continue; // Don't mask reserved areas
      if (maskFn(r, c)) m[r][c] ^= 1;
    }
  }
}

/** Calculate penalty score for mask selection */
function penalty(m: number[][]): number {
  const size = m.length;
  let score = 0;

  // Rule 1: Consecutive same-color modules in row/col
  for (let r = 0; r < size; r++) {
    let count = 1;
    for (let c = 1; c < size; c++) {
      if (m[r][c] === m[r][c - 1]) { count++; }
      else { if (count >= 5) score += count - 2; count = 1; }
    }
    if (count >= 5) score += count - 2;
  }
  for (let c = 0; c < size; c++) {
    let count = 1;
    for (let r = 1; r < size; r++) {
      if (m[r][c] === m[r - 1][c]) { count++; }
      else { if (count >= 5) score += count - 2; count = 1; }
    }
    if (count >= 5) score += count - 2;
  }

  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }

  return score;
}

/** Write format info (EC level L = 01, mask pattern) */
function writeFormat(m: number[][], mask: number) {
  const size = m.length;
  // Format info = 5 bits (EC level 01 + mask) + 10 EC bits
  let data = (1 << 3) | mask; // EC level L = 01
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem & 0x200) ? 0x537 : 0);
  }
  // Wait, need to recalculate properly
  let bits = data << 10;
  let div = 0x537 << 4;
  for (let i = 14; i >= 10; i--) {
    if (bits & (1 << i)) bits ^= div;
    div >>= 1;
  }
  bits = (data << 10) | bits;
  bits ^= 0x5412; // XOR mask

  // Place format info
  const fmtBits: number[] = [];
  for (let i = 14; i >= 0; i--) fmtBits.push((bits >> i) & 1);

  // Around top-left finder
  const positions1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  // Around bottom-left + top-right finder
  const positions2 = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];

  for (let i = 0; i < 15; i++) {
    m[positions1[i][0]][positions1[i][1]] = fmtBits[i];
    m[positions2[i][0]][positions2[i][1]] = fmtBits[i];
  }
}

/** Write version info (v7+) */
function writeVersion(m: number[][], version: number) {
  if (version < 7) return;
  const size = m.length;
  let rem = version;
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ ((rem & 0x800) ? 0x1f25 : 0);
  }
  // Recalculate properly
  let bits = version;
  for (let i = 0; i < 12; i++) {
    bits = (bits << 1) ^ ((bits >> 17) ? 0x1f25 : 0);
  }
  // Actually, simpler approach:
  let vBits = version << 12;
  let divisor = 0x1f25;
  for (let i = 17; i >= 12; i--) {
    if (vBits & (1 << i)) vBits ^= divisor << (i - 12);
  }
  vBits = (version << 12) | vBits;

  for (let i = 0; i < 18; i++) {
    const bit = (vBits >> i) & 1;
    const r = Math.floor(i / 3);
    const c = size - 11 + (i % 3);
    m[r][c] = bit;
    m[c][r] = bit;
  }
}

/**
 * Generate a QR code matrix from a string.
 * Returns a 2D boolean array (true = black module).
 * Returns null if the data is too large.
 */
export function generateQR(text: string): boolean[][] | null {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 858) return null; // Too large for version 20

  // Find smallest version
  let version = 1;
  while (version <= 20 && bytes.length > VERSION_CAP[version]) version++;
  if (version > 20) return null;

  const size = getSize(version);

  // Step 1: Create reserved pattern matrix (to know which cells are "function patterns")
  const reserved = createMatrix(size);
  placeFinder(reserved, 0, 0);
  placeFinder(reserved, 0, size - 7);
  placeFinder(reserved, size - 7, 0);

  if (version >= 2) {
    const positions = ALIGN_POS[version] || [];
    for (const r of positions) {
      for (const c of positions) {
        placeAlignment(reserved, r, c);
      }
    }
  }
  placeTiming(reserved);
  reserveFormat(reserved);
  reserveVersion(reserved, version);

  // Step 2: Encode data
  const dataCW = encodeData(text, version);
  const ecPerBlock = EC_PER_BLOCK[version];
  const numBlocks = NUM_BLOCKS[version];
  const blockSize = Math.floor(dataCW.length / numBlocks);
  const longBlocks = dataCW.length % numBlocks;

  // Split into blocks and compute EC
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const bLen = blockSize + (b >= numBlocks - longBlocks ? 1 : 0);
    const block = dataCW.slice(offset, offset + bLen);
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecPerBlock));
    offset += bLen;
  }

  // Interleave data codewords
  const interleaved: number[] = [];
  const maxDataLen = blockSize + (longBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) interleaved.push(dataBlocks[b][i]);
    }
  }
  // Interleave EC codewords
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      interleaved.push(ecBlocks[b][i]);
    }
  }

  // Convert to bits
  const dataBits: number[] = [];
  for (const cw of interleaved) {
    for (let i = 7; i >= 0; i--) dataBits.push((cw >> i) & 1);
  }

  // Step 3: Build matrix with data
  const matrix = reserved.map(row => [...row]);
  placeData(matrix, dataBits);

  // Step 4: Try all 8 mask patterns, pick best
  let bestMask = 0;
  let bestPenalty = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = matrix.map(row => [...row]) as number[][];
    applyMask(candidate, mask, reserved);
    writeFormat(candidate, mask);
    writeVersion(candidate, version);
    const p = penalty(candidate);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMask = mask;
    }
  }

  // Apply best mask
  const final = matrix.map(row => [...row]) as number[][];
  applyMask(final, bestMask, reserved);
  writeFormat(final, bestMask);
  writeVersion(final, version);

  return final.map(row => row.map(cell => cell === 1));
}
