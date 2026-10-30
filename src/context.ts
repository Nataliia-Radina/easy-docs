import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";

export interface RepoContext {
  name: string;
  tree: string[];
  treeTruncated: boolean;
  files: { path: string; content: string; truncated: boolean }[];
}

const MAX_TREE_ENTRIES = 400;
const MAX_FILE_CHARS = 8_000;
const MAX_TOTAL_CHARS = 60_000;

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".output",
  "coverage",
  "vendor",
  "__pycache__",
  ".venv",
  "target",
]);

// Files that explain what a project is and how to run it. Matched by basename
// anywhere in the first two directory levels; earlier entries get budget first.
const KEY_FILE_PATTERNS: RegExp[] = [
  /^README(\.[a-z]+)?$/i,
  /^CONTRIBUTING(\.[a-z]+)?$/i,
  /^ARCHITECTURE(\.[a-z]+)?$/i,
  /^package\.json$/,
  /^pyproject\.toml$/,
  /^requirements\.txt$/,
  /^go\.mod$/,
  /^Cargo\.toml$/,
  /^pom\.xml$/,
  /^build\.gradle(\.kts)?$/,
  /^Gemfile$/,
  /^composer\.json$/,
  /^Makefile$/,
  /^Dockerfile$/,
  /^docker-compose\.ya?ml$/,
  /^\.env\.example$/,
  /^(vite|nuxt|next|webpack|vue)\.config\.[cm]?[jt]s$/,
  /^tsconfig\.json$/,
];

const ENTRY_POINT_PATTERNS: RegExp[] = [
  /^(src\/)?(main|index|app|cli|server)\.[cm]?[jt]sx?$/,
  /^(src\/)?(main|app|__main__|manage)\.py$/,
  /^(cmd\/[^/]+\/)?main\.go$/,
  /^src\/main\.rs$/,
];

function listFilesViaGit(root: string): string[] | null {
  try {
    // tracked + untracked-but-not-ignored, so uncommitted work is included too
    const out = execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard"], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\n").filter(Boolean);
  } catch {
    return null;
  }
}

function listFilesViaWalk(root: string): string[] {
  const result: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(join(dir, entry.name));
      } else if (entry.isFile()) {
        result.push(relative(root, join(dir, entry.name)));
      }
    }
  };
  walk(root);
  return result;
}

function isIgnored(path: string): boolean {
  return path.split("/").some((part) => IGNORED_DIRS.has(part));
}

function readTruncated(abs: string): { content: string; truncated: boolean } | null {
  try {
    if (statSync(abs).size > 2_000_000) return null;
    const raw = readFileSync(abs, "utf8");
    if (raw.includes("\u0000")) return null; // binary
    if (raw.length <= MAX_FILE_CHARS) return { content: raw, truncated: false };
    return { content: raw.slice(0, MAX_FILE_CHARS), truncated: true };
  } catch {
    return null;
  }
}

export function collectContext(root: string): RepoContext {
  const allFiles = (listFilesViaGit(root) ?? listFilesViaWalk(root))
    .filter((p) => !isIgnored(p))
    .sort();

  const tree = allFiles.slice(0, MAX_TREE_ENTRIES);

  const depth = (p: string) => p.split("/").length;
  const shallow = allFiles.filter((p) => depth(p) <= 3);

  const picked: string[] = [];
  for (const pattern of KEY_FILE_PATTERNS) {
    for (const p of shallow) {
      if (depth(p) <= 2 && pattern.test(basename(p)) && !picked.includes(p)) picked.push(p);
    }
  }
  for (const pattern of ENTRY_POINT_PATTERNS) {
    for (const p of shallow) {
      if (pattern.test(p) && !picked.includes(p)) picked.push(p);
    }
  }

  const files: RepoContext["files"] = [];
  let total = 0;
  for (const p of picked) {
    if (total >= MAX_TOTAL_CHARS) break;
    const read = readTruncated(join(root, p));
    if (!read) continue;
    total += read.content.length;
    files.push({ path: p, ...read });
  }

  return {
    name: basename(root),
    tree,
    treeTruncated: allFiles.length > MAX_TREE_ENTRIES,
    files,
  };
}

export function renderContext(ctx: RepoContext): string {
  const parts: string[] = [];
  parts.push(`# Repository: ${ctx.name}`);
  parts.push(
    `## File tree${ctx.treeTruncated ? ` (first ${MAX_TREE_ENTRIES} entries)` : ""}\n` +
      ctx.tree.join("\n"),
  );
  for (const f of ctx.files) {
    parts.push(
      `## File: ${f.path}${f.truncated ? " (truncated)" : ""}\n\`\`\`\n${f.content}\n\`\`\``,
    );
  }
  return parts.join("\n\n");
}
