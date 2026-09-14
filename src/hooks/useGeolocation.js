import { useCallback, useState } from 'react';

/**
 * getPosition() resolves a single high-accuracy GPS fix as { lat, lng, accuracy }.
 * Requires HTTPS (or localhost) — Netlify gives you HTTPS by default.
 */
export function useGeolocation() {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  const getPosition = useCallback(() => {
    setLocating(true);
    setError(null);

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = new Error('Geolocation is not supported on this device.');
        setError(err.message);
        setLocating(false);
        reject(err);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          setLocating(false);
          setError(err.message);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  return { getPosition, locating, error };
}
