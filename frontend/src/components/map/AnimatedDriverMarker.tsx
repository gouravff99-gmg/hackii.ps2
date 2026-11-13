import { useEffect, useRef, useState } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";

interface AnimatedDriverMarkerProps {
  marker: { lat: number; lng: number; label?: string };
}

export function AnimatedDriverMarker({ marker }: AnimatedDriverMarkerProps) {
  const [position, setPosition] = useState<[number, number]>([marker.lat, marker.lng]);
  const positionRef = useRef(position);
  useEffect(() => {
    const from = positionRef.current;
    const to: [number, number] = [marker.lat, marker.lng];
    const start = performance.now();
    const duration = 700;
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next: [number, number] = [
        from[0] + (to[0] - from[0]) * eased,
        from[1] + (to[1] - from[1]) * eased,
      ];
      positionRef.current = next;
      setPosition(next);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [marker.lat, marker.lng]);

  return (
    <CircleMarker center={position} radius={5} pathOptions={{
      color: "#2049e3",
      fillColor: "#3566f6",
      fillOpacity: 0.9,
      weight: 2,
    }}>
      {marker.label ? <Tooltip direction="top" offset={[0, -6]} opacity={1}>{marker.label}</Tooltip> : null}
    </CircleMarker>
  );
}
