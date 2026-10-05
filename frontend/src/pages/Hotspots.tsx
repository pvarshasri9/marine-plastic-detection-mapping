import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { hotspotsAPI, getImageUrl } from '../api';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PRIORITY_COLORS = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

export default function Hotspots() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [hotspotsData, setHotspotsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedHotspot, setSelectedHotspot] = useState<any>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Status updating state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showMethodology, setShowMethodology] = useState(false);

  useEffect(() => {
    fetchHotspots();
  }, []);

  const fetchHotspots = async (preserveSelectedKey?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await hotspotsAPI.list();
      setHotspotsData(res);

      const list = res.hotspots || [];
      const keyToSelect = preserveSelectedKey || searchParams.get('key') || searchParams.get('location');

      if (keyToSelect && list.length > 0) {
        const found = list.find((h: any) =>
          h.hotspot_key === keyToSelect ||
          h.location_name.toLowerCase() === keyToSelect.toLowerCase()
        );
        if (found) {
          setSelectedHotspot(found);
          setNewStatus(found.cleanup_status);
        } else if (list.length > 0) {
          setSelectedHotspot(list[0]);
          setNewStatus(list[0].cleanup_status);
        }
      } else if (list.length > 0 && !selectedHotspot) {
        setSelectedHotspot(list[0]);
        setNewStatus(list[0].cleanup_status);
      }
    } catch (err: any) {
      console.error('Failed to load Hotspot Intelligence', err);
      setError('Unable to load hotspot analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectHotspot = (h: any) => {
    setSelectedHotspot(h);
    setNewStatus(h.cleanup_status);
    setStatusNotes('');
    setStatusMessage('');
    setSearchParams({ key: h.hotspot_key });
  };

  const handleUpdateStatus = async () => {
    if (!selectedHotspot || !newStatus) return;
    setUpdatingStatus(true);
    setStatusMessage('');
    try {
      await hotspotsAPI.updateStatus({
        hotspot_key: selectedHotspot.hotspot_key,
        location_name: selectedHotspot.location_name,
        center_lat: selectedHotspot.center_lat,
        center_lon: selectedHotspot.center_lon,
        status: newStatus,
        notes: statusNotes || undefined,
      });

      setStatusMessage(`Status updated to "${newStatus}" successfully.`);
      setStatusNotes('');

      // Refresh data while preserving current selected hotspot
      await fetchHotspots(selectedHotspot.hotspot_key);
    } catch (err: any) {
      setStatusMessage(err.response?.data?.detail || 'Failed to update cleanup status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredHotspots = useMemo(() => {
    if (!hotspotsData?.hotspots) return [];
    return hotspotsData.hotspots.filter((h: any) => {
      const matchesSearch =
        h.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (h.top_plastic_types || []).some((t: string) => t.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesPriority = priorityFilter === 'ALL' || h.priority === priorityFilter;
      const matchesStatus = statusFilter === 'ALL' || h.cleanup_status === statusFilter;
      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [hotspotsData, searchTerm, priorityFilter, statusFilter]);

  // Map coordinates
  const mapHotspots = useMemo(() => {
    if (!hotspotsData?.hotspots) return [];
    return hotspotsData.hotspots.filter((h: any) => h.has_coordinates);
  }, [hotspotsData]);

  const mapCenter: [number, number] = useMemo(() => {
    if (selectedHotspot && selectedHotspot.has_coordinates) {
      return [selectedHotspot.center_lat, selectedHotspot.center_lon];
    }
    if (mapHotspots.length > 0) {
      return [mapHotspots[0].center_lat, mapHotspots[0].center_lon];
    }
    return [13.0827, 80.2707]; // Fallback to Indian coastline
  }, [selectedHotspot, mapHotspots]);

  if (loading && !hotspotsData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-10 h-10 border-4 border-ocean-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white/60 text-sm">Loading hotspot analysis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-10 text-center max-w-lg mx-auto border border-red-500/20 rounded-2xl my-10 space-y-4">
        <span className="text-4xl">⚠️</span>
        <h3 className="text-lg font-bold text-white">Analysis Unavailable</h3>
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={() => fetchHotspots()} className="btn-secondary px-6 py-2">
          Retry Analysis
        </button>
      </div>
    );
  }

  const summary = hotspotsData?.summary || {
    total_hotspots: 0,
    high_priority: 0,
    medium_priority: 0,
    low_priority: 0,
    total_objects_in_hotspots: 0,
    total_observations: 0,
    status_breakdown: {},
    all_demo: false,
    demo_records_count: 0,
    ai_records_count: 0,
    insufficient_location_count: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">🔥 Hotspot Intelligence</h1>
            <span className="bg-ocean-500/20 border border-ocean-400/30 text-ocean-300 text-xs px-2.5 py-0.5 rounded-full font-mono">
              v2.0 System
            </span>
          </div>
          <p className="text-white/60 text-sm mt-1">
            System-generated cleanup priority based on recorded observations.
            <span className="text-white/40 ml-1">Not an official environmental risk model.</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMethodology(!showMethodology)}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
            title="Inspect calculation methodology"
          >
            <span>ℹ️</span>
            <span>{showMethodology ? 'Hide Methodology' : 'Scoring Formula'}</span>
          </button>
          <Link to="/map" className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
            <span>🗺️</span>
            <span>View Full Map</span>
          </Link>
        </div>
      </div>

      {/* Demo Mode / Source Banner */}
      {summary.all_demo ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-300 flex items-start gap-2.5">
          <span className="text-base leading-none">⚠️</span>
          <div>
            <strong>Demonstration Data:</strong> These hotspot results are based on demonstration records and must not be interpreted as real environmental measurements.
            <span className="opacity-75 ml-1">({summary.demo_records_count} demo observations analysed).</span>
          </div>
        </div>
      ) : summary.demo_records_count > 0 ? (
        <div className="bg-ocean-500/10 border border-ocean-500/30 rounded-xl px-4 py-3 text-xs text-ocean-300 flex items-start gap-2.5">
          <span className="text-base leading-none">ℹ️</span>
          <div>
            <strong>Mixed Dataset:</strong> Analysis encompasses {summary.ai_records_count} AI model observations and {summary.demo_records_count} demonstration records. Each observation is clearly tagged below.
          </div>
        </div>
      ) : null}

      {/* Methodology Collapsible Box */}
      {showMethodology && (
        <div className="card p-6 border border-ocean-500/30 bg-slate-900/90 rounded-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>📐</span> Deterministic Priority Scoring Calculation
            </h3>
            <span className="text-xs text-white/50 font-mono">Normalized scale: 0 — 100</span>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">
            Priority scores are calculated exclusively from verified database metrics. No random numbers or subjective scores are used.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-ocean-400 font-bold block mb-1">1. Volume (35%)</span>
              <p className="text-white/60">Normalized up to 20 recorded plastic objects per cluster.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-cyan-400 font-bold block mb-1">2. Frequency (25%)</span>
              <p className="text-white/60">Normalized up to 5 recorded observation sessions at the site.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-amber-400 font-bold block mb-1">3. Recency (20%)</span>
              <p className="text-white/60">Decay scale: 20 pts (≤7d), 15 pts (≤14d), 10 pts (≤30d), 5 pts (≤60d).</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-purple-400 font-bold block mb-1">4. Persistence (10%)</span>
              <p className="text-white/60">Recurring detection spread over multiple days/weeks.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-emerald-400 font-bold block mb-1">5. Material Impact (10%)</span>
              <p className="text-white/60">Proportion of high-entanglement fishing nets and rigid containers.</p>
            </div>
          </div>
          <div className="pt-2 text-xs text-white/50 border-t border-white/5 flex gap-4">
            <span><strong>High Priority:</strong> ≥ 65.0 pts</span>
            <span><strong>Medium Priority:</strong> 35.0 — 64.9 pts</span>
            <span><strong>Low Priority:</strong> &lt; 35.0 pts</span>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-5 rounded-2xl border border-white/10">
          <p className="text-xs text-white/50 uppercase font-medium">Total Hotspots</p>
          <p className="text-3xl font-extrabold text-white mt-1.5">{summary.total_hotspots}</p>
          <p className="text-xs text-white/40 mt-1">Identified location clusters</p>
        </div>

        <div className="card p-5 rounded-2xl border border-red-500/20 bg-red-500/5">
          <p className="text-xs text-red-400 uppercase font-medium">High Priority</p>
          <p className="text-3xl font-extrabold text-red-400 mt-1.5">{summary.high_priority}</p>
          <p className="text-xs text-red-300/60 mt-1">Score ≥ 65 (Urgent)</p>
        </div>

        <div className="card p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <p className="text-xs text-amber-400 uppercase font-medium">Medium Priority</p>
          <p className="text-3xl font-extrabold text-amber-400 mt-1.5">{summary.medium_priority}</p>
          <p className="text-xs text-amber-300/60 mt-1">Score 35 — 64.9</p>
        </div>

        <div className="card p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-xs text-emerald-400 uppercase font-medium">Low Priority</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-1.5">{summary.low_priority}</p>
          <p className="text-xs text-emerald-300/60 mt-1">Score &lt; 35</p>
        </div>
      </div>

      {/* Insufficient location info notice if any */}
      {summary.insufficient_location_count > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/60">
          📍 Note: {summary.insufficient_location_count} observation(s) lacked valid coordinates and location names, so they were excluded from geographic clustering.
        </div>
      )}

      {/* Main Content Layout: Map + Ranking Table + Detail Panel */}
      {summary.total_hotspots === 0 ? (
        <div className="card p-12 text-center border border-white/10 rounded-2xl space-y-3">
          <span className="text-4xl">📋</span>
          <h3 className="text-lg font-bold text-white">No Hotspot Data Available</h3>
          <p className="text-white/50 text-sm max-w-md mx-auto">
            No detection records are available for hotspot analysis. Analyze coastal images via the Detect tab or load demo records to identify high-priority clusters.
          </p>
          <Link to="/detect" className="btn-primary inline-block px-5 py-2 mt-2">
            Upload & Detect Plastic
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Interactive Map & Detail View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Map Column (7 cols) */}
            <div className="lg:col-span-7 card p-0 overflow-hidden border border-white/10 rounded-2xl flex flex-col">
              <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Geographic Hotspot Map</h3>
                  <p className="text-xs text-white/50 mt-0.5">Click any cluster circle to inspect details</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-red-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> High
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Med
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Low
                  </span>
                </div>
              </div>

              {mapHotspots.length === 0 ? (
                <div className="h-96 flex flex-col items-center justify-center p-6 text-center text-white/50">
                  <span className="text-3xl mb-2">🗺️</span>
                  <p className="text-sm">No geographic coordinates are available for these records.</p>
                  <p className="text-xs text-white/40 mt-1">Records are grouped by location name in the table below.</p>
                </div>
              ) : (
                <div className="h-[420px] w-full relative z-0">
                  <MapContainer
                    center={mapCenter}
                    zoom={mapHotspots.length === 1 ? 9 : 6}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {mapHotspots.map((h: any) => {
                      const color = PRIORITY_COLORS[h.priority as keyof typeof PRIORITY_COLORS] || '#10b981';
                      const isSelected = selectedHotspot?.hotspot_key === h.hotspot_key;
                      return (
                        <CircleMarker
                          key={h.hotspot_key}
                          center={[h.center_lat, h.center_lon]}
                          radius={isSelected ? 18 : 12}
                          pathOptions={{
                            color: color,
                            fillColor: color,
                            fillOpacity: isSelected ? 0.8 : 0.5,
                            weight: isSelected ? 3 : 1.5,
                          }}
                          eventHandlers={{
                            click: () => selectHotspot(h),
                          }}
                        >
                          <Popup>
                            <div className="p-1 text-slate-900 text-xs space-y-1">
                              <p className="font-bold text-sm">{h.location_name}</p>
                              <p>
                                <strong>System Priority:</strong>{' '}
                                <span style={{ color: color, fontWeight: 'bold' }}>{h.priority}</span> ({h.priority_score})
                              </p>
                              <p><strong>Objects:</strong> {h.total_objects} across {h.observation_count} obs</p>
                              <p><strong>Trend:</strong> {h.trend} {h.trend_symbol}</p>
                              <p><strong>Status:</strong> {h.cleanup_status}</p>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </div>
              )}
            </div>

            {/* Selected Hotspot Detail Panel (5 cols) */}
            <div className="lg:col-span-5 flex flex-col">
              {selectedHotspot ? (
                <div className="card p-6 border border-white/10 rounded-2xl space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Location Title & Badges */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-ocean-400 font-bold text-sm">#{selectedHotspot.rank}</span>
                          <h2 className="text-xl font-bold text-white">{selectedHotspot.location_name}</h2>
                        </div>
                        {selectedHotspot.has_coordinates ? (
                          <p className="text-xs text-white/50 font-mono mt-0.5">
                            📍 {selectedHotspot.center_lat?.toFixed(4)}, {selectedHotspot.center_lon?.toFixed(4)}
                          </p>
                        ) : (
                          <p className="text-xs text-white/40 mt-0.5">📍 Coordinates unavailable (grouped by name)</p>
                        )}
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                            selectedHotspot.priority === 'HIGH'
                              ? 'bg-red-500/20 text-red-400 border-red-500/40'
                              : selectedHotspot.priority === 'MEDIUM'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          }`}
                        >
                          {selectedHotspot.priority} PRIORITY
                        </span>
                        <p className="text-xs font-mono text-white/70 mt-1">Score: {selectedHotspot.priority_score}/100</p>
                      </div>
                    </div>

                    {/* "Why?" Explanation Box */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1">
                      <p className="text-xs text-ocean-300 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                        <span>💡</span> Why this Priority?
                      </p>
                      <p className="text-xs text-white/80 leading-relaxed">{selectedHotspot.explanation}</p>
                    </div>

                    {/* Quick Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2.5 bg-black/30 rounded-lg border border-white/5">
                        <p className="text-white/40 text-[10px] uppercase">Objects</p>
                        <p className="text-base font-bold text-cyan-400 mt-0.5">{selectedHotspot.total_objects}</p>
                      </div>
                      <div className="p-2.5 bg-black/30 rounded-lg border border-white/5">
                        <p className="text-white/40 text-[10px] uppercase">Observations</p>
                        <p className="text-base font-bold text-white mt-0.5">{selectedHotspot.observation_count}</p>
                      </div>
                      <div className="p-2.5 bg-black/30 rounded-lg border border-white/5">
                        <p className="text-white/40 text-[10px] uppercase">Trend</p>
                        <p className="text-base font-bold text-amber-300 mt-0.5 flex items-center justify-center gap-1">
                          <span>{selectedHotspot.trend_symbol}</span>
                          <span className="text-xs truncate">{selectedHotspot.trend}</span>
                        </p>
                      </div>
                    </div>

                    {/* Trend Description */}
                    <div className="text-xs text-white/60 bg-white/3 rounded-lg p-2.5 border border-white/5 flex items-start gap-2">
                      <span className="text-amber-400">📈</span>
                      <span>{selectedHotspot.trend_description}</span>
                    </div>

                    {/* Top Plastic Categories */}
                    {selectedHotspot.top_plastic_types?.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-white/50 font-medium">Predominant Plastic Categories:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedHotspot.top_plastic_types.map((type: string, i: number) => (
                            <span key={i} className="text-[11px] bg-white/10 text-white/80 px-2 py-0.5 rounded capitalize">
                              {type.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cleanup Workflow Box */}
                    <div className="p-4 bg-ocean-500/5 border border-ocean-500/20 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-ocean-300 font-bold uppercase tracking-wider">Cleanup Workflow Status</p>
                        <span className="text-[11px] text-white/60 font-mono bg-white/10 px-2 py-0.5 rounded">
                          Current: {selectedHotspot.cleanup_status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          className="input text-xs py-1.5"
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Inspection">Inspection</option>
                          <option value="Cleanup Scheduled">Cleanup Scheduled</option>
                          <option value="Cleaned">Cleaned</option>
                        </select>

                        <button
                          onClick={handleUpdateStatus}
                          disabled={updatingStatus || newStatus === selectedHotspot.cleanup_status}
                          className="btn-primary text-xs py-1.5 disabled:opacity-50"
                        >
                          {updatingStatus ? 'Updating...' : 'Update Status'}
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Optional audit notes (e.g. Scheduled for Saturday morning)"
                        value={statusNotes}
                        onChange={(e) => setStatusNotes(e.target.value)}
                        className="input text-xs w-full py-1.5"
                      />

                      {statusMessage && (
                        <p className="text-xs text-ocean-300 font-medium">{statusMessage}</p>
                      )}

                      {/* Status History Timeline */}
                      {selectedHotspot.cleanup_history?.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-white/10">
                          <p className="text-[11px] text-white/40 uppercase font-bold">Status History Audit Log</p>
                          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                            {selectedHotspot.cleanup_history.map((item: any, idx: number) => (
                              <div key={idx} className="text-[11px] text-white/60 flex justify-between bg-black/20 p-1.5 rounded">
                                <span>{item.previous_status} → <strong>{item.new_status}</strong></span>
                                <span className="text-white/40">
                                  {item.changed_at ? new Date(item.changed_at).toLocaleDateString() : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 text-xs text-white/40 flex justify-between">
                    <span>First: {selectedHotspot.first_observed ? new Date(selectedHotspot.first_observed).toLocaleDateString() : '—'}</span>
                    <span>Latest: {selectedHotspot.latest_observed ? new Date(selectedHotspot.latest_observed).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
              ) : (
                <div className="card p-10 text-center border border-white/10 rounded-2xl flex-1 flex flex-col justify-center text-white/40">
                  <p>Select a hotspot to view detailed intelligence.</p>
                </div>
              )}
            </div>
          </div>

          {/* Priority Ranking Table (Requirement 8) */}
          <div className="card p-0 overflow-hidden border border-white/10 rounded-2xl">
            <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-base font-bold text-white tracking-wide">Hotspot Priority Ranking</h2>
                <p className="text-xs text-white/50 mt-0.5">Ranked by System Priority Score (highest cleanup urgency first)</p>
              </div>

              {/* Table Filters */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search location or plastic..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input text-xs py-1.5 px-3 w-44"
                />

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="input text-xs py-1.5 px-2"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="LOW">Low Priority</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input text-xs py-1.5 px-2"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Cleanup Scheduled">Cleanup Scheduled</option>
                  <option value="Cleaned">Cleaned</option>
                </select>
              </div>
            </div>

            {filteredHotspots.length === 0 ? (
              <div className="p-10 text-center text-white/40 text-sm">
                No hotspots match the applied search and filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-white/60 uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Rank</th>
                      <th className="px-5 py-3">Location</th>
                      <th className="px-5 py-3">Total Objects</th>
                      <th className="px-5 py-3">Observations</th>
                      <th className="px-5 py-3">Recent Activity</th>
                      <th className="px-5 py-3">Trend</th>
                      <th className="px-5 py-3">Cleanup Status</th>
                      <th className="px-5 py-3">System Priority</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-white/80">
                    {filteredHotspots.map((h: any) => {
                      const isSelected = selectedHotspot?.hotspot_key === h.hotspot_key;
                      return (
                        <tr
                          key={h.hotspot_key}
                          onClick={() => selectHotspot(h)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-ocean-500/15' : 'hover:bg-white/5'
                          }`}
                        >
                          <td className="px-5 py-3.5 font-mono font-bold text-ocean-400">#{h.rank}</td>
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-white block">{h.location_name}</span>
                            {h.has_coordinates && (
                              <span className="text-[10px] text-white/40 font-mono">
                                {h.center_lat?.toFixed(3)}, {h.center_lon?.toFixed(3)}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-cyan-400">{h.total_objects}</td>
                          <td className="px-5 py-3.5">{h.observation_count} obs</td>
                          <td className="px-5 py-3.5 text-white/60">
                            {h.days_since_latest !== null ? (
                              h.days_since_latest < 1 ? (
                                <span className="text-emerald-400 font-semibold">Today</span>
                              ) : (
                                `${h.days_since_latest}d ago`
                              )
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-amber-300">
                              {h.trend_symbol} {h.trend}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="bg-white/10 px-2 py-0.5 rounded text-[11px] font-medium">
                              {h.cleanup_status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                h.priority === 'HIGH'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : h.priority === 'MEDIUM'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {h.priority} ({h.priority_score})
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectHotspot(h);
                              }}
                              className={`text-xs px-2.5 py-1 rounded transition ${
                                isSelected ? 'btn-primary' : 'btn-secondary'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Inspect'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Observations History for Selected Hotspot (Requirement 12) */}
          {selectedHotspot && selectedHotspot.observations?.length > 0 && (
            <div className="card p-0 overflow-hidden border border-white/10 rounded-2xl space-y-0">
              <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>🔬</span> Detection Observations for {selectedHotspot.location_name}
                  </h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    Click any detection to view its full analytical result and uploaded photograph
                  </p>
                </div>
                <span className="text-xs font-mono text-white/60">
                  {selectedHotspot.observations.length} record(s)
                </span>
              </div>

              <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                {selectedHotspot.observations.map((obs: any) => (
                  <div key={obs.id} className="p-4 hover:bg-white/3 transition flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                        <img
                          src={obs.original_image_path ? getImageUrl(obs.original_image_path) : ''}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/detect?id=${obs.id}`}
                            className="font-bold text-ocean-400 hover:underline text-sm font-mono"
                          >
                            Detection #{obs.id}
                          </Link>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              obs.detection_source === 'DEMO'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {obs.detection_source}
                          </span>
                        </div>
                        <p className="text-xs text-white/50 mt-0.5">
                          {obs.date ? new Date(obs.date).toLocaleString() : 'Date N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-cyan-400 font-bold text-sm">{obs.total_objects} Objects</p>
                        <p className="text-white/40 text-[11px] truncate max-w-xs">
                          {obs.plastic_types?.length > 0
                            ? obs.plastic_types.map((t: string) => t.replace(/_/g, ' ')).join(', ')
                            : 'No specific types'}
                        </p>
                      </div>

                      <Link
                        to={`/detect?id=${obs.id}`}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 shrink-0"
                      >
                        <span>View Result</span>
                        <span>↗</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
