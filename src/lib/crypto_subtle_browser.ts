declare global {
  interface Window {
    msCrypto?: Crypto;
  }

  interface Crypto {
    webkitSubtle?: SubtleCrypto;
  }
}

const crypto = window.crypto || window.msCrypto;
if (crypto === undefined) {
  throw new Error("browser crypto api unavailable");
}

const subtle: SubtleCrypto = crypto.subtle || crypto.webkitSubtle;

if (subtle === undefined) {
  throw new Error("browser subtle api unavailable");
}

export { crypto, subtle };
