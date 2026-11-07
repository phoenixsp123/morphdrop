use crate::error::MorphDropError;
use crate::models::HistoryEntry;
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Mutex;

/// Thread-safe wrapper around a SQLite connection.
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Open (or create) the database at the given path and run migrations.
    pub fn new(db_path: &Path) -> Result<Self, MorphDropError> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(db_path)
            .map_err(|e| MorphDropError::DatabaseError(e.to_string()))?;

        // Enable WAL mode for better concurrent read performance
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| MorphDropError::DatabaseError(e.to_string()))?;

        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), MorphDropError> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS conversion_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL,
                input_files TEXT NOT NULL,
                output_files TEXT NOT NULL,
                output_format TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                file_sizes TEXT NOT NULL DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                output_format TEXT NOT NULL,
                settings_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_history_created ON conversion_history(created_at);
            CREATE INDEX IF NOT EXISTS idx_history_status ON conversion_history(status);
            ",
        )
        .map_err(|e| MorphDropError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    // ---- History ----

    pub fn add_history(&self, entry: &HistoryEntry) -> Result<i64, MorphDropError> {
        let conn = self.conn.lock().unwrap();
        let input_json = serde_json::to_string(&entry.input_files).unwrap_or_default();
        let output_json = serde_json::to_string(&entry.output_files).unwrap_or_default();
        let sizes_json = serde_json::to_string(&entry.file_sizes).unwrap_or_default();

        conn.execute(
            "INSERT INTO conversion_history (job_id, input_files, output_files, output_format, status, created_at, file_sizes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                entry.job_id,
                input_json,
                output_json,
                entry.output_format,
                entry.status,
                entry.created_at,
                sizes_json,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    pub fn get_history(&self, limit: usize) -> Result<Vec<HistoryEntry>, MorphDropError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, job_id, input_files, output_files, output_format, status, created_at, file_sizes
             FROM conversion_history
             ORDER BY created_at DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            let input_str: String = row.get(2)?;
            let output_str: String = row.get(3)?;
            let sizes_str: String = row.get(7)?;
            Ok(HistoryEntry {
                id: row.get(0)?,
                job_id: row.get(1)?,
                input_files: serde_json::from_str(&input_str).unwrap_or_default(),
                output_files: serde_json::from_str(&output_str).unwrap_or_default(),
                output_format: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
                file_sizes: serde_json::from_str(&sizes_str).unwrap_or_default(),
            })
        })?;

        let mut entries = Vec::new();
        for row in rows {
            entries.push(row?);
        }
        Ok(entries)
    }

    pub fn clear_history(&self) -> Result<(), MorphDropError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM conversion_history", [])?;
        Ok(())
    }

    // ---- Settings ----

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, MorphDropError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query_map(params![key], |row| row.get::<_, String>(0))?;
        match rows.next() {
            Some(Ok(val)) => Ok(Some(val)),
            _ => Ok(None),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), MorphDropError> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_all_settings(&self) -> Result<serde_json::Value, MorphDropError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let mut map = serde_json::Map::new();
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        for row in rows {
            let (key, value) = row?;
            map.insert(key, serde_json::Value::String(value));
        }
        Ok(serde_json::Value::Object(map))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_creation() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let _db = Database::new(&db_path).unwrap();
        assert!(db_path.exists());
    }

    #[test]
    fn test_settings_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::new(&dir.path().join("test.db")).unwrap();

        db.set_setting("theme", "dark").unwrap();
        let val = db.get_setting("theme").unwrap();
        assert_eq!(val, Some("dark".to_string()));

        db.set_setting("theme", "light").unwrap();
        let val = db.get_setting("theme").unwrap();
        assert_eq!(val, Some("light".to_string()));
    }

    #[test]
    fn test_history() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::new(&dir.path().join("test.db")).unwrap();

        let entry = HistoryEntry {
            id: 0,
            job_id: "job-1".into(),
            input_files: vec!["test.png".into()],
            output_files: vec!["test.jpg".into()],
            output_format: "Jpeg".into(),
            status: "Completed".into(),
            created_at: "2024-01-01T00:00:00Z".into(),
            file_sizes: vec![1024, 512],
        };

        db.add_history(&entry).unwrap();
        let history = db.get_history(10).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].job_id, "job-1");

        db.clear_history().unwrap();
        let history = db.get_history(10).unwrap();
        assert_eq!(history.len(), 0);
    }
}
