use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConnectionInput { pub base_url: String, pub model_name: String, pub api_key: Option<String>, pub wire_api: Option<String>, pub headers: Option<HashMap<String, String>> }
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConnectionOutput { pub latency_ms: u128, pub endpoint: String }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelGenerationInput { pub provider: Option<String>, pub base_url: String, pub model_name: String, pub api_key: Option<String>, pub wire_api: Option<String>, pub headers: Option<HashMap<String, String>>, pub system_prompt: Option<String>, pub user_prompt: String, pub max_output_tokens: Option<u32> }
#[derive(Debug, Serialize)]
pub struct ModelGenerationOutput { pub text: String }

#[tauri::command]
pub async fn test_model_connection(input: ModelConnectionInput) -> Result<ModelConnectionOutput, String> {
  let base = input.base_url.trim_end_matches('/'); let responses = input.wire_api.as_deref() == Some("responses"); let endpoint = format!("{}/{}", base, if responses { "responses" } else { "models" });
  let client = reqwest::Client::builder().build().map_err(|_| "network client init failed".to_owned())?;
  let mut request = if responses { client.post(&endpoint).json(&serde_json::json!({ "model": input.model_name, "input": "ping", "max_output_tokens": 1, "stream": false })) } else { client.get(&endpoint) };
  if let Some(key) = input.api_key.filter(|value| !value.is_empty()) { request = request.bearer_auth(key); }
  if let Some(headers) = input.headers { for (name, value) in headers { request = request.header(name, value); } }
  let started = std::time::Instant::now(); let response = request.send().await.map_err(|_| "unable to connect to model service".to_owned())?;
  if !response.status().is_success() {
    let status = response.status();
    let detail = response.text().await.unwrap_or_default().replace(['\n', '\r'], " ");
    let detail = if detail.len() > 300 { format!("{}...", &detail[..300]) } else { detail };
    return Err(format!("model service returned HTTP {}: {}", status.as_u16(), detail));
  }
  Ok(ModelConnectionOutput { latency_ms: started.elapsed().as_millis(), endpoint })
}

#[tauri::command]
pub async fn generate_model(input: ModelGenerationInput) -> Result<ModelGenerationOutput, String> {
  let base = input.base_url.trim_end_matches('/');
  let is_ollama = input.provider.as_deref() == Some("ollama");
  let responses = !is_ollama && input.wire_api.as_deref() == Some("responses");
  let endpoint = if is_ollama { format!("{}/api/generate", base) } else { format!("{}/{}", base, if responses { "responses" } else { "chat/completions" }) };
  let client = reqwest::Client::new();
  // Do not serialize optional request fields as JSON null. Several compatible
  // APIs reject null for token limits/instructions instead of treating them as
  // omitted, while JSON.stringify on the browser path omits undefined fields.
  let body = if is_ollama {
    let mut options = serde_json::Map::new();
    if let Some(max_output_tokens) = input.max_output_tokens {
      options.insert("num_predict".to_owned(), serde_json::json!(max_output_tokens));
    }
    serde_json::json!({ "model": input.model_name, "system": input.system_prompt.unwrap_or_default(), "prompt": input.user_prompt, "stream": false, "options": options })
  } else if responses {
    let mut body = serde_json::Map::new();
    body.insert("model".to_owned(), serde_json::json!(input.model_name));
    body.insert("input".to_owned(), serde_json::json!(input.user_prompt));
    body.insert("stream".to_owned(), serde_json::json!(false));
    if let Some(system_prompt) = input.system_prompt.filter(|value| !value.is_empty()) {
      body.insert("instructions".to_owned(), serde_json::json!(system_prompt));
    }
    if let Some(max_output_tokens) = input.max_output_tokens {
      body.insert("max_output_tokens".to_owned(), serde_json::json!(max_output_tokens));
    }
    serde_json::Value::Object(body)
  } else {
    let mut body = serde_json::Map::new();
    body.insert("model".to_owned(), serde_json::json!(input.model_name));
    body.insert("messages".to_owned(), serde_json::json!([{ "role": "system", "content": input.system_prompt.unwrap_or_default() }, { "role": "user", "content": input.user_prompt }]));
    body.insert("stream".to_owned(), serde_json::json!(false));
    if let Some(max_output_tokens) = input.max_output_tokens {
      body.insert("max_tokens".to_owned(), serde_json::json!(max_output_tokens));
    }
    serde_json::Value::Object(body)
  };
  let mut request = client.post(&endpoint).json(&body);
  if let Some(key) = input.api_key.filter(|value| !value.is_empty()) { request = request.bearer_auth(key); }
  if let Some(headers) = input.headers { for (name, value) in headers { request = request.header(name, value); } }
  let response = request.send().await.map_err(|_| "unable to connect to model service".to_owned())?; let status = response.status(); let body = response.text().await.unwrap_or_default();
  if !status.is_success() {
    let detail = body.replace(['\n', '\r'], " ");
    let detail = if detail.len() > 300 { format!("{}...", &detail[..300]) } else { detail };
    return Err(format!("model service returned HTTP {}: {}", status.as_u16(), detail));
  }
  let payload: serde_json::Value = match serde_json::from_str(&body) { Ok(value) => value, Err(_) => return Ok(ModelGenerationOutput { text: body }) };
  let text = if is_ollama { payload.get("response").and_then(|value| value.as_str()).unwrap_or_default().to_owned() } else if responses { payload.get("output_text").and_then(|value| value.as_str()).or_else(|| payload.get("output").and_then(|value| value.as_array()).and_then(|items| items.iter().find_map(|item| item.get("content").and_then(|content| content.as_array()).and_then(|content| content.iter().find_map(|part| part.get("text").and_then(|text| text.as_str())))))).unwrap_or_default().to_owned() } else { payload.get("choices").and_then(|value| value.get(0)).and_then(|value| value.get("message")).and_then(|value| value.get("content")).and_then(|value| value.as_str()).map(str::to_owned).or_else(|| payload.get("choices").and_then(|value| value.get(0)).and_then(|value| value.get("message")).and_then(|value| value.get("content")).and_then(|value| value.as_array()).map(|items| items.iter().filter_map(|item| item.get("text").and_then(|text| text.as_str())).collect::<Vec<_>>().join(""))).unwrap_or_default() };
  if text.trim().is_empty() { return Err("model response did not contain text; check API protocol or response format".to_owned()); }
  Ok(ModelGenerationOutput { text })
}
