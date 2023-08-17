import type { DnsClient } from "@waku/interfaces";
import { bytesToUtf8 } from "@waku/utils/bytes";
import debug from "debug";
import { Endpoint, query, wellknown } from "dns-query";

const log = debug("waku:dns-over-https");

export class DnsOverHttps implements DnsClient {
  /**
   * Create new Dns-Over-Http DNS client.
   *
   * @param endpoints The endpoints for Dns-Over-Https queries;
   * Defaults to using dns-query's API..
   * @param retries Retries if a given endpoint fails.
   *
   * @throws {code: string} If DNS query fails.
   */
  public static async create(
    endpoints?: Endpoint[],
    retries?: number
  ): Promise<DnsOverHttps> {
    const _endpoints = endpoints ?? (await wellknown.endpoints("doh"));

    return new DnsOverHttps(_endpoints, retries);
  }

  private constructor(
    private endpoints: Endpoint[],
    private retries: number = 3
  ) {}

  /**
   * Resolves a TXT record
   *
   * @param domain The domain name
   *
   * @throws if the query fails
   */
  async resolveTXT(domain: string): Promise<string[]> {
    let answers;
    try {
      const res = await query(
        {
          question: { type: "TXT", name: domain }
        },
        {
          endpoints: this.endpoints,
          retries: this.retries
        }
      );
      answers = res.answers;
    } catch (error) {
      log("query failed: ", error);
      throw new Error("DNS query failed");
    }

    if (!answers) throw new Error(`Could not resolve ${domain}`);

    const data = answers.map((a) => a.data) as
      | Array<string | Uint8Array>
      | Array<Array<string | Uint8Array>>;

    const result: string[] = [];

    data.forEach((d) => {
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
