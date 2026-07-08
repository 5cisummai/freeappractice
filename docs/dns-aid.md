# DNS for AI Discovery (DNS-AID)

DNS-AID records enable agent discovery via DNS without HTTP. These records must be published in your DNS provider for `freeappractice.org` — they cannot be served from the SvelteKit application.

## Prerequisites

- DNSSEC signing enabled on the public zone (required for authenticated discovery)
- HTTPS endpoint available at the advertised origin

## Recommended records

Publish ServiceMode SVCB/HTTPS records under the `_agents` subdomain:

```text
_index._agents.freeappractice.org. 300 IN HTTPS 1 freeappractice.org alpn=h2,h3 api=/.well-known/api-catalog
_a2a._agents.freeappractice.org.  300 IN HTTPS 1 freeappractice.org alpn=h2,h3 api=/.well-known/mcp/server-card.json
```

### Vercel DNS example

If using Vercel nameservers, add TXT/SVCB records in the Vercel dashboard or via API. Exact record UI varies by provider; consult your DNS operator's SVCB/HTTPS record documentation.

## Verification

After publishing and DNSSEC signing:

```bash
dig HTTPS _index._agents.freeappractice.org
dig HTTPS _a2a._agents.freeappractice.org
```

Validate with an isitagentready.com scan once DNS has propagated.

## References

- [DNS-AID draft](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/)
- [RFC 9460 — SVCB and HTTPS records](https://www.rfc-editor.org/rfc/rfc9460)
