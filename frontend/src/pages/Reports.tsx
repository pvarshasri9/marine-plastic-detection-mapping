import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { detectionsAPI, reportsAPI, exportAPI, analyticsAPI, hotspotsAPI } from '../api';

export default function Reports() {
  const [detections, setDetections] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [hotspotData, setHotspotData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [exportingHotspots, setExportingHotspots] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // detectionsAPI.list() already returns r.data — do NOT call .data again
      const [dets, summ, hs] = await Promise.all([
        detectionsAPI.list(),
        analyticsAPI.summary(),
        hotspotsAPI.list().catch(() => null),
      ]);
      setDetections(Array.isArray(dets) ? dets : []);
      setSummary(summ);
      setHotspotData(hs);
    } catch (err) {
      console.error('Failed to load report data', err);
      setError('Failed to load data. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (id: number) => {
    setDownloadingId(id);
    try {
      const blob = await reportsAPI.download(id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Marine_Plastic_Report_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate PDF report. Please try again.');
      console.error('PDF download error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadCSV = async () => {
    setDownloadingCsv(true);
    try {
      const blob = await exportAPI.csv();
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `marine_plastic_detections_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export CSV dataset.');
      console.error('CSV export error:', err);
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handleExportHotspotCSV = () => {
    if (!hotspotData?.hotspots?.length) return;
    setExportingHotspots(true);
    try {
      const headers = ['Rank', 'Location', 'Latitude', 'Longitude', 'System Priority', 'Score', 'Total Objects', 'Observations', 'Trend', 'Cleanup Status', 'Last Observation'];
      const rows = hotspotData.hotspots.map((h: any) => [
        h.rank,
        `"${(h.location_name || '').replace(/"/g, '""')}"`,
        h.latitude ?? '',
        h.longitude ?? '',
        h.priority_level,
        h.priority_score,
        h.total_objects,
        h.observation_count,
        h.trend,
        h.cleanup_status,
        `"${h.latest_observation || ''}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `marine_hotspot_intelligence_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExportingHotspots(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-white/60">
        <div className="animate-spin text-3xl mr-3">🌀</div> Loading Reports...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-400">{error}</p>
        <button className="btn-secondary" onClick={fetchData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">📄 Report & Data Export Center</h1>
          <p className="text-white/60 text-sm">Download PDF audit reports for individual scans or export the full dataset as CSV</p>
        </div>

        <button
          onClick={handleDownloadCSV}
          disabled={downloadingCsv || detections.length === 0}
          id="export-csv-btn"
          className="btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
        >
          {downloadingCsv ? '⏳ Exporting...' : '📥 Export Full CSV Dataset'}
        </button>
      </div>

      {/* Summary bar */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Scans', value: summary.total_images ?? 0 },
            { label: 'Objects Detected', value: summary.total_objects ?? 0 },
            { label: 'Locations', value: summary.detection_locations ?? 0 },
            { label: 'Categories', value: summary.plastic_categories ?? 0 },
          ].map(s => (
            <div key={s.label} className="glass-card p-4 rounded-xl border border-white/10 text-center">
              <p className="text-2xl font-bold text-ocean-400">{s.value}</p>
              <p className="text-xs text-white/50 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Hotspot Intelligence Summary (Requirement 16) */}
      {hotspotData?.summary && (
        <div className="glass-card rounded-2xl p-6 border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-transparent space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <h2 className="text-lg font-bold text-white tracking-wide uppercase">Hotspot Intelligence Summary</h2>
              </div>
              <p className="text-xs text-white/50 mt-1">
                System-generated cleanup priority based on recorded observations. Not an official environmental risk model.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportHotspotCSV}
                disabled={exportingHotspots || !hotspotData?.hotspots?.length}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 border-amber-500/30 text-amber-300 hover:text-white"
              >
                {exportingHotspots ? '⏳ Exporting...' : '📥 Export Hotspot CSV'}
              </button>
              <Link
                to="/hotspots"
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white"
              >
                View Full Hotspot Intelligence →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-center">
              <p className="text-xl font-bold text-white">{hotspotData.summary.total_hotspots}</p>
              <p className="text-xs text-white/50">Total Hotspots</p>
            </div>
            <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center">
              <p className="text-xl font-bold text-red-400">{hotspotData.summary.high_priority}</p>
              <p className="text-xs text-red-300/70">High Priority</p>
            </div>
            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-center">
              <p className="text-xl font-bold text-amber-400">{hotspotData.summary.medium_priority}</p>
              <p className="text-xs text-amber-300/70">Medium Priority</p>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-center">
              <p className="text-xl font-bold text-emerald-400">{hotspotData.summary.low_priority}</p>
              <p className="text-xs text-emerald-300/70">Low Priority</p>
            </div>
          </div>

          {hotspotData.summary.top_priority_locations?.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-white/60 font-medium">Top Priority Locations:</span>
              {hotspotData.summary.top_priority_locations.map((loc: string, idx: number) => (
                <span key={idx} className="bg-red-500/20 border border-red-500/30 text-red-200 px-2.5 py-1 rounded-md font-semibold">
                  #{idx + 1} {loc}
                </span>
              ))}
            </div>
          )}

          {hotspotData.summary.cleanup_statuses && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10 text-xs text-white/60">
              <span className="font-medium text-white/80">Cleanup Statuses:</span>
              {Object.entries(hotspotData.summary.cleanup_statuses).map(([status, count]) => (
                <span key={status} className="bg-white/5 px-2.5 py-1 rounded border border-white/10">
                  {status}: <strong className="text-white">{count as number}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reports Table */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Individual Scan PDF Audit Reports</h2>
          <span className="text-xs text-white/50">{detections.length} report(s) available</span>
        </div>

        {detections.length === 0 ? (
          <div className="p-12 text-center text-white/40">
            <p className="text-3xl mb-3">📋</p>
            <p className="font-medium text-white/60">No detections recorded yet.</p>
            <p className="text-sm mt-1">Perform scans or load the Demo Dataset to generate downloadable PDF reports.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-white/80">
              <thead className="bg-white/5 text-white/60 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Report ID</th>
                  <th className="px-6 py-3">Scan Date</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Coordinates</th>
                  <th className="px-6 py-3">Objects</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {detections.map((d) => (
                  <tr key={d.id} className="hover:bg-white/5 transition">
                    <td className="px-6 py-4 font-mono text-xs text-ocean-400">REP-#{d.id}</td>
                    <td className="px-6 py-4 text-xs text-white/70">
                      {d.created_at ? new Date(d.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">{d.location_name || '(no location)'}</td>
                    <td className="px-6 py-4 font-mono text-xs text-white/50">
                      {d.latitude ? `${d.latitude.toFixed(3)}, ${d.longitude.toFixed(3)}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 font-bold text-cyan-400">{d.total_objects ?? 0}</td>
                    <td className="px-6 py-4">
                      {d.detection_source === 'DEMO' ? (
                        <span className="demo-badge">DEMO</span>
                      ) : (
                        <span className="ai-badge">AI</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        id={`pdf-btn-${d.id}`}
                        onClick={() => handleDownloadPDF(d.id)}
                        disabled={downloadingId === d.id}
                        className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 text-ocean-400 hover:text-white disabled:opacity-50"
                      >
                        {downloadingId === d.id ? '⏳ Generating...' : '📄 Download PDF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
