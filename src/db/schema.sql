CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone            VARCHAR(20) UNIQUE NOT NULL,
  email            VARCHAR(255) UNIQUE,
  display_name     VARCHAR(60) NOT NULL,
  date_of_birth    DATE NOT NULL,
  is_verified      BOOLEAN DEFAULT FALSE,
  is_active        BOOLEAN DEFAULT TRUE,
  avatar_color     VARCHAR(7) DEFAULT '#534AB7',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT users_must_be_adult CHECK (
    date_of_birth <= CURRENT_DATE - INTERVAL '18 years'
  )
);

CREATE TABLE otp_codes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone        VARCHAR(20) NOT NULL,
  code_hash    TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  used         BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_phone   ON otp_codes(phone);
CREATE INDEX idx_otp_expires ON otp_codes(expires_at);

CREATE TABLE consent_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiator_id     UUID NOT NULL REFERENCES users(id),
  recipient_id     UUID NOT NULL REFERENCES users(id),
  terms_text       TEXT,
  categories       TEXT[] DEFAULT '{}',
  boundaries       TEXT[] DEFAULT '{}',
  expires_at       TIMESTAMPTZ NOT NULL,
  valid_from       TIMESTAMPTZ DEFAULT NOW(),
  status           VARCHAR(20) DEFAULT 'pending',
  agreement_hash   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_consent CHECK (initiator_id != recipient_id),
  CONSTRAINT valid_status CHECK (status IN ('pending','accepted','declined','expired','revoked'))
);

CREATE INDEX idx_requests_initiator ON consent_requests(initiator_id);
CREATE INDEX idx_requests_recipient ON consent_requests(recipient_id);
CREATE INDEX idx_requests_status    ON consent_requests(status);
CREATE INDEX idx_requests_expires   ON consent_requests(expires_at);

CREATE TABLE signatures (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id         UUID NOT NULL REFERENCES consent_requests(id),
  user_id            UUID NOT NULL REFERENCES users(id),
  signed_at          TIMESTAMPTZ DEFAULT NOW(),
  device_fingerprint TEXT,
  ip_hash            TEXT,
  CONSTRAINT one_signature_per_user_per_request UNIQUE (request_id, user_id)
);

CREATE INDEX idx_signatures_request ON signatures(request_id);
CREATE INDEX idx_signatures_user    ON signatures(user_id);

CREATE TABLE records (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  request_id       UUID NOT NULL REFERENCES consent_requests(id),
  other_party_name VARCHAR(60) NOT NULL,
  other_party_id   UUID,
  terms_snapshot   JSONB NOT NULL,
  agreement_hash   TEXT NOT NULL,
  signed_at        TIMESTAMPTZ NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  status           VARCHAR(20) NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_records_owner   ON records(owner_id);
CREATE INDEX idx_records_request ON records(request_id);
CREATE INDEX idx_records_signed  ON records(signed_at DESC);

CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type   VARCHAR(50) NOT NULL,
  request_id   UUID REFERENCES consent_requests(id),
  actor_id     UUID REFERENCES users(id),
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_request ON audit_log(request_id);
CREATE INDEX idx_audit_actor   ON audit_log(actor_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

CREATE TABLE push_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE TABLE consent_categories (
  id    SERIAL PRIMARY KEY,
  label VARCHAR(60) NOT NULL,
  emoji VARCHAR(4)
);

INSERT INTO consent_categories (label, emoji) VALUES
  ('Kissing', '💋'),
  ('Hugging', '🤗'),
  ('Holding hands', '🤝'),
  ('Massage', '💆'),
  ('Cuddling', '🛋️'),
  ('Sexual activity', '🔒'),
  ('Photography', '📷'),
  ('Other (see notes)', '📝');

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER requests_updated_at
  BEFORE UPDATE ON consent_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION prevent_record_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Records cannot be deleted. This is by design. (May I)';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER records_no_delete
  BEFORE DELETE ON records FOR EACH ROW EXECUTE FUNCTION prevent_record_delete();

CREATE OR REPLACE FUNCTION prevent_signature_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Signatures cannot be deleted.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signatures_no_delete
  BEFORE DELETE ON signatures FOR EACH ROW EXECUTE FUNCTION prevent_signature_delete();
