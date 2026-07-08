/** RFC 8288 Link header values for the homepage. */
export function buildHomepageLinkHeader(): string {
	const links = [
		`</.well-known/api-catalog>; rel="api-catalog"`,
		`</openapi.json>; rel="service-desc"; type="application/json"`,
		`</llms.txt>; rel="service-doc"`,
		`</auth.md>; rel="describedby"`,
		`</.well-known/oauth-authorization-server>; rel="oauth-authorization-server"`,
		`</.well-known/oauth-protected-resource>; rel="oauth-protected-resource"`,
		`</.well-known/agent-skills/index.json>; rel="agent-skills"`,
		`</.well-known/mcp/server-card.json>; rel="mcp-server-card"`
	];

	return links.join(', ');
}
