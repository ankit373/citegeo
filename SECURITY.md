# Security Policy

CiteGEO is self-hosted and runs on provider API keys that you supply. It has no backend of its own, and it sends nothing anywhere except to the model APIs you configure.

## Scope

This repository is pre-1.0. Treat it as unstable for production use, and pin a commit rather than tracking the default branch if you deploy it.

## Secrets

Never commit:

- `.env`
- Provider API keys
- Private domains or prompts
- Generated reports containing anything sensitive
- Local run directories holding evidence

`.env.example` documents the variable names and nothing else.

## Provider key boundaries

A key is only ever sent to the provider it belongs to. This is enforced in the provider catalogue and any change to it needs review.

| Variable | Reaches |
| :--- | :--- |
| `OPENROUTER_API_KEY` | OpenRouter |
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GEMINI_API_KEY` | Google Gemini |
| `PERPLEXITY_API_KEY` | Perplexity |
| `DEEPSEEK_API_KEY` | DeepSeek |

A result routed through OpenRouter stays labelled as an OpenRouter result, whichever model served it.

## Exposure to consider when self-hosting

The server binds `127.0.0.1` unless `HOST` says otherwise, so a fresh start is not reachable from another machine. The Docker image and the Helm chart set `HOST=0.0.0.0`, because a container has to listen on its own interfaces for the published port or the Service to reach it; the Compose file still publishes to `127.0.0.1` on the host side.

Authentication is off unless `AUTH_PASSWORD` is set, because turning it on by default would lock out every existing install on upgrade. While it is off, anyone who reaches the port can read every stored project, run and raw answer, and can spend your provider credit.

With `AUTH_PASSWORD` set, every route is closed except `/health`, the login form and the brand assets the form references. Sessions are a signed cookie carrying an expiry and nothing else: `HttpOnly`, `SameSite=Strict`, `Secure` when the request arrived over HTTPS, and valid for twelve hours. `AUTH_SECRET` signs them, and is regenerated each boot when unset, so a restart signs everyone out.

This is one shared password, not accounts. It keeps strangers out of an exposed instance. It is not a substitute for an authenticating proxy if you need per-person access, audit trails or revocation. The chart leaves `ingress.enabled=false` and offers a NetworkPolicy that denies everything until you name the sources allowed in.

## Credentials

Keys are read from the environment, or from a file when you set `<VARIABLE>_FILE` to its path, which is the convention Docker and Kubernetes secrets use. The application never writes a key, never logs one, and never returns one from an API: `GET /api/providers` reports variable names, the endpoint and whether a key is present, never its value.

There is deliberately no way to enter a provider key through the web UI. Doing that on a server with no authentication would let anyone who reaches the port store and use credentials, so key entry has to wait until the app can authenticate a user.

## Reporting a vulnerability

Report privately to the repository maintainer rather than opening a public issue, especially for anything involving key leakage or exposure of stored evidence.

Include:

- What the issue is
- The affected commit
- How to reproduce it
- Whether provider keys or stored reports can be exposed
