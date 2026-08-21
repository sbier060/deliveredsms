#!/usr/bin/env node
/**
 * resms CLI - Resms from the terminal.
 *
 * Agents reach for a shell before an SDK, so every command works
 * non-interactively, reads RESMS_API_KEY, and has a --json mode that prints
 * raw API objects with no decoration.
 *
 *   npx resms send --from +1... --to +1... "body"
 *   npx resms verify +14155550132
 *   npx resms verify +14155550132 482193
 *   npx resms numbers search 415 | buy +1... | release +1... | list
 *   npx resms lookup +14155550132 [--spam]
 *   npx resms messages [--limit 10]
 *   npx resms events [--limit 10]
 *   npx resms login   (stores the key in ~/.resms.json)
 */

import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';
import { Resms, ResmsError } from './index';

const CONFIG_PATH = join(homedir(), '.resms.json');

const HELP = `resms: SMS, verification, and phone numbers from the terminal

Usage
  resms login                          store an API key (or set RESMS_API_KEY)
  resms send --from <num> --to <num> <body...>
  resms verify <phone>                 send a one-time code
  resms verify <phone> <code>          check the code
  resms numbers list
  resms numbers search <area-code>
  resms numbers buy <phone>
  resms numbers release <phone>
  resms lookup <phone> [--spam]
  resms messages [--limit <n>]
  resms events [--limit <n>]

Flags
  --json        raw API output (for scripts and agents)
  --key <key>   API key for this invocation only

Keys: free sandbox key at https://resms.com/console
Docs: https://resms.com/docs  (llms.txt available)`;

interface Flags {
  json: boolean;
  key?: string;
  from?: string;
  to?: string;
  spam: boolean;
  limit?: number;
  rest: string[];
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = { json: false, spam: false, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') flags.json = true;
    else if (a === '--spam') flags.spam = true;
    else if (a === '--key') flags.key = argv[++i];
    else if (a === '--from') flags.from = argv[++i];
    else if (a === '--to') flags.to = argv[++i];
    else if (a === '--limit') flags.limit = Number(argv[++i]);
    else flags.rest.push(a);
  }
  return flags;
}

function loadStoredKey(): string | undefined {
  try {
    const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    return typeof cfg.apiKey === 'string' ? cfg.apiKey : undefined;
  } catch {
    return undefined;
  }
}

function out(flags: Flags, data: unknown, human: () => void): void {
  if (flags.json) console.log(JSON.stringify(data, null, 2));
  else human();
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

async function login(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const key = await new Promise<string>((resolve) =>
    rl.question('Resms key (ghost_sk_...): ', (v) => {
      rl.close();
      resolve(v.trim());
    })
  );
  if (!/^ghost_sk_(test|live)_/.test(key)) fail('that does not look like a Resms key');
  writeFileSync(CONFIG_PATH, `${JSON.stringify({ apiKey: key }, null, 2)}\n`, { mode: 0o600 });
  console.log(`Saved to ${CONFIG_PATH} (${key.startsWith('ghost_sk_test_') ? 'sandbox' : 'LIVE'} key).`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flags = parseArgs(argv);
  const [cmd, ...args] = flags.rest;

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return;
  }
  if (cmd === 'login') return login();

  const apiKey =
    flags.key ??
    process.env.RESMS_API_KEY ??
    process.env.DELIVERED_API_KEY ??
    process.env.GHOST_API_KEY ??
    loadStoredKey();
  if (!apiKey) {
    fail('no API key. Run `resms login`, set RESMS_API_KEY, or pass --key.');
  }
  const resms = new Resms(
    apiKey,
    process.env.RESMS_BASE_URL || process.env.DELIVERED_BASE_URL
      ? { baseUrl: process.env.RESMS_BASE_URL || process.env.DELIVERED_BASE_URL }
      : {}
  );

  switch (cmd) {
    case 'send': {
      const body = args.join(' ');
      if (!flags.from || !flags.to || !body) fail('usage: send --from <num> --to <num> <body>');
      const msg = await resms.messages.send({ from: flags.from, to: flags.to, body });
      out(flags, msg, () => console.log(`${msg.id}  ${msg.status}  ${msg.from} -> ${msg.to}`));
      break;
    }
    case 'verify': {
      const [phone, code] = args;
      if (!phone) fail('usage: verify <phone> [code]');
      if (code) {
        const check = await resms.verify.check({ to: phone, code });
        out(flags, check, () =>
          console.log(
            check.verified
              ? `verified (charged: ${check.charged})`
              : `not verified: status ${check.status}, ${check.attempts_remaining} tries left`
          )
        );
        process.exitCode = check.verified ? 0 : 1;
      } else {
        const v = await resms.verify.send({ to: phone });
        out(flags, v, () =>
          console.log(`${v.id}  ${v.status}  expires in ${v.expires_in}s${v.test ? '  (sandbox code: 111111)' : ''}`)
        );
      }
      break;
    }
    case 'numbers': {
      const [sub, arg] = args;
      if (sub === 'search') {
        if (!arg) fail('usage: numbers search <area-code>');
        const page = await resms.numbers.available({ areaCode: arg });
        out(flags, page, () =>
          page.data.forEach((n) => console.log(`${n.phone_number}  ${n.locality}, ${n.region}`))
        );
      } else if (sub === 'buy') {
        if (!arg) fail('usage: numbers buy <phone>');
        const n = await resms.numbers.buy(arg);
        out(flags, n, () => console.log(`${n.phone_number}  ${n.status}  (${n.mode})`));
      } else if (sub === 'release') {
        if (!arg) fail('usage: numbers release <phone>');
        const n = await resms.numbers.release(arg);
        out(flags, n, () => console.log(`${n.phone_number}  released`));
      } else {
        const page = await resms.numbers.list();
        out(flags, page, () => {
          if (page.data.length === 0) console.log('no numbers; `resms numbers search 415` to find one');
          page.data.forEach((n) => console.log(`${n.phone_number}  ${n.status}  (${n.mode})`));
        });
      }
      break;
    }
    case 'lookup': {
      const [phone] = args;
      if (!phone) fail('usage: lookup <phone> [--spam]');
      if (flags.spam) {
        const s = await resms.lookup.spam(phone);
        out(flags, s, () =>
          console.log(`${s.phone_number}  spam_score ${s.spam_score}  ${s.spam_type ?? ''} ${s.severity ?? ''}`.trim())
        );
      } else {
        const l = await resms.lookup.phone(phone);
        out(flags, l, () =>
          console.log(`${l.phone_number}  valid=${l.valid}  line_type=${l.line_type ?? '?'}  carrier=${l.carrier.name ?? '?'}`)
        );
      }
      break;
    }
    case 'messages': {
      const page = await resms.messages.list({ limit: flags.limit ?? 10 });
      out(flags, page, () =>
        page.data.forEach((m) =>
          console.log(`${m.id}  ${m.direction}  ${m.status}  ${m.from} -> ${m.to}  ${m.body.slice(0, 40)}`)
        )
      );
      break;
    }
    case 'events': {
      const page = await resms.events.list({ limit: flags.limit ?? 10 });
      out(flags, page, () =>
        page.data.forEach((e) => console.log(`${e.created_at}  ${e.type}`))
      );
      break;
    }
    default:
      console.log(HELP);
      fail(`unknown command: ${cmd}`);
  }
}

main().catch((err) => {
  if (err instanceof ResmsError) {
    console.error(`error [${err.code}]: ${err.message}`);
    if (err.retryAfter) console.error(`retry after ${err.retryAfter}s`);
    process.exit(1);
  }
  console.error(`error: ${(err as Error)?.message ?? err}`);
  process.exit(1);
});
