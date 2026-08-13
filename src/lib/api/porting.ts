import { db } from '@/lib/firebase-admin';
import { randomBase62 } from './ids';

/**
 * Number porting, v1: a request workflow. The actual port is a carrier process
 * (LOA, CSR, FOC dates) run by a human; what the product owns is intake with
 * the fields the carrier will ask for, an admin queue, and a status timeline
 * the customer can see.
 *
 *   apiPortRequests/{tenantId}/{id} = PortRequest
 */

export type PortStatus = 'requested' | 'submitted' | 'foc_set' | 'complete' | 'rejected';

export interface PortRequest {
  id: string;
  number: string;
  currentCarrier: string;
  accountNumber: string;
  pinLast4: string;
  authorizedName: string;
  status: PortStatus;
  statusLog: Array<{ at: number; status: PortStatus; note?: string }>;
  createdAt: number;
}

export const newPortId = () => `port_${randomBase62(12)}`;
export const PORT_STATUSES: PortStatus[] = ['requested', 'submitted', 'foc_set', 'complete', 'rejected'];

export async function listPortRequests(tenantId: string): Promise<PortRequest[]> {
  const snap = await db.ref(`apiPortRequests/${tenantId}`).get();
  if (!snap.exists()) return [];
  return (Object.values(snap.val()) as PortRequest[])
    .map((p) => ({ ...p, statusLog: p.statusLog || [] }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function createPortRequest(
  tenantId: string,
  input: Omit<PortRequest, 'id' | 'status' | 'statusLog' | 'createdAt'>
): Promise<PortRequest> {
  const request: PortRequest = {
    ...input,
    id: newPortId(),
    status: 'requested',
    statusLog: [{ at: Date.now(), status: 'requested' }],
    createdAt: Date.now(),
  };
  await db.ref(`apiPortRequests/${tenantId}/${request.id}`).set(JSON.parse(JSON.stringify(request)));
  return request;
}

/** Admin-side status advance, appending to the visible timeline. */
export async function advancePortStatus(
  tenantId: string,
  portId: string,
  status: PortStatus,
  note?: string
): Promise<boolean> {
  const ref = db.ref(`apiPortRequests/${tenantId}/${portId}`);
  const snap = await ref.get();
  if (!snap.exists()) return false;
  const current = snap.val() as PortRequest;
  await ref.update({
    status,
    statusLog: [...(current.statusLog || []), { at: Date.now(), status, ...(note ? { note } : {}) }],
  });
  return true;
}
