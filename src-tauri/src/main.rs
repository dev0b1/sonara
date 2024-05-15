#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
struct TranscribeResult {
    stdout: String,
}

#[tauri::command]
fn transcribe_file(path: String) -> Result<String, String> {
    let python = std::env::var("PYTHON_PATH").unwrap_or_else(|_| "python".into());
    let script = "python/bridge.py";
    let output = Command::new(python)
        .arg(script)
        .arg("transcribe")
        .arg("--file")
        .arg(&path)
        .output()
        .map_err(|e| format!("failed to spawn python: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("python failed: {}", err));
    }
    let out = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(out)
}

#[tauri::command]
fn check_license() -> Result<String, String> {
    let python = std::env::var("PYTHON_PATH").unwrap_or_else(|_| "python".into());
    let script = "python/bridge.py";
    let output = Command::new(python)
        .arg(script)
        .arg("check_license")
        .output()
        .map_err(|e| format!("failed to spawn python: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("python failed: {}", err));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn activate_license(key: String) -> Result<String, String> {
    let python = std::env::var("PYTHON_PATH").unwrap_or_else(|_| "python".into());
    let script = "python/bridge.py";
    let output = Command::new(python)
        .arg(script)
        .arg("activate")
        .arg("--key")
        .arg(&key)
        .output()
        .map_err(|e| format!("failed to spawn python: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("python failed: {}", err));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn issue_admin_key(key: String, issued_to: Option<String>) -> Result<String, String> {
    let python = std::env::var("PYTHON_PATH").unwrap_or_else(|_| "python".into());
    let script = "python/bridge.py";
    let mut cmd = Command::new(python);
    cmd.arg(script).arg("issue_admin").arg("--key").arg(&key);
    if let Some(t) = issued_to {
        cmd.arg("--issued_to").arg(t);
    }
    let output = cmd.output().map_err(|e| format!("failed to spawn python: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("python failed: {}", err));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn get_admin_keys() -> Result<String, String> {
    let python = std::env::var("PYTHON_PATH").unwrap_or_else(|_| "python".into());
    let script = "python/bridge.py";
    let output = Command::new(python)
        .arg(script)
        .arg("get_admin_keys")
        .output()
        .map_err(|e| format!("failed to spawn python: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("python failed: {}", err));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            transcribe_file,
            check_license,
            activate_license,
            issue_admin_key,
            get_admin_keys
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

