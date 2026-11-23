import type { Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';

export const FACILITY_UPGRADE_DAYS = 2;
export const FACILITY_UPGRADE_HOURS = 48;
export const FACILITY_UPGRADE_MS = FACILITY_UPGRADE_HOURS * 60 * 60 * 1000;
export const FACILITY_UPGRADE_ACTIVE = 'IN_PROGRESS';
export const STADIUM_UPGRADE_COST = 10_000_000;
export const STADIUM_CAPACITY_INCREMENT = 5_000;

/** The persisted start timestamp is authoritative, regardless of game-day changes. */
export function upgradeTiming(upgrade: { started_at: Date }, now = new Date()) {
  const completesAt = new Date(upgrade.started_at.getTime() + FACILITY_UPGRADE_MS);
  const seconds = Math.max(0, Math.ceil((completesAt.getTime() - now.getTime()) / 1000));
  return {
    started_at: upgrade.started_at.toISOString(), completes_at: completesAt.toISOString(),
    server_time: now.toISOString(), remaining_seconds: seconds,
    days_remaining: Math.ceil(seconds / 86400),
  };
}

/** Call after locking the club row, for both kinds of construction. */
export async function assertConstructionSlot(db: Prisma.TransactionClient, clubId: bigint) {
  const active = await db.facility_upgrades.findFirst({
    where: { status: FACILITY_UPGRADE_ACTIVE, OR: [{ facilities: { club_id: clubId } }, { stadiums: { club_id: clubId } }] },
  });
  if (active) {
    if (upgradeTiming(active).remaining_seconds === 0) await progressFacilityUpgrades(db, undefined, new Date(), active.id);
    else throw new ConflictException('CLB đang nâng cấp một công trình. Vui lòng chờ hoàn tất trước khi nâng cấp công trình khác.');
  }
}

export async function stadiumUpgradeDetails(db: Prisma.TransactionClient, stadium: { id: bigint; capacity: number }) {
  const [active, completed] = await Promise.all([
    db.facility_upgrades.findFirst({ where: { stadium_id: stadium.id, status: FACILITY_UPGRADE_ACTIVE } }),
    db.facility_upgrades.count({ where: { stadium_id: stadium.id, status: 'COMPLETED' } }),
  ]);
  return {
    upgrade_cost: STADIUM_UPGRADE_COST, upgrade_days: FACILITY_UPGRADE_DAYS,
    capacity_increment: STADIUM_CAPACITY_INCREMENT,
    next_capacity: stadium.capacity + STADIUM_CAPACITY_INCREMENT,
    completed_expansions: completed,
    active_upgrade: active ? {
      id: active.id.toString(), cost: Number(active.cost),
      from_capacity: active.from_capacity, to_capacity: active.to_capacity,
      upgrade_days: FACILITY_UPGRADE_DAYS, ...upgradeTiming(active),
      start_season_id: active.start_season_id.toString(), start_season_day: active.start_season_day,
      completion_season_day: active.completion_season_day,
    } : null,
  };
}

interface FacilityRow {
  id: bigint;
  facility_type_id: bigint;
  facility_levels: { level: number };
}

/** Read prices from the configured NEXT level, never from the current level. */
export async function facilityUpgradeDetails(db: Prisma.TransactionClient, facilities: FacilityRow[]) {
  if (!facilities.length) return new Map();
  const [levels, upgrades] = await Promise.all([
    db.facility_levels.findMany({ where: { facility_type_id: { in: facilities.map(f => f.facility_type_id) } } }),
    db.facility_upgrades.findMany({
      where: { facility_id: { in: facilities.map(f => f.id) }, status: FACILITY_UPGRADE_ACTIVE },
      include: { facility_levels_facility_upgrades_to_level_idTofacility_levels: true },
    }),
  ]);
  return new Map(facilities.map(f => {
    const configs = levels.filter(level => level.facility_type_id === f.facility_type_id);
    const next = configs.find(level => level.level === f.facility_levels.level + 1);
    const active = upgrades.find(upgrade => upgrade.facility_id === f.id);
    return [f.id, {
      max_level: Math.max(f.facility_levels.level, ...configs.map(level => level.level)),
      upgrade_cost: next ? Number(next.cost) : null,
      upgrade_days: FACILITY_UPGRADE_DAYS,
      active_upgrade: active ? {
        id: active.id.toString(),
        target_level: active.facility_levels_facility_upgrades_to_level_idTofacility_levels.level,
        cost: Number(active.cost),
        upgrade_days: FACILITY_UPGRADE_DAYS,
        ...upgradeTiming(active),
        start_season_id: active.start_season_id?.toString() ?? null,
        start_season_day: active.start_season_day,
        completion_season_day: active.completion_season_day,
      } : null,
    }];
  }));
}

/**
 * Run inside a transaction after locking the club. Completion depends only on
 * elapsed real time. The status claim prevents repeated capacity/level changes.
 */
export async function progressFacilityUpgrades(db: Prisma.TransactionClient, worldId?: bigint, now = new Date(), upgradeId?: bigint) {
  const upgrades = await db.facility_upgrades.findMany({
    where: { status: FACILITY_UPGRADE_ACTIVE, ...(upgradeId != null ? { id: upgradeId } : {}), ...(worldId != null ? { OR: [
      { facilities: { clubs: { world_id: worldId } } },
      { stadiums: { clubs: { world_id: worldId } } },
    ] } : {}) },
  });
  for (const upgrade of upgrades) {
    const remaining = upgradeTiming(upgrade, now).days_remaining;
    if (remaining > 0 && remaining === upgrade.days_remaining) continue;
    const claimed = await db.facility_upgrades.updateMany({
      where: { id: upgrade.id, status: FACILITY_UPGRADE_ACTIVE },
      data: { days_remaining: remaining, ...(remaining === 0 ? { status: 'COMPLETED', completed_at: now } : {}) },
    });
    if (claimed.count && remaining === 0) {
      if (upgrade.stadium_id != null) {
        const changed = await db.stadiums.updateMany({
          where: { id: upgrade.stadium_id, capacity: upgrade.from_capacity },
          data: { capacity: { increment: STADIUM_CAPACITY_INCREMENT } },
        });
        if (!changed.count) throw new ConflictException('Sức chứa sân đã thay đổi trong lúc thi công; cần kiểm tra công trình.');
      } else {
        await db.facilities.update({
          where: { id: upgrade.facility_id },
          data: { facility_level_id: upgrade.to_level_id, status: 'OPERATIONAL' },
        });
      }
    }
  }
}
