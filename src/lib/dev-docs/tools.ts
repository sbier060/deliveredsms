/**
 * Per-AI-tool landing pages (/developers/[tool]) — the Resend pattern of a
 * dedicated "use us with X" page for every coding agent. These pages are what
 * an agent retrieves when someone asks it "how do I send SMS / verify a
 * phone", so each leads with the integration move that tool actually
 * supports (MCP config vs skills install), not generic copy.
 *
 * The sitemap generator regex-extracts `slug:` values from this file, the
 * same way it reads the docs registry — adding a tool here is enough.
 */

export interface AgentTool {
  slug: string;
  name: string;
  /** Tagline under the tool name. */
  tag: string;
  /** Which integration block to lead with. */
  lead: 'mcp' | 'skills';
  /** One sentence on why this pairing works, unique per tool. */
  pitch: string;
}

export const AGENT_TOOLS: AgentTool[] = [
  {
    slug: 'claude',
    name: 'Claude',
    tag: "Anthropic's assistant, via MCP",
    lead: 'mcp',
    pitch:
      "Connect the Delivered MCP server and Claude can send texts, run phone verification, and buy numbers as native tool calls — no glue code.",
  },
  {
    slug: 'claude-code',
    name: 'Claude Code',
    tag: "Anthropic's coding agent",
    lead: 'skills',
    pitch:
      "Install the Delivered skills once and Claude Code ships SMS and OTP features against the real API — sandbox-first, with the gotchas already encoded.",
  },
  {
    slug: 'cursor',
    name: 'Cursor',
    tag: 'The AI code editor',
    lead: 'mcp',
    pitch:
      "Add Delivered to Cursor's MCP config and the agent tab can send test messages and wire verification flows while you watch the diff.",
  },
  {
    slug: 'codex',
    name: 'Codex',
    tag: "OpenAI's coding agent",
    lead: 'skills',
    pitch:
      "Codex reads SKILL.md files — give it Delivered's and it stops hand-rolling OTP over raw SMS and uses the verify primitive instead.",
  },
  {
    slug: 'devin',
    name: 'Devin',
    tag: 'The autonomous software engineer',
    lead: 'skills',
    pitch:
      "Point Devin at the Delivered skills and long-running tasks like 'add SMS 2FA' resolve against a real sandbox it can test end to end.",
  },
  {
    slug: 'copilot',
    name: 'GitHub Copilot',
    tag: 'Your AI pair programmer',
    lead: 'skills',
    pitch:
      "Copilot's agent mode picks up Delivered skills from your repo, so generated SMS code matches the API instead of hallucinating one.",
  },
];

export const toolBySlug = (slug: string) =>
  AGENT_TOOLS.find((t) => t.slug === slug);
