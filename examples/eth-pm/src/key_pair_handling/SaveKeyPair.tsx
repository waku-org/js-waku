import { Button } from "@material-ui/core";
import React from "react";
import { KeyPair } from "../crypto";
import { saveKeyPairToStorage } from "./key_pair_storage";

export interface Props {
  EncryptionKeyPair: KeyPair | undefined;
  password: string | undefined;
}

export function SaveKeyPair({ password, EncryptionKeyPair }: Props) {
  const saveKeyPair = () => {
    if (!EncryptionKeyPair) return;
    if (!password) return;
    saveKeyPairToStorage(EncryptionKeyPair, password).then(() => {
      console.log("Encryption KeyPair saved to storage");
    });
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={saveKeyPair}
      disabled={!password || !EncryptionKeyPair}
    >
      Save Encryption Key Pair to storage
    </Button>
  );
}
