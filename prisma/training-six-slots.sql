-- Apply once to an existing database; preserves historical single-drill sessions.
ALTER TABLE `training_sessions`
  ADD COLUMN `plan` JSON NULL COMMENT 'Ordered six drills and training environment snapshot',
  ADD COLUMN `results` JSON NULL COMMENT 'Committed per-player fitness, chances and attribute gains';
