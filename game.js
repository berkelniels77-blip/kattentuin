export const maxLives = 3;

export function replay(level, attempts) {
  if (!Array.isArray(attempts) || attempts.length > level.n + maxLives) return null;
  const cats = new Set();
  let lives = maxLives;
  for (const index of attempts) {
    if (!Number.isInteger(index) || index < 0 || index >= level.n ** 2 ||
        cats.has(index) || !lives || cats.size === level.n) return null;
    if (level.solution.includes(index)) cats.add(index);
    else lives--;
  }
  return {cats, lives, won: cats.size === level.n};
}

export function runScore(level, attempts) {
  const result = replay(level, attempts);
  return result?.won ? 100 + result.lives * 20 : 0;
}
