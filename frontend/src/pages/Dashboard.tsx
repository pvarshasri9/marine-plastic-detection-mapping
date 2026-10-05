import { useEffect, useState } from 'react';
import { analyticsAPI, demoAPI } from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#00bcd4', '#26c6da', '#4dd0e1', '#80deea', '#b2ebf2', '#f06292', '#ce93d8', '#ffcc02'];

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMsg, setDemoMsg] = useState('');

  const fetchAll = () => {
    setLoading(true);
    setError('');
    Promise.all([
      analyticsAPI.summary(),
      analyticsAPI.categories(),
      analyticsAPI.trends(),
      analyticsAPI.locations(),
    ]).then(([s, c, t, l]) => {
      setSummary(s);
      setCategories(Array.isArray(c) ? c : []);
      setTrends(Array.isArray(t) ? t : []);
      setLocations(Array.isArray(l) ? l : []);
    }).catch(() => {
      setError('Failed to load dashboard data. Make sure the backend is running.');
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    setDemoMsg('');
    try {
      const res = await demoAPI.load();
      setDemoMsg(`✅ ${res.message || 'Demo dataset loaded.'}`);
      fetchAll(); // Refresh all stats
    } catch (err: any) {
      setDemoMsg(`❌ ${err.response?.data?.detail || 'Failed to load demo data.'}`);
    } finally {
      setDemoLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-white/50">
      <div className="animate-spin text-3xl mr-3">🌀</div> Loading dashboard...
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-red-400">{error}</p>
      <button className="btn-secondary" onClick={fetchAll}>Retry</button>
    </div>
  );

  const isEmpty = !summary || summary.total_images === 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-white/50 text-sm mt-1">Overview of your detection activity — all values from database</p>
        </div>

        {/* Demo Dataset Button */}
        <div className="flex flex-col items-end gap-2">
          <button
            id="load-demo-btn"
            onClick={handleLoadDemo}
            disabled={demoLoading}
            className="btn-primary flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
          >
            {demoLoading ? '⏳ Loading Demo...' : '🗃️ Load Demo Dataset'}
          </button>
          {demoMsg && (
            <p className={`text-xs px-3 py-1.5 rounded-lg border ${
              demoMsg.startsWith('✅')
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {demoMsg}
            </p>
          )}
          <p className="text-xs text-white/30">⚠ Demo data — not real-world observations</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Images Analyzed', value: summary?.total_images ?? 0, icon: '🖼️' },
          { label: 'Plastic Objects', value: summary?.total_objects ?? 0, icon: '🗑️' },
          { label: 'Locations', value: summary?.detection_locations ?? 0, icon: '📍' },
          { label: 'Categories', value: summary?.plastic_categories ?? 0, icon: '🏷️' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <span className="text-3xl">{s.icon}</span>
            <span className="text-3xl font-bold text-ocean-400">{s.value}</span>
            <span className="text-sm text-white/50">{s.label}</span>
          </div>
        ))}
      </div>

      {isEmpty ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">🌊</p>
          <p className="text-white text-lg font-medium">No detection data available yet.</p>
          <p className="text-white/50 text-sm mt-2">Analyze an image or use the <strong>Load Demo Dataset</strong> button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category chart */}
          <div className="card p-6">
            <h2 className="font-semibold text-white mb-4">Plastic Type Distribution</h2>
            {categories.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="count"
                    nameKey="plastic_type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${(name || '').replace(/_/g, ' ')} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-white/40 text-sm">No data yet.</p>}
          </div>

          {/* Trend chart */}
          <div className="card p-6">
            <h2 className="font-semibold text-white mb-4">Detection Trend</h2>
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trends}>
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="detections" stroke="#00bcd4" strokeWidth={2} dot={false} name="Detections" />
                  <Line type="monotone" dataKey="objects" stroke="#f06292" strokeWidth={2} dot={false} name="Objects" />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-white/40 text-sm">No trend data yet.</p>}
          </div>

          {/* Location chart */}
          <div className="card p-6 lg:col-span-2">
            <h2 className="font-semibold text-white mb-4">Detections by Location</h2>
            {locations.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={locations}>
                  <XAxis dataKey="location" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#00bcd4" radius={[4, 4, 0, 0]} name="Detections" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-white/40 text-sm">No location data yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
