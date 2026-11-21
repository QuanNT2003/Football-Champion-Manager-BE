-- Apply once to an existing database. Do not use the root reset schema for upgrades.
-- Preflight: this query must return no rows before adding the unique constraint:
-- SELECT club_id, season_id, COUNT(*) FROM youth_intakes
-- GROUP BY club_id, season_id HAVING COUNT(*) > 1;
-- Resolve existing duplicates deliberately; this script never deletes intake/player data.

ALTER TABLE `youth_intakes`
  ADD COLUMN `academy_level_snapshot` TINYINT UNSIGNED NULL
    COMMENT 'Cap hoc vien khi sinh lua; NULL neu du lieu cu khong xac dinh' AFTER `quality_rating`,
  ADD UNIQUE KEY `uq_youth_intakes_club_season` (`club_id`, `season_id`);

CREATE TABLE `youth_intake_candidates` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `youth_intake_id` BIGINT UNSIGNED NOT NULL,
  `nationality_id` BIGINT UNSIGNED NOT NULL,
  `primary_position_id` BIGINT UNSIGNED NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `age` TINYINT UNSIGNED NOT NULL COMMENT 'Tuoi khi sinh ung vien (14-16)',
  `ovr` TINYINT UNSIGNED NOT NULL,
  `potential` TINYINT UNSIGNED NOT NULL,
  `profile_data` JSON NOT NULL COMMENT 'Ho so co dinh: the chat, ngay sinh trong game, anh, vi tri phu, attributes, mentality, tactics',
  `status` ENUM('AVAILABLE', 'SIGNED', 'EXPIRED') NOT NULL DEFAULT 'AVAILABLE',
  `signed_player_id` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `signed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_youth_candidates_signed_player` (`signed_player_id`),
  KEY `idx_youth_candidates_intake_status` (`youth_intake_id`, `status`),
  KEY `idx_youth_candidates_nationality` (`nationality_id`),
  KEY `idx_youth_candidates_position` (`primary_position_id`),
  CONSTRAINT `fk_youth_candidates_intake` FOREIGN KEY (`youth_intake_id`) REFERENCES `youth_intakes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_youth_candidates_nationality` FOREIGN KEY (`nationality_id`) REFERENCES `countries` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_youth_candidates_position` FOREIGN KEY (`primary_position_id`) REFERENCES `positions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_youth_candidates_signed_player` FOREIGN KEY (`signed_player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Fixed seasonal youth recruitment candidates';

-- Lifecycle implemented by AcademyService:
-- Snapshot the level/count for every club at season initialization.
-- Generate and persist the full pool once when recruitment is first opened.
-- Keep player_count as the ORIGINAL count; remaining = COUNT(status = 'AVAILABLE').
-- Sign in one transaction: check the current transfer window, claim AVAILABLE candidate,
-- create player from the persisted profile, then set SIGNED/signed_player_id/signed_at.
-- A deleted signed player must not make a SIGNED candidate AVAILABLE again.
-- Expire only unsigned candidates at season rollover. Keep historical intakes:
-- players.youth_intake_id currently cascades on intake deletion.
