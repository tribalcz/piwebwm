//! Date/time and locale settings, driven by systemd's `timedatectl` and
//! `localectl`. All input is validated before reaching the (shell-free) command
//! runner; the timezone and locale are additionally checked against the system
//! lists so only real values are applied.

use crate::error::{AgentError, Result};
use crate::handlers::exec::run;
use crate::protocol::{LocaleSettings, TimeSettings};
use log::info;

/// Parses `timedatectl show` output (key=value lines) into TimeSettings.
pub fn get_time_settings() -> Result<TimeSettings> {
    let out = run("timedatectl", &["show"])?;
    let mut timezone = String::new();
    let mut ntp = false;
    let mut ntp_synced = false;
    for line in out.lines() {
        if let Some((k, v)) = line.split_once('=') {
            match k.trim() {
                "Timezone" => timezone = v.trim().to_string(),
                "NTP" => ntp = v.trim() == "yes",
                "NTPSynchronized" => ntp_synced = v.trim() == "yes",
                _ => {}
            }
        }
    }

    // Local wall-clock time as a display string (separate, locale-independent call).
    let time = run("date", &["+%Y-%m-%d %H:%M:%S"])
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    Ok(TimeSettings {
        timezone,
        ntp,
        ntp_synced,
        time,
    })
}

pub fn list_timezones() -> Result<Vec<String>> {
    let out = run("timedatectl", &["list-timezones"])?;
    Ok(out.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect())
}

/// A timezone identifier such as "Europe/Prague" or "UTC": letters, digits and
/// '/', '_', '-', '+'. Also confirmed against the system list before applying.
fn valid_timezone(tz: &str) -> bool {
    !tz.is_empty()
        && tz.len() <= 64
        && !tz.starts_with('/')
        && tz.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '_' | '-' | '+'))
}

pub fn set_timezone(tz: &str) -> Result<()> {
    if !valid_timezone(tz) {
        return Err(AgentError::InvalidRequest("invalid timezone".to_string()));
    }
    if !list_timezones()?.iter().any(|t| t == tz) {
        return Err(AgentError::InvalidRequest(format!("unknown timezone: {}", tz)));
    }
    run("timedatectl", &["set-timezone", tz])?;
    info!("Timezone set to {}", tz);
    Ok(())
}

pub fn set_ntp(enabled: bool) -> Result<()> {
    run("timedatectl", &["set-ntp", if enabled { "true" } else { "false" }])?;
    info!("NTP set to {}", enabled);
    Ok(())
}

/// Sets the system clock manually (only meaningful when NTP is off).
/// Expects "YYYY-MM-DD HH:MM:SS"; validated strictly before use.
pub fn set_time(value: &str) -> Result<()> {
    if !valid_datetime(value) {
        return Err(AgentError::InvalidRequest(
            "invalid time (expected YYYY-MM-DD HH:MM:SS)".to_string(),
        ));
    }
    run("timedatectl", &["set-time", value])?;
    info!("System time set");
    Ok(())
}

/// Strict "YYYY-MM-DD HH:MM:SS" check with basic range validation.
fn valid_datetime(s: &str) -> bool {
    let (date, time) = match s.split_once(' ') {
        Some(p) => p,
        None => return false,
    };
    let d: Vec<&str> = date.split('-').collect();
    let t: Vec<&str> = time.split(':').collect();
    if d.len() != 3 || t.len() != 3 {
        return false;
    }
    let nums: Option<Vec<u32>> = d.iter().chain(t.iter()).map(|p| p.parse::<u32>().ok()).collect();
    let nums = match nums {
        Some(n) => n,
        None => return false,
    };
    let (y, mo, da, h, mi, se) = (nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]);
    (1970..=2100).contains(&y)
        && (1..=12).contains(&mo)
        && (1..=31).contains(&da)
        && h < 24
        && mi < 60
        && se < 60
}

// --- Locale ----------------------------------------------------------------

/// Reads the system locale from `localectl status`.
pub fn get_locale() -> Result<LocaleSettings> {
    let out = run("localectl", &["status"])?;
    let mut lang = String::new();
    let mut keymap = String::new();
    for line in out.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("System Locale:") {
            // e.g. "System Locale: LANG=en_US.UTF-8"
            for token in rest.split_whitespace() {
                if let Some(v) = token.strip_prefix("LANG=") {
                    lang = v.to_string();
                }
            }
        } else if let Some(v) = line.strip_prefix("VC Keymap:") {
            keymap = v.trim().to_string();
        }
    }
    Ok(LocaleSettings { lang, keymap })
}

pub fn list_locales() -> Result<Vec<String>> {
    let out = run("localectl", &["list-locales"])?;
    Ok(out.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect())
}

/// A locale identifier such as "en_US.UTF-8" or "C": letters, digits and
/// '_', '.', '-', '@'. Also confirmed against the system list before applying.
fn valid_locale(loc: &str) -> bool {
    !loc.is_empty()
        && loc.len() <= 32
        && loc.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-' | '@'))
}

pub fn set_locale(lang: &str) -> Result<()> {
    if !valid_locale(lang) {
        return Err(AgentError::InvalidRequest("invalid locale".to_string()));
    }
    if !list_locales()?.iter().any(|l| l == lang) {
        return Err(AgentError::InvalidRequest(format!("unknown locale: {}", lang)));
    }
    run("localectl", &["set-locale", &format!("LANG={}", lang)])?;
    info!("Locale set to {}", lang);
    Ok(())
}
