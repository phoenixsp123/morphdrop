use crate::error::MorphDropError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use chrono::Utc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameRule {
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    pub find: Option<String>,
    pub replace_with: Option<String>,
    pub case_transform: Option<CaseTransform>,
    pub numbering_start: Option<usize>,
    pub numbering_padding: Option<usize>,
    pub clean_special_chars: bool,
    pub add_date_prefix: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CaseTransform {
    Lowercase,
    Uppercase,
    TitleCase,
    SnakeCase,
    KebabCase,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenamePreview {
    pub original_path: String,
    pub proposed_name: String,
    pub proposed_path: String,
    pub changed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    pub id: String,
    pub operation_type: String, // "rename", "move"
    pub original_path: String,
    pub new_path: String,
    pub timestamp: String,
}

pub struct OperationJournal {
    history: Mutex<Vec<Vec<JournalEntry>>>,
}

impl OperationJournal {
    pub fn new() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
        }
    }

    /// Compute proposed new filenames according to the specified rule.
    pub fn preview_rename(paths: &[String], rule: &RenameRule) -> Vec<RenamePreview> {
        let mut previews = Vec::new();
        let date_str = Utc::now().format("%Y-%m-%d").to_string();

        for (idx, p_str) in paths.iter().enumerate() {
            let path = Path::new(p_str);
            let parent = path.parent().unwrap_or(Path::new(""));
            let stem = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let ext = path
                .extension()
                .map(|e| format!(".{}", e.to_string_lossy()))
                .unwrap_or_default();

            let mut new_stem = stem.clone();

            // 1. Find & replace
            if let (Some(find), Some(replace)) = (&rule.find, &rule.replace_with) {
                if !find.is_empty() {
                    new_stem = new_stem.replace(find, replace);
                }
            }

            // 2. Clean special characters
            if rule.clean_special_chars {
                new_stem = new_stem
                    .chars()
                    .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
                    .collect();
            }

            // 3. Case transform
            if let Some(ref case) = rule.case_transform {
                new_stem = match case {
                    CaseTransform::Lowercase => new_stem.to_lowercase(),
                    CaseTransform::Uppercase => new_stem.to_uppercase(),
                    CaseTransform::TitleCase => {
                        let mut c = new_stem.chars();
                        match c.next() {
                            None => String::new(),
                            Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                        }
                    }
                    CaseTransform::SnakeCase => new_stem.replace(' ', "_").replace('-', "_").to_lowercase(),
                    CaseTransform::KebabCase => new_stem.replace(' ', "-").replace('_', "-").to_lowercase(),
                };
            }

            // 4. Numbering
            if let Some(start) = rule.numbering_start {
                let num = start + idx;
                let pad = rule.numbering_padding.unwrap_or(3);
                let num_str = format!("{:0width$}", num, width = pad);
                new_stem = format!("{}_{}", new_stem, num_str);
            }

            // 5. Prefix & Suffix
            if let Some(ref p) = rule.prefix {
                new_stem = format!("{}{}", p, new_stem);
            }
            if let Some(ref s) = rule.suffix {
                new_stem = format!("{}{}", new_stem, s);
            }

            // 6. Date prefix
            if rule.add_date_prefix {
                new_stem = format!("{}_{}", date_str, new_stem);
            }

            let proposed_name = format!("{}{}", new_stem, ext);
            let proposed_path = parent.join(&proposed_name).to_string_lossy().to_string();

            previews.push(RenamePreview {
                original_path: p_str.clone(),
                proposed_name,
                proposed_path: proposed_path.clone(),
                changed: proposed_path != *p_str,
            });
        }

        previews
    }

    /// Execute batch rename based on preview and store in journal.
    pub fn execute_rename(&self, previews: &[RenamePreview]) -> Result<Vec<String>, MorphDropError> {
        let mut executed_batch = Vec::new();
        let mut final_paths = Vec::new();
        let timestamp = Utc::now().to_rfc3339();

        for prev in previews {
            if !prev.changed {
                final_paths.push(prev.original_path.clone());
                continue;
            }

            let src = Path::new(&prev.original_path);
            let dst = Path::new(&prev.proposed_path);

            if !src.exists() {
                return Err(MorphDropError::ValidationError(format!(
                    "File does not exist: {}",
                    src.display()
                )));
            }

            if dst.exists() && dst != src {
                return Err(MorphDropError::ValidationError(format!(
                    "Destination already exists: {}",
                    dst.display()
                )));
            }

            fs::rename(src, dst)?;

            executed_batch.push(JournalEntry {
                id: uuid::Uuid::new_v4().to_string(),
                operation_type: "rename".into(),
                original_path: prev.original_path.clone(),
                new_path: prev.proposed_path.clone(),
                timestamp: timestamp.clone(),
            });

            final_paths.push(prev.proposed_path.clone());
        }

        if !executed_batch.is_empty() {
            let mut hist = self.history.lock().unwrap();
            hist.push(executed_batch);
        }

        Ok(final_paths)
    }

    /// Undo the most recent batch operation.
    pub fn undo_last(&self) -> Result<Vec<String>, MorphDropError> {
        let last_batch = {
            let mut hist = self.history.lock().unwrap();
            hist.pop()
        };

        match last_batch {
            Some(entries) => {
                let mut restored = Vec::new();
                // Undo in reverse order
                for entry in entries.iter().rev() {
                    let current = Path::new(&entry.new_path);
                    let orig = Path::new(&entry.original_path);
                    if current.exists() {
                        fs::rename(current, orig)?;
                        restored.push(entry.original_path.clone());
                    }
                }
                Ok(restored)
            }
            None => Err(MorphDropError::ValidationError("No operation to undo".into())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preview_rename_prefix_suffix() {
        let paths = vec!["/tmp/photo.jpg".to_string(), "/tmp/vacation.png".to_string()];
        let rule = RenameRule {
            prefix: Some("2026_".into()),
            suffix: Some("_edit".into()),
            find: None,
            replace_with: None,
            case_transform: None,
            numbering_start: None,
            numbering_padding: None,
            clean_special_chars: false,
            add_date_prefix: false,
        };

        let previews = OperationJournal::preview_rename(&paths, &rule);
        assert_eq!(previews.len(), 2);
        assert_eq!(previews[0].proposed_name, "2026_photo_edit.jpg");
        assert_eq!(previews[1].proposed_name, "2026_vacation_edit.png");
    }

    #[test]
    fn test_preview_rename_numbering() {
        let paths = vec!["/tmp/a.png".into(), "/tmp/b.png".into(), "/tmp/c.png".into()];
        let rule = RenameRule {
            prefix: None,
            suffix: None,
            find: None,
            replace_with: None,
            case_transform: Some(CaseTransform::Uppercase),
            numbering_start: Some(1),
            numbering_padding: Some(2),
            clean_special_chars: false,
            add_date_prefix: false,
        };

        let previews = OperationJournal::preview_rename(&paths, &rule);
        assert_eq!(previews[0].proposed_name, "A_01.png");
        assert_eq!(previews[1].proposed_name, "B_02.png");
        assert_eq!(previews[2].proposed_name, "C_03.png");
    }

    #[test]
    fn test_execute_rename_and_undo() {
        let dir = tempfile::tempdir().unwrap();
        let file1 = dir.path().join("first.txt");
        let file2 = dir.path().join("second.txt");
        fs::write(&file1, "1").unwrap();
        fs::write(&file2, "2").unwrap();

        let paths = vec![
            file1.to_string_lossy().to_string(),
            file2.to_string_lossy().to_string(),
        ];
        let rule = RenameRule {
            prefix: Some("renamed_".into()),
            suffix: None,
            find: None,
            replace_with: None,
            case_transform: None,
            numbering_start: None,
            numbering_padding: None,
            clean_special_chars: false,
            add_date_prefix: false,
        };

        let journal = OperationJournal::new();
        let previews = OperationJournal::preview_rename(&paths, &rule);
        let renamed = journal.execute_rename(&previews).unwrap();

        assert_eq!(renamed.len(), 2);
        assert!(!file1.exists());
        assert!(Path::new(&renamed[0]).exists());

        // Now Undo
        let undone = journal.undo_last().unwrap();
        assert_eq!(undone.len(), 2);
        assert!(file1.exists());
        assert!(file2.exists());
    }
}
