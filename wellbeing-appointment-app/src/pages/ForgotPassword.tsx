import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login',
      });
      if (error) {
        setError(error.message);
      } else {
        setSubmitted(true);
      }
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-2 text-foreground transition-colors duration-300">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-8 flex flex-col items-center text-card-foreground">
        {/* Logo */}
        <div className="flex items-center mb-6 select-none">
          <span className="text-2xl font-extrabold tracking-tight text-foreground">Pre Clinic</span>
          <span className="ml-2 px-2 py-0.5 rounded bg-indigo-500 text-white text-xs font-bold uppercase">email</span>
        </div>
        {/* Heading */}
        <h2 className="text-xl font-bold text-foreground mb-2 text-center">Forgot Your Password?</h2>
        <p className="text-muted-foreground text-sm mb-6 text-center">Enter your email address and we will send you instructions to reset your password.</p>
        {submitted ? (
          <div className="flex flex-col items-center w-full">
            <h2 className="text-2xl font-bold text-green-600 mb-2 text-center">Success!</h2>
            <p className="text-muted-foreground text-base mb-6 text-center">Your password has been sent to your address.</p>
            {/* Mail delivery SVG illustration */}
            <div className="mb-8">
              <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <rect x="60" y="30" width="40" height="25" rx="4" fill="#E0E7FF" />
                  <polygon points="60,30 80,50 100,30" fill="#6366F1" />
                  <polygon points="60,55 80,40 100,55" fill="#A5B4FC" />
                  <ellipse cx="80" cy="65" rx="18" ry="6" fill="#E0E7FF" />
                  <rect x="70" y="20" width="20" height="10" rx="2" fill="#6366F1" />
                  <rect x="75" y="10" width="10" height="10" rx="2" fill="#6366F1" />
                  <circle cx="80" cy="20" r="2" fill="#6366F1" />
                  <rect x="90" y="35" width="8" height="2" rx="1" fill="#6366F1" />
                  <rect x="62" y="35" width="8" height="2" rx="1" fill="#6366F1" />
                </g>
                <g>
                  <rect x="10" y="50" width="30" height="4" rx="2" fill="#CBD5E1" />
                  <rect x="20" y="60" width="20" height="4" rx="2" fill="#CBD5E1" />
                  <rect x="5" y="70" width="25" height="3" rx="1.5" fill="#CBD5E1" />
                </g>
              </svg>
            </div>
            <Link to="/login" className="w-full">
              <button className="w-full bg-indigo-800 hover:bg-indigo-900 text-white font-semibold rounded-lg py-3 text-base transition mt-4">
                LOGIN TO MY ACCOUNT
              </button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email address*</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                className="w-full px-4 py-2 rounded border border-border focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-base transition bg-background text-foreground"
                autoFocus
              />
            </div>
            {error && <div className="text-red-600 text-sm text-center">{error}</div>}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2.5 text-base transition disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Continue'}
            </button>
          </form>
        )}
        <Link to="/login" className="mt-6 text-indigo-600 hover:text-indigo-800 text-sm font-medium transition">
          Back to Login
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword; 