import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { db } from '@/lib/firebase-admin';
import { apiBillingStripe } from '@/lib/api/billing/stripe';
import { tenantIdFromMetadata } from '@/lib/api/billing/customer';
import { activatePaygFromSetup } from '@/lib/api/billing/activate';
import { postSlackMessage } from '@/lib/slack';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Delivered billing webhook - a SEPARATE Stripe endpoint with its own signing
 * secret. It is deliberately not the consumer webhook
 * (src/app/api/webhook/route.ts), whose event list must not change.
 *
 * The first thing this handler does after verifying the signature is resolve a
 * ghost_api_tenant_id and bail if there isn't one. Consequence: even if this
 * endpoint were misconfigured to receive every account event, it can only ever
 * write under apiTenants/{tenantId}/billing. It never touches users/*,
 * subscription flags, dunning, or anything consumer-side.
 */

async function resolveTenantId(event: Stripe.Event): Promise<string | null> {
  const object = event.data.object as {
    metadata?: Record<string, string>;
    customer?: string | { id: string } | null;
  };

  const direct = tenantIdFromMetadata(object.metadata);
  if (direct) return direct;

  const customerId =
    typeof object.customer === 'string' ? object.customer : object.customer?.id;
  if (!customerId) return null;
  try {
    const customer = await apiBillingStripe().customers.retrieve(customerId);
    if (customer.deleted) return null;
    return tenantIdFromMetadata(customer.metadata as Record<string, string>);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_API_BILLING_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = apiBillingStripe().webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    console.error('[api-billing/webhook] signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ── the isolation gate ────────────────────────────────────────────────────
  const tenantId = await resolveTenantId(event);
  if (!tenantId) {
    console.log(
      `[api-billing/webhook] no ghost_api_tenant_id on ${event.type} (${event.id}); ignoring`
    );
    return NextResponse.json({ received: true, ignored: true });
  }

  const billingRef = db.ref(`apiTenants/${tenantId}/billing`);

  // Handled as a raw string: the event postdates the pinned stripe@17.3.1
  // typings, and the SDK must not be bumped (12 files, including the consumer
  // webhook, are typed against 2024-10-28.acacia).
  if ((event.type as string) === 'billing.meter.error_report_triggered') {
    // Rejected meter events mean silent revenue loss - always page us.
    postSlackMessage(
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Delivered meter errors*\nStripe is rejecting meter events for tenant \`${tenantId}\`. Usage may not be billed.`,
          },
        },
      ],
      `Delivered meter error for ${tenantId}`
    ).catch(() => {});
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'setup') {
          const si =
            typeof session.setup_intent === 'string'
              ? session.setup_intent
              : session.setup_intent?.id || null;
          await activatePaygFromSetup(tenantId, si);
        }
        break;
      }

      case 'setup_intent.succeeded': {
        const si = event.data.object as Stripe.SetupIntent;
        await activatePaygFromSetup(tenantId, si.id);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const status =
          sub.status === 'active' || sub.status === 'trialing'
            ? 'active'
            : sub.status === 'past_due' || sub.status === 'unpaid'
              ? 'past_due'
              : sub.status === 'canceled'
                ? 'canceled'
                : 'none';
        await billingRef.update({
          status,
          currentPeriodStart: sub.current_period_start * 1000,
          currentPeriodEnd: sub.current_period_end * 1000,
          updatedAt: Date.now(),
        });
        break;
      }

      case 'customer.subscription.deleted': {
        // API access continues at free-tier limits - we do NOT touch
        // tenant.status, which would kill their sandbox too.
        await billingRef.update({
          plan: 'free',
          status: 'canceled',
          updatedAt: Date.now(),
        });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await billingRef.update({
          delinquentSince: null,
          status: 'active',
          lastInvoice: {
            id: invoice.id,
            amountDue: invoice.amount_due,
            hostedUrl: invoice.hosted_invoice_url || null,
            paidAt: Date.now(),
          },
          updatedAt: Date.now(),
        });
        break;
      }

      case 'invoice.payment_failed': {
        const current = (await billingRef.child('delinquentSince').get()).val();
        await billingRef.update({
          status: 'past_due',
          delinquentSince: current || Date.now(),
          updatedAt: Date.now(),
        });
        postSlackMessage(
          [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Delivered payment failed*\nTenant \`${tenantId}\` is now past_due (limits drop to free tier).`,
              },
            },
          ],
          `Delivered payment failed for ${tenantId}`
        ).catch(() => {});
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error(`[api-billing/webhook] handler failed for ${event.type}:`, error);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
