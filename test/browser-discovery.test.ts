import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverBrowser,
  parsePortFile,
  profileDirectories,
  type DiscoveryIo,
} from "../src/product/engines/browser-discovery.js";
import { probeReach } from "../src/product/engines/engine-reach.js";

const NOTHING: DiscoveryIo = {
  version: async () => null,
  tabs: async () => null,
  portFile: async () => null,
  socketAlive: async () => null,
};

function io(overrides: Partial<DiscoveryIo>): DiscoveryIo {
  return { ...NOTHING, ...overrides };
}

const CHROME_FILE = "9222\n/devtools/browser/abc-123\n";

test("a port file is the port and the browser's own socket path", () => {
  assert.deepEqual(parsePortFile(CHROME_FILE), { port: 9222, path: "/devtools/browser/abc-123" });
});

test("a port file with no socket path still gives the port", () => {
  assert.deepEqual(parsePortFile("9222\n"), { port: 9222, path: "" });
});

test("a file that is not a port is not a browser", () => {
  assert.equal(parsePortFile(""), null);
  assert.equal(parsePortFile("not a port\n/devtools/browser/x"), null);
  assert.equal(parsePortFile("0\n/x"), null);
  assert.equal(parsePortFile("99999\n/x"), null);
});

test("every platform looks in browser profiles and nowhere else", () => {
  for (const platform of ["darwin", "win32", "linux"]) {
    const directories = profileDirectories("/home/me", platform, "C:\\local");
    assert.ok(directories.length >= 4, platform);
    for (const directory of directories) {
      const lower = directory.toLocaleLowerCase();
      const browser = ["chrome", "chromium", "edge", "brave"].some((name) => lower.includes(name));
      assert.ok(browser, `${directory} is not a browser profile`);
    }
  }
});

test("a browser that lists its tabs is found where it was named", async () => {
  const search = await discoverBrowser({
    configured: "http://127.0.0.1:9333",
    directories: ["/profile"],
    io: io({
      version: async () => ({ browser: "Chrome/153", webSocketDebuggerUrl: "ws://127.0.0.1:9333/devtools/browser/z" }),
      tabs: async () => [{ id: "a", type: "page", url: "about:blank", webSocketDebuggerUrl: "ws://x" }],
    }),
  });
  assert.equal(search.found?.source, "configured");
  assert.equal(search.found?.pages, 1);
  assert.equal(search.found?.browser, "Chrome/153");
});

test("a browser listening and refusing to list its tabs is found, not declared missing", async () => {
  // Switching debugging on from the browser's own inspect page leaves exactly
  // this state, and it used to read as no browser at all.
  const search = await discoverBrowser({
    configured: "http://127.0.0.1:9222",
    directories: ["/profile"],
    io: io({
      portFile: async () => CHROME_FILE,
      socketAlive: async (url) => (url === "ws://127.0.0.1:9222/devtools/browser/abc-123" ? 103 : null),
    }),
  });
  assert.equal(search.found?.pages, 103);
  assert.equal(search.found?.browserWsUrl, "ws://127.0.0.1:9222/devtools/browser/abc-123");
  assert.equal(search.found?.endpoint, "", "only the socket is known, and saying otherwise would invent one");
});

test("a browser you named and cannot be reached never falls through to a different one", async () => {
  // A port that answers is not necessarily a browser you meant, and driving
  // somebody else's application is worse than finding nothing.
  const search = await discoverBrowser({
    configured: "http://127.0.0.1:1",
    directories: ["/profile"],
    io: io({
      portFile: async () => CHROME_FILE,
      socketAlive: async () => 103,
    }),
  });
  assert.equal(search.found, null);
  assert.ok(search.detail.includes("127.0.0.1:1"));
});

test("with nothing configured the profiles are read, and the one that answers wins", async () => {
  const search = await discoverBrowser({
    directories: ["/dead", "/live"],
    io: io({
      portFile: async (directory) => (directory === "/dead" ? "9111\n/devtools/browser/dead" : CHROME_FILE),
      socketAlive: async (url) => (url.includes("abc-123") ? 7 : null),
    }),
  });
  assert.equal(search.found?.profile, "/live");
  assert.equal(search.found?.pages, 7);
  assert.deepEqual(search.looked, ["http://127.0.0.1:9111 (/dead)", "http://127.0.0.1:9222 (/live)"]);
});

test("nowhere to look is said as nowhere to look, not as no browser", async () => {
  const search = await discoverBrowser({ directories: [], io: NOTHING });
  assert.equal(search.found, null);
  assert.deepEqual(search.looked, []);
  assert.ok(search.detail.includes("Nowhere to look"));
});

test("a stale port file is not a browser", async () => {
  const search = await discoverBrowser({
    directories: ["/profile"],
    io: io({ portFile: async () => CHROME_FILE, socketAlive: async () => null }),
  });
  assert.equal(search.found, null);
  assert.equal(search.looked.length, 1, "it was tried, and saying so is the point");
});

test("the caveat says ports are never scanned and why", async () => {
  const search = await discoverBrowser({ directories: [], io: NOTHING });
  assert.ok(search.caveat.includes("never scanned"));
  assert.ok(search.caveat.includes("same engine"));
});

test("a reach sweep opens its own tab and leaves the browser as it found it", async () => {
  // Driving a tab somebody is reading navigates it away and posts into
  // whatever conversation was open there.
  const opened: string[] = [];
  const closed: string[] = [];
  const session = {
    send: async () => ({}),
    evaluate: async () => ({ url: "https://surface.test/", host: "surface.test", length: 9000, composer: 1, signIn: [] }),
    close: () => {},
  };
  const driver = {
    search: { found: { endpoint: "http://127.0.0.1:9333", browserWsUrl: "", browser: "Chrome", pages: 2, source: "configured", profile: "", detail: "x" }, looked: [], detail: "found", caveat: "c" },
    connection: {} as never,
    withTab: async (run: (value: never) => Promise<unknown>) => {
      opened.push("tab");
      try {
        return await run(session as never);
      } finally {
        closed.push("tab");
      }
    },
    close: () => {},
  };
  const result = await probeReach({
    engines: [{ id: "chatgpt", label: "A surface", home: "https://surface.test/", caveat: "c", grounding: "per_question", ask: async () => ({ state: "no_answer", detail: "" }) }],
    driver: driver as never,
  });
  assert.deepEqual(opened, ["tab"]);
  assert.deepEqual(closed, ["tab"], "the tab it opened is the tab it closes");
  assert.equal(result.engines[0]?.reach, "drivable");
  assert.equal(result.found, "found");
});
