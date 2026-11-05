// Smoke test: mounts the plugin against a fake skill registry and checks the
// candidate, the description, the resource base and the placeholder rewrite.
// Run: node scripts/smoke-test.mjs
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

const here = fileURLToPath(new URL("../", import.meta.url));
const { apply } = await import(pathToFileURL(join(here, "index.js")).href);

let provider;
const ctx = {
  skills: {
    registerProvider(factory) {
      provider = factory({});
      return () => {};
    },
  },
};

apply(ctx, {});
assert.ok(provider, "provider must be registered");
assert.equal(provider.name, "dsh-academic-paper-polish");

const candidates = await provider.list();
assert.equal(candidates.length, 1);
const [candidate] = candidates;
assert.equal(candidate.name, "academic-paper-polish");
assert.ok(candidate.description.length > 0, "description must not be empty");
assert.ok(candidate.description.length <= 500, `description too long for the catalog: ${candidate.description.length}`);
assert.ok(!candidate.description.includes("{{"), "description must not contain placeholders");
assert.equal(candidate.invocation.modelInvocable, true);
assert.equal(candidate.invocation.userInvocable, true);
assert.equal(candidate.resourceBase.kind, "directory");
assert.ok(candidate.resourceBase.path.startsWith("/") || /^[A-Za-z]:/.test(candidate.resourceBase.path), "resource base must be absolute");
assert.ok(candidate.resourceBase.path.includes("academic-paper-polish"), "resource base must point at the skill folder");

const definition = await provider.get(candidate, {});
assert.equal(definition.name, "academic-paper-polish");
assert.equal(definition.source, "bundled");
assert.ok(typeof definition.content === "string" && definition.content.length > 1000, "content must be the skill body");
assert.ok(!definition.content.includes("{{SKILL_DIR}}"), "placeholder must be rewritten");
assert.ok(definition.content.includes(candidate.resourceBase.path), "body must carry the absolute resource directory");
assert.ok(definition.content.includes("prompts/01-abstract.md"), "module index must survive");
assert.ok(!definition.content.startsWith("---"), "frontmatter must be stripped from the body");

console.log("OK: provider registered, description %d chars, body %d chars", candidate.description.length, definition.content.length);
console.log("resourceBase:", candidate.resourceBase.path);
