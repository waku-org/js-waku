use rand_chacha::{ChaCha20Rng, rand_core::SeedableRng};
use sha3::{Digest, Keccak256};

fn main() {
    // Test seed - bytes 0..=9 as in the TypeScript test
    let signal = &[0u8, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    
    // Generate seed hash using Keccak256 (32 bytes)
    let mut hasher = Keccak256::new();
    hasher.update(signal);
    let seed_hash = hasher.finalize();
    
    println!("Seed hash: {:?}", hex::encode(&seed_hash));
    
    // Create ChaCha20Rng
    let mut rng = ChaCha20Rng::from_seed(seed_hash.into());
    
    // Generate 64 bytes of keystream
    let mut keystream = [0u8; 64];
    use rand_chacha::rand_core::RngCore;
    rng.fill_bytes(&mut keystream);
    
    println!("Raw keystream: {}", hex::encode(&keystream));
    
    // Interpret first 32 bytes as little-endian like arkworks does
    let trapdoor_bytes = &keystream[0..32];
    
    println!("First 32 bytes as hex: {}", hex::encode(trapdoor_bytes));
    
    // Show the full 256-bit number interpretation
    println!("\nFull 256-bit interpretations:");
    
    // Little-endian interpretation (like TypeScript)
    let mut full_le = num_bigint::BigUint::from(0u32);
    for (i, &byte) in trapdoor_bytes.iter().enumerate() {
        full_le += num_bigint::BigUint::from(byte) << (i * 8);
    }
    println!("Full LE: {}", full_le);
    
    // Show modulo BN254 field prime (should match RLN_Q)
    let bn254_q = num_bigint::BigUint::parse_bytes(
        b"21888242871839275222246405745257275088548364400416034343698204186575808495617", 10
    ).unwrap();
    
    let trapdoor_field = &full_le % &bn254_q;
    println!("Trapdoor field (LE % BN254_Q): {}", trapdoor_field);
} 