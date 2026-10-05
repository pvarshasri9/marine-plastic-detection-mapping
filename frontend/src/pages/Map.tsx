import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { mapAPI } from '../api';

const defaultCenter: [number, number] = [13.0827, 80.2707]; // Chennai coast

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="
      background-color: ${color};
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 8px ${color};
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

const highIcon = createIcon('#ef4444');
const mediumIcon = createIcon('#f59e0b');
const lowIcon = createIcon('#10b981');

const getMarkerIcon = (totalObjects: number) => {
  if (totalObjects >= 5) return highIcon;
  if (totalObjects >= 2) return mediumIcon;
  return lowIcon;
};

const getDensityLabel = (total: number) => {
  if (total >= 5) return 'High';
  if (total >= 2) return 'Medium';
  return 'Low';
};

export default function MapPage() {
  const [detections, setDetections] = useState<any[]>([]);
  const [heatmapPoints, setHeatmapPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterDensity, setFilterDensity] = useState('ALL');
  const [showHotspotCircles, setShowHotspotCircles] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [mapRes, heatRes] = await Promise.all([
        mapAPI.detections(),
        mapAPI.heatmap(),
      ]);
      setDetections(Array.isArray(mapRes) ? mapRes : []);
      setHeatmapPoints(Array.isArray(heatRes) ? heatRes : []);
    } catch (err) {
      console.error('Failed to load map data', err);
      setError('Failed to load map data. Backend may be unavailable.');
    } finally {
      setLoading(false);
    }
  };

  // Backend map API returns: id, latitude, longitude, location_name, total_objects, detection_source, created_at, plastic_types[]
  const filteredDetections = detections.filter(d => {
    if (filterDensity === 'ALL') return true;
    const count = d.total_objects ?? 0;
    if (filterDensity === 'HIGH') return count >= 5;
    if (filterDensity === 'MEDIUM') return count >= 2 && count < 5;
    if (filterDensity === 'LOW') return count < 2;
    return true;
  });

  const mapCenter: [number, number] =
    detections.length > 0
      ? [detections[0].latitude, detections[0].longitude]
      : defaultCenter;

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
          <h1 className="text-2xl font-bold text-white">🗺 Marine Plastic Geographic Map</h1>
          <p className="text-white/60 text-sm">
            Observation-based visualization of detected marine debris locations
            — <span className="text-amber-400 font-medium">Observation Density only, not a scientific pollution measurement</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/hotspots"
            className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 bg-amber-600/80 hover:bg-amber-600 border border-amber-400/30 text-white"
          >
            🔥 View Hotspot Intelligence
          </Link>

          <div className="bg-white/5 border border-white/10 rounded-lg p-1 flex text-xs">
            {[
              { key: 'ALL', label: `All (${detections.length})`, style: 'bg-ocean-500' },
              { key: 'HIGH', label: 'High', style: 'bg-red-500' },
              { key: 'MEDIUM', label: 'Medium', style: 'bg-amber-500' },
              { key: 'LOW', label: 'Low', style: 'bg-emerald-500' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterDensity(f.key)}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  filterDensity === f.key ? `${f.style} text-white` : 'text-white/60 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80">
            <input
              type="checkbox"
              checked={showHotspotCircles}
              onChange={e => setShowHotspotCircles(e.target.checked)}
              className="accent-ocean-500 rounded"
            />
            Show Density Radii
          </label>
        </div>
      </div>

      {/* Map Card */}
      <div className="glass-card rounded-2xl p-2 border border-white/10 relative overflow-hidden h-[600px] flex">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-white/60">
            <div className="animate-spin text-3xl mr-3">🌀</div> Loading Map...
          </div>
        ) : detections.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-3">
            <p className="text-4xl">🗺️</p>
            <p className="font-medium">No observations available.</p>
            <p className="text-sm">Load the Demo Dataset or save detections with location coordinates.</p>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={6}
            className="w-full h-full rounded-xl z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Detection Markers */}
            {filteredDetections.map((d) => (
              <Marker
                key={d.id}
                position={[d.latitude, d.longitude]}
                icon={getMarkerIcon(d.total_objects ?? 0)}
              >
                <Popup className="custom-popup">
                  <div className="p-1 max-w-xs text-navy-900">
                    <p className="font-bold text-sm text-gray-900 truncate mb-1">
                      {d.location_name || `${d.latitude.toFixed(3)}, ${d.longitude.toFixed(3)}`}
                    </p>
                    <p className="text-xs text-gray-600">
                      Detection ID: <strong>#{d.id}</strong>
                    </p>
                    <p className="text-xs text-gray-600">
                      Coordinates: <strong>{d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}</strong>
                    </p>
                    <p className="text-xs text-gray-600">
                      Objects: <strong>{d.total_objects ?? 0}</strong>
                    </p>
                    <p className="text-xs text-gray-600">
                      Density: <strong>{getDensityLabel(d.total_objects ?? 0)}</strong>
                    </p>
                    {d.plastic_types && d.plastic_types.length > 0 && (
                      <p className="text-xs text-gray-600">
                        Types: {d.plastic_types.slice(0, 3).map((t: string) => t.replace(/_/g, ' ')).join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Source: <span className="font-mono text-blue-600">{d.detection_source}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {d.created_at ? new Date(d.created_at).toLocaleString() : ''}
                    </p>
                    {d.detection_source === 'DEMO' && (
                      <p className="text-xs text-red-500 font-bold mt-1">⚠ DEMO DATA</p>
                    )}
                    <div className="mt-2 pt-1 border-t border-gray-200">
                      <Link to={`/detect?id=${d.id}`} className="text-xs text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1">
                        🔍 View Detection Details →
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Density Circles from heatmap points */}
            {showHotspotCircles && heatmapPoints.map((h, idx) => (
              <CircleMarker
                key={`heat-${idx}`}
                center={[h.lat, h.lng]}
                radius={Math.min(Math.max(h.intensity * 4, 8), 35)}
                pathOptions={{
                  color: h.intensity > 5 ? '#ef4444' : '#f59e0b',
                  fillColor: h.intensity > 5 ? '#ef4444' : '#f59e0b',
                  fillOpacity: 0.25,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div className="text-navy-900 p-1">
                    <p className="font-bold text-xs">🔴 Density Zone</p>
                    <p className="text-xs">Lat: {h.lat.toFixed(4)}, Lng: {h.lng.toFixed(4)}</p>
                    <p className="text-xs">Objects: <strong>{h.intensity}</strong></p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}

        {/* Legend */}
        {!loading && detections.length > 0 && (
          <div className="absolute bottom-4 left-4 z-10 bg-navy-900/90 backdrop-blur p-3 rounded-lg border border-white/10 text-xs space-y-1.5 shadow-xl">
            <p className="font-semibold text-white mb-1">Observation Density</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
              <span className="text-white/80">High (≥5 objects)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span className="text-white/80">Medium (2–4 objects)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-white/80">Low (&lt;2 objects)</span>
            </div>
            <p className="text-white/30 text-xs pt-1 border-t border-white/10">
              Not a scientific pollution measurement
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
