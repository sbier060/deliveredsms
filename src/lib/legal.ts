import { SITE_DOMAIN, SITE_URL } from '@/lib/urls';

/**
 * Legal documents for the Delivered service, operated by Truelabel LLC.
 * Drafted to CPaaS norms (consent warranty, indemnity, carrier disclaimers);
 * have an attorney review before relying on them in a dispute.
 *
 * Company identity uses the registered business mailing address only - never
 * personal addresses or ID details.
 */

export const COMPANY = {
  legalName: 'Truelabel LLC',
  dba: 'Delivered',
  address: '5830 E 2nd St, Ste 7000, PMB 35111, Casper, WY 82609, USA',
  state: 'Wyoming',
  email: `legal@${SITE_DOMAIN}`,
  supportEmail: `support@${SITE_DOMAIN}`,
};

export const TERMS_UPDATED = 'August 12, 2026';
export const PRIVACY_UPDATED = 'August 12, 2026';

export const TERMS_MD = `# Terms of Service

**Last updated: ${TERMS_UPDATED}**

These Terms of Service ("Terms") govern access to and use of the Delivered
platform, APIs, SDKs, console, and websites (the "Service"), operated by
**${COMPANY.legalName}**, a ${COMPANY.state} limited liability company doing
business as "${COMPANY.dba}" ("Delivered", "we", "us"). By creating an
account or using the Service you agree to these Terms on behalf of yourself
and any organization you represent ("you", "Customer").

## 1. The Service

Delivered provides programmable SMS messaging, phone verification, phone
number provisioning, and phone intelligence via API. Test ("sandbox") keys
simulate the Service without carrier traffic; live keys transmit real
messages over telecommunications carriers.

## 2. Accounts

You must be at least 18 years old and use the Service for business purposes.
You are responsible for all activity under your API keys and for keeping
them secret. Notify us immediately at ${COMPANY.supportEmail} if a key is
compromised; keys can be rotated in the console at any time.

## 3. Messaging Policy and Acceptable Use

This section is the heart of these Terms. Violating it is grounds for
immediate suspension.

**3.1 Consent.** You may only send messages to recipients who have given you
prior express consent appropriate to the message type (including, for
marketing to US recipients, prior express written consent under the
Telephone Consumer Protection Act). You warrant that you obtain, record, and
can produce evidence of such consent for every recipient.

**3.2 Opt-outs.** You must honor opt-out requests immediately and
permanently. Delivered enforces STOP at the platform level; you must also
never re-add an opted-out recipient in your own systems.

**3.3 Prohibited content and uses.** You may not use the Service for:
content that is illegal in the destination jurisdiction; deceptive,
fraudulent, or misleading messages, including phishing and brand
impersonation; SHAFT content (sex, hate, alcohol, firearms, tobacco) except
where expressly permitted by carrier programs; harassment, abuse, or
threats; SMS pumping, artificially inflated traffic, or any scheme that
generates traffic for revenue-share; snowshoeing or evading carrier
filtering; or messages to emergency services.

**3.4 Sender identification.** Messages must identify you or your product as
sender. You may not impersonate any person or organization, including in the
\`app_name\` field of verification messages.

**3.5 Compliance.** You are responsible for compliance with all laws that
apply to your messaging, including the TCPA, CAN-SPAM where applicable,
state telemarketing laws, CTIA Messaging Principles and Best Practices, and
carrier codes of conduct. Delivered registers numbers under its A2P 10DLC
campaigns; you agree to provide accurate information we reasonably request
for such registration.

**3.6 Enforcement.** We may filter, block, or refuse any message, suspend
any key, or terminate any account that we reasonably believe violates this
Section, harms the platform's deliverability, or exposes us or carriers to
liability; with notice where practicable, without notice where necessary.

## 4. Fees and Billing

Usage-based fees are listed at ${SITE_URL}/pricing and are charged in USD.
Phone verification is billed only on successful verification. Number rentals
are billed monthly and prorated. We may change rates with at least 14 days'
notice via the console or email. You are responsible for applicable taxes.
We may suspend the Service for non-payment after notice. Fees are
non-refundable except where required by law or expressly stated.

## 5. Phone Numbers

Numbers are provisioned from telecommunications carriers and remain subject
to carrier and regulatory rules. Numbers released by you, reclaimed for
non-payment, or reclaimed for violation of Section 3 may be reassigned. We
will reasonably cooperate with porting requests where supported.

## 6. Your Data

You retain all rights to the content you transmit. You grant us the license
required to operate the Service: to transmit, store, process, and analyze
message content and metadata to deliver messages, prevent fraud and abuse,
comply with law, and improve the Service. Our handling of personal data is
described in the [Privacy Policy](/privacy). As between the parties, you are
the controller of your recipients' data; we process it on your behalf to
provide the Service.

## 7. Service Levels and Disclaimers

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE". Message delivery depends
on telecommunications carriers we do not control; we do not guarantee that
any message will be delivered, or delivered within any time. TO THE MAXIMUM
EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED,
INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
NON-INFRINGEMENT.

## 8. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY IS LIABLE FOR
INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOST
PROFITS OR REVENUES. OUR TOTAL LIABILITY UNDER THESE TERMS IS LIMITED TO THE
FEES YOU PAID US IN THE THREE (3) MONTHS BEFORE THE EVENT GIVING RISE TO THE
CLAIM. THESE LIMITS DO NOT APPLY TO YOUR OBLIGATIONS UNDER SECTIONS 3 AND 9.

## 9. Indemnification

You will defend and indemnify ${COMPANY.legalName} against claims, fines,
and penalties arising from your messages or your breach of Section 3,
including claims under the TCPA or similar laws, carrier fines, and claims
by message recipients. This obligation survives termination.

## 10. Termination

You may stop using the Service and close your account at any time. We may
suspend or terminate as described in Sections 3 and 4, or with 30 days'
notice for any reason. Sections 6–12 survive termination.

## 11. Governing Law and Disputes

These Terms are governed by the laws of the State of ${COMPANY.state},
excluding its conflicts rules. The state and federal courts located in
${COMPANY.state} have exclusive jurisdiction, and each party consents to
their venue. The prevailing party in any action is entitled to reasonable
attorneys' fees.

## 12. Changes; Miscellaneous

We may update these Terms; material changes will be notified via the console
or email at least 14 days before they take effect, and continued use after
that constitutes acceptance. These Terms are the entire agreement regarding
the Service. If a provision is unenforceable, the remainder stands. You may
not assign these Terms without our consent; we may assign them in connection
with a merger or sale.

## Contact

${COMPANY.legalName} (d/b/a ${COMPANY.dba})
${COMPANY.address}
${COMPANY.email}
`;

export const PRIVACY_MD = `# Privacy Policy

**Last updated: ${PRIVACY_UPDATED}**

This policy describes how **${COMPANY.legalName}**, doing business as
"${COMPANY.dba}" ("we", "us"), handles personal data in connection with the
Delivered platform and websites (the "Service").

Two roles matter here. For data about **our customers** (developers and
their teams) we are the controller. For data about **our customers' message
recipients** we are a processor/service provider acting on the customer's
instructions; the customer is responsible for having a lawful basis to
message them.

## 1. Data We Collect

**Account data** - name, email, and authentication identifiers when you
create an account (sign-in is via Google/Firebase Authentication); billing
details when you add a payment method (card details are held by Stripe, not
us).

**Message data** - phone numbers, message content, and delivery metadata for
messages you send and receive through the API. Verification codes are stored
only as salted hashes and are never logged in plaintext.

**Usage data** - API request logs, usage counters, rate-limit and fraud
signals (including IP addresses), and console analytics (subject to the
consent controls below).

**Automated-agent traffic** - we count requests from self-identified AI
crawlers and agents (user-agent and path); this contains no personal data.

**Cookies** - the console uses strictly-necessary cookies for
authentication, plus analytics gated by consent where required (see
[Privacy Choices](/privacy-choices)).

## 2. How We Use Data

To operate the Service: transmitting messages via telecommunications
carriers, verifying phone numbers, provisioning numbers, metering and
billing, and providing the console. To protect the platform: preventing SMS
pumping, spam, fraud, and abuse, including screening destinations and
maintaining opt-out and abuse registries. To comply with law and carrier
requirements, including A2P 10DLC registration. To improve the Service, in
aggregate. We do not sell personal data, and we do not use message content
for advertising.

## 3. Sharing and Subprocessors

We share data only with service providers that help us operate:
telecommunications carriers and aggregators (message transmission and number
provisioning); Google Firebase (authentication, database); Vercel (hosting);
Stripe (payments); Twilio (phone line-type lookup); Mixpanel (product
analytics, consent-gated); and Slack (internal operational alerts). We may
disclose data when required by law, and in connection with a merger or sale
of the business. Carriers may process message content per their own legal
obligations.

## 4. International Transfers

We are a US company and process data in the United States. Where we receive
personal data subject to GDPR/UK GDPR, we rely on appropriate safeguards
such as standard contractual clauses with our subprocessors.

## 5. Retention

Account data is kept while your account is active and for a reasonable
period afterward for legal and accounting purposes. Message content and
metadata are retained for the operational window shown in your plan and then
deleted or de-identified. Fraud, abuse, and opt-out registries are retained
as long as needed to protect the platform. You may request deletion earlier
(Section 6).

## 6. Your Rights

Depending on where you live (including under GDPR and US state privacy
laws), you may have rights to access, correct, delete, port, or restrict
processing of your personal data, and to opt out of certain processing. To
exercise them, email ${COMPANY.email}; we will verify and respond within
the time required by law. If you are a message recipient, we will route your
request to the customer who messaged you where the law requires them to
respond; you can always stop receiving messages by replying STOP.

## 7. Security

Data in transit is encrypted with TLS. API keys and verification codes are
stored as salted hashes. Access to production systems is limited and
audited. No system is perfectly secure; we will notify affected parties of
breaches as required by law.

## 8. Children

The Service is for business use and not directed to children under 16; we do
not knowingly collect their data.

## 9. Changes

We will post changes here and, for material changes, notify account holders
via the console or email.

## Contact

${COMPANY.legalName} (d/b/a ${COMPANY.dba})
${COMPANY.address}
${COMPANY.email}
`;
