ALTER TABLE machines ADD COLUMN ebay_item_id TEXT NOT NULL DEFAULT '';   -- the eBay listing number, if linked
ALTER TABLE machines ADD COLUMN ebay_status  TEXT NOT NULL DEFAULT '';   -- listed, ended, error
ALTER TABLE machines ADD COLUMN ebay_error   TEXT NOT NULL DEFAULT '';   -- eBay's last complaint, in plain words
ALTER TABLE machines ADD COLUMN ebay_data    TEXT NOT NULL DEFAULT '{}'; -- category, item specifics, policies from eBay

CREATE INDEX IF NOT EXISTS machines_ebay ON machines (ebay_item_id);

-- Private settings, such as the encrypted eBay sign-in
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
