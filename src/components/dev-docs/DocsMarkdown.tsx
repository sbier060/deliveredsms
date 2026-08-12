'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import Link from 'next/link';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '@/lib/copy-to-clipboard';

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

function CodeBlock({ className, children }: React.HTMLAttributes<HTMLElement>) {
  const [copied, setCopied] = useState(false);
  const lang = /language-(\w+)/.exec(className || '')?.[1] ?? 'code';
  const code = String(children).replace(/\n$/, '');
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("[^"\n]*"|'[^'\n]*')/g, '<span class="text-[#EFEEEC]">$1</span>');
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-[#2C2C2E] bg-[#111112]">
      <div className="flex items-center justify-between border-b border-[#2C2C2E] bg-[#0A0A0B] px-3 py-1.5">
        <span className="text-[11px] uppercase tracking-[0.04em] text-[#8E8E93]">
          {lang}
        </span>
        <button
          onClick={() => {
            void copyToClipboard(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-[#8E8E93] transition-all duration-150 hover:bg-[#2C2C2E] hover:text-[#F2F2F7]"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[#00D26A]" />
              <span className="text-[#00D26A]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className={`overflow-x-auto p-4 text-[13px] leading-relaxed text-[#918E86] ${MONO}`}>
        <code dangerouslySetInnerHTML={{ __html: escaped }} />
      </pre>
    </div>
  );
}

export default function DocsMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-[clamp(26px,3.5vw,34px)] leading-[1.2] tracking-[-0.02em] text-[#EFEEEC]">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-10 border-t border-[#2E2C28] pt-8 text-[20px] tracking-[-0.02em] text-[#EFEEEC]">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-6 text-[16px] text-[#EFEEEC]">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.7] text-[#C9C6BF]">
            {children}
          </p>
        ),
        a: ({ href, children }) => {
          const h = href || '#';
          const isInternal = h.startsWith('/');
          return isInternal ? (
            <Link href={h} className="text-[#EFEEEC] underline underline-offset-4 hover:text-white">
              {children}
            </Link>
          ) : (
            <a href={h} className="text-[#EFEEEC] underline underline-offset-4 hover:text-white" target="_blank" rel="noreferrer">
              {children}
            </a>
          );
        },
        ul: ({ children }) => (
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[15px] leading-[1.7] text-[#C9C6BF]">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[15px] leading-[1.7] text-[#C9C6BF]">
            {children}
          </ol>
        ),
        code: ({ className, children, ...props }) => {
          const inline = !className;
          if (inline) {
            return (
              <code
                className={`rounded-md border border-[#2C2C2E] bg-[#1C1C1E] px-1.5 py-0.5 text-[13px] text-[#C9C6BF] ${MONO}`}
                {...props}
              >
                {children}
              </code>
            );
          }
          return <CodeBlock className={className}>{children}</CodeBlock>;
        },
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[#2E2C28]">
            <table className="w-full text-left text-[14px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-[#0F0E0C] text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
            {children}
          </thead>
        ),
        th: ({ children }) => <th className="px-4 py-2.5 font-normal">{children}</th>,
        td: ({ children }) => (
          <td className="border-t border-[#2E2C28] px-4 py-2.5 align-top text-[#C9C6BF]">
            {children}
          </td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mt-4 border-l-2 border-[#2E2C28] pl-4 text-[14px] leading-[1.7] text-[#918E86]">
            {children}
          </blockquote>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
