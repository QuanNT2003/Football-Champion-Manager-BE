// Explicit opt-in integration check: all fixture/gameplay writes are rolled back.
const assert = require('node:assert/strict');
require('dotenv').config();
require('reflect-metadata');
require('tsconfig-paths').register({ baseUrl: './dist', paths: { '@/*': ['*'] } });
const { PrismaClient } = require('@prisma/client');
const { AcademyService } = require('../dist/modules/academy/academy.service');
const { academyContractExpirationWhere } = require('../dist/modules/academy/academy.rules');
const prisma = new PrismaClient();
const rollback = new Error('ACADEMY_TEST_ROLLBACK');
let fixtureWorldId;

async function main() {
  const user = await prisma.users.findFirst({ select: { id: true } });
  const template = await prisma.clubs.findFirst({ select: { country_id: true, city_id: true } });
  assert.ok(user && template, 'Integration check requires seeded users and clubs');
  try {
    await prisma.$transaction(async tx => {
      const date = new Date('2026-11-01T00:00:00Z');
      const world = await tx.game_worlds.create({ data: { name: '__academy_rollback_test__', current_date: date, status: 'ACTIVE' } });
      fixtureWorldId = world.id;
      const season = await tx.seasons.create({ data: {
        world_id: world.id, name: 'Academy test season 1', season_number: 1,
        total_days: 36, current_day: 1, start_date: date, status: 'ACTIVE', is_transfer_window_open: true,
      } });
      await tx.server_timeline.create({ data: {
        world_id: world.id, season_id: season.id, season_number: 1, season_day: 1,
        total_season_days: 36, world_day: 1, real_date: date, is_transfer_window_open: true,
      } });
      const club = await tx.clubs.create({ data: {
        world_id: world.id, owner_user_id: user.id, country_id: template.country_id,
        city_id: template.city_id, name: '__academy_rollback_test__', status: 'ACTIVE',
      } });
      // Execute the actual service against a single rollback-only transaction.
      const adapter = new Proxy(tx, { get(target, property) {
        return property === '$transaction' ? work => work(tx) : Reflect.get(target, property);
      } });
      const academy = new AcademyService(adapter);
      await academy.initializeSeason(season.id);
      const level10 = await tx.facility_levels.findFirst({ where: { level: 10, facility_types: { code: 'YOUTH_ACADEMY' } } });
      assert.ok(level10, 'Integration check requires the level 10 youth academy catalog');
      await tx.facilities.create({ data: {
        club_id: club.id, facility_type_id: level10.facility_type_id, facility_level_id: level10.id, status: 'OPERATIONAL',
      } });
      const overview = await academy.getOverview(user.id, club.id);
      assert.equal(overview.academyLevel, 10);
      assert.equal(overview.intakeLevel, 1);
      assert.equal(overview.remainingCandidates, 5);
      const pool = await academy.getRecruitment(user.id, club.id);
      assert.equal(pool.candidates.length, 5);
      assert.deepEqual(await academy.getRecruitment(user.id, club.id), pool);
      const snapshot = await tx.youth_intake_candidates.findUnique({ where: { id: pool.candidates[0].id } });
      const signed = await academy.signCandidate(user.id, club.id, snapshot.id);
      assert.equal(signed.remainingCandidates, 4);
      const player = await tx.players.findUnique({ where: { id: signed.playerId }, include: {
        player_attributes: true, player_mentality: true, player_tactics: true,
        player_positions: true, player_status: true, player_contracts: true, player_statistics: true,
      } });
      assert.equal(player.squad_type, 'YOUTH_U21');
      assert.equal(player.current_club_id, club.id);
      assert.equal(player.ovr, snapshot.ovr);
      assert.equal(player.potential, snapshot.potential);
      for (const [key, value] of Object.entries(snapshot.profile_data.attributes)) assert.equal(player.player_attributes[key], value);
      assert.equal(player.player_contracts[0].status, 'ACTIVE');
      assert.equal(player.player_contracts[0].start_season_id, 1n);
      assert.equal(player.player_contracts[0].end_season_id, 3n);
      assert.equal(player.player_statistics.length, 1);
      assert.ok(player.player_mentality && player.player_tactics && player.player_status && player.player_positions.length);
      await assert.rejects(() => academy.signCandidate(user.id, club.id, snapshot.id), error => error.getStatus() === 409);
      await tx.server_timeline.update({ where: { world_id: world.id }, data: { is_transfer_window_open: false } });
      await assert.rejects(() => academy.getRecruitment(user.id, club.id), error => error.getStatus() === 400);
      assert.equal((await academy.getOverview(user.id, club.id)).canRecruit, false);
      await tx.server_timeline.update({ where: { world_id: world.id }, data: { is_transfer_window_open: true, season_day: 18 } });
      assert.deepEqual((await academy.getRecruitment(user.id, club.id)).candidates, pool.candidates.slice(1));
      await tx.seasons.update({ where: { id: season.id }, data: { status: 'COMPLETED' } });
      await academy.expireSeason(season.id);
      const next = await tx.seasons.create({ data: {
        world_id: world.id, name: 'Academy test season 2', season_number: 2,
        total_days: 36, current_day: 1, start_date: new Date('2026-12-07T00:00:00Z'), status: 'ACTIVE',
      } });
      await tx.server_timeline.update({ where: { world_id: world.id }, data: { season_id: next.id, season_number: 2, season_day: 1 } });
      await academy.initializeSeason(next.id);
      assert.equal(await tx.player_contracts.count({ where: academyContractExpirationWhere(world.id, next.id, 2) }), 0);
      assert.equal(await tx.player_contracts.count({ where: academyContractExpirationWhere(world.id, next.id + 10n, 3) }), 1);
      assert.equal(await tx.player_contracts.count({ where: academyContractExpirationWhere(world.id + 999n, next.id + 10n, 3) }), 0);
      const nextPool = await academy.getRecruitment(user.id, club.id);
      assert.equal(nextPool.candidates.length, 10);
      assert.equal(await tx.youth_intake_candidates.count({ where: { youth_intake_id: snapshot.youth_intake_id, status: 'EXPIRED' } }), 4);
      assert.equal(await tx.players.count({ where: { world_id: world.id } }), 1);
      assert.equal((await tx.youth_intake_candidates.findUnique({ where: { id: snapshot.id } })).status, 'SIGNED');
      throw rollback;
    }, { isolationLevel: 'ReadCommitted', timeout: 30000 });
  } catch (error) {
    if (error !== rollback && error.message !== rollback.message) throw error;
  }
  assert.equal(await prisma.game_worlds.findUnique({ where: { id: fixtureWorldId } }), null, 'Fixture writes must be rolled back');
  console.log('MySQL integration passed: fixed pool, upgrade snapshot, complete signing, duplicate prevention, transfer lock, midseason reuse, rollover, and fixture rollback.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
