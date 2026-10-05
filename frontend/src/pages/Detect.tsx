import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { detectionsAPI, getImageUrl } from '../api';
import DetectionImage from '../components/DetectionImage';

// Fix default leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onSelect(e.latlng.lat, e.latlng.lng) });
  return null;
}

type Step = 'upload' | 'analyzing' | 'result';

export default function Detect() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState<any>(null);
  const [modelStatus, setModelStatus] = useState<any>(null);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locationName, setLocationName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    detectionsAPI.modelStatus().then(setModelStatus).catch(() => {});
  }, []);

  // Sync detection result if ID is in URL (supports refresh and direct linking)
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      const idNum = parseInt(idParam, 10);
      if (!isNaN(idNum)) {
        detectionsAPI.get(idNum)
          .then(data => {
            setResult(data);
            setStep('result');
            if (data.latitude) setLat(data.latitude.toString());
            if (data.longitude) setLng(data.longitude.toString());
            if (data.location_name) setLocationName(data.location_name);
          })
          .catch(() => {
            setError(`Detection #${idParam} could not be loaded.`);
          });
      }
    }
  }, [searchParams]);

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    if (rejected.length > 0) {
      setError('Invalid file. Only JPG, JPEG, and PNG are allowed (Max 10 MB).');
      return;
    }
    if (accepted[0]) {
      setFile(accepted[0]);
      setPreview(URL.createObjectURL(accepted[0]));
      setResult(null);
      setError('');
      setStep('upload');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/jpeg': ['.jpeg', '.jpg'], 'image/png': ['.png'] }, maxFiles: 1, maxSize: 10 * 1024 * 1024
  });

  const analyzeAndSave = async () => {
    if (!file) return;
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (lat && (isNaN(latN) || latN < -90 || latN > 90)) { setError('Latitude must be -90 to 90.'); return; }
    if (lng && (isNaN(lngN) || lngN < -180 || lngN > 180)) { setError('Longitude must be -180 to 180.'); return; }
    
    setStep('analyzing');
    setError('');
    
    try {
      // 1. Upload and Analyze
      const rawResult = await detectionsAPI.analyze(file);
      
      // 2. Save directly to DB
      const savedRecord = await detectionsAPI.save({
        filename: rawResult.filename,
        original_path: rawResult.original_path,
        annotated_path: rawResult.annotated_path,
        latitude: lat ? latN : null,
        longitude: lng ? lngN : null,
        location_name: locationName || null,
        source: rawResult.source,
        detections: rawResult.detections,
      });

      setResult(savedRecord);
      setStep('result');
      setSearchParams({ id: savedRecord.id.toString() });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Analysis or saving failed.');
      setStep('upload');
    }
  };

  const removeImage = () => {
    setFile(null);
    setPreview('');
    setResult(null);
    setLat(''); setLng(''); setLocationName(''); setError('');
    setStep('upload');
    setSearchParams({});
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Detect Plastic</h1>
        <p className="text-white/50 text-sm mt-1">Upload a coastal/marine image for plastic detection</p>
      </div>

      {/* Model Status Banner */}
      {modelStatus && (
        <div className={`px-4 py-3 rounded-lg text-sm border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
          modelStatus.model_available
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          <div>
            <span className="font-bold text-base mr-2">Detection Engine:</span>
            <span className="font-mono uppercase font-semibold">
              {modelStatus.model_available ? 'REAL MODEL' : 'DEMO MODE'}
            </span>
          </div>
          <div className="opacity-90 text-xs">
            {modelStatus.model_available
              ? 'Configured YOLO model active'
              : 'Simulated demonstration result — no trained model configured.'}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Step: Upload */}
      {(step === 'upload' || step === 'analyzing') && (
        <div className="space-y-4">
          {!file ? (
            <div
              {...getRootProps()}
              className={`card p-10 text-center cursor-pointer border-2 border-dashed transition-all ${
                isDragActive ? 'border-ocean-400 bg-ocean-500/10' : 'border-white/20 hover:border-ocean-500/50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="space-y-2">
                <p className="text-4xl">📤</p>
                <p className="text-white font-medium">Drop image here or click to browse</p>
                <p className="text-white/40 text-sm">JPG, JPEG, PNG • Max 10 MB</p>
              </div>
            </div>
          ) : (
            <div className="card p-6 border border-white/20 space-y-6">
              <div className="flex gap-4">
                <img src={preview} alt="Preview" className="h-32 w-48 object-cover rounded-lg border border-white/10" />
                <div className="flex flex-col justify-center space-y-1">
                  <p className="text-white font-medium">{file.name}</p>
                  <p className="text-white/60 text-sm">Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p className="text-white/60 text-sm">Type: {file.type}</p>
                  <div className="pt-2">
                    <button onClick={removeImage} className="text-red-400 text-sm hover:text-red-300 font-medium">
                      ❌ Remove Image
                    </button>
                  </div>
                </div>
              </div>

              {/* Optional Location Input before analysis */}
              <div className="border-t border-white/10 pt-4 space-y-4">
                <h3 className="font-semibold text-white">Location Details (Optional)</h3>
                <div>
                  <label className="label">Location Name</label>
                  <input id="location-name" className="input" value={locationName}
                    onChange={e => setLocationName(e.target.value)} placeholder="e.g. Marina Beach, Chennai" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Latitude (-90 to 90)</label>
                    <input id="lat-input" className="input" type="number" step="any" value={lat}
                      onChange={e => setLat(e.target.value)} placeholder="13.0827" />
                  </div>
                  <div>
                    <label className="label">Longitude (-180 to 180)</label>
                    <input id="lng-input" className="input" type="number" step="any" value={lng}
                      onChange={e => setLng(e.target.value)} placeholder="80.2707" />
                  </div>
                </div>
                <p className="text-white/40 text-xs">📍 Click the map to auto-fill coordinates</p>
                <div className="h-48 rounded-xl overflow-hidden border border-white/10">
                  <MapContainer
                    center={[13.08, 80.27]} zoom={5}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapClickHandler onSelect={(la, ln) => { setLat(la.toFixed(6)); setLng(ln.toFixed(6)); }} />
                    {lat && lng && <Marker position={[parseFloat(lat), parseFloat(lng)]} />}
                  </MapContainer>
                </div>
              </div>

              <button
                id="analyze-btn"
                onClick={analyzeAndSave}
                disabled={step === 'analyzing'}
                className="btn-primary w-full py-3 text-lg mt-4"
              >
                {step === 'analyzing' ? '⏳ Analyzing image... Please wait.' : '🔍 Analyze Image'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step: Result */}
      {step === 'result' && result && (
        <div className="space-y-5">
          {/* Professional Result Card */}
          <div className="card p-0 overflow-hidden border-2 border-white/20">
            <div className="bg-white/5 p-4 border-b border-white/10 flex flex-wrap justify-between items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-widest uppercase">Detection Result</h2>
              <div className="flex items-center gap-3">
                <Link
                  to="/hotspots"
                  className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/30 transition flex items-center gap-1 font-medium"
                >
                  🔥 View Location Hotspot
                </Link>
                <span className="text-xs text-white/50 font-mono">ID: #{result.id}</span>
              </div>
            </div>
            <div className="p-6 space-y-6">
              
              {result.detection_source === 'DEMO' || !result.is_real_model ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚠️</span>
                    <p className="text-red-400 font-bold uppercase tracking-wide">DEMO MODE</p>
                  </div>
                  <p className="text-red-300/90 text-sm">
                    Simulated demonstration result — no trained model configured.
                  </p>
                  <p className="text-white/40 text-xs">
                    No artificial confidence scores or fake detections are generated. To enable real AI inference, configure MODEL_PATH with YOLO weights and install ultralytics.
                  </p>
                </div>
              ) : (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">✅</span>
                    <p className="text-green-400 font-bold uppercase tracking-wide">REAL MODEL</p>
                  </div>
                  <p className="text-green-300/90 text-sm">
                    Detection generated by the configured model.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-white/50 text-xs uppercase">Detection Engine</p>
                  <p className="text-white font-mono font-bold">
                    {result.is_real_model ? 'REAL MODEL' : 'DEMO MODE'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-white/50 text-xs uppercase">Objects Detected</p>
                  <p className="text-ocean-400 font-bold text-xl">{result.total_objects}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white/50 text-xs uppercase">Location</p>
                  <p className="text-white text-sm">{result.location_name || 'Not specified'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white/50 text-xs uppercase">Timestamp</p>
                  <p className="text-white text-sm">{new Date(result.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Detected Objects Table */}
              {result.detected_objects && result.detected_objects.length > 0 ? (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-2 font-medium text-white/60">Class / Category</th>
                        <th className="px-4 py-2 font-medium text-white/60">Confidence</th>
                        <th className="px-4 py-2 font-medium text-white/60">Bounding Box</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {result.detected_objects.map((obj: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 text-white capitalize">{obj.plastic_type.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-ocean-400 font-mono">
                            {(obj.confidence * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-white/50 font-mono text-xs">
                            ({Math.round(obj.x_min)}, {Math.round(obj.y_min)}) → ({Math.round(obj.x_max)}, {Math.round(obj.y_max)})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-6 bg-white/5 rounded-lg text-white/60 space-y-1">
                  <p className="text-2xl mb-1">🔍</p>
                  <p className="font-medium text-white/80">No plastic objects detected by the configured model.</p>
                  <p className="text-xs text-white/40">
                    {result.detection_source === 'DEMO'
                      ? 'In DEMO MODE, no fake detections or fabricated bounding boxes are rendered.'
                      : 'The image was processed but no objects met the confidence threshold.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Images */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-white/60 text-xs mb-2 font-medium uppercase tracking-wider">Original Image</p>
              <DetectionImage
                src={result.image_url || getImageUrl(result.original_image_path) || preview}
                alt="Original uploaded image"
                maxHeightClass="max-h-72"
              />
            </div>
            {result.annotated_image_path && (
              <div className="card p-4">
                <p className="text-white/60 text-xs mb-2 font-medium uppercase tracking-wider">Annotated Image</p>
                <DetectionImage
                  src={result.annotated_image_url || getImageUrl(result.annotated_image_path)}
                  alt="Annotated detection image"
                  maxHeightClass="max-h-72"
                />
              </div>
            )}
          </div>

          <button onClick={removeImage} className="btn-secondary w-full py-3">Analyze Another Image</button>
        </div>
      )}
    </div>
  );
}
