import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authAPI.login(form);
      login(data.access_token, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 via-[#0a1628] to-[#061220] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-6xl">🌊</span>
          <h1 className="text-3xl font-bold text-white mt-3">Marine Plastic Detection</h1>
          <p className="text-white/50 mt-1">Sign in to your account</p>
        </div>
        <div className="card p-8">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handle} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <input
                id="login-email"
                className="input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                id="login-password"
                className="input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button id="login-btn" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-white/50 text-sm mt-6">
            No account?{' '}
            <Link to="/register" className="text-ocean-400 hover:text-ocean-300">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
