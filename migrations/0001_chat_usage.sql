-- チャットの回数の記録（日本時間の日付 × キー）。キーは ip:<ハッシュ> または all
CREATE TABLE IF NOT EXISTS chat_usage (
  day TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key)
);
