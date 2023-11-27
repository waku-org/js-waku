export const Symmetric = {
  keySize: 32,
  ivSize: 12,
  tagSize: 16,
  algorithm: { name: "AES-GCM", length: 128 }
};

export const Asymmetric = {
  keySize: 32
};

export const OneMillion = BigInt(1_000_000);

export const Version = 1;
