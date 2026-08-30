use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRow { pub id: String, pub name: String, pub schema_version: i64, pub created_at: String, pub updated_at: String, pub deleted_at: Option<String>, pub source_document_ids: Vec<String>, pub active_version_id: Option<String>, pub story_bible_id: Option<String> }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenplayVersionInput { pub id: String, pub project_id: String, pub source_document_id: Option<String>, pub parent_version_id: Option<String>, pub version_number: i64, pub title: String, pub content: String, pub status: String, pub created_at: String, pub updated_at: String, pub episode_number: Option<i64>, pub entry_type: Option<String>, pub generation_context_json: Option<String> }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryBibleInput { pub id: String, pub project_id: String, pub version_id: Option<String>, pub facts: serde_json::Value, pub created_at: String, pub updated_at: String }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAssetsInput { pub project_id: String, pub assets: Vec<serde_json::Value>, pub board_prompts: Vec<serde_json::Value> }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDocumentInput {
  pub id: String,
  pub project_id: String,
  pub schema_version: i64,
  pub kind: String,
  pub title: String,
  pub body: String,
  pub sha256: String,
  pub word_count: i64,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGraph { pub project: ProjectRow, pub source_documents: Vec<serde_json::Value>, pub screenplay_versions: Vec<serde_json::Value>, pub story_bible: Option<serde_json::Value>, pub scores: Vec<serde_json::Value>, pub assets: Vec<serde_json::Value>, pub board_prompts: Vec<serde_json::Value>, pub shot_groups: Vec<serde_json::Value>, pub generation_records: Vec<serde_json::Value> }
