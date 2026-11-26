import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../server.ts';
import {
  adjustInventoryByAdmin,
  createReturnRequestForOrder,
  decideReturnByAdmin,
  updateOrderStatusByAdmin,
} from '../../server/services/orderLifecycleService.ts';
import { pool } from '../../src/db/index.ts';

let server: http.Server | null = null;
let baseUrl = process.env.TEST_BASE_URL || '';

const hasDbEnv = Boolean(
  process.env.TEST_BASE_URL ||
    (process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_PASSWORD && process.env.SQL_DB_NAME)
);

beforeAll(async () => {
  if (!hasDbEnv) return;
  if (!baseUrl) {
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }
  await fetch(`${baseUrl}/api/categories`);
}, 60_000);

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.end();
  }
});

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

describe.skipIf(!hasDbEnv)('CompareX Phase 3 Full-Stack Integration Tests (TC01–TC24)', () => {
  let userAToken = '';
  let userBToken = '';
  let savedCompId = 0;
  let laptopIds: number[] = [];
  let targetProduct: any = null;
  let fridgeId = 0;
  let createdAddressId = 0;
  let order1Id = 0;
  let order2Id = 0;
  let order2ItemId = 0;

  it('TC06–TC08: fetches 31 INR products, 26 real-world brands, brand showcase, and category filters', async () => {
    const health = await api('/api/health');
    expect(health.status).toBe(200);
    expect(health.data.status).toBe('ok');

    const catRes = await api('/api/categories');
    expect(catRes.status).toBe(200);
    expect(catRes.data.categories.length).toBeGreaterThanOrEqual(17);

    const brandsRes = await api('/api/brands');
    expect(brandsRes.status).toBe(200);
    expect(brandsRes.data.brands.length).toBeGreaterThanOrEqual(26);

    const samsungRes = await api('/api/brands/samsung');
    expect(samsungRes.status).toBe(200);
    expect(samsungRes.data.brand.slug).toBe('samsung');
    expect(samsungRes.data.products.length).toBeGreaterThanOrEqual(2);

    const allProducts = await api('/api/products?limit=48');
    expect(allProducts.status).toBe(200);
    expect(allProducts.data.total).toBeGreaterThanOrEqual(31);
    expect(allProducts.data.items[0].currency).toBe('INR');
    targetProduct =
      allProducts.data.items.find((p: any) => p.stockQuantity >= 5) || allProducts.data.items[0];

    const laptops = await api('/api/products?category=laptops&maxPrice=150000');
    expect(laptops.status).toBe(200);
    expect(laptops.data.items.length).toBeGreaterThanOrEqual(2);
    laptopIds = laptops.data.items.map((p: any) => p.id);

    const fridges = await api('/api/products?category=refrigerators');
    expect(fridges.status).toBe(200);
    fridgeId = fridges.data.items[0].id;
  }, 30_000);

  it('TC01–TC05: registers, rejects invalid registration, logs in, rejects bad password, and blocks unauthorized admin access', async () => {
    const emailA = `usera_${Date.now()}@example.com`;
    const emailB = `userb_${Date.now()}@example.com`;

    const invalidReg = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'A', email: 'bad-email', password: '123' }),
    });
    expect(invalidReg.status).toBe(400);

    const regA = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice Tester', email: emailA, password: 'Password123' }),
    });
    expect(regA.status).toBe(201);
    userAToken = regA.data.token;

    const regB = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bob Tester', email: emailB, password: 'Password123' }),
    });
    expect(regB.status).toBe(201);
    userBToken = regB.data.token;

    const badLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailA, password: 'WrongPassword1' }),
    });
    expect(badLogin.status).toBe(401);

    const goodLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailA, password: 'Password123' }),
    });
    expect(goodLogin.status).toBe(200);
    expect(goodLogin.data.token).toBeTruthy();

    const guestAdmin = await api('/api/admin/overview');
    expect(guestAdmin.status).toBe(401);

    const consumerAdmin = await api('/api/admin/overview', {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(consumerAdmin.status).toBe(403);

    const consumerInv = await api('/api/admin/inventory', {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(consumerInv.status).toBe(403);
  }, 30_000);

  it('TC09–TC11: compares compatible products and rejects incompatible categories', async () => {
    const comp = await api('/api/compare/analyze', {
      method: 'POST',
      body: JSON.stringify({ productIds: laptopIds.slice(0, 2) }),
    });
    expect(comp.status).toBe(200);
    expect(comp.data.compatible).toBe(true);

    const badComp = await api('/api/compare/analyze', {
      method: 'POST',
      body: JSON.stringify({ productIds: [laptopIds[0], fridgeId] }),
    });
    expect(badComp.status).toBe(400);
  }, 30_000);

  it('TC14–TC15: generates explainable INR recommendations using Strategy pattern', async () => {
    const catRes = await api('/api/categories');
    const laptopCat = catRes.data.categories.find((c: any) => c.slug === 'laptops');

    const rec = await api('/api/recommendations', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: laptopCat.id,
        budgetMax: 150000,
        intendedUsage: 'student_portable',
        priorities: { performance: 70, value: 80, efficiency: 60, reliability: 60 },
      }),
    });
    expect(rec.status).toBe(200);
    expect(rec.data.recommendations.length).toBeGreaterThan(0);
    expect(rec.data.recommendations[0].explanation).toBeTruthy();
  }, 30_000);

  it('TC16–TC18 & TC21: saves comparison, manages wishlist, prevents cross-user deletion, and fetches price history', async () => {
    const catRes = await api('/api/categories');
    const laptopCat = catRes.data.categories.find((c: any) => c.slug === 'laptops');

    const saveRes = await api('/api/workspace/comparisons', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        title: 'User A Shortlist',
        categoryId: laptopCat.id,
        productIds: laptopIds.slice(0, 2),
        notes: 'Integration test',
      }),
    });
    expect(saveRes.status).toBe(201);
    savedCompId = saveRes.data.comparison.id;

    const crossDelete = await api(`/api/workspace/comparisons/${savedCompId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    expect(crossDelete.status).toBe(403);

    const wlAdd = await api('/api/workspace/wishlist', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ productId: laptopIds[0] }),
    });
    expect(wlAdd.status).toBe(201);

    const wlDel = await api(`/api/workspace/wishlist/${laptopIds[0]}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(wlDel.status).toBe(200);

    const hist = await api(`/api/products/${laptopIds[0]}/price-history`);
    expect(hist.status).toBe(200);
    expect(hist.data.observations.length).toBeGreaterThan(0);

    const ownDelete = await api(`/api/workspace/comparisons/${savedCompId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(ownDelete.status).toBe(200);
  }, 30_000);

  it('TC19–TC20 (Cart & Guest Merge): enforces stock limits, updates cart, and merges guest cart on sign-in', async () => {
    const guestToken = `guest_${Date.now()}`;

    const overStock = await api('/api/cart/items', {
      method: 'POST',
      headers: { 'x-cart-token': guestToken },
      body: JSON.stringify({ productId: targetProduct.id, quantity: 9999 }),
    });
    expect(overStock.status).toBe(400);

    const addGuest = await api('/api/cart/items', {
      method: 'POST',
      headers: { 'x-cart-token': guestToken },
      body: JSON.stringify({ productId: targetProduct.id, quantity: 1 }),
    });
    expect(addGuest.status).toBe(201);
    expect(addGuest.data.cart.itemCount).toBe(1);

    const mergeRes = await api('/api/cart/merge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ guestToken }),
    });
    expect(mergeRes.status).toBe(200);
    expect(mergeRes.data.cart.itemCount).toBeGreaterThanOrEqual(1);

    const itemId = mergeRes.data.cart.items[0].id;
    const updRes = await api(`/api/cart/items/${itemId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ quantity: 2 }),
    });
    expect(updRes.status).toBe(200);
    expect(updRes.data.cart.items[0].quantity).toBe(2);
  }, 30_000);

  it('TC22–TC24 (Addresses, Transactional Checkout, Idempotency & Order Lifecycle): verifies atomic stock, cancellation, returns, and isolation', async () => {
    const badAddr = await api('/api/addresses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        label: 'Home',
        fullName: 'A',
        phone: '123',
        houseBuilding: '1',
        street: 'a',
        city: 'b',
        state: 'c',
        postalCode: '12',
        country: 'India',
      }),
    });
    expect(badAddr.status).toBe(400);

    const goodAddr = await api('/api/addresses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        label: 'Home',
        fullName: 'Alice Tester',
        phone: '+91 98765 43210',
        houseBuilding: 'Flat 402, Skyview',
        street: 'MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
        isDefault: true,
      }),
    });
    expect(goodAddr.status).toBe(201);
    createdAddressId = goodAddr.data.address.id;

    // Reject raw card/CVV fields
    const unsafeCheckout = await api('/api/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        addressId: createdAddressId,
        deliveryMethod: 'STANDARD',
        paymentMode: 'DEMO_CARD_SIMULATION',
        idempotencyKey: `unsafe_${Date.now()}`,
        cardNumber: '4111111111111111',
      }),
    });
    expect(unsafeCheckout.status).toBe(400);

    const idemKey = `idem_${Date.now()}`;
    const checkout1 = await api('/api/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        addressId: createdAddressId,
        deliveryMethod: 'EXPRESS',
        paymentMode: 'DEMO_UPI_SIMULATION',
        paymentLabel: 'alice@demo-upi',
        idempotencyKey: idemKey,
      }),
    });
    expect(checkout1.status).toBe(201);
    order1Id = checkout1.data.order.id;
    expect(checkout1.data.order.status).toBe('Order Placed');
    expect(checkout1.data.order.currency).toBe('INR');

    // Duplicate idempotencyKey returns existing order without double-charging/decrementing
    const replay = await api('/api/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        addressId: createdAddressId,
        deliveryMethod: 'EXPRESS',
        paymentMode: 'DEMO_UPI_SIMULATION',
        paymentLabel: 'alice@demo-upi',
        idempotencyKey: idemKey,
      }),
    });
    expect(replay.status).toBe(200);
    expect(replay.data.idempotentReplay).toBe(true);
    expect(replay.data.order.id).toBe(order1Id);

    // Cross-user isolation on order detail
    const crossOrder = await api(`/api/orders/${order1Id}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    expect(crossOrder.status).toBe(403);

    // Stock decremented after checkout
    const prodAfterCheckout = await api(`/api/products/${targetProduct.id}`);
    expect(prodAfterCheckout.data.product.stockQuantity).toBe(targetProduct.stockQuantity - 2);

    // Pre-shipment cancel restores stock
    const cancelRes = await api(`/api/orders/${order1Id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ reason: 'Changed mind before dispatch' }),
    });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.data.order.status).toBe('Cancelled');

    const prodAfterCancel = await api(`/api/products/${targetProduct.id}`);
    expect(prodAfterCancel.data.product.stockQuantity).toBe(targetProduct.stockQuantity);

    // Reorder to cart & place second order for shipment/return lifecycle test
    const reorder = await api(`/api/orders/${order1Id}/reorder`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    expect(reorder.status).toBe(200);
    expect(reorder.data.cart.items.length).toBe(1);

    const checkout2 = await api('/api/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({
        addressId: createdAddressId,
        deliveryMethod: 'STANDARD',
        paymentMode: 'DEMO_COD_SIMULATION',
        idempotencyKey: `idem2_${Date.now()}`,
      }),
    });
    expect(checkout2.status).toBe(201);
    order2Id = checkout2.data.order.id;
    order2ItemId = checkout2.data.order.items[0].id;

    // When DB credentials exist locally, verify admin Shipped block + Delivered return + restock
    if (process.env.SQL_HOST && process.env.SQL_DB_NAME) {
      await updateOrderStatusByAdmin({
        orderId: order2Id,
        nextStatus: 'Shipped',
        note: 'Dispatched for integration test',
        actorEmail: 'test-admin@comparex.local',
      });

      const blockedCancel = await api(`/api/orders/${order2Id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: JSON.stringify({ reason: 'Too late to cancel' }),
      });
      expect(blockedCancel.status).toBe(400);

      await updateOrderStatusByAdmin({
        orderId: order2Id,
        nextStatus: 'Delivered',
        note: 'Delivered in test',
        actorEmail: 'test-admin@comparex.local',
      });

      const returnReq = await api(`/api/orders/${order2Id}/returns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: JSON.stringify({
          orderItemId: order2ItemId,
          reason: 'Packaging seal damaged during transit',
        }),
      });
      expect(returnReq.status).toBe(201);

      const decided = await decideReturnByAdmin({
        returnId: returnReq.data.returnRequest.id,
        nextStatus: 'Demo Refund Completed',
        adminNote: 'Restocked in test verification',
        actorEmail: 'test-admin@comparex.local',
      });
      expect(decided.status).toBe('Demo Refund Completed');

      // Restore exact original stock via admin inventory adjust
      await adjustInventoryByAdmin({
        productId: targetProduct.id,
        stockQuantity: targetProduct.stockQuantity,
        reason: 'Reset post integration test',
        actorEmail: 'test-admin@comparex.local',
      });
    } else {
      // Clean up order2 if running purely remote without direct DB access
      const cancel2 = await api(`/api/orders/${order2Id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: JSON.stringify({ reason: 'Integration test cleanup' }),
      });
      expect(cancel2.status).toBe(200);
    }

    // Verify nonexistent resource 404
    const missing = await api('/api/products/nonexistent-slug-99999');
    expect(missing.status).toBe(404);
  }, 30_000);
});
