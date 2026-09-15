import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Fallback center so the map has somewhere to render before we have a GPS fix.
const DEFAULT_CENTER = { lat: 40.2338, lng: -111.6585 };

/**
 * markers: [{ lat, lng, type: 'start'|'target'|'pin'|'ball', label? }]
 * onMapClick: ({ lat, lng }) => void, fired when the map is tapped
 */
export default function MapView({ center, markers = [], zoom = 17, onMapClick, className }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef([]);
  const clickHandlerRef = useRef(onMapClick);

  clickHandlerRef.current = onMapClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!mapboxgl.accessToken) {
      // eslint-disable-next-line no-console
      console.warn('VITE_MAPBOX_TOKEN is not set — the map will not render.');
    }

    const initialCenter = center || DEFAULT_CENTER;
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [initialCenter.lng, initialCenter.lat],
      zoom,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapRef.current.on('click', (e) => {
      clickHandlerRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter (without resetting zoom) whenever center changes meaningfully.
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.easeTo({ center: [center.lng, center.lat], duration: 400 });
    }
  }, [center?.lat, center?.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = markers.map((m) => {
      const el = document.createElement('div');
      el.className = `map-pin map-pin--${m.type || 'default'}`;
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map);
      if (m.label) {
        marker.setPopup(
          new mapboxgl.Popup({ offset: 14, closeButton: false }).setText(m.label)
        );
      }
      return marker;
    });
  }, [markers]);

  return <div ref={containerRef} className={className || 'map-view'} />;
}
