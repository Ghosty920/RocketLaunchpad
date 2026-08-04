use crate::keychain::{KeychainError, keyring_entry};
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce, aead::Aead};

pub fn encrypt(data: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let cipher = get_key()?;

    let nonce_bytes: [u8; 12] = random_bytes();
    let nonce = Nonce::from(nonce_bytes);

    let ciphertext = cipher.encrypt(&nonce, data).map_err(CryptoError::Encrypt)?;

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
    let nonce = Nonce::try_from(nonce_bytes).expect("slice is 12 bytes");

    cipher
        .decrypt(&nonce, ciphertext)
        .map_err(CryptoError::Decrypt)
}

fn get_key() -> Result<Aes256Gcm, CryptoError> {
    let password = get_password()?;
    let key = Key::<Aes256Gcm>::from(password);
    Ok(Aes256Gcm::new(&key))
}

fn get_password() -> Result<[u8; 32], CryptoError> {
    let entry = keyring_entry("data")
        .map_err(|e| KeychainError::new(format!("Failed to access keyring: {e}")))?;

    if let Ok(stored) = entry.get_password() {
        let bytes = hex::decode(&stored)
            .map_err(|e| KeychainError::new(format!("Hex decode failed: {e}")))?;

        return bytes.try_into().map_err(|_| {
            CryptoError::Keyring(KeychainError::new(
                "Stored key has wrong length (expected 32 bytes)",
            ))
        });
    }

    // Key not found -> generate and store a new one
    let key_bytes: [u8; 32] = random_bytes();

    entry
        .set_password(&hex::encode(key_bytes))
        .map_err(|e| KeychainError::new(format!("Failed to store key: {e}")))?;

    Ok(key_bytes)
}

fn random_bytes<const N: usize>() -> [u8; N] {
    let mut buf = [0u8; N];
    getrandom::fill(&mut buf).expect("OS RNG failure");
    buf
}

#[derive(Debug)]
pub enum CryptoError {
    Encrypt(aes_gcm::Error),
    Decrypt(aes_gcm::Error),
    InvalidData(&'static str),
    Keyring(KeychainError),
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CryptoError::Encrypt(e) => write!(f, "Encryption failed: {e}"),
            CryptoError::Decrypt(e) => write!(f, "Decryption failed: {e}"),
            CryptoError::InvalidData(msg) => write!(f, "Invalid data: {msg}"),
            CryptoError::Keyring(e) => write!(f, "Keyring error: {e}"),
        }
    }
}

impl std::error::Error for CryptoError {}

impl From<KeychainError> for CryptoError {
    fn from(e: KeychainError) -> Self {
        CryptoError::Keyring(e)
    }
}
