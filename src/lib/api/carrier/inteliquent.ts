import { digits10 } from '../phone';

/**
 * Inteliquent carrier operations for LIVE API tenants, inlined in the Next
 * app. Logic extracted from the deployed Cloud Functions
 * (searchAvailableNumbersSinchExpo, purchaseNumberSinchExpo,
 * removePhoneNumberExpo) - the originals are NOT touched or called.
 *
 * Env required for live mode: INTELIQUENT_API_KEY, INTELIQUENT_API_SECRET
 * (optionally ENVIRONMENT_MODE='sandbox' + the _SANDBOX variants).
 * Every function here asserts it is only used on the live path.
 */

const ENVIRONMENT_MODE = process.env.ENVIRONMENT_MODE || 'production';
const IS_SANDBOX = ENVIRONMENT_MODE === 'sandbox';

const BASE_URL = IS_SANDBOX
  ? 'https://services-sandbox.inteliquent.com/Services/2.0.0'
  : 'https://services.inteliquent.com/Services/2.0.0';
const TOKEN_URL = IS_SANDBOX
  ? 'https://services-token-sandbox.inteliquent.com/oauth2/token'
  : 'https://services-token.inteliquent.com/oauth2/token';

// Same trunk-group ladder as purchaseNumberSinchExpo.
const TRUNK_GROUPS = IS_SANDBOX
  ? ['ATLNGAQSJK9_1268']
  : ['DNVTCOZITR2_2867', 'ATLNGAQSTR6_6642'];

function creds(): { apiKey: string; apiSecret: string } {
  const apiKey = IS_SANDBOX
    ? process.env.INTELIQUENT_API_KEY_SANDBOX
    : process.env.INTELIQUENT_API_KEY;
  const apiSecret = IS_SANDBOX
    ? process.env.INTELIQUENT_API_SECRET_SANDBOX
    : process.env.INTELIQUENT_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error('Inteliquent credentials not configured (INTELIQUENT_API_KEY/SECRET)');
  }
  return { apiKey, apiSecret };
}

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  const buffer = 10 * 60 * 1000;
  if (cachedToken && Date.now() < tokenExpiry - buffer) return cachedToken;
  cachedToken = null;

  const { apiKey, apiSecret } = creds();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: 'client_credentials',
    }),
  });
  const data = (await res.json().catch(() => null)) as { access_token?: string } | null;
  if (!res.ok || !data?.access_token) {
    throw new Error(`Inteliquent token request failed (${res.status})`);
  }
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 50 * 60 * 1000;
  return cachedToken;
}

/** POST with the shared 401-clear-cache-retry-once behavior. */
async function iqPost(path: string, payload: Record<string, unknown>): Promise<{
  status: number;
  data: Record<string, unknown> | null;
}> {
  const attempt = async () => {
    const token = await getAccessToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, data };
  };
  let result = await attempt();
  if (result.status === 401) {
    cachedToken = null;
    result = await attempt();
  }
  return result;
}

export interface CarrierAvailableNumber {
  phone_number: string; // E.164
  locality: string;
  region: string;
}

/** tnInventory search by area code (single tier - no fallback ladder in v1). */
export async function carrierSearchNumbers(
  areaCode: string,
  limit = 5
): Promise<CarrierAvailableNumber[]> {
  const { apiKey } = creds();
  const { status, data } = await iqPost('/tnInventory', {
    privateKey: apiKey,
    wireless: 'Y',
    tnMask: `${areaCode}xxxxxxx`,
  });
  if (status < 200 || status >= 300 || !data) {
    throw new Error(`tnInventory failed (${status})`);
  }
  const tnResult = Array.isArray(data.tnResult)
    ? (data.tnResult as Array<Record<string, string>>)
    : [];
  return tnResult.slice(0, limit).map((n) => ({
    phone_number: `+1${digits10(String(n.telephoneNumber || ''))}`,
    locality: n.city || n.rateCenter || '',
    region: n.province || '',
  }));
}

/**
 * tnOrder over the trunk-group ladder, with messaging (PPW/SMS) configured
 * inline - same payload shape as purchaseNumberSinchExpo. SMS-only: no voice
 * routing, no SIP endpoint (API tenants don't get them in v1).
 */
export async function carrierPurchaseNumber(
  e164: string,
  reference: string
): Promise<{ orderId: string; trunkGroup: string }> {
  const { apiKey } = creds();
  const ten = digits10(e164);
  let lastError = 'no trunk groups attempted';
  for (const trunkGroup of TRUNK_GROUPS) {
    const { status, data } = await iqPost('/tnOrder', {
      privateKey: apiKey,
      tnOrder: {
        customerOrderReference: reference,
        tnList: {
          tnItem: [
            {
              tn: ten,
              trunkGroup,
              tnFeature: {
                messaging: { messageClass: 'PPW', messageType: 'SMS' },
              },
            },
          ],
        },
      },
    });
    const orderId = data && (data.orderId as string | number | undefined);
    const ok = status >= 200 && status < 300 && (orderId || data?.statusCode === '200');
    if (ok) {
      return { orderId: String(orderId || `api${Date.now()}`), trunkGroup };
    }
    lastError = `tnOrder ${trunkGroup} HTTP ${status} status=${data?.status ?? 'n/a'}`;
  }
  throw new Error(lastError);
}

/** tnDisconnect - same call removePhoneNumberExpo and the purge job make. */
export async function carrierReleaseNumber(e164: string): Promise<void> {
  const { apiKey } = creds();
  const { status, data } = await iqPost('/tnDisconnect', {
    privateKey: apiKey,
    customerOrderReference: `ApiRelease_${Date.now()}`,
    tnList: { tnItem: [{ tn: digits10(e164) }] },
  });
  const ok =
    status >= 200 && status < 300 &&
    !!data && (data.status === 'Success' || !!data.tnDisconnectResponse);
  if (!ok) {
    throw new Error(`tnDisconnect HTTP ${status} status=${data?.status ?? 'n/a'}`);
  }
}
