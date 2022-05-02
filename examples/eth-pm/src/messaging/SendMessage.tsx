import {
  FormControl,
  InputLabel,
  makeStyles,
  MenuItem,
  Select,
  TextField,
} from "@material-ui/core";
import React, { ChangeEvent, useState, KeyboardEvent } from "react";
import { utils, Waku, WakuMessage } from "js-waku";
import { PrivateMessage } from "./wire";
import { PrivateMessageContentTopic } from "../waku";

const useStyles = makeStyles((theme) => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
}));

export interface Props {
  waku: Waku | undefined;
  // address, public key
  recipients: Map<string, Uint8Array>;
}

export default function SendMessage({ waku, recipients }: Props) {
  const classes = useStyles();
  const [recipient, setRecipient] = useState<string>("");
  const [message, setMessage] = useState<string>();

  const handleRecipientChange = (
    event: ChangeEvent<{ name?: string; value: unknown }>
  ) => {
    setRecipient(event.target.value as string);
  };

  const handleMessageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMessage(event.target.value);
  };

  const items = Array.from(recipients.keys()).map((recipient) => {
    return (
      <MenuItem key={recipient} value={recipient}>
        {recipient}
      </MenuItem>
    );
  });

  const keyDownHandler = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === "Enter" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.shiftKey
    ) {
      if (!waku) return;
      if (!recipient) return;
      if (!message) return;
      const publicKey = recipients.get(recipient);
      if (!publicKey) return;

      sendMessage(waku, recipient, publicKey, message, (res) => {
        if (res) {
          console.log("callback called with", res);
          setMessage("");
        }
      });
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <FormControl className={classes.formControl}>
        <InputLabel id="select-recipient-label">Recipient</InputLabel>
        <Select
          labelId="select-recipient"
          id="select-recipient"
          value={recipient}
          onChange={handleRecipientChange}
        >
          {items}
        </Select>
      </FormControl>
      <TextField
        id="message-input"
        label="Message"
        variant="filled"
        onChange={handleMessageChange}
        onKeyDown={keyDownHandler}
        value={message}
      />
    </div>
  );
}

async function encodeEncryptedWakuMessage(
  message: string,
  publicKey: Uint8Array,
  address: string
): Promise<WakuMessage> {
  const privateMessage = new PrivateMessage({
    toAddress: utils.hexToBytes(address),
    message: message,
  });

  const payload = privateMessage.encode();
  return WakuMessage.fromBytes(payload, PrivateMessageContentTopic, {
    encPublicKey: publicKey,
  });
}

function sendMessage(
  waku: Waku,
  recipientAddress: string,
  recipientPublicKey: Uint8Array,
  message: string,
  callback: (res: boolean) => void
) {
  encodeEncryptedWakuMessage(message, recipientPublicKey, recipientAddress)
    .then((msg) => {
      console.log("pushing");
      waku.lightPush
        .push(msg)
        .then((res) => {
          console.log("Message sent", res);
          callback(res ? res.isSuccess : false);
        })
        .catch((e) => {
          console.error("Failed to send message", e);
          callback(false);
        });
    })
    .catch((e) => {
      console.error("Cannot encode & encrypt message", e);
      callback(false);
    });
}
