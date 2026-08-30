#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;

fn main() {
  let database_path = std::env::var("AI_DRAMA_DATABASE_URL").unwrap_or_else(|_| "sqlite://ai-drama-workbench.db".to_owned());
  let repository = tauri::async_runtime::block_on(db::initialize(&database_path)).expect("database initialization failed");
  tauri::Builder::default()
    .manage(repository)
    .invoke_handler(tauri::generate_handler![commands::projects::create_project, commands::projects::rename_project, commands::projects::list_projects, commands::projects::load_project_graph, commands::projects::soft_delete_project, commands::projects::delete_project_permanently, commands::projects::restore_project, commands::projects::save_version, commands::projects::save_source_document, commands::projects::save_story_bible, commands::projects::load_project_assets, commands::projects::save_project_assets, commands::secrets::secret_storage_mode, commands::secrets::secret_set, commands::secrets::secret_get, commands::secrets::secret_delete, commands::model::test_model_connection, commands::model::generate_model])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
