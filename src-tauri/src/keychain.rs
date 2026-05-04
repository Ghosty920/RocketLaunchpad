use core::fmt;

use keyring_core::Entry;

pub fn keyring_entry(name: &str) -> Result<Entry, KeychainError> {
    Entry::new("RocketLaunchpad", name).map_err(|e| KeychainError::new(e.to_string()))
}

#[derive(Debug)]
pub struct KeychainError {
    msg: String,
}

impl KeychainError {
    pub fn new(msg: impl Into<String>) -> Self {
        Self { msg: msg.into() }
    }
}

impl fmt::Display for KeychainError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Failed to create keyring entry: {}", self.msg)
    }
}

impl std::error::Error for KeychainError {}
