/** XP per passare dal livello N a N+1 */
const XP_PER_LEVEL = 100;

export function levelForXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function levelProgress(xp: number): { current: number; target: number; pct: number } {
  const current = xp % XP_PER_LEVEL;
  return { current, target: XP_PER_LEVEL, pct: Math.min(100, (current / XP_PER_LEVEL) * 100) };
}
