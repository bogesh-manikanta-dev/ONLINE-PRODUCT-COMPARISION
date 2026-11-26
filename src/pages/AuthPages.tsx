import React, { useEffect, useState } from 'react';
import { LogIn, Shield, UserPlus } from 'lucide-react';
import { Button, Card, Input, Label } from '../components/ui/Primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';

export function AuthPage({
  mode,
  navigate,
}: {
  mode: 'login' | 'signup';
  navigate: (to: string) => void;
}) {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, claimAdminAccess } = useAuth();
  const { showNotice } = useCompare();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showAdminClaim, setShowAdminClaim] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminConfigured, setAdminConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    apiRequest<{ isConfigured: boolean }>('/api/auth/admin-bootstrap-status')
      .then((res) => setAdminConfigured(res.isConfigured))
      .catch(() => setAdminConfigured(null));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const user = await registerWithEmail(name, email, password);
        showNotice('success', `Welcome to CompareX, ${user.name}!`);
        navigate('/dashboard');
      } else {
        const user = await loginWithEmail(email, password);
        showNotice('success', `Signed in as ${user.name}.`);
        navigate(user.role === 'ADMIN' ? '/admin' : '/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSubmitting(true);
    try {
      const user = await loginWithGoogle();
      showNotice('success', `Signed in with Google as ${user.name}.`);
      navigate(user.role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google sign-in could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await claimAdminAccess({
        passcode: adminPasscode,
        email: email || 'admin@comparex.local',
        name: name || 'CompareX Administrator',
      });
      showNotice('success', `Administrator access verified for ${user.email}.`);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Administrator verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden py-14 sm:py-20 px-4 cx-grid-bg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[340px] w-[540px] rounded-full bg-sky-500/10 blur-[120px]"
      />
      <div className="relative mx-auto max-w-md">
        <Card className="p-6 sm:p-8 bg-[#0B1222]/90 backdrop-blur-xl border-slate-700/80 shadow-2xl">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-2">
              {mode === 'signup' ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              <span>{mode === 'signup' ? 'Consumer Registration' : 'Account Sign In'}</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              {mode === 'signup' ? 'Create your CompareX account' : 'Sign in to CompareX'}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {mode === 'signup'
                ? 'Save product comparisons, track wishlist price targets, and personalize recommendation weights.'
                : 'Access your saved comparisons, personal wishlist, and dashboard.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-800/80 bg-red-950/70 px-3.5 py-2.5 text-sm text-red-200"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <Label htmlFor="auth-name">Full Name</Label>
                <Input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                />
              </div>
            )}

            <div>
              <Label htmlFor="auth-email">Email Address</Label>
              <Input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
              />
            </div>

            <div>
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters with a number' : '••••••••'}
              />
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
              {submitting
                ? 'Processing...'
                : mode === 'signup'
                  ? 'Create Account'
                  : 'Sign In'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
            <div className="h-px flex-1 bg-slate-800" />
            <span>or</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={submitting}
          >
            Continue with Google
          </Button>

          <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            {mode === 'signup' ? (
              <>
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                <span>New to CompareX?</span>
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  Create Account
                </button>
              </>
            )}
          </div>

          {/* Admin Console Access Section */}
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowAdminClaim((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-sky-400 transition-colors cursor-pointer"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>
                {adminConfigured === false
                  ? 'First-Run Admin Setup (Claim Admin Passcode)'
                  : 'Administrator Console Sign In'}
              </span>
            </button>

            {showAdminClaim && (
              <form
                onSubmit={handleAdminClaim}
                className="mt-3 space-y-3 rounded-xl bg-[#070D1A] p-4 border border-slate-800"
              >
                <p className="text-xs text-slate-400 leading-relaxed">
                  {adminConfigured === false
                    ? 'No admin passcode has been claimed yet. Enter a passcode (8+ characters) to initialize administrator access.'
                    : 'Enter the configured administrator passcode to access the CompareX Admin Console.'}
                </p>
                <div>
                  <Label htmlFor="admin-passcode">Administrator Passcode</Label>
                  <Input
                    id="admin-passcode"
                    type="password"
                    required
                    minLength={8}
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    placeholder="Enter 8+ character passcode"
                  />
                </div>
                <Button type="submit" variant="accent" size="sm" className="w-full" disabled={submitting}>
                  {adminConfigured === false ? 'Claim & Open Admin Console' : 'Verify Admin Access'}
                </Button>
              </form>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
