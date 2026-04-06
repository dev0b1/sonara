#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::ffi::OsStr;
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use tauri::path::BaseDirectory;
use tauri::Manager;

/// `CreateProcessW` flag: do not create a console window for console subsystem programs (e.g. `python.exe`).
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn python_program() -> String {
    std::env::var("PYTHON_PATH").unwrap_or_else(|_| {
        #[cfg(windows)]
        {
            // `pythonw.exe` has no console; avoids a flashing terminal when Tauri spawns Python.
            "pythonw".to_string()
        }
        #[cfg(not(windows))]
        {
            "python".to_string()
        }
    })
}

fn python_command(program: impl AsRef<OsStr>) -> Command {
    let mut cmd = Command::new(program);
    cmd.stdin(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

fn bridge_script_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("SONARA_BRIDGE_PATH") {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Ok(pb);
        }
    }
    if let Ok(p) = app.path().resolve("python/bridge.py", BaseDirectory::Resource) {
        if p.is_file() {
            return Ok(p);
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.parent().map(|p| p.to_path_buf());
        while let Some(ref d) = dir {
            let c = d.join("python").join("bridge.py");
            if c.is_file() {
                return Ok(c);
            }
            dir = d.parent().map(|p| p.to_path_buf());
        }
    }
    if let Ok(mut dir) = std::env::current_dir() {
        loop {
            let c = dir.join("python").join("bridge.py");
            if c.is_file() {
                return Ok(c);
            }
            if !dir.pop() {
                break;
            }
        }
    }
    Err("Could not find python/bridge.py. Set SONARA_BRIDGE_PATH or keep python/ next to the app.".into())
}

#[tauri::command]
fn save_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("failed to write file: {}", e))
}

#[tauri::command]
fn probe_audio_duration(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let py = python_program();
    let s = bridge_script_path(&app)?;
    let o = python_command(py)
        .arg(&s)
        .arg("probe_duration")
        .arg("--file")
        .arg(&path)
        .output()
        .map_err(|e| format!("failed to spawn python: {}", e))?;
    if !o.status.success() {
        return Err(format!("python failed: {}", String::from_utf8_lossy(&o.stderr)));
    }
    Ok(String::from_utf8_lossy(&o.stdout).to_string())
}

#[tauri::command]
fn transcribe_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let py = python_program();
    let s = bridge_script_path(&app)?;
    let o = python_command(py)
        .arg(&s)
        .arg("transcribe")
        .arg("--file")
        .arg(&path)
        .output()
        .map_err(|e| format!("failed to spawn python: {}", e))?;
    if !o.status.success() {
        return Err(format!("python failed: {}", String::from_utf8_lossy(&o.stderr)));
    }
    Ok(String::from_utf8_lossy(&o.stdout).to_string())
}

#[tauri::command]
fn check_license(app: tauri::AppHandle) -> Result<String, String> {
    let py = python_program();
    let s = bridge_script_path(&app)?;
    let o = python_command(py).arg(&s).arg("check_license").output()
        .map_err(|e| format!("failed to spawn python: {}", e))?;
    if !o.status.success() {
        return Err(format!("python failed: {}", String::from_utf8_lossy(&o.stderr)));
    }
    Ok(String::from_utf8_lossy(&o.stdout).to_string())
}

#[tauri::command]
fn activate_license(app: tauri::AppHandle, key: String) -> Result<String, String> {
    let py = python_program();
    let s = bridge_script_path(&app)?;
    let o = python_command(py)
        .arg(&s)
        .arg("activate")
        .arg("--key")
        .arg(&key)
        .output()
        .map_err(|e| format!("failed to spawn python: {}", e))?;
    if !o.status.success() {
        return Err(format!("python failed: {}", String::from_utf8_lossy(&o.stderr)));
    }
    Ok(String::from_utf8_lossy(&o.stdout).to_string())
}

#[tauri::command]
fn issue_admin_key(
    app: tauri::AppHandle,
    key: String,
    issued_to: Option<String>,
) -> Result<String, String> {
    let py = python_program();
    let s = bridge_script_path(&app)?;
    let mut c = python_command(py);
    c.arg(&s).arg("issue_admin").arg("--key").arg(&key);
    if let Some(t) = issued_to {
        c.arg("--issued_to").arg(t);
    }
    let o = c.output().map_err(|e| format!("failed to spawn python: {}", e))?;
    if !o.status.success() {
        return Err(format!("python failed: {}", String::from_utf8_lossy(&o.stderr)));
    }
    Ok(String::from_utf8_lossy(&o.stdout).to_string())
}

#[tauri::command]
fn get_admin_keys(app: tauri::AppHandle) -> Result<String, String> {
    let py = python_program();
    let s = bridge_script_path(&app)?;
    let o = python_command(py).arg(&s).arg("get_admin_keys").output()
        .map_err(|e| format!("failed to spawn python: {}", e))?;
    if !o.status.success() {
        return Err(format!("python failed: {}", String::from_utf8_lossy(&o.stderr)));
    }
    Ok(String::from_utf8_lossy(&o.stdout).to_string())
}

#[tauri::command]
fn reset_license_for_testing(app: tauri::AppHandle) -> Result<String, String> {
    let py = python_program();
    let s = bridge_script_path(&app)?;
    let o = python_command(py)
        .arg(&s)
        .arg("reset_license")
        .output()
        .map_err(|e| format!("failed to spawn python: {}", e))?;
    if !o.status.success() {
        return Err(format!("python failed: {}", String::from_utf8_lossy(&o.stderr)));
    }
    Ok(String::from_utf8_lossy(&o.stdout).to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_text_file,
            probe_audio_duration,
            transcribe_file,
            check_license,
            activate_license,
            issue_admin_key,
            get_admin_keys,
            reset_license_for_testing
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
