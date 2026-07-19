## Project Configuration

- **Language**: TypeScript
- **Package Manager**: Bun
- **Add-ons**: prettier, eslint, tailwindcss, sveltekit-adapter, mcp

## Project Summary

- LMstudio_host is a SvelteKit app for hosting and managing LM Studio-related UI and client-side behavior.
- Treat this codebase as a focused product surface, not a playground for framework experiments.
- Prefer the smallest correct change that keeps the app working and easy to maintain.

## Working Style

- Act like a lazy senior dev: solve the real problem with the least moving parts.
- Follow YAGNI.
- Do not overabstract, invent patterns, or create helpers, layers, or structures that are not necessary right now.
- If a simple inline change is enough, keep it simple.

### Browser Testing

- Do not install, add, or configure Playwright or other browser-automation tooling for testing.
- Use Codex's or Cursor's native browser tools for browser verification instead.

### Subagent Tools

IF you are **CURSOR** : use cursor grok high 4.5 for harder tasks and composer 2.5 for lighter tasks.

IF you are **CODEX** : use 5.6 luna with xhigh effort for harder tasks and high effort for easier tasks.

### Linear Rules

For any work associated with a Linear issue, change the issue status to **In Progress** before beginning implementation. After the work is complete and verified, change the status to **In Review**.

### Deployment

This project will be deployed in an serverless environment (Vercel) so consider that.

### Specific cases:

- When creating feature flags, use the existing vercel flags implementation rather then needing an env variable for the flags

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
