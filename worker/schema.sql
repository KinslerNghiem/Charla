-- Anonymous venue reports.
--
-- device_hash is SHA-256 of (a random per-device id + ':' + the place id), so
-- the same visitor gets a DIFFERENT hash at every place. That is deliberate:
-- one place still needs two independent devices to reach Confirmed, but the
-- rows cannot be joined across places into one person's itinerary. Nothing
-- derived from it ever leaves the Worker.
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id TEXT NOT NULL,
  lang TEXT NOT NULL,
  positive INTEGER NOT NULL DEFAULT 1,
  role TEXT,
  shift TEXT,
  device_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_place ON reports(place_id, created_at);
-- Covers the whole /api/places aggregate so it never scans the table.
CREATE INDEX IF NOT EXISTS reports_created ON reports(created_at, place_id, lang, positive, device_hash);
-- One report per device per place per day, enforced by the database rather than
-- by a read-then-write check that races.
CREATE UNIQUE INDEX IF NOT EXISTS reports_one_per_day ON reports(device_hash, place_id, day);

-- Replies a learner flagged with "Report this reply", for the team to review.
-- Rows older than 60 days are deleted on write; see worker/src/index.ts.
CREATE TABLE IF NOT EXISTS flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id TEXT,
  reply TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL
);

-- Daily counters for the caps. One atomic upsert per request; see worker/src/caps.ts.
CREATE TABLE IF NOT EXISTS counters (
  k TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (k, day)
);
