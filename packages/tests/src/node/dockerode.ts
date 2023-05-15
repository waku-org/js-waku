import fs from "fs";

import debug from "debug";
import Docker from "dockerode";

import { Args } from "./interfaces.js";

const log = debug("waku:docker");

export default class Dockerode {
  public docker: Docker;
  private readonly IMAGE_NAME: string;
  public containerId?: string;
  constructor(imageName: string) {
    this.docker = new Docker();
    this.IMAGE_NAME = imageName;
  }

  get container(): Docker.Container | undefined {
    if (!this.containerId) {
      return undefined;
    }
    return this.docker.getContainer(this.containerId);
  }

  async startContainer(
    ports: number[],
    args: Args,
    argsArray: string[],
    logPath: string
  ): Promise<Docker.Container> {
    const [rpcPort, tcpPort, websocketPort, discv5UdpPort] = ports;
    await this.confirmImageExistsOrPull();
    const container = await this.docker.createContainer({
      Image: this.IMAGE_NAME,
      HostConfig: {
        PortBindings: {
          [`${rpcPort}/tcp`]: [{ HostPort: rpcPort.toString() }],
          [`${tcpPort}/tcp`]: [{ HostPort: tcpPort.toString() }],
          [`${websocketPort}/tcp`]: [{ HostPort: websocketPort.toString() }],
          ...(args?.peerExchange && {
            [`${discv5UdpPort}/udp`]: [{ HostPort: discv5UdpPort.toString() }],
          }),
        },
      },
      ExposedPorts: {
        [`${rpcPort}/tcp`]: {},
        [`${tcpPort}/tcp`]: {},
        [`${websocketPort}/tcp`]: {},
        ...(args?.peerExchange && {
          [`${discv5UdpPort}/udp`]: {},
        }),
      },
      Cmd: argsArray,
    });
    await container.start();

    const logStream = fs.createWriteStream(logPath);

    container.logs(
      { follow: true, stdout: true, stderr: true },
      (err, stream) => {
        if (err) {
          throw err;
        }
        if (stream) {
          stream.pipe(logStream);
        }
      }
    );

    this.containerId = container.id;

    log(
      `nwaku ${this.containerId} started at ${new Date().toLocaleTimeString()}`
    );

    return container;
  }

  async stop(): Promise<void> {
    if (!this.container) throw "containerId not set";

    log(
      `Shutting down nwaku container ID ${
        this.container
      } at ${new Date().toLocaleTimeString()}`
    );

    await this.container.remove({ force: true });

    this.containerId = undefined;
  }

  async confirmImageExistsOrPull(): Promise<void> {
    log(`Confirming that image ${this.IMAGE_NAME} exists`);

    const doesImageExist = this.docker.getImage(this.IMAGE_NAME);
    if (!doesImageExist) {
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(this.IMAGE_NAME, {}, (err, stream) => {
          if (err) {
            reject(err);
          }
          this.docker.modem.followProgress(stream, (err, result) => {
            if (err) {
              reject(err);
            }
            if (result) {
              resolve();
            }
          });
        });
      });
    }
    log(`Image ${this.IMAGE_NAME} successfully found`);
  }
}
