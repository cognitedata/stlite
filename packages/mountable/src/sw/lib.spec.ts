import { describe, expect, it } from "vitest";
import {
  extractProjectFromPath,
  getCachedContentForUrl,
  getContentType,
} from "./lib";

describe("extractProjectFromPath", () => {
  it("extracts project from cdf_project segment", () => {
    expect(extractProjectFromPath("/foo/cdf_project/myproj/bar")).toBe(
      "myproj",
    );
  });
  it("returns null when not present", () => {
    expect(extractProjectFromPath("/foo/bar")).toBeNull();
  });
});

describe("getCachedContentForUrl", () => {
  it("returns content by multiple path keys", () => {
    const map = new Map<string, string>();
    const url = new URL("https://example.com/a/b.txt");
    map.set(url.pathname.replace(/^\//, "./"), "ok");
    expect(getCachedContentForUrl(map, url)).toBe("ok");
  });
  it("returns null when not found", () => {
    const map = new Map<string, string>();
    const url = new URL("https://example.com/none");
    expect(getCachedContentForUrl(map, url)).toBeNull();
  });
});

describe("getContentType", () => {
  it("maps known extensions", () => {
    expect(getContentType("/path/file.json")).toBe("application/json");
    expect(getContentType("/path/file.woff2")).toBe("font/woff2");
  });
  it("falls back to text/plain", () => {
    expect(getContentType("/path/file.unknown")).toBe("text/plain");
  });
});
