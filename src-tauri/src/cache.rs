use redb::{Database, ReadableDatabase, TableDefinition};
use serde::{Serialize, de::DeserializeOwned};
use std::sync::Arc;

const CACHE_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("cache");

#[derive(Clone)]
pub struct Cache {
    db: Arc<Database>,
}

impl Cache {
    pub fn new(path: &str) -> Self {
        let db = Database::create(path).unwrap();
        let txn = db.begin_write().unwrap();
        {
            txn.open_table(CACHE_TABLE).unwrap();
        }
        txn.commit().unwrap();
        Self { db: Arc::new(db) }
    }

    pub fn set<T: Serialize>(&self, key: &str, value: &T) {
        let json = serde_json::to_vec(value).unwrap();
        let compressed = zstd::encode_all(json.as_slice(), 3).unwrap();
        let txn = self.db.begin_write().unwrap();
        {
            let mut table = txn.open_table(CACHE_TABLE).unwrap();
            table.insert(key, compressed.as_slice()).unwrap();
        }
        txn.commit().unwrap();
    }

    pub fn get<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        let txn = self.db.begin_read().ok()?;
        let table = txn.open_table(CACHE_TABLE).ok()?;
        let value = table.get(key).ok()??;
        let decompressed = zstd::decode_all(value.value()).ok()?;
        serde_json::from_slice(&decompressed).ok()
    }
}
