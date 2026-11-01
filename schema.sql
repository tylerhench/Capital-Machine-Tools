-- Capital Machine Tools — inventory database
-- Paste this whole file into the D1 console once, at setup.
-- (Cloudflare dashboard → Storage & Databases → D1 → cmt-inventory → Console)
-- Running it again is safe: it only creates what is missing.

CREATE TABLE IF NOT EXISTS machines (
  id           TEXT PRIMARY KEY,               -- e.g. 2008-haas-vf-2, used in page links
  published    INTEGER NOT NULL DEFAULT 1,     -- 1 = on the website, 0 = hidden
  status       TEXT    NOT NULL DEFAULT 'available',  -- available, pending, sold
  category     TEXT    NOT NULL,
  year         INTEGER,
  manufacturer TEXT    NOT NULL,
  model        TEXT    NOT NULL,
  type         TEXT    NOT NULL,
  price        INTEGER NOT NULL DEFAULT 0,
  show_price   INTEGER NOT NULL DEFAULT 1,
  specs        TEXT    NOT NULL DEFAULT '[]',  -- JSON: [["Swing","15 in"], ...]
  power        TEXT    NOT NULL DEFAULT '',
  condition    TEXT    NOT NULL DEFAULT '',
  description  TEXT    NOT NULL DEFAULT '',
  photos       TEXT    NOT NULL DEFAULT '[]',  -- JSON: ["/photos/abc.jpg", ...]
  video        TEXT    NOT NULL DEFAULT '',    -- YouTube video ID
  date_added   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  updated_by   TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS machines_live ON machines (published, status);
