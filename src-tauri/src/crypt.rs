use aes_gcm::{
    Aes256Gcm, Key, KeyInit, Nonce,
    aead::{Aead, OsRng, rand_core::RngCore},
};
use keyring_core::Entry;

pub fn encrypt(data: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let cipher = get_key()?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, data).map_err(CryptoError::Encrypt)?;

    let mut out = Vec::with_capacity(12 + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);

    Ok(out)
}

pub fn decrypt(data: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if data.len() < 12 {
        return Err(CryptoError::InvalidData(
            "Data too short to contain a nonce (< 12 bytes)",
        ));
    }

    let cipher = get_key()?;
    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(CryptoError::Decrypt)
}

fn get_key() -> Result<Aes256Gcm, CryptoError> {
    let password = get_password()?;
    let key = Key::<Aes256Gcm>::from_slice(&password);
    Ok(Aes256Gcm::new(key))
}

fn keyring_entry() -> Result<Entry, CryptoError> {
    Entry::new("RocketLaunchpad", "data").map_err(|e| CryptoError::Keyring(e.to_string()))
}

fn get_password() -> Result<[u8; 32], CryptoError> {
    let entry = keyring_entry()?;

    // Try to load an existing key from the keyring
    if let Ok(stored) = entry.get_password() {
        let bytes = hex::decode(&stored)
            .map_err(|e| CryptoError::Keyring(format!("Hex decode failed: {e}")))?;

        return bytes.try_into().map_err(|_| {
            CryptoError::Keyring("Stored key has wrong length (expected 32 bytes)".into())
        });
    }

    // Key not found -> generate and store a new one
    let key = Aes256Gcm::generate_key(&mut OsRng);

    entry
        .set_password(&hex::encode(key))
        .map_err(|e| CryptoError::Keyring(format!("Failed to store key: {e}")))?;

    Ok(key.into())
}

#[derive(Debug)]
pub enum CryptoError {
    Encrypt(aes_gcm::Error),
    Decrypt(aes_gcm::Error),
    InvalidData(&'static str),
    Keyring(String),
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CryptoError::Encrypt(e) => write!(f, "Encryption failed: {e}"),
            CryptoError::Decrypt(e) => write!(f, "Decryption failed: {e}"),
            CryptoError::InvalidData(msg) => write!(f, "Invalid data: {msg}"),
            CryptoError::Keyring(msg) => write!(f, "Keyring error: {msg}"),
        }
    }
}

impl std::error::Error for CryptoError {}
