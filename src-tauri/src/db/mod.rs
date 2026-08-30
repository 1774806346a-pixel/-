pub mod models;
pub mod repository;

use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use repository::Repository;

pub async fn initialize(database_url: &str) -> Result<Repository, String> {
  let options = SqliteConnectOptions::from_str(database_url).map_err(|e| e.to_string())?.create_if_missing(true);
  let pool = SqlitePool::connect_with(options).await.map_err(|e| e.to_string())?;
  sqlx::migrate!("./migrations").run(&pool).await.map_err(|e| e.to_string())?;
  Ok(Repository { pool })
}
