// A metric labelled with a URL path grows a new series per project and per
// question. The convention is http.route, the templated shape, and the way to
// get one without a router is a vocabulary of the segments that are literal.

/** Every fixed segment this server serves. Anything else in a path is an
 * identifier, whatever it looks like, so a new id shape cannot leak in. */
const LITERAL = new Set([
  "api", "projects", "assets", "app", "login", "logout", "health", "healthz", "readyz", "metrics",
  "topics", "prompts", "generate", "bulk", "activate", "retire", "personas",
  "prompt-runs", "cancel", "prompt-answers", "prompt-insights", "prompt-schedule", "prompt-demand",
  "prompt-export", "answer-export", "prompt-brief", "prompt-brief.md", "question-priority",
  "ranking-plan", "actions", "engines", "source-pages", "search-demand", "assistant-referrals",
  "competitors", "adopt", "segments", "remove", "regions", "digest", "home", "profile",
  "cited-pages", "crawlers", "models", "baselines", "monitoring-configuration", "provider-models",
  "credentials", "storage", "check", "insights", "signals", "action-plan", "measurements",
  "recognition", "reports", "runs", "observations", "tasks", "workbench", "nested",
]);

const MAX_SEGMENTS = 12;

/** Names the placeholder after the collection before it, so a route reads as
 * a route rather than as a row of anonymous braces. */
function placeholderFor(previous: string | undefined): string {
  if (previous === "projects") return "{projectId}";
  if (previous === "prompt-runs") return "{runId}";
  if (previous === "prompt-export" || previous === "answer-export") return "{table}";
  if (previous === "baselines") return "{baselineId}";
  if (previous === "assets" || previous === "app") return "{path}";
  return "{id}";
}

export function routeTemplate(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return "/";
  // A path longer than anything this server routes is one label, not many.
  if (segments.length > MAX_SEGMENTS) return "/{deep}";
  const out: string[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index] as string;
    if (LITERAL.has(segment)) {
      out.push(segment);
      continue;
    }
    const placeholder = placeholderFor(segments[index - 1]);
    // Everything under a static asset prefix collapses to one label.
    if (placeholder === "{path}") {
      out.push(placeholder);
      break;
    }
    out.push(placeholder);
  }
  return `/${out.join("/")}`;
}

export function isLiteralSegment(segment: string): boolean {
  return LITERAL.has(segment);
}
