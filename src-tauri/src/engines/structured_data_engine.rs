use crate::engines::ConversionEngine;
use crate::error::MorphDropError;
use crate::models::{ConversionSettings, OutputFormat};
use async_trait::async_trait;
use std::fs;
use std::path::{Path, PathBuf};

pub struct StructuredDataEngine;

impl StructuredDataEngine {
    /// Read a file as a serde_json::Value, auto-detecting the input format.
    fn read_as_json(path: &Path, ext: &str) -> Result<serde_json::Value, MorphDropError> {
        let content = fs::read_to_string(path)?;
        match ext {
            "json" => {
                let val: serde_json::Value = serde_json::from_str(&content)?;
                Ok(val)
            }
            "yaml" | "yml" => {
                let val: serde_json::Value = serde_yaml::from_str(&content)?;
                Ok(val)
            }
            "csv" => Self::csv_to_json(&content),
            "tsv" => Self::tsv_to_json(&content),
            "xml" => Self::xml_to_json(&content),
            "txt" => {
                // TXT → just wrap the text as a JSON string
                Ok(serde_json::Value::String(content))
            }
            _ => Err(MorphDropError::UnsupportedFormat(format!(
                "Cannot parse .{} as structured data",
                ext
            ))),
        }
    }

    /// Write a serde_json::Value to a file in the given output format.
    fn write_as_format(
        value: &serde_json::Value,
        output: &Path,
        format: &OutputFormat,
    ) -> Result<(), MorphDropError> {
        let content = match format {
            OutputFormat::Json => serde_json::to_string_pretty(value)?,
            OutputFormat::Yaml => serde_yaml::to_string(value)
                .map_err(|e| MorphDropError::ConversionError(e.to_string()))?,
            OutputFormat::Csv => Self::json_to_csv(value)?,
            OutputFormat::Tsv => Self::json_to_tsv(value)?,
            OutputFormat::Xml => Self::json_to_xml(value)?,
            OutputFormat::Txt => match value {
                serde_json::Value::String(s) => s.clone(),
                _ => serde_json::to_string_pretty(value)?,
            },
            _ => {
                return Err(MorphDropError::UnsupportedFormat(format!(
                    "Cannot write to {}",
                    format
                )))
            }
        };

        fs::write(output, content)?;
        Ok(())
    }

    fn csv_to_json(content: &str) -> Result<serde_json::Value, MorphDropError> {
        let mut rdr = csv::ReaderBuilder::new()
            .has_headers(true)
            .from_reader(content.as_bytes());
        let headers: Vec<String> = rdr
            .headers()?
            .iter()
            .map(|h| h.to_string())
            .collect();
        let mut rows = Vec::new();
        for result in rdr.records() {
            let record = result?;
            let mut obj = serde_json::Map::new();
            for (i, field) in record.iter().enumerate() {
                let key = headers.get(i).cloned().unwrap_or_else(|| format!("col{}", i));
                // Try to parse as number or bool
                let val = if let Ok(n) = field.parse::<i64>() {
                    serde_json::Value::Number(n.into())
                } else if let Ok(n) = field.parse::<f64>() {
                    serde_json::Number::from_f64(n)
                        .map(serde_json::Value::Number)
                        .unwrap_or_else(|| serde_json::Value::String(field.to_string()))
                } else if field.eq_ignore_ascii_case("true") || field.eq_ignore_ascii_case("false")
                {
                    serde_json::Value::Bool(field.eq_ignore_ascii_case("true"))
                } else {
                    serde_json::Value::String(field.to_string())
                };
                obj.insert(key, val);
            }
            rows.push(serde_json::Value::Object(obj));
        }
        Ok(serde_json::Value::Array(rows))
    }

    fn tsv_to_json(content: &str) -> Result<serde_json::Value, MorphDropError> {
        let mut rdr = csv::ReaderBuilder::new()
            .delimiter(b'\t')
            .has_headers(true)
            .from_reader(content.as_bytes());
        let headers: Vec<String> = rdr
            .headers()?
            .iter()
            .map(|h| h.to_string())
            .collect();
        let mut rows = Vec::new();
        for result in rdr.records() {
            let record = result?;
            let mut obj = serde_json::Map::new();
            for (i, field) in record.iter().enumerate() {
                let key = headers.get(i).cloned().unwrap_or_else(|| format!("col{}", i));
                obj.insert(key, serde_json::Value::String(field.to_string()));
            }
            rows.push(serde_json::Value::Object(obj));
        }
        Ok(serde_json::Value::Array(rows))
    }

    fn xml_to_json(content: &str) -> Result<serde_json::Value, MorphDropError> {
        // Basic XML to JSON using quick-xml
        // We do a simplified parse: treat each element as a JSON object
        use quick_xml::events::Event;
        use quick_xml::Reader;

        let mut reader = Reader::from_str(content);
        let mut stack: Vec<(String, serde_json::Map<String, serde_json::Value>)> = Vec::new();
        let mut root = serde_json::Map::new();
        let mut current_text = String::new();

        loop {
            match reader.read_event() {
                Ok(Event::Start(e)) => {
                    let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                    stack.push((name, serde_json::Map::new()));
                    current_text.clear();
                }
                Ok(Event::End(_)) => {
                    if let Some((name, obj)) = stack.pop() {
                        let value = if obj.is_empty() && !current_text.is_empty() {
                            serde_json::Value::String(current_text.trim().to_string())
                        } else if !obj.is_empty() {
                            serde_json::Value::Object(obj)
                        } else {
                            serde_json::Value::Null
                        };

                        if let Some(parent) = stack.last_mut() {
                            // If key already exists, convert to array
                            if let Some(existing) = parent.1.get_mut(&name) {
                                match existing {
                                    serde_json::Value::Array(arr) => arr.push(value),
                                    _ => {
                                        let prev = existing.clone();
                                        *existing =
                                            serde_json::Value::Array(vec![prev, value]);
                                    }
                                }
                            } else {
                                parent.1.insert(name, value);
                            }
                        } else {
                            root.insert(name, value);
                        }
                        current_text.clear();
                    }
                }
                Ok(Event::Text(e)) => {
                    let text = e.unescape().unwrap_or_default().to_string();
                    if let Some(parent) = stack.last_mut() {
                        if parent.1.is_empty() {
                            current_text.push_str(&text);
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    return Err(MorphDropError::ConversionError(format!(
                        "XML parse error: {}",
                        e
                    )));
                }
                _ => {}
            }
        }

        Ok(serde_json::Value::Object(root))
    }

    fn json_to_csv(value: &serde_json::Value) -> Result<String, MorphDropError> {
        let rows = match value {
            serde_json::Value::Array(arr) => arr,
            _ => {
                return Err(MorphDropError::ConversionError(
                    "JSON must be an array of objects to convert to CSV".into(),
                ))
            }
        };

        if rows.is_empty() {
            return Ok(String::new());
        }

        // Collect all unique keys from all objects for headers
        let mut headers: Vec<String> = Vec::new();
        for row in rows {
            if let serde_json::Value::Object(obj) = row {
                for key in obj.keys() {
                    if !headers.contains(key) {
                        headers.push(key.clone());
                    }
                }
            }
        }

        let mut wtr = csv::Writer::from_writer(Vec::new());
        wtr.write_record(&headers)?;

        for row in rows {
            if let serde_json::Value::Object(obj) = row {
                let record: Vec<String> = headers
                    .iter()
                    .map(|h| match obj.get(h) {
                        Some(serde_json::Value::String(s)) => s.clone(),
                        Some(serde_json::Value::Number(n)) => n.to_string(),
                        Some(serde_json::Value::Bool(b)) => b.to_string(),
                        Some(serde_json::Value::Null) => String::new(),
                        Some(v) => v.to_string(),
                        None => String::new(),
                    })
                    .collect();
                wtr.write_record(&record)?;
            }
        }

        let data = wtr
            .into_inner()
            .map_err(|e| MorphDropError::ConversionError(e.to_string()))?;
        String::from_utf8(data)
            .map_err(|e| MorphDropError::ConversionError(format!("UTF-8 error: {}", e)))
    }

    fn json_to_tsv(value: &serde_json::Value) -> Result<String, MorphDropError> {
        let csv_str = Self::json_to_csv(value)?;
        // Replace CSV commas with tabs (simplistic but works for non-quoted fields)
        // Better: re-serialize with tab delimiter
        let rows = match value {
            serde_json::Value::Array(arr) => arr,
            _ => return Ok(csv_str.replace(',', "\t")),
        };

        if rows.is_empty() {
            return Ok(String::new());
        }

        let mut headers: Vec<String> = Vec::new();
        for row in rows {
            if let serde_json::Value::Object(obj) = row {
                for key in obj.keys() {
                    if !headers.contains(key) {
                        headers.push(key.clone());
                    }
                }
            }
        }

        let mut wtr = csv::WriterBuilder::new()
            .delimiter(b'\t')
            .from_writer(Vec::new());
        wtr.write_record(&headers)?;

        for row in rows {
            if let serde_json::Value::Object(obj) = row {
                let record: Vec<String> = headers
                    .iter()
                    .map(|h| match obj.get(h) {
                        Some(serde_json::Value::String(s)) => s.clone(),
                        Some(v) => v.to_string(),
                        None => String::new(),
                    })
                    .collect();
                wtr.write_record(&record)?;
            }
        }

        let data = wtr
            .into_inner()
            .map_err(|e| MorphDropError::ConversionError(e.to_string()))?;
        String::from_utf8(data)
            .map_err(|e| MorphDropError::ConversionError(format!("UTF-8 error: {}", e)))
    }

    fn json_to_xml(value: &serde_json::Value) -> Result<String, MorphDropError> {
        let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        Self::value_to_xml(value, "root", &mut xml, 0);
        Ok(xml)
    }

    fn value_to_xml(value: &serde_json::Value, tag: &str, xml: &mut String, indent: usize) {
        let pad = "  ".repeat(indent);
        match value {
            serde_json::Value::Object(obj) => {
                xml.push_str(&format!("{}<{}>\n", pad, tag));
                for (key, val) in obj {
                    // XML tag names can't start with numbers
                    let safe_key = if key.starts_with(|c: char| c.is_ascii_digit()) {
                        format!("_{}", key)
                    } else {
                        key.clone()
                    };
                    Self::value_to_xml(val, &safe_key, xml, indent + 1);
                }
                xml.push_str(&format!("{}</{}>\n", pad, tag));
            }
            serde_json::Value::Array(arr) => {
                for item in arr {
                    Self::value_to_xml(item, tag, xml, indent);
                }
            }
            serde_json::Value::String(s) => {
                let escaped = s
                    .replace('&', "&amp;")
                    .replace('<', "&lt;")
                    .replace('>', "&gt;");
                xml.push_str(&format!("{}<{}>{}</{}>\n", pad, tag, escaped, tag));
            }
            serde_json::Value::Number(n) => {
                xml.push_str(&format!("{}<{}>{}</{}>\n", pad, tag, n, tag));
            }
            serde_json::Value::Bool(b) => {
                xml.push_str(&format!("{}<{}>{}</{}>\n", pad, tag, b, tag));
            }
            serde_json::Value::Null => {
                xml.push_str(&format!("{}<{}/>\n", pad, tag));
            }
        }
    }
}

#[async_trait]
impl ConversionEngine for StructuredDataEngine {
    fn name(&self) -> &str {
        "StructuredDataEngine"
    }

    fn supported_input_formats(&self) -> Vec<String> {
        vec!["json", "csv", "tsv", "yaml", "yml", "xml", "txt"]
            .into_iter()
            .map(String::from)
            .collect()
    }

    fn supported_output_formats(&self) -> Vec<OutputFormat> {
        vec![
            OutputFormat::Json,
            OutputFormat::Csv,
            OutputFormat::Tsv,
            OutputFormat::Yaml,
            OutputFormat::Xml,
            OutputFormat::Txt,
        ]
    }

    fn can_handle(&self, input_format: &str, output_format: &OutputFormat) -> bool {
        let input_lower = input_format.to_lowercase();
        self.supported_input_formats().contains(&input_lower)
            && self.supported_output_formats().contains(output_format)
    }

    async fn convert(
        &self,
        input: &Path,
        output: &Path,
        format: &OutputFormat,
        _settings: &ConversionSettings,
        progress_tx: Option<tokio::sync::mpsc::Sender<f64>>,
    ) -> Result<PathBuf, MorphDropError> {
        if let Some(ref tx) = progress_tx {
            let _ = tx.send(0.1).await;
        }

        let ext = input
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let value = Self::read_as_json(input, &ext)?;

        if let Some(ref tx) = progress_tx {
            let _ = tx.send(0.5).await;
        }

        Self::write_as_format(&value, output, format)?;

        if let Some(ref tx) = progress_tx {
            let _ = tx.send(1.0).await;
        }

        Ok(output.to_path_buf())
    }

    async fn validate_input(&self, input: &Path) -> Result<(), MorphDropError> {
        if !input.exists() {
            return Err(MorphDropError::ValidationError(format!(
                "Input file does not exist: {}",
                input.display()
            )));
        }
        let meta = fs::metadata(input)?;
        if meta.len() > 100 * 1024 * 1024 {
            return Err(MorphDropError::ValidationError(
                "Structured data file exceeds 100 MB limit".into(),
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_csv_to_json_roundtrip() {
        let csv_data = "name,age,active\nAlice,30,true\nBob,25,false\n";
        let json = StructuredDataEngine::csv_to_json(csv_data).unwrap();
        let arr = json.as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0]["name"], "Alice");
        assert_eq!(arr[0]["age"], 30);
    }

    #[test]
    fn test_json_to_csv() {
        let json = serde_json::json!([
            {"name": "Alice", "age": 30},
            {"name": "Bob", "age": 25}
        ]);
        let csv = StructuredDataEngine::json_to_csv(&json).unwrap();
        assert!(csv.contains("Alice"));
        assert!(csv.contains("Bob"));
    }

    #[test]
    fn test_json_to_xml() {
        let json = serde_json::json!({"greeting": "hello", "count": 42});
        let xml = StructuredDataEngine::json_to_xml(&json).unwrap();
        assert!(xml.contains("<greeting>hello</greeting>"));
        assert!(xml.contains("<count>42</count>"));
    }
}
