// Deterministic, dependency-free embedding for DEMO MODE.
// Hashing bag-of-words + bigrams into a fixed vector, L2-normalised. This makes
// cosine similarity reflect real keyword/semantic overlap, so vault search
// actually works convincingly before any Gemini key is added.

export const MOCK_EMBED_DIM = 256;

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function hashEmbed(text: string, dim = MOCK_EMBED_DIM): number[] {
  const vec = new Array(dim).fill(0);
  const tokens = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const add = (gram: string, weight: number) => {
    const idx = hashToken(gram) % dim;
    vec[idx] += weight;
  };

  for (let i = 0; i < tokens.length; i++) {
    add(tokens[i], 1);
    if (i + 1 < tokens.length) add(tokens[i] + '_' + tokens[i + 1], 0.5);
  }

  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}
