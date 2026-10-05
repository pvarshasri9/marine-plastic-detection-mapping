import { useState, useEffect } from 'react';
import { analyticsAPI } from '../api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const COLORS = ['#00bcd4', '#26c6da', '#009688', '#e91e63', '#9c27b0', '#ff9800', '#4caf50'];

export default function Analytics() {
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      // APIs already unwrap .data in api.ts — don't call .data again
      const [sumRes, catRes, trendRes, locRes] = await Promise.all([
        analyticsAPI.summary(),
        analyticsAPI.categories(),
        analyticsAPI.trends(),
        analyticsAPI.locations(),
      ]);
      setSummary(sumRes);
      setCategories(Array.isArray(catRes) ? catRes : []);
      setTrends(Array.isArray(trendRes) ? trendRes : []);
      setLocations(Array.isArray(locRes) ? locRes : []);
    } catch (err) {
      console.error('Failed to load analytics', err);
      setError('Failed to load analytics. Backend may be unavailable.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-white/60">
        <div className="animate-spin text-3xl mr-3">🌀</div> Loading Analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-400">{error}</p>
        <button className="btn-secondary" onClick={fetchAnalytics}>Retry</button>
      </div>
    );
  }

  const isEmpty = !summary || summary.total_images === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">📈 Debris Analytics</h1>
        <p className="text-white/60 text-sm">Statistical breakdown of detected ocean debris — all values from database records</p>
      </div>

      {/* Summary KPI Cards — use actual backend field names */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-3xl">📊</span>
            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-mono">TOTAL</span>
          </div>
          <p className="text-3xl font-extrabold text-white mt-2">{summary?.total_images ?? 0}</p>
          <p className="text-xs text-white/60">Images Analyzed</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-3xl">🍾</span>
            <span className="text-xs bg-ocean-500/20 text-ocean-400 px-2 py-0.5 rounded font-mono">OBJECTS</span>
          </div>
          <p className="text-3xl font-extrabold text-ocean-400 mt-2">{summary?.total_objects ?? 0}</p>
          <p className="text-xs text-white/60">Plastic Objects Detected</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-3xl">📍</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono">LOCATIONS</span>
          </div>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">{summary?.detection_locations ?? 0}</p>
          <p className="text-xs text-white/60">Unique Locations Observed</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-3xl">🏷️</span>
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono">CATEGORIES</span>
          </div>
          <p className="text-3xl font-extrabold text-amber-400 mt-2">{summary?.plastic_categories ?? 0}</p>
          <p className="text-xs text-white/60">Plastic Categories Found</p>
        </div>
      </div>

      {isEmpty ? (
        <div className="glass-card p-12 rounded-2xl border border-white/10 text-center">
          <p className="text-4xl mb-4">🌊</p>
          <p className="text-white font-medium text-lg">No data available yet.</p>
          <p className="text-white/50 text-sm mt-2">Analyze images or load the demo dataset to populate analytics.</p>
        </div>
      ) : (
        <>
          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Distribution Pie Chart */}
            <div className="glass-card p-5 rounded-2xl border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-1">Plastic Category Breakdown</h2>
              <p className="text-xs text-white/50 mb-4">Distribution of detected plastic types</p>
              <div className="h-64">
                {categories.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categories}
                        dataKey="count"
                        nameKey="plastic_type"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={45}
                        paddingAngle={4}
                        label={({ name, percent }: { name?: string; percent?: number }) =>
                          `${(name || '').replace(/_/g, ' ')} (${((percent || 0) * 100).toFixed(0)}%)`}
                      >
                        {categories.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: any) => [v, 'Count']}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-white/40 text-sm flex items-center justify-center h-full">No category data yet.</p>
                )}
              </div>
            </div>

            {/* Monthly Trend Line Chart */}
            <div className="glass-card p-5 rounded-2xl border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-1">Detection Trend Over Time</h2>
              <p className="text-xs text-white/50 mb-4">Daily detection and object counts</p>
              <div className="h-64">
                {trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                      <Line type="monotone" dataKey="detections" stroke="#00bcd4" strokeWidth={2} dot={{ fill: '#00bcd4', r: 4 }} name="Detections" />
                      <Line type="monotone" dataKey="objects" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} name="Objects" />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-white/40 text-sm flex items-center justify-center h-full">No trend data yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Location Bar Chart */}
          <div className="glass-card p-5 rounded-2xl border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-1">Detections by Location</h2>
            <p className="text-xs text-white/50 mb-4">Number of detections per recorded location</p>
            <div className="h-64">
              {locations.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={locations}>
                    <XAxis dataKey="location" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                    <Bar dataKey="count" fill="#00bcd4" radius={[6, 6, 0, 0]} name="Detections" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-white/40 text-sm flex items-center justify-center h-full">No location data yet.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
