import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout();
    navigate('/login');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">👤 User Profile & Account Settings</h1>
        <p className="text-white/60 text-sm">Authenticated research account details and system roles</p>
      </div>

      <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-6">
        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
          <div className="w-16 h-16 rounded-full bg-ocean-500/20 border border-ocean-500/30 flex items-center justify-center text-3xl font-bold text-ocean-400">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user?.name}</h2>
            <p className="text-sm text-white/60">{user?.email}</p>
            <span className="mt-2 inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase">
              {user?.role || 'Researcher'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-sm text-white/60">Full Name</span>
            <span className="text-sm font-medium text-white">{user?.name}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-sm text-white/60">Email Address</span>
            <span className="text-sm font-medium text-white">{user?.email}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-sm text-white/60">System Role</span>
            <span className="text-sm font-medium text-white capitalize">{user?.role || 'User'}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-sm text-white/60">Account Created</span>
            <span className="text-sm font-medium text-white">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}
            </span>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={handleLogout}
            className="btn-secondary text-red-400 hover:text-red-300 border-red-500/30 hover:bg-red-500/10 text-sm px-5 py-2.5"
          >
            🚪 Sign Out of Account
          </button>
        </div>
      </div>
    </div>
  );
}
