import { afterEach, describe, expect, it, vi } from "vitest";
import { clearGeocodingCache, reverseGeocode, searchPlaces } from "../services/geocoding";

afterEach(() => {
  clearGeocodingCache();
  vi.unstubAllGlobals();
});

describe("geocoding service", () => {
  it("normalizes and caches address search results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            place_id: 42,
            lat: "12.9716",
            lon: "77.5946",
            display_name: "MG Road, Bengaluru, Karnataka, India",
            type: "road",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await searchPlaces("  MG   Road ")).toEqual([
      {
        placeId: "42",
        lat: 12.9716,
        lng: 77.5946,
        displayName: "MG Road, Bengaluru, Karnataka, India",
        type: "road",
      },
    ]);
    expect(await searchPlaces("mg road")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/search?");
  });

  it("returns an empty result without calling Nominatim for short queries", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchPlaces("ab")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reverse-geocodes selected coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ display_name: "MG Road, Bengaluru, India" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(reverseGeocode({ lat: 12.9716, lng: 77.5946 })).resolves.toBe(
      "MG Road, Bengaluru, India",
    );
  });
});
