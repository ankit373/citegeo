# Reading the surfaces buyers use

An API answer and a product answer are different things. ChatGPT the product
runs its own retrieval, its own system prompt and its own model routing, none
of which an API key exposes. These engines read the product.

## What you need

A browser you started, with remote debugging on, signed in to whichever
surfaces you want read.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.citegeo-browser"
```

Sign in to the surfaces in that window once. The profile keeps the session, so
later runs reuse it. Nothing here signs in for you or works around a sign-in.

## What each one does

| Engine | Surface | Notes |
| :--- | :--- | :--- |
| `google-ai-overview` | Google search results | Shows an overview for some queries and not others. No overview is a finding, not a failure. |
| `perplexity-web` | perplexity.ai | Also sold as an API, so the two answers can be compared. Signed out it answers but links nothing. |
| `chatgpt` | chatgpt.com | Waits for the stream to finish; half an answer is worse than none. |
| `copilot` | copilot.microsoft.com | Personalises by account and region. |

## The four outcomes

None of them is a silent empty answer.

- **answered** — the surface's own answer container was found and read.
- **no_answer** — the surface answered nothing. A real finding: a searcher
  sees the same.
- **unreadable** — the page changed shape. A bug in the adapter, not in your
  setup.
- **unavailable** — the browser is missing, the tab closed, or the surface is
  asking you to sign in.

`unreadable` and `unavailable` are kept apart on purpose. One is fixed by
updating a selector and the other by signing in, and reporting the wrong one
sends you to the wrong place. A sign-in prompt *beside* a rendered answer is a
banner rather than a wall, so the answer container gets fifteen seconds to
appear before a wall is believed.

## What this is not

Nothing is enabled by default. Automating a site you do not own may be against
its terms, and that is a judgement for whoever runs it.

These read one browser, in one place, signed in as one person. They are what
your session saw, which is not the same as what everyone sees.
