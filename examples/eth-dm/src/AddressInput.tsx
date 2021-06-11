import { useState } from 'react';

export interface Props {
  sendMessage: (message: string) => void;
}
function MessageInput(props: Props) {
  const [inputText, setInputText] = useState('');

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(event.target.value);
  };

  const onKeyDown = (event: { key: string }) => {
    if (event.key === 'Enter') {
      props.sendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Send a message...."
        onChange={onChange}
        onKeyDown={onKeyDown}
        value={inputText}
      />
    </div>
  );
}
