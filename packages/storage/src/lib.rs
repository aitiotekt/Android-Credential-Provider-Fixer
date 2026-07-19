//! Local, versioned snapshot storage shared by the desktop and CLI adapters.

use std::{
    collections::{HashMap, HashSet},
    env,
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use acp_fixer_core::{
    ChangeError, SnapshotId, SnapshotInventory, SnapshotRecord, SnapshotStatus, SnapshotStore,
    SnapshotWarning,
};

const SNAPSHOT_SCHEMA_VERSION: u32 = 2;
const MAX_NORMAL_SNAPSHOTS_PER_DEVICE: usize = 20;

#[derive(Clone, Debug)]
pub struct FileSnapshotStore {
    root: PathBuf,
}

impl FileSnapshotStore {
    #[must_use]
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    #[must_use]
    pub fn root(&self) -> &Path {
        &self.root
    }

    fn inventory(&self) -> Result<SnapshotInventory, ChangeError> {
        let mut latest = HashMap::<SnapshotId, SnapshotRecord>::new();
        let mut warnings = Vec::new();
        let entries = match fs::read_dir(&self.root) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(SnapshotInventory {
                    schema_version: SNAPSHOT_SCHEMA_VERSION,
                    snapshots: Vec::new(),
                    warnings,
                });
            }
            Err(error) => return Err(storage_error(error)),
        };
        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    warnings.push(warning("<directory>", error));
                    continue;
                }
            };
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }
            let display = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("<invalid>")
                .to_owned();
            let record = match fs::read(&path)
                .map_err(|error| error.to_string())
                .and_then(|bytes| {
                    let value: serde_json::Value =
                        serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
                    let schema_version = value
                        .get("schemaVersion")
                        .and_then(serde_json::Value::as_u64)
                        .unwrap_or_default();
                    if schema_version != u64::from(SNAPSHOT_SCHEMA_VERSION) {
                        return Err(format!(
                            "unsupported snapshot schema version {schema_version}; file was preserved"
                        ));
                    }
                    serde_json::from_value::<SnapshotRecord>(value)
                        .map_err(|error| error.to_string())
                }) {
                    Ok(record) => record,
                    Err(error) => {
                        warnings.push(SnapshotWarning {
                            file: display,
                            code: "SNAPSHOT_INVALID".to_owned(),
                            message: error,
                        });
                        continue;
                    }
                };
            if validate_id(record.snapshot_id.as_str()).is_err() {
                warnings.push(SnapshotWarning {
                    file: display,
                    code: "SNAPSHOT_INVALID".to_owned(),
                    message: "snapshot ID is invalid".to_owned(),
                });
                continue;
            }
            latest
                .entry(record.snapshot_id.clone())
                .and_modify(|current| {
                    if record.revision > current.revision {
                        *current = record.clone();
                    }
                })
                .or_insert(record);
        }
        let mut snapshots = latest.into_values().collect::<Vec<_>>();
        snapshots.sort_by(|left, right| {
            right
                .updated_at_unix_ms
                .cmp(&left.updated_at_unix_ms)
                .then_with(|| right.revision.cmp(&left.revision))
        });
        Ok(SnapshotInventory {
            schema_version: SNAPSHOT_SCHEMA_VERSION,
            snapshots,
            warnings,
        })
    }

    fn prune(&self) -> Result<(), ChangeError> {
        let inventory = self.inventory()?;
        let mut ordinary_by_device = HashMap::<String, Vec<&SnapshotRecord>>::new();
        for snapshot in &inventory.snapshots {
            if !matches!(
                snapshot.status,
                SnapshotStatus::Applied
                    | SnapshotStatus::RecoveryFailed
                    | SnapshotStatus::Executing
            ) {
                ordinary_by_device
                    .entry(snapshot.device.serial.clone())
                    .or_default()
                    .push(snapshot);
            }
        }
        let removable = ordinary_by_device
            .into_values()
            .flat_map(|snapshots| snapshots.into_iter().skip(MAX_NORMAL_SNAPSHOTS_PER_DEVICE))
            .map(|snapshot| snapshot.snapshot_id.clone())
            .collect::<HashSet<_>>();
        if removable.is_empty() {
            return Ok(());
        }
        for entry in fs::read_dir(&self.root).map_err(storage_error)? {
            let path = entry.map_err(storage_error)?.path();
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if removable
                .iter()
                .any(|snapshot_id| name.starts_with(&format!("{snapshot_id}.")))
            {
                fs::remove_file(path).map_err(storage_error)?;
            }
        }
        Ok(())
    }
}

impl SnapshotStore for FileSnapshotStore {
    fn save(&self, snapshot: &SnapshotRecord) -> Result<(), ChangeError> {
        validate_id(snapshot.snapshot_id.as_str())?;
        if snapshot.schema_version != SNAPSHOT_SCHEMA_VERSION || snapshot.revision == 0 {
            return Err(ChangeError::SnapshotInvalid {
                message: "unsupported schema version or revision".to_owned(),
            });
        }
        fs::create_dir_all(&self.root).map_err(storage_error)?;
        let final_path = self.root.join(format!(
            "{}.{}.json",
            snapshot.snapshot_id, snapshot.revision
        ));
        let temporary_path = self.root.join(format!(
            ".{}.{}.{}.tmp",
            snapshot.snapshot_id,
            snapshot.revision,
            uuid::Uuid::new_v4()
        ));
        let bytes = serde_json::to_vec_pretty(snapshot).map_err(storage_error)?;
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&temporary_path).map_err(storage_error)?;
        if let Err(error) = write_synced(&mut file, &bytes) {
            let _ = fs::remove_file(&temporary_path);
            return Err(storage_error(error));
        }
        drop(file);
        if let Err(error) = fs::rename(&temporary_path, &final_path) {
            let _ = fs::remove_file(&temporary_path);
            return Err(storage_error(error));
        }
        sync_directory(&self.root)?;
        self.prune()
    }

    fn load(&self, snapshot_id: &SnapshotId) -> Result<SnapshotRecord, ChangeError> {
        validate_id(snapshot_id.as_str())?;
        self.inventory()?
            .snapshots
            .into_iter()
            .find(|snapshot| snapshot.snapshot_id == *snapshot_id)
            .ok_or_else(|| ChangeError::SnapshotNotFound {
                snapshot_id: snapshot_id.clone(),
            })
    }

    fn list(&self) -> Result<SnapshotInventory, ChangeError> {
        self.inventory()
    }
}

#[must_use]
pub fn default_app_data_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(env::temp_dir)
            .join("Library/Application Support/com.aitiotekt.acp-fixer")
    }
    #[cfg(target_os = "windows")]
    {
        env::var_os("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(env::temp_dir)
            .join("com.aitiotekt.acp-fixer")
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
            .unwrap_or_else(env::temp_dir)
            .join("com.aitiotekt.acp-fixer")
    }
}

fn validate_id(id: &str) -> Result<(), ChangeError> {
    if id.is_empty()
        || id.len() > 128
        || !id
            .bytes()
            .all(|value| value.is_ascii_alphanumeric() || value == b'-')
    {
        return Err(ChangeError::SnapshotInvalid {
            message: "snapshot ID contains unsupported characters".to_owned(),
        });
    }
    Ok(())
}

fn write_synced(file: &mut File, bytes: &[u8]) -> std::io::Result<()> {
    file.write_all(bytes)?;
    file.flush()?;
    file.sync_all()
}

fn sync_directory(path: &Path) -> Result<(), ChangeError> {
    #[cfg(unix)]
    File::open(path)
        .and_then(|directory| directory.sync_all())
        .map_err(storage_error)?;
    Ok(())
}

fn storage_error(error: impl std::fmt::Display) -> ChangeError {
    ChangeError::SnapshotStorage {
        message: error.to_string(),
    }
}

fn warning(file: &str, error: impl std::fmt::Display) -> SnapshotWarning {
    SnapshotWarning {
        file: file.to_owned(),
        code: "SNAPSHOT_INVALID".to_owned(),
        message: error.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};

    use acp_fixer_core::{
        AndroidUser, ChangeKind, ComponentName, ConnectionType, DeviceInfo, ManagedCredentialState,
        ManagedSettingValue, PlanId, SnapshotId, SnapshotRecord, SnapshotStatus, ValidatedAdb,
    };

    use super::*;

    static NEXT: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn versions_records_and_ignores_corrupt_files() {
        let directory = temporary_directory();
        let store = FileSnapshotStore::new(&directory);
        let mut record = record("snapshot-a", 1);
        store.save(&record).unwrap();
        record.revision = 2;
        record.status = SnapshotStatus::Applied;
        store.save(&record).unwrap();
        fs::write(directory.join("corrupt.1.json"), b"not json").unwrap();

        let inventory = store.list().unwrap();

        assert_eq!(inventory.snapshots.len(), 1);
        assert_eq!(inventory.snapshots[0].revision, 2);
        assert_eq!(inventory.warnings.len(), 1);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn preserves_v1_files_and_reports_them_as_unsupported() {
        let directory = temporary_directory();
        let store = FileSnapshotStore::new(&directory);
        fs::create_dir_all(&directory).unwrap();
        let legacy = directory.join("legacy.1.json");
        fs::write(&legacy, br#"{"schemaVersion":1,"snapshotId":"legacy"}"#).unwrap();

        let inventory = store.list().unwrap();

        assert!(inventory.snapshots.is_empty());
        assert_eq!(inventory.warnings.len(), 1);
        assert!(inventory.warnings[0].message.contains("preserved"));
        assert!(legacy.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn retains_twenty_ordinary_records_and_protects_unrestored_changes() {
        let directory = temporary_directory();
        let store = FileSnapshotStore::new(&directory);
        for index in 0..21 {
            let mut snapshot = record(&format!("ordinary-{index}"), 1);
            snapshot.updated_at_unix_ms = index;
            store.save(&snapshot).unwrap();
        }
        let mut applied = record("applied-protected", 1);
        applied.status = SnapshotStatus::Applied;
        applied.updated_at_unix_ms = 100;
        store.save(&applied).unwrap();

        let inventory = store.list().unwrap();

        assert_eq!(inventory.snapshots.len(), 21);
        assert!(
            inventory
                .snapshots
                .iter()
                .any(|snapshot| snapshot.snapshot_id.as_str() == "applied-protected")
        );
        assert!(
            !inventory
                .snapshots
                .iter()
                .any(|snapshot| snapshot.snapshot_id.as_str() == "ordinary-0")
        );
        fs::remove_dir_all(directory).unwrap();
    }

    fn record(id: &str, revision: u32) -> SnapshotRecord {
        let state = ManagedCredentialState {
            enabled: ManagedSettingValue::Missing,
            primary: ManagedSettingValue::Missing,
        };
        SnapshotRecord {
            schema_version: 2,
            revision,
            snapshot_id: SnapshotId::from(id),
            plan_id: PlanId::from("plan-a"),
            source_diagnosis_id: acp_fixer_core::DiagnosisId::from("diagnosis-a"),
            source_snapshot_id: None,
            created_at_unix_ms: 1,
            updated_at_unix_ms: u64::from(revision),
            status: SnapshotStatus::Planned,
            kind: ChangeKind::Pin,
            adb: ValidatedAdb {
                path: PathBuf::from("adb"),
                resolved_path: PathBuf::from("adb"),
                version: "1".to_owned(),
            },
            device: DeviceInfo {
                serial: "SERIAL".to_owned(),
                connection_type: ConnectionType::Usb,
                manufacturer: "Example".to_owned(),
                model: "Phone".to_owned(),
                codename: "phone".to_owned(),
                android_version: "14".to_owned(),
                api_level: 34,
            },
            android_user: AndroidUser {
                id: 0,
                is_foreground: true,
            },
            target: ComponentName {
                flattened: "com.example/.Provider".to_owned(),
                package_name: "com.example".to_owned(),
                service_class: ".Provider".to_owned(),
            },
            registered_providers: vec!["com.example/com.example.Provider".to_owned()],
            before: state.clone(),
            intended_after: state,
            last_observed: None,
            message: None,
        }
    }

    fn temporary_directory() -> PathBuf {
        env::temp_dir().join(format!(
            "acp-fixer-storage-test-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ))
    }
}
