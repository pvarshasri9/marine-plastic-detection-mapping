import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const data = await authAPI.register(form);
      login(data.access_token, data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 via-[#0a1628] to-[#061220] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-6xl">🌊</span>
          <h1 className="text-3xl font-bold text-white mt-3">Create Account</h1>
          <p className="text-white/50 mt-1">Join Marine Plastic Detection</p>
        </div>
        <div className="card p-8">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handle} className="space-y-4">
            {[
              { id: 'reg-name', key: 'name', label: 'Full Name', type: 'text', ph: 'Your name' },
              { id: 'reg-email', key: 'email', label: 'Email', type: 'email', ph: 'you@example.com' },
              { id: 'reg-password', key: 'password', label: 'Password (min 8 chars)', type: 'password', ph: '••••••••' },
              { id: 'reg-confirm', key: 'confirm_password', label: 'Confirm Password', type: 'password', ph: '••••••••' },
            ].map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input
                  id={f.id}
                  className="input"
                  type={f.type}
                  placeholder={f.ph}
                  value={(form as any)[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  required
                />
              </div>
            ))}
            <button id="register-btn" className="btn-primary w-full py-3 mt-2" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-white/50 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-ocean-400 hover:text-ocean-300">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
