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

`npm run server` calls `listen(port)` with no host argument, so Node binds every interface, not just loopback. On a machine with a public address the workbench is reachable from the internet the moment you start it, and there is no authentication anywhere in the app. Anyone who reaches the port can read every stored project, run and raw answer, and can spend your provider credit.

Put an authenticating proxy in front of it, bind it to loopback yourself, or run it through the Compose file, which publishes to `127.0.0.1` explicitly.

## Reporting a vulnerability

Report privately to the repository maintainer rather than opening a public issue, especially for anything involving key leakage or exposure of stored evidence.

Include:

- What the issue is
- The affected commit
- How to reproduce it
- Whether provider keys or stored reports can be exposed
