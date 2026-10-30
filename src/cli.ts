#!/usr/bin/env node
import { existsSync, statSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { collectContext, renderContext } from "./context.js";
import { DEFAULT_MODEL, generateOnboarding } from "./generate.js";

const HELP = `easy-docs: generate ONBOARDING.md for a repository

Usage:
  easy-docs [path] [options]

Arguments:
  path              Path to a local clone (default: current directory)

Options:
  --out <file>      Output file name inside the repo (default: ONBOARDING.md)
  --model <id>      Claude model (default: ${DEFAULT_MODEL})
  --force           Overwrite the output file if it exists
  --dry-run         Print the context that would be sent to the model and exit (no API call)
  -h, --help        Show this help

Environment:
  ANTHROPIC_API_KEY must be set unless --dry-run is used.

After generation, review the result with: git diff
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string", default: "ONBOARDING.md" },
      model: { type: "string", default: DEFAULT_MODEL },
      force: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  const root = resolve(positionals[0] ?? ".");
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }

  const context = renderContext(collectContext(root));

  if (values["dry-run"]) {
    process.stdout.write(context + "\n");
    process.stderr.write(`\n[dry-run] context size: ${context.length} chars\n`);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const outPath = join(root, values.out!);
  if (existsSync(outPath) && !values.force) {
    throw new Error(`${outPath} already exists. Use --force to overwrite.`);
  }

  process.stderr.write(`Analyzing ${root} with ${values.model}...\n`);
  const markdown = await generateOnboarding({ context, model: values.model! });
  writeFileSync(outPath, markdown, "utf8");
  process.stderr.write(`Wrote ${outPath}\nReview with: git -C "${root}" diff\n`);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
