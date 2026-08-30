//! Narrow command boundary for API credentials.
//!
//! Secrets are intentionally never accepted by project/database commands. On Windows
//! they are stored in Credential Manager through `keyring`; other targets report that
//! secure storage is unavailable so the frontend can use its ephemeral fallback.

const SERVICE: &str = "ai-drama-workbench";

#[cfg(windows)]
fn entry(key: &str) -> Result<keyring::Entry, String> {
  if key.trim().is_empty() || key.len() > 256 {
    return Err("invalid secret key".to_owned());
  }
  keyring::Entry::new(SERVICE, key).map_err(|_| "secure credential store unavailable".to_owned())
}

#[tauri::command]
pub fn secret_storage_mode() -> String {
  if cfg!(windows) {
    "windows-credential-manager".to_owned()
  } else {
    "unavailable".to_owned()
  }
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
  if value.is_empty() || value.len() > 16 * 1024 {
    return Err("invalid secret value".to_owned());
  }
  #[cfg(windows)]
  {
    return entry(&key)?.set_password(&value).map_err(|_| "secure credential store unavailable".to_owned());
  }
  #[cfg(not(windows))]
  {
    let _ = (key, value);
    Err("secure credential store unavailable".to_owned())
  }
}

#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, String> {
  #[cfg(windows)]
  {
    match entry(&key)?.get_password() {
      Ok(value) => Ok(Some(value)),
      Err(keyring::Error::NoEntry) => Ok(None),
      Err(_) => Err("secure credential store unavailable".to_owned()),
    }
  }
  #[cfg(not(windows))]
  {
    let _ = key;
    Err("secure credential store unavailable".to_owned())
  }
}

#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), String> {
  #[cfg(windows)]
  {
    match entry(&key)?.delete_credential() {
      Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
      Err(_) => Err("secure credential store unavailable".to_owned()),
    }
  }
  #[cfg(not(windows))]
  {
    let _ = key;
    Err("secure credential store unavailable".to_owned())
  }
}
