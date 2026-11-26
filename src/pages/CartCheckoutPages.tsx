import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react';
import type {
  DeliveryMethod,
  OrderDTO,
  PaymentMode,
  UserAddressDTO,
} from '../../shared/types.ts';
import {
  Breadcrumbs,
  Button,
  Card,
  Input,
  Label,
  ProductImage,
} from '../components/ui/Primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useAudio } from '../context/AudioContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency, formatDate } from '../lib/utils.ts';

export function CartPage({ navigate }: { navigate: (to: string) => void }) {
  const { cart, updateQuantity, removeItem } = useCart();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="space-y-2 border-b border-slate-800/80 pb-6">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Shopping Cart' }]} navigate={navigate} />
        <h1 className="font-display text-3xl font-bold text-white">Shopping Cart</h1>
        <p className="text-sm text-slate-400">
          Review items, adjust quantities within demonstration stock limits, and inspect server-computed INR GST &amp; delivery estimates.
        </p>
      </div>

      {cart.items.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-[#0B0A08] text-slate-500">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">Your shopping cart is empty</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Explore our 31-product demonstration catalog or run a side-by-side comparison to pick the right model.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="primary" onClick={() => navigate('/discover')}>
              Explore Catalog
            </Button>
            <Button variant="outline" onClick={() => navigate('/brands')}>
              Browse Brands
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-4">
            {cart.items.map((item) => (
              <Card key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <button
                  type="button"
                  onClick={() => navigate(`/products/${item.productSlug}`)}
                  className="h-24 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-[#0B0A08] cursor-pointer"
                >
                  <ProductImage src={item.primaryImage} alt={item.productName} className="h-full w-full" />
                </button>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-xs font-semibold text-sky-400">
                    {item.brandName} · Model {item.modelNumber}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/products/${item.productSlug}`)}
                    className="font-display text-lg font-bold text-white hover:text-sky-300 text-left cursor-pointer"
                  >
                    {item.productName}
                  </button>
                  <div className="text-xs text-slate-400">{item.variantLabel}</div>
                  <div className="text-xs text-slate-500">
                    Unit: {formatCurrency(item.unitPrice, item.currency)} · GST {item.taxRatePercent}% · Available stock: {item.stockQuantity}
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3">
                  <div className="font-mono text-lg font-bold text-white tabular-nums">
                    {formatCurrency(item.lineSubtotal, item.currency)}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center rounded-lg border border-slate-700 bg-[#0B0A08]">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="px-2.5 py-1.5 text-slate-300 hover:text-white cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="px-3 font-mono text-sm font-semibold text-white tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.stockQuantity}
                        className="px-2.5 py-1.5 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-4">
            <Card className="p-6 space-y-5 sticky top-24">
              <h2 className="font-display text-lg font-bold text-white">Order Estimate</h2>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between text-slate-400">
                  <dt>Subtotal ({cart.itemCount} items)</dt>
                  <dd className="font-mono text-white tabular-nums">
                    {formatCurrency(cart.subtotal, cart.currency)}
                  </dd>
                </div>
                <div className="flex justify-between text-slate-400">
                  <dt>GST / Tax (Product Category Rate)</dt>
                  <dd className="font-mono text-white tabular-nums">
                    {formatCurrency(cart.taxAmount, cart.currency)}
                  </dd>
                </div>
                <div className="flex justify-between text-slate-400">
                  <dt>Standard Delivery</dt>
                  <dd className="font-mono text-white tabular-nums">
                    {cart.standardDeliveryCharge === 0
                      ? 'FREE'
                      : formatCurrency(cart.standardDeliveryCharge, cart.currency)}
                  </dd>
                </div>
                <div className="text-[11px] text-slate-500">
                  Free standard delivery on orders ₹{cart.freeDeliveryThreshold.toLocaleString('en-IN')}+.
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-3 text-base font-bold text-white">
                  <dt>Estimated Total</dt>
                  <dd className="font-mono text-sky-400 tabular-nums">
                    {formatCurrency(cart.estimatedTotalStandard, cart.currency)}
                  </dd>
                </div>
              </dl>

              <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/checkout')}>
                <span>Proceed to Checkout</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="md" className="w-full" onClick={() => navigate('/discover')}>
                Continue Shopping
              </Button>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

const CHECKOUT_STEPS = [
  '1. Cart Review',
  '2. Shipping Address',
  '3. Delivery Method',
  '4. Order Summary',
  '5. Payment Mode (Demo)',
  '6. Confirmation',
];

export function CheckoutPage({ navigate }: { navigate: (to: string) => void }) {
  const { user } = useAuth();
  const { cart, refreshCart } = useCart();
  const { showNotice } = useCompare();
  const { playCue } = useAudio();

  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState<UserAddressDTO[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | 'NEW'>('NEW');
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [addrForm, setAddrForm] = useState({
    label: 'Home',
    fullName: '',
    phone: '',
    houseBuilding: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  });
  const [addrError, setAddrError] = useState('');

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('STANDARD');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('DEMO_UPI_SIMULATION');
  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `chk-${crypto.randomUUID()}`
      : `chk-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<OrderDTO | null>(null);

  useEffect(() => {
    if (!user) return;
    apiRequest<{ addresses: UserAddressDTO[] }>('/api/addresses')
      .then((res) => {
        setAddresses(res.addresses);
        const def = res.addresses.find((a) => a.isDefault) || res.addresses[0];
        if (def) setSelectedAddressId(def.id);
      })
      .catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="p-8 text-center space-y-4">
          <ShieldCheck className="mx-auto h-10 w-10 text-sky-400" />
          <h1 className="font-display text-2xl font-bold text-white">Sign in to Checkout</h1>
          <p className="text-sm text-slate-400">
            Your guest cart items will merge automatically into your account when you sign in.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="primary" onClick={() => navigate('/login')}>
              Sign In
            </Button>
            <Button variant="outline" onClick={() => navigate('/signup')}>
              Create Account
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (cart.items.length === 0 && !placedOrder) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="p-8 text-center space-y-4">
          <ShoppingBag className="mx-auto h-10 w-10 text-slate-500" />
          <h1 className="font-display text-2xl font-bold text-white">Your Cart is Empty</h1>
          <p className="text-sm text-slate-400">Add products from the catalog before checking out.</p>
          <Button variant="primary" onClick={() => navigate('/discover')}>
            Browse Products
          </Button>
        </Card>
      </div>
    );
  }

  const deliveryFee =
    deliveryMethod === 'EXPRESS' ? cart.expressDeliveryCharge : cart.standardDeliveryCharge;
  const finalTotal = Number((cart.subtotal + cart.taxAmount + deliveryFee).toFixed(2));

  const validateAddressStep = () => {
    setAddrError('');
    if (selectedAddressId !== 'NEW') {
      return true;
    }
    if (addrForm.fullName.trim().length < 2) {
      setAddrError('Enter recipient full name (at least 2 characters).');
      return false;
    }
    if (!/^[0-9+\-\s()]{10,15}$/.test(addrForm.phone.trim())) {
      setAddrError('Enter a valid 10 to 15 digit phone number.');
      return false;
    }
    if (addrForm.houseBuilding.trim().length < 2 || addrForm.street.trim().length < 3) {
      setAddrError('Complete house/building and street address details.');
      return false;
    }
    if (addrForm.city.trim().length < 2 || addrForm.state.trim().length < 2) {
      setAddrError('Enter valid city and state.');
      return false;
    }
    if (!/^[A-Za-z0-9\-\s]{5,10}$/.test(addrForm.postalCode.trim())) {
      setAddrError('Enter a valid 5 to 10 character PIN / postal code.');
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    setSubmitting(true);
    try {
      const payload =
        selectedAddressId !== 'NEW'
          ? {
              addressId: selectedAddressId,
              deliveryMethod,
              paymentMode,
              idempotencyKey,
            }
          : {
              shippingAddress: addrForm,
              saveAddress: saveNewAddress,
              deliveryMethod,
              paymentMode,
              idempotencyKey,
            };

      const res = await apiRequest<{ order: OrderDTO }>('/api/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPlacedOrder(res.order);
      setStep(6);
      playCue('success');
      showNotice('success', `Order ${res.order.orderNumber} placed successfully!`);
      await refreshCart();
    } catch (err: any) {
      playCue('error');
      showNotice('error', err.message || 'Checkout failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const chosenAddress =
    selectedAddressId !== 'NEW'
      ? addresses.find((a) => a.id === selectedAddressId)
      : addrForm;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: 'Cart', to: '/cart' },
            { label: 'Checkout' },
          ]}
          navigate={navigate}
        />
        <h1 className="font-display text-3xl font-bold text-white">Guided Checkout</h1>

        {/* Step Indicator */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {CHECKOUT_STEPS.map((label, idx) => {
            const num = idx + 1;
            const active = step === num;
            const done = step > num;
            return (
              <div
                key={label}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-sky-400 bg-sky-500/15 text-sky-300'
                    : done
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 bg-[#0F0E0B] text-slate-500'
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Cart Review */}
      {step === 1 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <h2 className="font-display text-xl font-bold text-white">Step 1: Review Cart Items</h2>
          <div className="divide-y divide-slate-800/80">
            {cart.items.map((item) => (
              <div key={item.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-14 w-16 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                    <ProductImage src={item.primaryImage} alt={item.productName} className="h-full w-full" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold text-white truncate">
                      {item.productName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {item.brandName} · {item.variantLabel} · Qty {item.quantity}
                    </div>
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-white tabular-nums shrink-0">
                  {formatCurrency(item.lineSubtotal, item.currency)}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-slate-800">
            <Button variant="outline" onClick={() => navigate('/cart')}>
              <ArrowLeft className="h-4 w-4" />
              <span>Edit Cart</span>
            </Button>
            <Button variant="primary" onClick={() => setStep(2)}>
              <span>Continue to Shipping Address</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Shipping Address */}
      {step === 2 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <h2 className="font-display text-xl font-bold text-white">Step 2: Shipping Address</h2>

          {addresses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => {
                    setSelectedAddressId(addr.id);
                    setAddrError('');
                  }}
                  className={`rounded-xl border p-4 text-left transition-all cursor-pointer ${
                    selectedAddressId === addr.id
                      ? 'border-sky-400 bg-sky-500/10'
                      : 'border-slate-800 bg-[#0B0A08] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display text-sm font-bold text-white">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="text-[11px] font-semibold text-sky-400">Default</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-200 font-medium">{addr.fullName} · {addr.phone}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {addr.houseBuilding}, {addr.street}, {addr.city}, {addr.state} — {addr.postalCode}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedAddressId('NEW')}
                className={`rounded-xl border p-4 text-left transition-all flex items-center gap-3 cursor-pointer ${
                  selectedAddressId === 'NEW'
                    ? 'border-sky-400 bg-sky-500/10'
                    : 'border-slate-800 bg-[#0B0A08] hover:border-slate-600'
                }`}
              >
                <MapPin className="h-5 w-5 text-sky-400" />
                <div>
                  <div className="font-display text-sm font-bold text-white">Add New Shipping Address</div>
                  <div className="text-xs text-slate-400">Enter a fresh delivery location</div>
                </div>
              </button>
            </div>
          )}

          {selectedAddressId === 'NEW' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <Label>Address Label</Label>
                <Input
                  value={addrForm.label}
                  onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                  placeholder="Home / Office"
                />
              </div>
              <div>
                <Label>Full Name</Label>
                <Input
                  value={addrForm.fullName}
                  onChange={(e) => setAddrForm({ ...addrForm, fullName: e.target.value })}
                  placeholder="Recipient full name"
                />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input
                  value={addrForm.phone}
                  onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                  placeholder="+91 9876543210"
                />
              </div>
              <div>
                <Label>House / Flat / Building</Label>
                <Input
                  value={addrForm.houseBuilding}
                  onChange={(e) => setAddrForm({ ...addrForm, houseBuilding: e.target.value })}
                  placeholder="Flat 402, Meridian Residency"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Street / Locality</Label>
                <Input
                  value={addrForm.street}
                  onChange={(e) => setAddrForm({ ...addrForm, street: e.target.value })}
                  placeholder="MG Road, Indiranagar"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={addrForm.city}
                  onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                  placeholder="Bengaluru"
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={addrForm.state}
                  onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                  placeholder="Karnataka"
                />
              </div>
              <div>
                <Label>PIN / Postal Code</Label>
                <Input
                  value={addrForm.postalCode}
                  onChange={(e) => setAddrForm({ ...addrForm, postalCode: e.target.value })}
                  placeholder="560038"
                />
              </div>
              <div>
                <Label>Country</Label>
                <Input
                  value={addrForm.country}
                  onChange={(e) => setAddrForm({ ...addrForm, country: e.target.value })}
                />
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveNewAddress}
                  onChange={(e) => setSaveNewAddress(e.target.checked)}
                  className="accent-sky-400"
                />
                Save this address to my CompareX address book
              </label>
            </div>
          )}

          {addrError && <p className="text-xs font-semibold text-red-400">{addrError}</p>}

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (validateAddressStep()) setStep(3);
              }}
            >
              <span>Continue to Delivery Method</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Delivery Method */}
      {step === 3 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <h2 className="font-display text-xl font-bold text-white">Step 3: Delivery Method (Demo)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setDeliveryMethod('STANDARD')}
              className={`rounded-xl border p-5 text-left transition-all cursor-pointer ${
                deliveryMethod === 'STANDARD'
                  ? 'border-sky-400 bg-sky-500/10'
                  : 'border-slate-800 bg-[#0B0A08] hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-2 font-display text-base font-bold text-white">
                  <Truck className="h-4 w-4 text-sky-400" />
                  Standard Delivery
                </span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  {cart.standardDeliveryCharge === 0
                    ? 'FREE'
                    : formatCurrency(cart.standardDeliveryCharge, 'INR')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Estimated simulated arrival in 5 business days. Free on orders ₹{cart.freeDeliveryThreshold.toLocaleString('en-IN')}+.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryMethod('EXPRESS')}
              className={`rounded-xl border p-5 text-left transition-all cursor-pointer ${
                deliveryMethod === 'EXPRESS'
                  ? 'border-sky-400 bg-sky-500/10'
                  : 'border-slate-800 bg-[#0B0A08] hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-2 font-display text-base font-bold text-white">
                  <Truck className="h-4 w-4 text-violet-400" />
                  Priority Express Delivery
                </span>
                <span className="font-mono text-sm font-bold text-white">
                  {formatCurrency(cart.expressDeliveryCharge, 'INR')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Simulated priority dispatch with estimated arrival in 2 business days.
              </p>
            </button>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <Button variant="primary" onClick={() => setStep(4)}>
              <span>Continue to Order Summary</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Order Summary */}
      {step === 4 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <h2 className="font-display text-xl font-bold text-white">Step 4: Order Summary Verification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-800 bg-[#0B0A08] p-4 space-y-2">
              <div className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Shipping To</div>
              {chosenAddress && (
                <div className="text-sm text-slate-200 space-y-0.5">
                  <div className="font-bold">{chosenAddress.fullName} ({chosenAddress.label})</div>
                  <div className="text-xs text-slate-400">{chosenAddress.phone}</div>
                  <div className="text-xs text-slate-300">
                    {chosenAddress.houseBuilding}, {chosenAddress.street}, {chosenAddress.city},{' '}
                    {chosenAddress.state} — {chosenAddress.postalCode}, {chosenAddress.country}
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 text-xs text-slate-400">
                Delivery Tier: <strong className="text-white">{deliveryMethod}</strong>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0B0A08] p-4 space-y-2">
              <div className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Server-Verified Totals</div>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-400">
                  <dt>Items Subtotal</dt>
                  <dd className="font-mono text-white tabular-nums">{formatCurrency(cart.subtotal, 'INR')}</dd>
                </div>
                <div className="flex justify-between text-slate-400">
                  <dt>GST / Tax</dt>
                  <dd className="font-mono text-white tabular-nums">{formatCurrency(cart.taxAmount, 'INR')}</dd>
                </div>
                <div className="flex justify-between text-slate-400">
                  <dt>Delivery Charge</dt>
                  <dd className="font-mono text-white tabular-nums">
                    {deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee, 'INR')}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2 text-base font-bold text-white">
                  <dt>Final Order Total</dt>
                  <dd className="font-mono text-sky-400 tabular-nums">{formatCurrency(finalTotal, 'INR')}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <Button variant="outline" onClick={() => setStep(3)}>
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <Button variant="primary" onClick={() => setStep(5)}>
              <span>Continue to Payment Mode (Demo)</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 5: Demonstration Payment Mode */}
      {step === 5 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-white">
              Step 5: Select Payment Mode (Demonstration Only)
            </h2>
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              Academic Demonstration Mode: CompareX does not collect real card numbers, CVVs, or UPI PINs, and no real money is charged.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: 'DEMO_UPI_SIMULATION' as PaymentMode,
                title: 'UPI Instant (Demo Simulation)',
                desc: 'Simulates instant UPI confirmation without banking credentials.',
                icon: Smartphone,
              },
              {
                id: 'DEMO_CARD_SIMULATION' as PaymentMode,
                title: 'Card Mode (Demo Simulation)',
                desc: 'Simulates authorized card checkout locally with zero PAN/CVV input.',
                icon: CreditCard,
              },
              {
                id: 'DEMO_COD_SIMULATION' as PaymentMode,
                title: 'Cash on Delivery (Demo)',
                desc: 'Simulates pay-on-delivery order dispatch.',
                icon: Wallet,
              },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setPaymentMode(mode.id)}
                className={`rounded-xl border p-5 text-left transition-all cursor-pointer space-y-2 ${
                  paymentMode === mode.id
                    ? 'border-sky-400 bg-sky-500/10'
                    : 'border-slate-800 bg-[#0B0A08] hover:border-slate-600'
                }`}
              >
                <mode.icon className="h-5 w-5 text-sky-400" />
                <div className="font-display text-sm font-bold text-white">{mode.title}</div>
                <p className="text-xs text-slate-400">{mode.desc}</p>
              </button>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <Button variant="outline" onClick={() => setStep(4)}>
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <Button variant="primary" size="lg" disabled={submitting} onClick={handlePlaceOrder}>
              <span>{submitting ? 'Placing Demo Order...' : `Confirm Demo Order (${formatCurrency(finalTotal, 'INR')})`}</span>
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 6: Order Confirmation */}
      {step === 6 && placedOrder && (
        <Card className="p-8 sm:p-10 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <div className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Demonstration Order Confirmed
            </div>
            <h2 className="font-display text-3xl font-bold text-white">
              Order {placedOrder.orderNumber}
            </h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              Your demonstration order has been recorded in PostgreSQL, inventory has been updated atomically,
              and your simulated delivery date is{' '}
              <strong className="text-white">{formatDate(placedOrder.estimatedDeliveryDate)}</strong>.
            </p>
          </div>

          <div className="mx-auto max-w-md rounded-xl border border-slate-800 bg-[#0B0A08] p-4 text-left text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Payment Mode</span>
              <span className="font-mono text-slate-200">{placedOrder.paymentMode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Status</span>
              <span className="font-semibold text-sky-400">{placedOrder.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Amount</span>
              <span className="font-mono font-bold text-white">{formatCurrency(placedOrder.totalAmount, placedOrder.currency)}</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button variant="primary" onClick={() => navigate(`/orders/${placedOrder.id}`)}>
              Track Order Details
            </Button>
            <Button variant="outline" onClick={() => navigate('/orders')}>
              View All Orders
            </Button>
            <Button variant="ghost" onClick={() => navigate('/discover')}>
              Continue Shopping
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
