// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: No types available
import { DNSoverHTTPS } from 'dohdec';

import { DnsClient } from './dns';

export class Doh implements DnsClient {
  doh: DNSoverHTTPS;

  /**
   * Create new Dns-Over-Http DNS client.
   *
   * @param baseUrL Base URL for all HTTP requests. The underlying library
   * [dohdec](https://www.npmjs.com/package/dohdec) uses Cloudflare by default.
   * Other valid values can be find at [dns-query](https://github.com/martinheidegger/dns-query/blob/HEAD/endpoints.md).
   */
  public constructor(baseUrL?: string) {
    if (baseUrL) {
      this.doh = new DNSoverHTTPS({ url: baseUrL });
    } else {
      this.doh = new DNSoverHTTPS();
    }
  }

  async resolveTXT(domain: string): Promise<string[]> {
    return await this.doh
      .lookup(domain, 'TXT')
      .then((res: { Answer: [{ data: string }] }) =>
        res.Answer.map((answer: { data: string }) =>
          answer.data.replace(/(^")|("$)/g, '')
        )
      );
  }
}
