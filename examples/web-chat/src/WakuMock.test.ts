import WakuMock, { Message } from "./WakuMock";

test("Messages are emitted", async () => {
  const wakuMock = await WakuMock.create();

  let message: Message;
  wakuMock.on("message", (msg) => {
    message = msg;
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));
  // @ts-ignore
  expect(message.message).toBeDefined();
});

test("Messages are sent", async () => {
  const wakuMock = await WakuMock.create();

  const text = "This is a message.";

  let message: Message;
  wakuMock.on("message", (msg) => {
    message = msg;
  });

  await wakuMock.send(text);

  // @ts-ignore
  expect(message.message).toEqual(text);
});
