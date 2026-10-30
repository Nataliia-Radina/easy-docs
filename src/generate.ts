import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

const SYSTEM_PROMPT = `You write onboarding guides for software engineers who are new to a repository.

You receive the repository's file tree and the contents of its key files. Write ONBOARDING.md in Markdown.

Rules:
- Base every statement on the provided material. Do not invent commands, scripts, env vars, services or architecture. If something important is not visible in the material, say so in a short "Open questions" section instead of guessing.
- Assume the reader is an experienced engineer. Skip generic explanations of the language or framework basics.
- Be concrete: real paths, real script names, real commands taken from the files.
- Keep it scannable: short sections, lists for steps, no filler.

Structure:
1. What this project does (2-4 sentences)
2. Tech stack
3. Getting started (prerequisites, install, run, test), only steps supported by the files
4. Repository map (key directories and files, one line each)
5. Architecture and main flow (how the pieces fit together, entry points)
6. Where to start (a few suggested first-reading files and a good first task)
7. Open questions (gaps in the documentation that a maintainer should answer)`;

export async function generateOnboarding(opts: {
  context: string;
  model: string;
}): Promise<string> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  const response = await client.messages.create({
    model: opts.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Write ONBOARDING.md for this repository.\n\n${opts.context}`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("The model returned an empty response.");
  return text + "\n";
}
