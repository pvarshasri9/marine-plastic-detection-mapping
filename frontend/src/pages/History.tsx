import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { detectionsAPI, reportsAPI, getImageUrl } from '../api';
import DetectionImage from '../components/DetectionImage';

export default function History() {
  const [detections, setDetections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [downloading, setDownloading] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (search) params.search = search;
    if (source) params.source = source;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    detectionsAPI.list(params).then(setDetections).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this detection and its files?')) return;
    setDeleting(id);
    try {
      await detectionsAPI.delete(id);
      setDetections(d => d.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
    } finally { setDeleting(null); }
  };

  const downloadPDF = async (id: number) => {
    setDownloading(id);
    try {
      const blob = await reportsAPI.download(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `detection_${id}_report.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Report generation failed.'); }
    finally { setDownloading(null); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Detection History</h1>
          <p className="text-white/50 text-sm mt-1">All your saved detections</p>
        </div>
        <Link
          to="/hotspots"
          className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3 bg-amber-600/80 hover:bg-amber-600 border border-amber-400/30 text-white self-start sm:self-auto"
        >
          🔥 Analyse Hotspots
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-40">
          <label className="label text-xs">Search location</label>
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Location name..." />
        </div>
        <div>
          <label className="label text-xs">Source</label>
          <select className="input" value={source} onChange={e => setSource(e.target.value)}>
            <option value="">All</option>
            <option value="AI">AI</option>
            <option value="DEMO">DEMO</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">From date</label>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">To date</label>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={load}>Search</button>
        <button className="btn-secondary" onClick={() => { setSearch(''); setSource(''); setDateFrom(''); setDateTo(''); setTimeout(load, 50); }}>Reset</button>
      </div>

      {loading ? (
        <div className="text-white/50 text-center py-10">Loading detections...</div>
      ) : detections.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-white font-medium">No detections recorded yet.</p>
          <p className="text-white/40 text-sm mt-1">Analyze an image to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-left">
                <th className="pb-3 pr-3">Image</th>
                <th className="pb-3 pr-4">ID</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Location</th>
                <th className="pb-3 pr-4">Category</th>
                <th className="pb-3 pr-4">Objects</th>
                <th className="pb-3 pr-4">Source</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {detections.map(d => (
                <tr key={d.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="py-2.5 pr-3">
                    <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center">
                      <img
                        src={d.image_url || getImageUrl(d.original_image_path)}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-white/60">#{d.id}</td>
                  <td className="py-3 pr-4 text-white">{d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}</td>
                  <td className="py-3 pr-4 text-white">{d.location_name || '—'}</td>
                  <td className="py-3 pr-4 text-white/80 text-xs capitalize max-w-[150px] truncate" title={Array.from(new Set(d.detected_objects?.map((o: any) => o.plastic_type.replace(/_/g, ' ')))).join(', ') || 'None'}>
                    {Array.from(new Set(d.detected_objects?.map((o: any) => o.plastic_type.replace(/_/g, ' ')))).join(', ') || 'None'}
                  </td>
                  <td className="py-3 pr-4 text-ocean-400 font-semibold">{d.total_objects}</td>
                  <td className="py-3 pr-4">
                    {d.detection_source === 'DEMO'
                      ? <span className="demo-badge">DEMO</span>
                      : <span className="ai-badge">AI</span>}
                  </td>
                  <td className="py-3 flex gap-2 items-center">
                    <button className="btn-secondary text-xs px-2 py-1" onClick={() => setSelected(d)}>View</button>
                    <Link to={`/detect?id=${d.id}`} className="btn-secondary text-xs px-2 py-1 text-ocean-300 hover:text-white" title="Open detection page">🔍 Details</Link>
                    <button className="btn-secondary text-xs px-2 py-1" onClick={() => downloadPDF(d.id)} disabled={downloading === d.id}>
                      {downloading === d.id ? '...' : '📄 PDF'}
                    </button>
                    <button className="btn-danger text-xs px-2 py-1" onClick={() => handleDelete(d.id)} disabled={deleting === d.id}>
                      {deleting === d.id ? '...' : '🗑'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Detection #{selected.id}</h2>
                <Link to={`/detect?id=${selected.id}`} className="text-xs text-ocean-400 hover:underline">
                  Open Full Page ↗
                </Link>
                <Link
                  to="/hotspots"
                  className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500/30 flex items-center gap-1"
                >
                  🔥 View Hotspot
                </Link>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="flex gap-2">
                {selected.detection_source === 'DEMO'
                  ? <span className="demo-badge">⚠️ DEMO DATA — NOT REAL AI INFERENCE</span>
                  : <span className="ai-badge">✅ AI INFERENCE</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-white/70">
                <span>Date: <span className="text-white">{selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'}</span></span>
                <span>Objects: <span className="text-ocean-400 font-bold">{selected.total_objects}</span></span>
                <span>Location: <span className="text-white">{selected.location_name || '—'}</span></span>
                <span>Coords: <span className="text-white">{selected.latitude ? `${selected.latitude}, ${selected.longitude}` : '—'}</span></span>
              </div>

              {/* Images with dedicated loading and error states */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-white/60 text-xs mb-1.5 font-medium uppercase tracking-wider">Original Image</p>
                  <DetectionImage
                    src={selected.image_url || getImageUrl(selected.original_image_path)}
                    alt="Original"
                    maxHeightClass="max-h-56"
                  />
                </div>
                {selected.annotated_image_path && (
                  <div>
                    <p className="text-white/60 text-xs mb-1.5 font-medium uppercase tracking-wider">Annotated Image</p>
                    <DetectionImage
                      src={selected.annotated_image_url || getImageUrl(selected.annotated_image_path)}
                      alt="Annotated"
                      maxHeightClass="max-h-56"
                    />
                  </div>
                )}
              </div>

              {selected.detected_objects?.length > 0 && (
                <div>
                  <p className="text-white/60 mb-2 font-medium">Detected Objects</p>
                  <div className="space-y-1">
                    {selected.detected_objects.map((o: any, i: number) => (
                      <div key={i} className="flex justify-between bg-white/5 rounded px-3 py-1.5">
                        <span className="capitalize text-white">{o.plastic_type.replace(/_/g,' ')}</span>
                        <span className="text-ocean-400 font-mono">{(o.confidence*100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
