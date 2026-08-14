import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import Image from 'next/image';
import type { Metadata } from 'next';
import DevFooter from '@/components/dev-docs/DevFooter';
import { generateMetadata as buildMetadata, BASE_URL } from '@/lib/metadata';
import PricingEstimator from './PricingEstimator';
import {
  RATES,
  PLANS,
  COMPETITORS,
  COMPETITORS_CHECKED_ON,
  FREE_TIER,
  formatRate,
  formatRange,
  formatMoney,
  type UnitRate,
} from '@/lib/api/pricing';
import { PRIMARY_CTA, SECONDARY_CTA } from '@/lib/cta';

export const metadata: Metadata = buildMetadata({
  title: 'Pricing',
  description:
    'Delivered pricing: $0.005 per outbound SMS all-in: no carrier surcharge, no platform fee, A2P 10DLC included. Cheaper all-in than Twilio, Telnyx and Plivo. Free tier with 100 live texts a month, no credit card.',
  path: '/pricing',
  keywords: [
    'sms api pricing',
    'twilio pricing alternative',
    'cheap sms api',
    'programmable sms cost',
    'phone number api pricing',
    'a2p 10dlc included',
  ],
});

const MONO =
  '[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]';

const HEADLINE =
  'text-[clamp(30px,4.5vw,44px)] leading-[1.15] tracking-[-0.02em] [text-wrap:balance]';

const rateList = Object.values(RATES) as UnitRate[];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Delivered',
  description:
    'Programmable SMS and phone numbers for developers. All-in per-message pricing with no carrier surcharge and A2P 10DLC registration included.',
  url: `${BASE_URL}/pricing`,
  brand: { '@type': 'Brand', name: 'Delivered' },
  offers: rateList.map((rate) => ({
    '@type': 'Offer',
    name: rate.label,
    priceCurrency: 'USD',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: (rate.microUsd / 1_000_000).toFixed(6),
      priceCurrency: 'USD',
      unitText: rate.per,
    },
  })),
};

const faqs: Array<[string, string]> = [
  [
    'How am I billed?',
    'Usage accrues through the month and we charge your card on the 1st. There is no platform fee, no minimum, and no commitment; a month with no traffic costs nothing.',
  ],
  [
    'Do failed messages cost anything?',
    'No. You are billed when the carrier accepts the message. Rejections and undeliverable numbers are free.',
  ],
  [
    'What happens when I hit the free limit?',
    `Sends return a 429 with a clear message until the next day or month. Nothing breaks and nothing is charged; add a card to lift every cap. Sandbox keeps working regardless.`,
  ],
  [
    'Why do I have to verify a recipient on the free tier?',
    'It is the same idea as verifying a domain before you can send email anywhere: it keeps the free tier from becoming a spam relay. Verify your own phone in the console and text it as much as your allowance allows. Add a card and the restriction disappears.',
  ],
  [
    'Does the sandbox count against anything?',
    'Never. Test keys are unlimited and free forever: every endpoint, no verification, no metering. Build the whole integration before you spend a cent.',
  ],
  [
    'What about A2P 10DLC registration?',
    'Included. We register on your behalf, so there is no brand fee, no per-campaign monthly, and no waiting on carrier approval before your first message. Live access is reviewed by a human because we carry the compliance responsibility for that traffic.',
  ],
  [
    'Do you offer volume discounts?',
    'Yes. Once you are past a few hundred thousand messages a month, talk to us and we will quote committed rates.',
  ],
];

export default function DeveloperPricingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-16">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#00D26A]">
            Pricing
          </p>
          <h1 className={`mt-6 ${HEADLINE}`}>
            <span className="block text-[#EFEEEC]">Pay for what you send.</span>
            <span className="block text-[#918E86]">
              {formatRate(RATES.outbound_sms.microUsd)} a text. No carrier
              surcharge, no platform fee, no minimum.
            </span>
          </h1>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.65] text-[#C9C6BF]">
            One rate, all-in. The number on this page is the number on your
            invoice; we don&apos;t pass carrier fees through for you to
            reconcile at the end of the month.
          </p>
        </div>
      </section>

      {/* Rates */}
      <section className="border-t border-[#2E2C28]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-[20px] tracking-[-0.02em] text-[#EFEEEC]">Rates</h2>
          <div className="mt-6 overflow-hidden rounded-xl border border-[#2E2C28]">
            <ul className="divide-y divide-[#2E2C28]">
              {rateList.map((rate) => (
                <li
                  key={rate.unit}
                  className="flex flex-wrap items-baseline justify-between gap-2 bg-[#0F0E0C] px-5 py-4"
                >
                  <span className="text-[15px] text-[#EFEEEC]">{rate.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className={`text-[16px] tabular-nums text-[#EFEEEC] ${MONO}`}>
                      {formatRate(rate.microUsd)}
                    </span>
                    <span className="text-[13px] text-[#918E86]">{rate.per}</span>
                  </span>
                </li>
              ))}
              <li className="flex flex-wrap items-baseline justify-between gap-2 bg-[#0F0E0C] px-5 py-4">
                <span className="text-[15px] text-[#EFEEEC]">
                  A2P 10DLC registration
                </span>
                <span className="text-[16px] text-[#EFEEEC]">Included</span>
              </li>
            </ul>
          </div>
          <p className="mt-4 max-w-[70ch] text-[13px] leading-[1.7] text-[#918E86]">
            US &amp; Canada long code, billed monthly in arrears in USD. You are
            billed when the carrier accepts the message; failed sends cost
            nothing. Inbound billing starts when inbound webhooks ship; until
            then inbound is free. We register your 10DLC brand and campaign, so
            there is no registration fee and no wait.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="border-t border-[#2E2C28]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-[20px] tracking-[-0.02em] text-[#EFEEEC]">Plans</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {PLANS.filter((p) => !p.contactOnly).map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col rounded-xl border border-[#2E2C28] bg-[#0F0E0C] p-6"
              >
                <p className="text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
                  {plan.name}
                </p>
                <p className={`mt-3 text-[24px] text-[#EFEEEC] ${MONO}`}>
                  {plan.priceLine}
                </p>
                <p className="mt-1.5 text-[14px] text-[#C9C6BF]">{plan.tagline}</p>
                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="text-[14px] leading-[1.6] text-[#918E86]">
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.cta && (
                  <div className="mt-6">
                    {plan.id === 'payg' ? (
                      <Link href={plan.cta.href} className={PRIMARY_CTA}>
                        {plan.cta.label} <span aria-hidden="true">→</span>
                      </Link>
                    ) : (
                      <Link
                        href={plan.cta.href}
                        className="inline-block rounded-full border border-[#2E2C28] px-6 py-[13px] text-[15px] text-[#EFEEEC] transition-colors duration-150 hover:border-[#918E86]"
                      >
                        {plan.cta.label}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-[#2E2C28]">
            <ul className="divide-y divide-[#2E2C28]">
              {PLANS.filter((p) => p.contactOnly).map((plan) => (
                <li
                  key={plan.id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-[#0F0E0C] px-5 py-4"
                >
                  <span>
                    <span className="text-[15px] text-[#EFEEEC]">{plan.name}</span>
                    <span className="ml-3 text-[13px] text-[#918E86]">
                      {plan.tagline}
                    </span>
                  </span>
                  {plan.cta && (
                    <Link
                      href={plan.cta.href}
                      className="text-[14px] text-[#918E86] underline underline-offset-4 transition-colors duration-150 hover:text-[#EFEEEC]"
                    >
                      {plan.cta.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Estimator */}
      <section className="border-t border-[#2E2C28]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-[20px] tracking-[-0.02em] text-[#EFEEEC]">
            What would it cost you?
          </h2>
          <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.65] text-[#C9C6BF]">
            Put your own numbers in.
          </p>
          <div className="mt-6 max-w-3xl">
            <PricingEstimator />
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="border-t border-[#2E2C28]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className={HEADLINE}>
            <span className="block text-[#EFEEEC]">All-in, not headline.</span>
            <span className="block text-[#918E86]">
              Everyone else quotes a rate and adds carrier fees at the bottom of
              the invoice.
            </span>
          </h2>

          <div className="mt-8 overflow-x-auto rounded-xl border border-[#2E2C28]">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead className="bg-[#0F0E0C] text-[12px] uppercase tracking-[0.06em] text-[#918E86]">
                <tr>
                  <th className="px-5 py-3 font-normal">Provider</th>
                  <th className="px-5 py-3 font-normal">Headline</th>
                  <th className="px-5 py-3 font-normal">Carrier fees</th>
                  <th className="px-5 py-3 font-normal">All-in per text</th>
                  <th className="px-5 py-3 font-normal">Number / mo</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#2E2C28] bg-[#0F0E0C]">
                  <td className="px-5 py-4 text-[#EFEEEC]">Delivered</td>
                  <td className={`px-5 py-4 tabular-nums text-[#C9C6BF] ${MONO}`}>
                    {formatRate(RATES.outbound_sms.microUsd)}
                  </td>
                  <td className="px-5 py-4 text-[#C9C6BF]">none</td>
                  <td className={`px-5 py-4 tabular-nums text-[#EFEEEC] ${MONO}`}>
                    {formatRate(RATES.outbound_sms.microUsd)}
                  </td>
                  <td className={`px-5 py-4 tabular-nums text-[#C9C6BF] ${MONO}`}>
                    {formatMoney(RATES.numbers.microUsd)}
                  </td>
                </tr>
                {COMPETITORS.map((row) => (
                  <tr key={row.provider} className="border-t border-[#2E2C28] bg-[#0F0E0C]">
                    <td className="px-5 py-4">
                      <a
                        href={row.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#C9C6BF] underline underline-offset-4 hover:text-[#EFEEEC]"
                      >
                        {row.provider}
                      </a>
                    </td>
                    <td className={`px-5 py-4 tabular-nums text-[#918E86] ${MONO}`}>
                      {formatRate(row.headlineMicroUsd)}
                    </td>
                    <td className={`px-5 py-4 tabular-nums text-[#918E86] ${MONO}`}>
                      {row.carrierFeeMicroUsd
                        ? `+${formatRange(row.carrierFeeMicroUsd)}`
                        : 'not published as a band'}
                    </td>
                    <td className={`px-5 py-4 tabular-nums text-[#918E86] ${MONO}`}>
                      {formatRange(row.allInMicroUsd)}
                      {row.carrierFeeMicroUsd === null ? '+' : ''}
                    </td>
                    <td className={`px-5 py-4 tabular-nums text-[#918E86] ${MONO}`}>
                      {formatMoney(row.numberMicroUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 max-w-[70ch] space-y-3 text-[13px] leading-[1.7] text-[#918E86]">
            <p>
              Rates checked {COMPETITORS_CHECKED_ON} from each provider&apos;s
              public pricing page; every provider name above links to its
              source. Carrier fees are AT&amp;T, T-Mobile and Verizon
              pass-throughs: they vary by destination carrier and change
              quarterly, which is why every other row is a range and ours
              isn&apos;t.
            </p>
            <p>
              <span className="text-[#FFFFFF]">Where we don&apos;t win:</span>{' '}
              Plivo rents numbers cheaper than we do ($0.50 against our $0.95),
              and Telnyx&apos;s headline rate is lower than ours before its
              carrier fees are added. On the all-in cost of actually sending a
              message, we are the cheapest of the four, and the only one whose
              quoted rate is the whole rate, with 10DLC handled.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#2E2C28]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-[20px] tracking-[-0.02em] text-[#EFEEEC]">
            Questions
          </h2>
          <dl className="mt-6 max-w-[70ch] divide-y divide-[#2E2C28] border-t border-[#2E2C28]">
            {faqs.map(([q, a]) => (
              <div key={q} className="py-5">
                <dt className="text-[15px] text-[#EFEEEC]">{q}</dt>
                <dd className="mt-2 text-[14px] leading-[1.7] text-[#C9C6BF]">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#2E2C28]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className={HEADLINE}>
            <span className="block text-[#EFEEEC]">
              Start free, no card.
            </span>
            <span className="block text-[#918E86]">
              {FREE_TIER.outboundSmsPerMonth} live texts a month and an unlimited
              sandbox.
            </span>
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Link href="/console" className={PRIMARY_CTA}>
              Get started <span aria-hidden="true">→</span>
            </Link>
            <Link href="/docs" className={SECONDARY_CTA}>
              Documentation
            </Link>
          </div>
        </div>
      </section>

      <DevFooter />
    </div>
  );
}
