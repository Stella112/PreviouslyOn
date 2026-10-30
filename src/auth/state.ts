import { randomBytes, timingSafeEqual } from 'node:crypto';
export function newState(): string { return randomBytes(32).toString('hex'); }
export function validState(expected: unknown, received: unknown): boolean {
 if (typeof expected !== 'string' || typeof received !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(received)) return false;
 return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
