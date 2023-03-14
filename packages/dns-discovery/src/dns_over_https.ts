import { bytesToUtf8 } from "@waku/utils/bytes";
import debug from "debug";
import { Endpoint, query, toEndpoint } from "dns-query";

import { DnsClient } from "./dns.js";

const log = debug("waku:dns-over-https");

export class DnsOverHttps implements DnsClient {
  /**
   * Default endpoints to use for DNS queries.
   * Taken from https://github.com/martinheidegger/dns-query as static data
   * to avoid dynamic queries.
   *
   * To dynamically retrieve other endpoints, use https://github.com/martinheidegger/dns-query#well-known-endpoints
   */
  static DefaultEndpoints: Endpoint[] = [
    toEndpoint({
      name: "AhaDNS",
      protocol: "https:",
      host: "doh.la.ahadns.net",
      ipv4: "45.67.219.208",
    }),
    toEndpoint({
      name: "cloudflare",
      protocol: "https:",
      host: "dns.cloudflare.com",
      ipv4: "1.0.0.1",
    }),
  ];

  /**
   * Create new Dns-Over-Http DNS client.
   *
   * @param endpoints The endpoints for Dns-Over-Https queries;
   * Defaults to [[DnsOverHttps.DefaultEndpoints]].
   * @param retries Retries if a given endpoint fails.
   *
   * @throws {code: string} If DNS query fails.
   */
  public constructor(
    private endpoints: Endpoint[] = DnsOverHttps.DefaultEndpoints,
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
          question: { type: "TXT", name: domain },
        },
        {
          endpoints: this.endpoints,
          retries: this.retries,
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
