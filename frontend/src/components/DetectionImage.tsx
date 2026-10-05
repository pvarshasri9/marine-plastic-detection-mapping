import { useState, useEffect, useRef } from 'react';

interface DetectionImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  maxHeightClass?: string;
  fallbackMessage?: string;
}

export default function DetectionImage({
  src,
  alt,
  className = '',
  maxHeightClass = 'max-h-72',
  fallbackMessage = 'Check whether the uploaded file still exists.',
}: DetectionImageProps) {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoading(true);
    setHasError(false);
  }, [src]);

  // Handle cached images where onLoad might not fire
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setLoading(false);
      } else if (imgRef.current.src) {
        setLoading(false);
        setHasError(true);
      }
    }
  }, [src]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setHasError(true);
  };

  if (!src || hasError) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-red-500/5 border border-red-500/20 rounded-lg text-center min-h-[160px] space-y-1.5">
        <span className="text-2xl mb-1">⚠️</span>
        <p className="text-red-400 font-medium text-sm">Image unavailable</p>
        <p className="text-white/50 text-xs">{fallbackMessage}</p>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center bg-black/40 border border-white/10 rounded-lg overflow-hidden min-h-[160px]">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-ocean-300 text-sm font-medium z-10 space-y-2">
          <div className="w-5 h-5 border-2 border-ocean-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading image...</span>
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full ${maxHeightClass} rounded-lg ${className}`}
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
}
