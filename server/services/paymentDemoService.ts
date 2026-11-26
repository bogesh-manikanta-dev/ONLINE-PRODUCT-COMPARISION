import crypto from 'node:crypto';
import type { PaymentMode } from '../../shared/types.ts';

export interface DemoPaymentResult {
  paymentStatus: 'DEMO_VERIFIED' | 'DEMO_COD_PENDING';
  simulationReference: string;
  disclaimer: string;
}

/**
 * Demonstration-only Payment Simulation Service.
 * Never accepts, stores, or processes real PAN/CVV/UPI PIN credentials.
 */
export function simulateDemoPayment(mode: PaymentMode): DemoPaymentResult {
  const ref = `DEMO-PAY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  switch (mode) {
    case 'DEMO_CARD_SIMULATION':
      return {
        paymentStatus: 'DEMO_VERIFIED',
        simulationReference: ref,
        disclaimer: 'Demonstration mode only: no real card credentials collected or charged.',
      };
    case 'DEMO_UPI_SIMULATION':
      return {
        paymentStatus: 'DEMO_VERIFIED',
        simulationReference: ref,
        disclaimer: 'Demonstration mode only: simulated UPI verification completed locally.',
      };
    case 'DEMO_COD_SIMULATION':
      return {
        paymentStatus: 'DEMO_COD_PENDING',
        simulationReference: ref,
        disclaimer: 'Demonstration mode only: simulated Cash on Delivery selected.',
      };
  }
}
