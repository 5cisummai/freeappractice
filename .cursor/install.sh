#!/usr/bin/env bash
# Cloud Agent install step for Free AP Practice.
# Idempotent: safe to re-run. Prepares the pinned bun toolchain, installs
# dependencies, and seeds placeholder values for the build-time `$env/static/*`
# variables that SvelteKit requires to exist. Real values injected as Cloud
# Agent secrets always take precedence and are never overwritten here.
set -euo pipefail

BUN_VERSION="1.3.14"

# 1. Ensure the pinned bun is installed and available on the shared PATH.
if ! command -v bun >/dev/null 2>&1 || [ "$(bun --version 2>/dev/null)" != "$BUN_VERSION" ]; then
	export BUN_INSTALL="$HOME/.bun"
	curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
fi
export PATH="$HOME/.bun/bin:$PATH"

# Best-effort symlink onto the shared PATH so non-login shells also find bun.
# Terminals/start also export ~/.bun/bin directly, so this is not required.
if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
	sudo ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun || true
	sudo ln -sf "$HOME/.bun/bin/bunx" /usr/local/bin/bunx || true
fi

# 2. Install project dependencies from the committed lockfile.
bun install --frozen-lockfile

# 3. Seed a local .env with placeholders for the variables SvelteKit resolves at
#    build time. Only fill a key when it is not already provided by the
#    environment (real secrets win). Never overwrite an existing .env value.
touch .env
seed() {
	local key="$1" value="$2"
	# Skip if a real environment secret is present.
	if [ -n "${!key:-}" ]; then
		return
	fi
	# Skip if the key already exists in .env.
	if grep -qE "^${key}=" .env; then
		return
	fi
	printf '%s=%s\n' "$key" "$value" >>.env
}

seed BETTER_AUTH_SECRET "dev-placeholder-better-auth-secret-min-32-characters"
seed BETTER_AUTH_URL "http://localhost:5173"
seed PUBLIC_BASE_URL "http://localhost:5173"
seed OPENAI_BASE_URL "https://api.openai.com/v1"
seed OPEN_AI_KEY "sk-placeholder-not-a-real-key"
seed RESEND_API_KEY "re_placeholder"
seed RESEND_FROM "Dev <noreply@example.com>"
seed PUBLIC_GOOGLE_CLIENT_ID ""
seed PUBLIC_POSTHOG_PROJECT_TOKEN ""
seed PUBLIC_POSTHOG_HOST "https://us.i.posthog.com"

echo "Cloud Agent install complete (bun $(bun --version))."
