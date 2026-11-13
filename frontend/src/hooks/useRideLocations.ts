import { useEffect, useRef, useState } from "react";
import { CITY, type LatLng, type PlaceSuggestion } from "@ps02/shared";
import { errorMessage } from "../services/api";
import { geocodingApi } from "../services/geocodingApi";
import { useToast } from "./useToast";

export type LocationField = "pickup" | "drop";

function parseCoordinate(value: string): LatLng | null {
  const [latRaw, lngRaw] = value.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function useRideLocations() {
  const toast = useToast();
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [drop, setDrop] = useState<LatLng | null>(null);
  const [activeField, setActiveField] = useState<LocationField>("pickup");
  const [pickupText, setPickupText] = useState("");
  const [dropText, setDropText] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropAddress, setDropAddress] = useState("");
  const [pickupAddressError, setPickupAddressError] = useState<string | null>(null);
  const [dropAddressError, setDropAddressError] = useState<string | null>(null);
  const [mapRecenter, setMapRecenter] = useState<LatLng | null>(null);
  const reverseTimers = useRef<Record<LocationField, ReturnType<typeof setTimeout> | null>>({
    pickup: null,
    drop: null,
  });
  const reverseControllers = useRef<Record<LocationField, AbortController | null>>({
    pickup: null,
    drop: null,
  });

  const resolveAddress = (field: LocationField, point: LatLng) => {
    const timer = reverseTimers.current[field];
    if (timer) clearTimeout(timer);
    reverseControllers.current[field]?.abort();

    const fallback = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
    if (field === "pickup") {
      setPickupAddress(fallback);
      setPickupAddressError(null);
    } else {
      setDropAddress(fallback);
      setDropAddressError(null);
    }

    reverseTimers.current[field] = setTimeout(() => {
      const controller = new AbortController();
      reverseControllers.current[field] = controller;
      geocodingApi
        .reverse(point, controller.signal)
        .then(({ displayName }) => {
          if (controller.signal.aborted) return;
          if (field === "pickup") setPickupAddress(displayName);
          else setDropAddress(displayName);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          const message = errorMessage(err);
          if (field === "pickup") setPickupAddressError(message);
          else setDropAddressError(message);
        });
    }, 500);
  };

  useEffect(
    () => () => {
      for (const field of ["pickup", "drop"] as const) {
        const timer = reverseTimers.current[field];
        if (timer) clearTimeout(timer);
        reverseControllers.current[field]?.abort();
      }
    },
    [],
  );

  const handleMapClick = (point: LatLng) => {
    if (activeField === "pickup") {
      setPickup(point);
      setPickupText(`${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);
      resolveAddress("pickup", point);
      if (!drop) setActiveField("drop");
    } else {
      setDrop(point);
      setDropText(`${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);
      resolveAddress("drop", point);
    }
  };

  const selectPlace = (field: LocationField, place: PlaceSuggestion) => {
    const point = { lat: place.lat, lng: place.lng };
    const coordinates = `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
    const timer = reverseTimers.current[field];
    if (timer) clearTimeout(timer);
    reverseTimers.current[field] = null;
    reverseControllers.current[field]?.abort();
    if (field === "pickup") {
      setPickup(point);
      setPickupText(coordinates);
      setPickupAddress(place.displayName);
      setPickupAddressError(null);
      setActiveField("drop");
    } else {
      setDrop(point);
      setDropText(coordinates);
      setDropAddress(place.displayName);
      setDropAddressError(null);
    }
    setMapRecenter(point);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.push("warning", "Location unavailable", "This browser does not expose geolocation.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        setPickup(point);
        setPickupText(`${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);
        resolveAddress("pickup", point);
        setMapRecenter(point);
        setActiveField("drop");
      },
      () => {
        toast.push(
          "warning",
          "Could not read your location",
          "Pick your pickup point on the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const setCoordinateText = (field: LocationField, value: string) => {
    const point = parseCoordinate(value);
    if (field === "pickup") {
      setPickupText(value);
      setPickup(point);
      setPickupAddress(point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "");
    } else {
      setDropText(value);
      setDrop(point);
      setDropAddress(point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "");
    }
  };

  const setLocationPoint = (field: LocationField, point: LatLng) => {
    const coordinates = `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
    if (field === "pickup") {
      setPickup(point);
      setPickupText(coordinates);
      resolveAddress("pickup", point);
      setMapRecenter(point);
      setActiveField("drop");
      return;
    }
    setDrop(point);
    setDropText(coordinates);
    resolveAddress("drop", point);
    setMapRecenter(point);
  };

  const clearLocation = (field: LocationField) => {
    const timer = reverseTimers.current[field];
    if (timer) clearTimeout(timer);
    reverseTimers.current[field] = null;
    reverseControllers.current[field]?.abort();
    reverseControllers.current[field] = null;
    if (field === "pickup") {
      setPickup(null);
      setPickupText("");
      setPickupAddressError(null);
    } else {
      setDrop(null);
      setDropText("");
      setDropAddressError(null);
    }
  };

  const centerPickup = () => {
    setPickup(CITY.center);
    setPickupText(`${CITY.center.lat.toFixed(4)}, ${CITY.center.lng.toFixed(4)}`);
    resolveAddress("pickup", CITY.center);
    setMapRecenter(CITY.center);
  };

  const reset = () => {
    setPickup(null);
    setDrop(null);
    setPickupText("");
    setDropText("");
    setPickupAddress("");
    setDropAddress("");
    setPickupAddressError(null);
    setDropAddressError(null);
    setMapRecenter(null);
    setActiveField("pickup");
    for (const field of ["pickup", "drop"] as const) {
      const timer = reverseTimers.current[field];
      if (timer) clearTimeout(timer);
      reverseControllers.current[field]?.abort();
    }
  };

  return {
    pickup,
    drop,
    activeField,
    setActiveField,
    pickupText,
    dropText,
    pickupAddress,
    dropAddress,
    pickupAddressError,
    dropAddressError,
    mapRecenter,
    handleMapClick,
    selectPlace,
    useCurrentLocation,
    setCoordinateText,
    setLocationPoint,
    clearLocation,
    resolveAddress,
    centerPickup,
    reset,
  };
}
