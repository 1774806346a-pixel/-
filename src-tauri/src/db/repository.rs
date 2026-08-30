use chrono::Utc;
use sqlx::{Row, SqlitePool};
use uuid::Uuid;
use super::models::{ProjectAssetsInput, ProjectGraph, ProjectRow, ScreenplayVersionInput, SourceDocumentInput, StoryBibleInput};

pub type DbResult<T> = Result<T, String>;

#[derive(Clone)]
pub struct Repository { pub pool: SqlitePool }

impl Repository {
  pub async fn load_project_assets(&self, project_id: &str) -> DbResult<serde_json::Value> {
    let asset_rows = sqlx::query("SELECT source_locations_json FROM assets WHERE project_id=? ORDER BY name").bind(project_id).fetch_all(&self.pool).await.map_err(|e| e.to_string())?;
    let prompt_rows = sqlx::query("SELECT prompt_json FROM board_prompts WHERE project_id=? ORDER BY id").bind(project_id).fetch_all(&self.pool).await.map_err(|e| e.to_string())?;
    let assets = asset_rows.into_iter().filter_map(|row| serde_json::from_str::<serde_json::Value>(&row.get::<String,_>("source_locations_json")).ok()).collect::<Vec<_>>();
    let board_prompts = prompt_rows.into_iter().filter_map(|row| serde_json::from_str::<serde_json::Value>(&row.get::<String,_>("prompt_json")).ok()).collect::<Vec<_>>();
    Ok(serde_json::json!({ "assets": assets, "boardPrompts": board_prompts }))
  }

  pub async fn save_project_assets(&self, input: ProjectAssetsInput) -> DbResult<()> {
    let mut transaction = self.pool.begin().await.map_err(|e| e.to_string())?;
    let version_id = sqlx::query_scalar::<_, String>("SELECT id FROM screenplay_versions WHERE project_id=? ORDER BY version_number DESC LIMIT 1").bind(&input.project_id).fetch_optional(&mut *transaction).await.map_err(|e| e.to_string())?.ok_or_else(|| "请先保存至少一集剧本再保存资产".to_owned())?;
    for asset in &input.assets {
      let id = asset.get("id").and_then(|v| v.as_str()).ok_or_else(|| "资产缺少 id".to_owned())?;
      let kind = asset.get("kind").and_then(|v| v.as_str()).ok_or_else(|| "资产缺少 kind".to_owned())?;
      let name = asset.get("name").and_then(|v| v.as_str()).ok_or_else(|| "资产缺少 name".to_owned())?;
      let display_name = asset.get("displayName").and_then(|v| v.as_str()).unwrap_or(name);
      let description = asset.get("description").and_then(|v| v.as_str()).unwrap_or("");
      let locked = asset.get("locked").and_then(|v| v.as_bool()).unwrap_or(false);
      sqlx::query("INSERT INTO assets (id,project_id,version_id,kind,name,display_name,description,locked,source_locations_json,schema_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,version_id=excluded.version_id,kind=excluded.kind,name=excluded.name,display_name=excluded.display_name,description=excluded.description,locked=excluded.locked,source_locations_json=excluded.source_locations_json,schema_version=excluded.schema_version,updated_at=excluded.updated_at")
        .bind(id).bind(&input.project_id).bind(&version_id).bind(kind).bind(name).bind(display_name).bind(description).bind(if locked { 1_i64 } else { 0_i64 }).bind(serde_json::to_string(asset).unwrap_or_else(|_| "{}".to_owned())).bind(chrono::Utc::now().to_rfc3339()).bind(chrono::Utc::now().to_rfc3339()).execute(&mut *transaction).await.map_err(|e| e.to_string())?;
    }
    for prompt in &input.board_prompts {
      let id = prompt.get("id").and_then(|v| v.as_str()).ok_or_else(|| "资产提示词缺少 id".to_owned())?;
      let asset_id = prompt.get("assetId").and_then(|v| v.as_str()).ok_or_else(|| "资产提示词缺少 assetId".to_owned())?;
      sqlx::query("INSERT INTO board_prompts (id,project_id,asset_id,prompt_json,schema_version,created_at,updated_at) VALUES (?,?,?, ?,1,?,?) ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id,asset_id=excluded.asset_id,prompt_json=excluded.prompt_json,schema_version=excluded.schema_version,updated_at=excluded.updated_at")
        .bind(id).bind(&input.project_id).bind(asset_id).bind(serde_json::to_string(prompt).unwrap_or_else(|_| "{}".to_owned())).bind(chrono::Utc::now().to_rfc3339()).bind(chrono::Utc::now().to_rfc3339()).execute(&mut *transaction).await.map_err(|e| e.to_string())?;
    }
    transaction.commit().await.map_err(|e| e.to_string())?;
    Ok(())
  }
  pub async fn create_project(&self, name: String) -> DbResult<ProjectRow> {
    let id = Uuid::new_v4().to_string(); let timestamp = Utc::now().to_rfc3339(); let clean_name = if name.trim().is_empty() { "未命名项目".to_owned() } else { name.trim().to_owned() };
    sqlx::query("INSERT INTO projects (id,name,schema_version,created_at,updated_at) VALUES (?,?,?,?,?)").bind(&id).bind(&clean_name).bind(1_i64).bind(&timestamp).bind(&timestamp).execute(&self.pool).await.map_err(|e| e.to_string())?;
    self.get_project(&id).await
  }
  pub async fn get_project(&self, id: &str) -> DbResult<ProjectRow> {
    let row = sqlx::query("SELECT id,name,schema_version,created_at,updated_at,deleted_at FROM projects WHERE id=?").bind(id).fetch_optional(&self.pool).await.map_err(|e| e.to_string())?.ok_or_else(|| format!("项目不存在: {id}"))?;
    let source_document_ids = sqlx::query_scalar::<_, String>("SELECT id FROM source_documents WHERE project_id=? ORDER BY created_at").bind(id).fetch_all(&self.pool).await.map_err(|e| e.to_string())?;
    let active_version_id = sqlx::query_scalar::<_, String>("SELECT id FROM screenplay_versions WHERE project_id=? ORDER BY version_number DESC LIMIT 1").bind(id).fetch_optional(&self.pool).await.map_err(|e| e.to_string())?;
    Ok(ProjectRow { id: row.get("id"), name: row.get("name"), schema_version: row.get("schema_version"), created_at: row.get("created_at"), updated_at: row.get("updated_at"), deleted_at: row.try_get("deleted_at").ok(), source_document_ids, active_version_id, story_bible_id: None })
  }
  pub async fn list_projects(&self, include_deleted: bool) -> DbResult<Vec<ProjectRow>> { let ids = if include_deleted { sqlx::query_scalar::<_, String>("SELECT id FROM projects ORDER BY updated_at DESC") } else { sqlx::query_scalar::<_, String>("SELECT id FROM projects WHERE deleted_at IS NULL ORDER BY updated_at DESC") }; let ids = ids.fetch_all(&self.pool).await.map_err(|e| e.to_string())?; let mut result = Vec::with_capacity(ids.len()); for id in ids { result.push(self.get_project(&id).await?); } Ok(result) }
  pub async fn rename_project(&self, id: &str, name: String) -> DbResult<ProjectRow> { sqlx::query("UPDATE projects SET name=?,updated_at=? WHERE id=? AND deleted_at IS NULL").bind(name.trim()).bind(Utc::now().to_rfc3339()).bind(id).execute(&self.pool).await.map_err(|e| e.to_string())?; self.get_project(id).await }
  pub async fn soft_delete(&self, id: &str) -> DbResult<()> { sqlx::query("UPDATE projects SET deleted_at=?,updated_at=? WHERE id=?").bind(Utc::now().to_rfc3339()).bind(Utc::now().to_rfc3339()).bind(id).execute(&self.pool).await.map_err(|e| e.to_string())?; Ok(()) }
  pub async fn delete_permanently(&self, id: &str) -> DbResult<()> {
    let mut transaction = self.pool.begin().await.map_err(|e| e.to_string())?;
    let exists = sqlx::query_scalar::<_, i64>("SELECT 1 FROM projects WHERE id=?").bind(id).fetch_optional(&mut *transaction).await.map_err(|e| e.to_string())?;
    if exists.is_none() { return Err(format!("项目不存在: {id}")); }
    // Source documents are immutable during normal operation. The trigger is
    // transactional, so dropping and recreating it keeps this purge atomic.
    sqlx::query("DROP TRIGGER IF EXISTS prevent_source_document_delete").execute(&mut *transaction).await.map_err(|e| e.to_string())?;
    for table in ["board_prompts", "shot_groups", "scores", "assets", "export_records", "generation_records", "story_bibles", "screenplay_versions", "source_documents"] {
      let query = format!("DELETE FROM {table} WHERE project_id=?");
      sqlx::query(&query).bind(id).execute(&mut *transaction).await.map_err(|e| e.to_string())?;
    }
    sqlx::query("DELETE FROM projects WHERE id=?").bind(id).execute(&mut *transaction).await.map_err(|e| e.to_string())?;
    sqlx::query("CREATE TRIGGER IF NOT EXISTS prevent_source_document_delete BEFORE DELETE ON source_documents BEGIN SELECT RAISE(ABORT, 'source documents are immutable'); END;").execute(&mut *transaction).await.map_err(|e| e.to_string())?;
    transaction.commit().await.map_err(|e| e.to_string())?;
    Ok(())
  }
  pub async fn restore(&self, id: &str) -> DbResult<ProjectRow> { sqlx::query("UPDATE projects SET deleted_at=NULL,updated_at=? WHERE id=?").bind(Utc::now().to_rfc3339()).bind(id).execute(&self.pool).await.map_err(|e| e.to_string())?; self.get_project(id).await }
  pub async fn save_version(&self, input: ScreenplayVersionInput) -> DbResult<ScreenplayVersionInput> { sqlx::query("INSERT OR REPLACE INTO screenplay_versions (id,project_id,source_document_id,parent_version_id,version_number,title,content,status,schema_version,created_at,updated_at,episode_number,entry_type,generation_context_json) VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?,?)").bind(&input.id).bind(&input.project_id).bind(&input.source_document_id).bind(&input.parent_version_id).bind(input.version_number).bind(&input.title).bind(&input.content).bind(&input.status).bind(&input.created_at).bind(&input.updated_at).bind(input.episode_number).bind(&input.entry_type).bind(&input.generation_context_json).execute(&self.pool).await.map_err(|e| e.to_string())?; Ok(input) }
  pub async fn save_story_bible(&self, input: StoryBibleInput) -> DbResult<StoryBibleInput> {
    sqlx::query("INSERT OR REPLACE INTO story_bibles (id,project_id,version_id,facts_json,schema_version,created_at,updated_at) VALUES (?,?,?,?,1,?,?)")
      .bind(&input.id).bind(&input.project_id).bind(&input.version_id).bind(input.facts.to_string()).bind(&input.created_at).bind(&input.updated_at)
      .execute(&self.pool).await.map_err(|e| e.to_string())?;
    Ok(input)
  }
  pub async fn save_source_document(&self, input: SourceDocumentInput) -> DbResult<SourceDocumentInput> {
    sqlx::query("INSERT INTO source_documents (id,project_id,file_name,media_type,content,content_hash,character_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(&input.id).bind(&input.project_id).bind(&input.title).bind(&input.kind).bind(&input.body).bind(&input.sha256).bind(input.word_count).bind(&input.created_at).bind(&input.updated_at)
      .execute(&self.pool).await.map_err(|e| format!("原稿只读或保存失败: {e}"))?;
    sqlx::query("UPDATE projects SET updated_at=? WHERE id=? AND deleted_at IS NULL").bind(Utc::now().to_rfc3339()).bind(&input.project_id).execute(&self.pool).await.map_err(|e| e.to_string())?;
    Ok(input)
  }
  pub async fn load_graph(&self, id: &str) -> DbResult<ProjectGraph> {
    let project = self.get_project(id).await?;
    let source_rows = sqlx::query("SELECT id,project_id,file_name,media_type,content,content_hash,character_count,created_at,updated_at FROM source_documents WHERE project_id=? ORDER BY created_at").bind(id).fetch_all(&self.pool).await.map_err(|e| e.to_string())?;
    let source_documents = source_rows.into_iter().map(|row| serde_json::json!({"id": row.get::<String,_>("id"), "projectId": row.get::<String,_>("project_id"), "schemaVersion": 1, "kind": row.get::<String,_>("media_type"), "title": row.get::<String,_>("file_name"), "body": row.get::<String,_>("content"), "sha256": row.get::<String,_>("content_hash"), "wordCount": row.get::<i64,_>("character_count"), "createdAt": row.get::<String,_>("created_at"), "updatedAt": row.get::<String,_>("updated_at")})).collect();
    let version_rows = sqlx::query("SELECT id,project_id,source_document_id,parent_version_id,version_number,title,content,status,created_at,updated_at,episode_number,entry_type,generation_context_json FROM screenplay_versions WHERE project_id=? ORDER BY version_number").bind(id).fetch_all(&self.pool).await.map_err(|e| e.to_string())?;
    let screenplay_versions = version_rows.into_iter().map(|row| {
      let id = row.get::<String,_>("id");
      let version_number = row.get::<i64,_>("version_number");
      let episode_number = row.try_get::<Option<i64>,_>("episode_number").ok().flatten().unwrap_or(version_number);
      let context = row.try_get::<Option<String>,_>("generation_context_json").ok().flatten().and_then(|value| serde_json::from_str::<serde_json::Value>(&value).ok());
      let mut version = serde_json::json!({"id": id, "projectId": row.get::<String,_>("project_id"), "sourceVersionId": row.try_get::<Option<String>,_>("source_document_id").ok().flatten(), "parentVersionId": row.try_get::<Option<String>,_>("parent_version_id").ok().flatten(), "versionNumber": version_number, "episodeNumber": episode_number, "title": row.get::<String,_>("title"), "bodyMarkdown": row.get::<String,_>("content"), "status": row.get::<String,_>("status"), "schemaVersion": 1, "metadata": {"title": row.get::<String,_>("title"), "genre": "", "elements": [], "episodeCount": 1, "episodeDurationSeconds": 90, "oneLineSynopsis": row.get::<String,_>("title"), "comparableWorks": []}, "characters": [], "scenes": [{"id": format!("{}-scene", id), "sequence": 1, "header": {"location": "未指定", "timeOfDay": "unspecified", "setting": "unspecified"}, "characters": [], "actions": [{"type": "action", "subject": "scene", "description": "内容已保存"}], "dialogues": []}], "adaptationHandling": {"deleted": [], "rewritten": [], "compressed": [], "foreshadowing": [], "pendingConfirmation": []}, "qualitySelfCheck": {"sceneCount": 1, "actionDescriptionRate": 1, "dialogueEmotionRate": 1, "wordCount": 0, "suspenseStrength": 0, "endingHook": ""}, "createdAt": row.get::<String,_>("created_at"), "updatedAt": row.get::<String,_>("updated_at")});
      if let Some(context) = context { version["generationContext"] = context; }
      if let Some(entry_type) = row.try_get::<Option<String>,_>("entry_type").ok().flatten() { version["entryType"] = serde_json::json!(entry_type); }
      version
    }).collect();
    let bible_row = sqlx::query("SELECT id,project_id,facts_json FROM story_bibles WHERE project_id=? ORDER BY updated_at DESC LIMIT 1").bind(id).fetch_optional(&self.pool).await.map_err(|e| e.to_string())?;
    let story_bible = bible_row.map(|row| serde_json::from_str::<serde_json::Value>(&row.get::<String,_>("facts_json")).unwrap_or_else(|_| serde_json::json!({"id": row.get::<String,_>("id"), "projectId": row.get::<String,_>("project_id")})));
    Ok(ProjectGraph { project, source_documents, screenplay_versions, story_bible, scores: vec![], assets: vec![], board_prompts: vec![], shot_groups: vec![], generation_records: vec![] })
  }
}
