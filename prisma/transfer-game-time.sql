ALTER TABLE transfer_offers
  ADD COLUMN season_number INT NULL,
  ADD COLUMN season_day INT NULL;

ALTER TABLE staff_offers
  ADD COLUMN season_number INT NULL,
  ADD COLUMN season_day INT NULL;

ALTER TABLE transfers ADD COLUMN season_day INT NULL;

ALTER TABLE staff_contracts
  ADD COLUMN departure_season_number INT NULL,
  ADD COLUMN departure_season_day INT NULL;
