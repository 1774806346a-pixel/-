//! Library target required by the Tauri package manifest.
//!
//! The desktop binary owns application startup in `main.rs`; keeping this
//! library target allows Cargo metadata and Tauri tooling to resolve the
//! package consistently across platforms.

pub fn package_name() -> &'static str {
    "ai-drama-workbench"
}
