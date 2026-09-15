import { useCallback, useState } from 'react';

/**
 * getPosition() resolves a single high-accuracy GPS fix as { lat, lng, accuracy }.
 *
 * Geolocation requires a "secure context" — https://, or the literal hostname
 * "localhost". On an insecure origin (e.g. hitting your dev server over your
 * computer's local network IP from your phone, like http://192.168.1.23:5173)
 * the browser refuses silently: it never shows the permission prompt at all,
 * it just fails immediately. That's easy to mistake for "nothing happened."
 * Netlify serves everything over HTTPS, so this only bites during local dev.
 */
export function useGeolocation() {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  const getPosition = useCallback(() => {
    setLocating(true);
    setError(null);

    return new Promise((resolve, reject) => {
      if (!window.isSecureContext) {
        const err = new Error(
          'Location requires a secure connection. This page was loaded over an insecure ' +
            'origin (not https:// or localhost), so the browser won\'t even prompt for permission.'
        );
        setError(err.message);
        setLocating(false);
        reject(err);
        return;
      }

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
          // err.code: 1 = permission denied, 2 = position unavailable, 3 = timeout
          const message =
            err.code === 1
              ? 'Location permission was denied. Check your browser and phone location settings.'
              : err.code === 2
              ? 'Your location is currently unavailable. Make sure Location Services is on.'
              : err.code === 3
              ? 'Getting your location timed out. Try again, ideally outdoors with a clear sky view.'
              : err.message;
          setError(message);
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  return { getPosition, locating, error };
}
