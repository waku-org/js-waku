import { TxtAnswer } from "dns-packet";
import {
  endpoints as defaultEndpoints,
  Endpoint,
  EndpointProps,
  query,
} from "dns-query";

import { bytesToUtf8 } from "../utils";

import { DnsClient } from "./dns";

const { cloudflare, google, opendns } = defaultEndpoints;

export type Endpoints =
  | "doh"
  | "dns"
  | Iterable<Endpoint | EndpointProps | string>;

export class DnsOverHttps implements DnsClient {
  /**
   * Create new Dns-Over-Http DNS client.
   *
   * @param endpoints The endpoints for Dns-Over-Https queries.
   * See [dns-query](https://www.npmjs.com/package/dns-query) for details.
   * Defaults to cloudflare, google and opendns.
   *
   * @throws {code: string} If DNS query fails.
   */
  public constructor(
    public endpoints: Endpoints = [cloudflare, google, opendns]
  ) {}

  /**
   * Resolves a TXT record
   *
   * @param domain The domain name
   *
   * @throws if the result is provided in byte form which cannot be decoded
   * to UTF-8
   */
  async resolveTXT(domain: string): Promise<string[]> {
    const response = await query({
      questions: [{ type: "TXT", name: domain }],
    });

    const answers = response.answers as TxtAnswer[];

    const data = answers.map((a) => a.data);

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
