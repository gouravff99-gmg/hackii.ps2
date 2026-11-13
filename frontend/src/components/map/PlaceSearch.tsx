import { useEffect, useRef, useState } from "react";
import type { PlaceSuggestion } from "@ps02/shared";
import { Input } from "../ui/Input";
import { geocodingApi } from "../../services/geocodingApi";
import { errorMessage } from "../../services/api";
import { Spinner } from "../ui/Spinner";

interface PlaceSearchProps {
  label: string;
  value: string;
  onSelect: (place: PlaceSuggestion) => void;
  onQueryChange?: () => void;
  disabled?: boolean;
}

export function PlaceSearch({ label, value, onSelect, onQueryChange, disabled = false }: PlaceSearchProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchEnabled = useRef(false);

  useEffect(() => {
    searchEnabled.current = false;
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!searchEnabled.current) return;
    const normalized = query.trim();
    if (normalized.length < 3) {
      setSuggestions([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      geocodingApi
        .search(normalized, controller.signal)
        .then((response) => setSuggestions(response.suggestions))
        .catch((cause) => {
          if (!controller.signal.aborted) {
            setSuggestions([]);
            setError(errorMessage(cause));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="relative">
      <Input
        label={label}
        value={query}
        disabled={disabled}
        onChange={(event) => {
          searchEnabled.current = true;
          setQuery(event.target.value);
          onQueryChange?.();
        }}
        placeholder="Search an address, landmark or area"
        autoComplete="off"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-autocomplete="list"
      />
      {loading ? (
        <div className="absolute right-3 top-9 text-brand-600">
          <Spinner className="h-4 w-4" />
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {searchEnabled.current &&
      !error &&
      query.trim().length >= 3 &&
      !loading &&
      suggestions.length === 0 ? (
        <p className="mt-1 text-xs text-ink-500">No matching addresses found.</p>
      ) : null}
      {suggestions.length > 0 ? (
        <ul
          role="listbox"
          className="absolute z-[1000] mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-200 bg-white p-1 shadow-lg"
        >
          {suggestions.map((place) => (
            <li key={place.placeId} role="option" aria-selected={false}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  searchEnabled.current = false;
                  setSuggestions([]);
                  setQuery(place.displayName);
                  onSelect(place);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {place.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
