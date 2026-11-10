/**
 * Deterministic Seeded Pseudo-Random Number Generator (Mulberry32).
 * Returns a callable function `rng()` producing floats in [0, 1),
 * enriched with utility methods (.range, .int, .pick, .chance, .fork, .reset).
 */
export function hashSeed(seed) {
    if (typeof seed === 'number' && Number.isFinite(seed)) {
        return seed >>> 0;
    }
    const str = String(seed ?? 'hollywoodos2');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export function createRNG(seed = 'hollywoodos2') {
    const initialState = hashSeed(seed) || 0x1337beef;
    let state = initialState;

    const next = () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const rng = () => next();

    rng.next = next;
    rng.seed = initialState;

    rng.range = (min, max) => min + next() * (max - min);

    rng.int = (min, max) => {
        if (max === undefined) {
            return Math.floor(next() * min);
        }
        return min + Math.floor(next() * (max - min + 1));
    };

    rng.pick = (array) => {
        if (!Array.isArray(array) || array.length === 0) return undefined;
        return array[Math.floor(next() * array.length)];
    };

    rng.chance = (probability = 0.5) => next() < probability;

    rng.fork = (salt = '') => {
        const combined = `${initialState}:${salt}`;
        return createRNG(combined);
    };

    rng.reset = (newSeed) => {
        state = newSeed !== undefined ? (hashSeed(newSeed) || 0x1337beef) : initialState;
    };

    return rng;
}
