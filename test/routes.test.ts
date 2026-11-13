import assert from "node:assert/strict";
import test from "node:test";
import {
  type AddressBar,
  APP_PAGES,
  addressWriter,
  parseRoute,
  routeHash,
  SECTIONS,
} from "../src/ui/app/routes.js";

// A browser history reduced to what the app touches: a stack, a cursor, and
// Back and Forward moving the cursor without writing anything.
function fakeHistory(start: string) {
  const entries = [start];
  let at = 0;
  const bar: AddressBar = {
    hash: () => entries[at] ?? "",
    push: (hash) => {
      entries.splice(at + 1);
      entries.push(hash);
      at += 1;
    },
    replace: (hash) => {
      entries[at] = hash;
    },
  };
  return {
    bar,
    entries,
    back: () => {
      at = Math.max(0, at - 1);
      return bar.hash();
    },
    forward: () => {
      at = Math.min(entries.length - 1, at + 1);
      return bar.hash();
    },
  };
}

test("a project page reads back to the page and the project it was written for", () => {
  for (const section of SECTIONS) {
    const hash = routeHash(section.page, "acme-1");
    assert.deepEqual(
      parseRoute(hash || ""),
      { kind: "page", page: section.page, projectId: "acme-1" },
      section.slug,
    );
  }
  for (const page of APP_PAGES) {
    assert.deepEqual(parseRoute(routeHash(page.page, "acme-1") || ""), {
      kind: "page",
      page: page.page,
      projectId: "",
    });
  }
});

test("a project id is escaped in the address and unescaped on the way back", () => {
  const hash = routeHash("prompts", "a b/c");
  assert.equal(hash, "#/projects/a%20b%2Fc/questions");
  assert.deepEqual(parseRoute(hash || ""), {
    kind: "page",
    page: "prompts",
    projectId: "a b/c",
  });
});

test("a project with no section opens on its overview", () => {
  assert.deepEqual(parseRoute("#/projects/acme-1"), {
    kind: "page",
    page: "dashboard",
    projectId: "acme-1",
  });
  assert.deepEqual(parseRoute("#/projects/acme-1/"), {
    kind: "page",
    page: "dashboard",
    projectId: "acme-1",
  });
});

test("no address is a first visit, not an error", () => {
  assert.deepEqual(parseRoute(""), { kind: "none" });
  assert.deepEqual(parseRoute("#"), { kind: "none" });
  assert.deepEqual(parseRoute("#/"), { kind: "none" });
});

test("an address that names nothing is reported as not found, with what was asked for", () => {
  assert.deepEqual(parseRoute("#/nowhere"), {
    kind: "not-found",
    path: "/nowhere",
  });
  assert.deepEqual(parseRoute("#/projects/acme-1/nowhere"), {
    kind: "not-found",
    path: "/projects/acme-1/nowhere",
  });
  assert.deepEqual(parseRoute("#/projects/acme-1/questions/extra"), {
    kind: "not-found",
    path: "/projects/acme-1/questions/extra",
  });
  assert.deepEqual(parseRoute("#/elsewhere/acme-1/questions"), {
    kind: "not-found",
    path: "/elsewhere/acme-1/questions",
  });
  assert.equal(parseRoute("#/projects/%E0%A4%A/questions").kind, "not-found");
});

test("a project page with no project chosen has no address to write", () => {
  assert.equal(routeHash("prompts", ""), null);
  assert.equal(routeHash("not-found", "acme-1"), null);
});

test("back and forward walk the pages in the order they were opened", () => {
  const history = fakeHistory("");
  const write = addressWriter(history.bar);
  write(routeHash("dashboard", "acme-1"));
  write(routeHash("prompts", "acme-1"));
  write(routeHash("brand-visibility", "acme-1"));
  // The first write replaced the bare address, so Back never shows a page without one.
  assert.deepEqual(history.entries, [
    "#/projects/acme-1/overview",
    "#/projects/acme-1/questions",
    "#/projects/acme-1/rivals",
  ]);
  assert.deepEqual(parseRoute(history.back()), {
    kind: "page",
    page: "prompts",
    projectId: "acme-1",
  });
  assert.deepEqual(parseRoute(history.back()), {
    kind: "page",
    page: "dashboard",
    projectId: "acme-1",
  });
  assert.deepEqual(parseRoute(history.forward()), {
    kind: "page",
    page: "prompts",
    projectId: "acme-1",
  });
});

test("rendering the page the address already names adds no history entry", () => {
  const history = fakeHistory("#/projects/acme-1/questions");
  const write = addressWriter(history.bar);
  write(routeHash("prompts", "acme-1"));
  write(routeHash("prompts", "acme-1"));
  assert.deepEqual(history.entries, ["#/projects/acme-1/questions"]);
  // Following Back re-renders that page, which must not push it a second time.
  write(routeHash("answer-engine", "acme-1"));
  history.back();
  write(routeHash("prompts", "acme-1"));
  assert.deepEqual(history.entries, [
    "#/projects/acme-1/questions",
    "#/projects/acme-1/sources",
  ]);
});

test("a refresh on a deep link opens the same page of the same project", () => {
  const deep = "#/projects/acme-1/sources";
  const route = parseRoute(deep);
  assert.deepEqual(route, {
    kind: "page",
    page: "answer-engine",
    projectId: "acme-1",
  });
  const history = fakeHistory(deep);
  const write = addressWriter(history.bar);
  if (route.kind === "page") write(routeHash(route.page, route.projectId));
  assert.deepEqual(history.entries, [deep]);
});

test("switching project is its own step back", () => {
  const history = fakeHistory("#/projects/acme-1/questions");
  const write = addressWriter(history.bar);
  write(routeHash("prompts", "acme-1"));
  write(routeHash("prompts", "other-2"));
  assert.deepEqual(parseRoute(history.back()), {
    kind: "page",
    page: "prompts",
    projectId: "acme-1",
  });
});
