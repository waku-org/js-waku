import { TxtAnswer } from 'dns-packet';
import {
  endpoints as defaultEndpoints,
  Endpoint,
  EndpointProps,
  query,
} from 'dns-query';

import { DnsClient } from './dns';

const { cloudflare, google, opendns } = defaultEndpoints;

export type Endpoints =
  | 'doh'
  | 'dns'
  | Iterable<Endpoint | EndpointProps | string>;

export class DnsOverHttps implements DnsClient {
  /**
   * Create new Dns-Over-Http DNS client.
   *
   * @param endpoints The endpoints for Dns-Over-Https queries.
   * See [dns-query](https://www.npmjs.com/package/dns-query) for details.
   *
   * @throws {code: string} If DNS query fails.
   */
  public constructor(
    public endpoints: Endpoints = [cloudflare, google, opendns]
  ) {}

  async resolveTXT(domain: string): Promise<string[]> {
    const response = await query({
      questions: [{ type: 'TXT', name: domain }],
    });

    const answers = response.answers as TxtAnswer[];

    const data = answers.map((a) => a.data);

    const result: string[] = [];

    data.forEach((d) => {
      if (typeof d === 'string') {
        result.push(d);
      } else if (Array.isArray(d)) {
        d.forEach((sd) => {
          if (typeof sd === 'string') {
            result.push(sd);
          } else {
            result.push(Buffer.from(sd).toString('utf-8'));
          }
        });
      } else {
        result.push(Buffer.from(d).toString('utf-8'));
      }
    });

    return result;
  }
}
