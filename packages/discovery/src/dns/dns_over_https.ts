import type { DnsClient } from "@waku/interfaces";
import { Logger } from "@waku/utils";
import { bytesToUtf8 } from "@waku/utils/bytes";
import DnsOverHttpResolver from "dns-over-http-resolver";

const log = new Logger("dns-over-https");

export class DnsOverHttps implements DnsClient {
  /**
   * Create new Dns-Over-Http DNS client.
   *
   * @throws {code: string} If DNS query fails.
   */
  public static async create(): Promise<DnsOverHttps> {
    return new DnsOverHttps();
  }

  private constructor(private resolver = new DnsOverHttpResolver()) {}

  /**
   * Resolves a TXT record
   *
   * @param domain The domain name
   *
   * @throws if the query fails
   */
  public async resolveTXT(domain: string): Promise<string[]> {
    let answers;
    try {
      answers = await this.resolver.resolveTxt(domain);
    } catch (error) {
      log.error("query failed: ", error);
      throw new Error("DNS query failed");
    }

    if (!answers) throw new Error(`Could not resolve ${domain}`);

    const result: string[] = [];

    answers.forEach((d) => {
      if (typeof d === "string") {
        result.push(d);
      } else if (Array.isArray(d)) {
        d.forEach((sd) => {
          if (typeof sd === "string") {
            result.push(sd);
          } else {
            result.push(bytesToUtf8(sd));
          }
        });
      } else {
        result.push(bytesToUtf8(d));
      }
    });

    return result;
  }
}
