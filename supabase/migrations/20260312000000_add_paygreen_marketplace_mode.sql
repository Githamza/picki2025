ALTER TABLE vendors
  ADD COLUMN paygreen_mode text NOT NULL DEFAULT 'independent'
  CHECK (paygreen_mode IN ('independent', 'marketplace'));
