use tauri::State;
use crate::db::models::{ProjectAssetsInput, ProjectGraph, ProjectRow, ScreenplayVersionInput, SourceDocumentInput, StoryBibleInput};
use crate::db::repository::Repository;

#[tauri::command]
pub async fn create_project(repo: State<'_, Repository>, name: String) -> Result<ProjectRow, String> { repo.create_project(name).await }
#[tauri::command]
pub async fn rename_project(repo: State<'_, Repository>, id: String, name: String) -> Result<ProjectRow, String> { repo.rename_project(&id, name).await }
#[tauri::command]
pub async fn list_projects(repo: State<'_, Repository>, include_deleted: Option<bool>) -> Result<Vec<ProjectRow>, String> { repo.list_projects(include_deleted.unwrap_or(false)).await }
#[tauri::command]
pub async fn load_project_graph(repo: State<'_, Repository>, id: String) -> Result<ProjectGraph, String> { repo.load_graph(&id).await }
#[tauri::command]
pub async fn soft_delete_project(repo: State<'_, Repository>, id: String) -> Result<(), String> { repo.soft_delete(&id).await }
#[tauri::command]
pub async fn delete_project_permanently(repo: State<'_, Repository>, id: String) -> Result<(), String> { repo.delete_permanently(&id).await }
#[tauri::command]
pub async fn restore_project(repo: State<'_, Repository>, id: String) -> Result<ProjectRow, String> { repo.restore(&id).await }
#[tauri::command]
pub async fn save_version(repo: State<'_, Repository>, version: ScreenplayVersionInput) -> Result<ScreenplayVersionInput, String> { repo.save_version(version).await }
#[tauri::command]
pub async fn save_source_document(repo: State<'_, Repository>, document: SourceDocumentInput) -> Result<SourceDocumentInput, String> { repo.save_source_document(document).await }
#[tauri::command]
pub async fn save_story_bible(repo: State<'_, Repository>, bible: StoryBibleInput) -> Result<StoryBibleInput, String> { repo.save_story_bible(bible).await }
#[tauri::command]
pub async fn load_project_assets(repo: State<'_, Repository>, project_id: String) -> Result<serde_json::Value, String> { repo.load_project_assets(&project_id).await }
#[tauri::command]
pub async fn save_project_assets(repo: State<'_, Repository>, input: ProjectAssetsInput) -> Result<(), String> { repo.save_project_assets(input).await }
