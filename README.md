# EasyDocs

AI-powered CLI that reads a repository and writes an `ONBOARDING.md` for engineers who are new to it.

## The idea

Help developers understand unfamiliar codebases faster. EasyDocs collects the repo's structure and key files (README, manifests, configs, entry points), asks Claude to write an onboarding guide grounded in that material, and flags gaps in the existing documentation as open questions instead of guessing.

## Current scope (v1)

- Input: a local clone of a repository
- Output: `ONBOARDING.md` written into that clone (review it with `git diff`)
- Covers onboarding to the project: what it does, stack, how to run it, repo map, architecture, where to start
- Not in v1: onboarding to the team, PRs via GitHub API, sources outside the repo (Confluence, Google Docs)

## Usage

```bash
npm install
export ANTHROPIC_API_KEY=...

# generate ONBOARDING.md for a local clone
npm run dev -- /path/to/repo

# see what would be sent to the model, without calling the API
npm run dev -- /path/to/repo --dry-run
```

Options: `--out <file>`, `--model <id>`, `--force`, `--dry-run`. Run with `--help` for details.

Build a binary with `npm run build`, then run `node dist/cli.js <path>`.

## Roadmap

1. Onboarding for a repository (this version)
2. Also improve or generate `README.md`
3. Open a PR via the GitHub API instead of writing locally
4. More sources: Confluence, Google Docs and others
