import { useEffect, useRef, useState } from "react";
import { Circle, CircleMarker, Polyline, Tooltip } from "react-leaflet";

interface AnimatedDriverMarkerProps {
  marker: {
    lat: number;
    lng: number;
    label?: string;
    kind?: string;
    accuracyMeters?: number;
    heading?: number | null;
  };
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

  const passenger = marker.kind === "passenger";
  const headingEnd =
    passenger && marker.heading !== null && marker.heading !== undefined
      ? (() => {
          const radians = (marker.heading * Math.PI) / 180;
          const distance = 0.00025;
          return [
            position[0] + Math.cos(radians) * distance,
            position[1] +
              (Math.sin(radians) * distance) /
                Math.max(0.2, Math.cos((position[0] * Math.PI) / 180)),
          ] as [number, number];
        })()
      : null;

  return (
    <>
      {passenger && marker.accuracyMeters ? (
        <Circle
          center={position}
          radius={Math.min(marker.accuracyMeters, 500)}
          pathOptions={{ color: "#2563eb", fillColor: "#60a5fa", fillOpacity: 0.1, weight: 1 }}
        />
      ) : null}
      {headingEnd ? (
        <Polyline positions={[position, headingEnd]} pathOptions={{ color: "#1d4ed8", weight: 3, opacity: 0.9 }} />
      ) : null}
      <CircleMarker
        center={position}
        radius={passenger ? 8 : 5}
        pathOptions={{
          color: passenger ? "#ffffff" : "#2049e3",
          fillColor: passenger ? "#2563eb" : "#3566f6",
          fillOpacity: 0.98,
          weight: passenger ? 3 : 2,
        }}
      >
        {marker.label ? <Tooltip direction="top" offset={[0, -6]} opacity={1}>{marker.label}</Tooltip> : null}
      </CircleMarker>
    </>
  );
}
