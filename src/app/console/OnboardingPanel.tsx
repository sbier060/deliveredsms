'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Check, ChevronDown } from 'lucide-react';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import CodeTabs from '@/components/dev-docs/CodeTabs';
import { buildSendSnippets } from '@/lib/dev-docs/snippets';
import SendItNow from './SendItNow';
import type { DevTenant } from '@/lib/dev-console/api';

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

/** Vertical step rail like Resend's "Send your first email" onboarding. */
function Step({
  title,
  description,
  done,
  children,
  last,
}: {
  title: string;
  description: string;
  done: boolean;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className="relative pl-9">
      {!last && (
        <span
          className="absolute left-[7px] top-5 bottom-0 w-px bg-[#2E2C28]"
          aria-hidden="true"
        />
      )}
      <span
        className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 ${
          done ? 'border-[#00D26A] bg-[#00D26A]' : 'border-[#2E2C28] bg-[#0A0A0B]'
        }`}
        aria-hidden="true"
      />
      <h3 className="text-[17px] text-[#EFEEEC]">{title}</h3>
      <p className="mt-1 text-[14px] leading-[1.6] text-[#918E86]">{description}</p>
      {children && <div className="mt-4">{children}</div>}
      <div className={last ? 'h-0' : 'h-10'} />
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void copyToClipboard(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-[#8E8E93] transition-all duration-150 hover:bg-[#2C2C2E] hover:text-[#F2F2F7]"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-[#00D26A]" />
          <span className="text-[#00D26A]">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          {label || 'Copy'}
        </>
      )}
    </button>
  );
}

/** "Copy for AI" — hands a coding agent everything it needs in one paste. */
function CopyForAi({ apiKey, from }: { apiKey: string | null; from: string }) {
  const [open, setOpen] = useState(false);
  const prompt = `Integrate the Delivered API into my project.

Base URL: https://api.deliveredsms.com/v1
Auth header: Authorization: Bearer ${apiKey || 'dsms_sk_test_YOUR_KEY'}
My sandbox number (use as "from"): ${from}

Send an SMS:
  POST /v1/messages  {"from": "${from}", "to": "+15005550006", "body": "..."}
  → 201 {"id": "msg_...", "status": "sent", ...}

Sandbox magic numbers: +15005550006 delivers, +15005550002 fails, +15005550001 stays queued.
Other endpoints: GET /v1/messages, GET /v1/messages/:id, GET /v1/numbers,
GET /v1/numbers/available?area_code=415, POST /v1/numbers, DELETE /v1/numbers/:id,
GET /v1/lookup/:phone, GET /v1/lookup/:phone/spam, GET /v1/events,
POST /v1/test/inbound (sandbox inbound simulation).
Errors are always {"error": {"code", "message"}}. Retries: send an Idempotency-Key header.

Full reference: https://deliveredsms.com/docs/llms-full.txt
OpenAPI: https://deliveredsms.com/api/v1/openapi.yaml
MCP server: https://deliveredsms.com/api/mcp`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] text-[#918E86] transition-colors duration-150 hover:text-[#EFEEEC]"
      >
        Copy for AI
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-[300px] rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-3 shadow-2xl">
          <p className="text-[12px] leading-[1.6] text-[#918E86]">
            Copies a ready-to-paste prompt with your key, your number, and the
            full endpoint reference for a coding agent.
          </p>
          <div className="mt-2 flex items-center justify-between">
            <CopyButton text={prompt} label="Copy prompt" />
            <a
              href="/api/mcp"
              className="text-[11px] text-[#918E86] underline underline-offset-4 hover:text-[#EFEEEC]"
            >
              MCP server
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPanel({
  tenant,
  initialKey,
  sandboxNumber,
  onFirstCall,
}: {
  tenant: DevTenant;
  initialKey: string | null;
  sandboxNumber: string | null;
  onFirstCall?: () => void;
}) {
  const [sentHere, setSentHere] = useState(false);
  const from = sandboxNumber || tenant.numbers[0]?.phone_number || '+15005550100';
  const firstCallDone = Boolean(tenant.firstCallAt) || sentHere;

  return (
    <div>
      <h1 className="text-[26px] tracking-[-0.02em] text-[#EFEEEC]">
        Send your first message
      </h1>
      <p className="mt-2 text-[15px] leading-[1.6] text-[#918E86]">
        Follow the steps to send an SMS using the Delivered.
      </p>

      <div className="mt-10">
        <Step
          title="Your API key"
          description={
            initialKey
              ? "Use this key to authenticate requests. This is the only time we'll show it."
              : 'Keys are shown once at creation. Roll yours from the API keys tab if you need a new one.'
          }
          done
        >
          {initialKey ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[#2C2C2E] bg-[#111112] px-3.5 py-2.5">
              <code
                className={`overflow-x-auto whitespace-nowrap text-[13px] text-[#EFEEEC] ${MONO}`}
              >
                {initialKey}
              </code>
              <CopyButton text={initialKey} label="Copy key" />
            </div>
          ) : (
            <Link
              href="/console/keys"
              className="inline-block rounded-full border border-[#2E2C28] px-5 py-2 text-[14px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
            >
              Manage API keys
            </Link>
          )}
        </Step>

        <Step
          title="Send a message"
          description="Run it right here, or paste the code into your own project."
          done={firstCallDone}
        >
          <SendItNow
            apiKey={initialKey}
            from={from}
            onSent={() => {
              setSentHere(true);
              onFirstCall?.();
            }}
          />
          <div className="mt-6 flex justify-end pb-2">
            <CopyForAi apiKey={initialKey} from={from} />
          </div>
          <CodeTabs snippets={buildSendSnippets()} keyAware />
          <p className="mt-3 text-[13px] text-[#918E86]">
            Sending from{' '}
            <code className={`text-[#C9C6BF] ${MONO}`}>{from}</code> to the magic
            number <code className={`text-[#C9C6BF] ${MONO}`}>+15005550006</code>,
            which simulates successful delivery.
          </p>
        </Step>

        <Step
          title={firstCallDone ? 'First message sent' : 'Waiting for your first message'}
          description={
            firstCallDone
              ? 'Your integration is live. Watch delivery in Messages and Events.'
              : 'Run the command above — this page updates the moment your request lands.'
          }
          done={firstCallDone}
          last
        >
          {firstCallDone && (
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/console/messages"
                className="rounded-full bg-gradient-to-r from-[#00D26A] to-[#009E4F] px-6 py-2.5 text-[14px] text-white transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.97]"
              >
                View messages →
              </Link>
              <Link
                href="/docs/quickstart"
                className="text-[14px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
              >
                Read the docs
              </Link>
            </div>
          )}
        </Step>
      </div>
    </div>
  );
}
