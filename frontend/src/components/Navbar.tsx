import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <header className="bg-navy-900/60 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <span className="text-xl">🌊</span>
        <h1 className="text-base font-bold text-white tracking-wide">
          Marine Plastic Detection & Mapping System
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-navy-800 border border-white/10 px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs text-white/70 font-mono">System Online</span>
        </div>

        <div className="text-right text-xs">
          <p className="font-semibold text-white">{user?.name}</p>
          <p className="text-white/40 text-[10px]">{user?.role || 'Researcher'}</p>
        </div>
      </div>
    </header>
  );
}
