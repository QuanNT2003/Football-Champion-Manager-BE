export const MAX_SPONSORSHIPS = 4;
export const MIN_SPONSOR_AMOUNT = 1_000_000;
export const MAX_SPONSOR_AMOUNT = 100_000_000;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function sponsorshipProfile(reputation: number, financeLevel: number) {
  const rep = clamp(reputation, 0, 10000) / 10000;
  const level = clamp(financeLevel, 0, 10) / 10;
  return {
    appeal: rep * 0.65 + level * 0.35,
    offerCount: 4 + Math.floor(level * 4),
  };
}

/** Every integer 1..100M is possible; weight strictly decreases as value rises. */
export function rollSponsorshipAmount(appeal: number, random = Math.random) {
  const exponent = 10 - 7 * clamp(appeal, 0, 1);
  return (1 + Math.min(99, Math.floor(100 * Math.pow(clamp(random(), 0, 1), exponent)))) * MIN_SPONSOR_AMOUNT;
}

/** Weighted sampling without replacement: renowned brands prefer stronger clubs. */
export function selectSponsors<T extends { reputation: number }>(sponsors: T[], count: number, appeal: number, random = Math.random): T[] {
  const pool = [...sponsors];
  const selected: T[] = [];
  while (pool.length && selected.length < count) {
    const weights = pool.map(sponsor => Math.exp(-Math.max(0, sponsor.reputation / 10000 - appeal) * 6));
    let roll = clamp(random(), 0, 1) * weights.reduce((sum, weight) => sum + weight, 0);
    let index = 0;
    while (index < pool.length - 1 && roll >= weights[index]) roll -= weights[index++];
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}
