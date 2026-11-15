-- AIDNode D1 schema (structure only, no data). Dumped read-only from production botstop-dev-db on 2026-11-15.

CREATE TABLE accounts (id TEXT PRIMARY KEY,name TEXT NOT NULL,api_key_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'trial' CHECK(status IN ('trial','trial_full','active','paused')),trial_used INTEGER NOT NULL DEFAULT 0 CHECK(trial_used BETWEEN 0 AND 100),credit_units INTEGER NOT NULL DEFAULT 0 CHECK(credit_units >= 0),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE activation_events (id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),units_added INTEGER NOT NULL,charged_trial_units INTEGER NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE beta_accounts (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id),
  operator_key_hash TEXT NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_calls INTEGER NOT NULL DEFAULT 0 CHECK(completed_calls >= 0),
  max_calls INTEGER NOT NULL DEFAULT 500 CHECK(max_calls BETWEEN 100 AND 500),
  last_used_at TEXT
);

CREATE TABLE beta_feedback (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  checkpoint INTEGER NOT NULL CHECK(checkpoint IN (10,50,100,250,500)),
  service TEXT NOT NULL CHECK(service IN ('repair','verify','witness','overall')),
  helpful TEXT NOT NULL CHECK(helpful IN ('yes','no','unsure')),
  would_reuse TEXT NOT NULL CHECK(would_reuse IN ('yes','no','unsure')),
  would_pay_half_cent TEXT NOT NULL CHECK(would_pay_half_cent IN ('yes','no','unsure')),
  outcome TEXT NOT NULL CHECK(outcome IN ('resolved','partially_resolved','not_resolved','not_applicable')),
  comment TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id,checkpoint,service)
);

CREATE TABLE beta_registration_sources (
  source_bucket_hash TEXT PRIMARY KEY,
  claims INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE operations (id TEXT NOT NULL,account_id TEXT NOT NULL REFERENCES accounts(id),tool TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, request_hash TEXT, result_json TEXT,PRIMARY KEY(account_id,id));

CREATE INDEX beta_feedback_by_date ON beta_feedback(submitted_at);

CREATE INDEX operations_by_account ON operations(account_id,created_at);

CREATE TRIGGER account_for_operation AFTER INSERT ON operations
BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM accounts a WHERE a.id = NEW.account_id AND (
   EXISTS (SELECT 1 FROM beta_accounts b WHERE b.account_id=a.id AND b.completed_calls < b.max_calls)
   OR (NOT EXISTS (SELECT 1 FROM beta_accounts b WHERE b.account_id=a.id) AND
       ((a.status='trial' AND a.trial_used < 100) OR (a.status='active' AND a.credit_units >= 1)))
  )
 ) THEN RAISE(ABORT,'access_exhausted') END;
 UPDATE beta_accounts SET completed_calls=completed_calls+1,last_used_at=CURRENT_TIMESTAMP WHERE account_id=NEW.account_id;
 UPDATE accounts SET trial_used=MIN(100,trial_used+1),status=CASE WHEN trial_used+1>=100 THEN 'trial_full' ELSE 'trial' END
   WHERE id=NEW.account_id AND EXISTS (SELECT 1 FROM beta_accounts WHERE account_id=NEW.account_id) AND status='trial';
 UPDATE accounts SET trial_used=trial_used+1,status=CASE WHEN trial_used+1>=100 THEN 'trial_full' ELSE 'trial' END
   WHERE id=NEW.account_id AND NOT EXISTS (SELECT 1 FROM beta_accounts WHERE account_id=NEW.account_id) AND status='trial';
 UPDATE accounts SET credit_units=credit_units-1 WHERE id=NEW.account_id AND status='active' AND
   NOT EXISTS (SELECT 1 FROM beta_accounts WHERE account_id=NEW.account_id);
END;

CREATE TRIGGER activate_simulated AFTER INSERT ON activation_events WHEN NEW.source='simulation' BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM accounts WHERE id=NEW.account_id AND status='trial_full' AND trial_used=100) THEN RAISE(ABORT,'trial_not_complete') END; UPDATE accounts SET status='active',credit_units=credit_units+NEW.units_added-NEW.charged_trial_units WHERE id=NEW.account_id; END;

CREATE TRIGGER beta_cohort_cap BEFORE INSERT ON beta_accounts
BEGIN
 SELECT CASE WHEN (SELECT count(*) FROM beta_accounts) >= 100 THEN RAISE(ABORT,'beta_cohort_full') END;
END;
