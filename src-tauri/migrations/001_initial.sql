PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS source_documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  file_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  character_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS screenplay_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  source_document_id TEXT REFERENCES source_documents(id),
  parent_version_id TEXT REFERENCES screenplay_versions(id),
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'needs-review')),
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS story_bibles (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_id TEXT NOT NULL REFERENCES screenplay_versions(id),
  facts_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS generation_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_version_id TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_id TEXT NOT NULL REFERENCES screenplay_versions(id),
  target_profile TEXT NOT NULL,
  report_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_id TEXT NOT NULL REFERENCES screenplay_versions(id),
  kind TEXT NOT NULL CHECK (kind IN ('character', 'scene', 'prop', 'ui')),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  source_locations_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS board_prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  asset_id TEXT NOT NULL REFERENCES assets(id),
  prompt_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shot_groups (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_id TEXT NOT NULL REFERENCES screenplay_versions(id),
  duration_seconds REAL NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 10),
  group_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS export_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  version_id TEXT,
  format TEXT NOT NULL CHECK (format IN ('markdown', 'json')),
  path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_source_documents_project ON source_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_versions_project ON screenplay_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_shot_groups_project ON shot_groups(project_id);
