import { TextField } from "@material-ui/core";
import React, { ChangeEvent } from "react";

interface Props {
  password: string | undefined;
  setPassword: (password: string) => void;
}

export default function PasswordInput({ password, setPassword }: Props) {
  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  return (
    <TextField
      id="password-input"
      label="Password"
      variant="filled"
      type="password"
      onChange={handlePasswordChange}
      value={password}
    />
  );
}
