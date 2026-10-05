import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';

const links = [
  { to: '/dashboard', label: '📊 Dashboard' },
  { to: '/detect', label: '🔍 Detect Plastic' },
  { to: '/history', label: '📋 History' },
  { to: '/map', label: '🗺 Plastic Map' },
  { to: '/analytics', label: '📈 Analytics' },
  { to: '/hotspots', label: '🔥 Hotspot Intelligence' },
  { to: '/reports', label: '📄 Reports' },
  { to: '/profile', label: '👤 Profile' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 min-h-screen bg-navy-900 border-r border-white/10 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🌊</span>
          <div>
            <p className="font-bold text-ocean-400 text-sm leading-tight">Marine Plastic</p>
            <p className="text-white/50 text-xs">Detection & Mapping</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-ocean-500/20 text-ocean-400 border border-ocean-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="p-4 border-t border-white/10">
        <div className="mb-3 px-3">
          <p className="text-xs text-white/40">Logged in as</p>
          <p className="text-sm font-medium text-white truncate">{user?.name}</p>
          <p className="text-xs text-white/40 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full btn-secondary text-sm text-red-400 hover:text-red-300"
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  );
}
