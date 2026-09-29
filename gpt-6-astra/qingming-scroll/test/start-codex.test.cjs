const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("the project launcher bounds context without changing the model or dropping arguments", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "qingming-codex-"));
  try {
    const stub = path.join(directory, "codex");
    fs.writeFileSync(stub, `#!${process.execPath}\nconsole.log(JSON.stringify(process.argv.slice(2)));\n`,
      { mode: 0o700 });
    const root = path.resolve(__dirname, "..");
    const args = JSON.parse(execFileSync("sh", [
      path.join(root, "tools/start-codex.sh"), "resume", "test-session", "a prompt with spaces",
    ], {
      cwd: os.tmpdir(),
      env: { ...process.env, PATH: `${directory}${path.delimiter}${process.env.PATH}` },
      encoding: "utf8",
    }));
    assert.deepEqual(args, [
      "--cd", root,
      "-c", "model_auto_compact_token_limit=64000",
      "-c", "tool_output_token_limit=4000",
      "resume", "test-session", "a prompt with spaces",
    ]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
