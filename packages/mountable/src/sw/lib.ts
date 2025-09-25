export function extractProjectFromPath(pathname: string): string | null {
  const match = pathname.match(/\/cdf_project\/([^/]+)/);
  return match ? match[1] : null;
}

export function getCachedContentForUrl(
  fileContents: Map<string, unknown>,
  url: URL,
): unknown | null {
  return (
    fileContents.get(url.href) ||
    fileContents.get(url.pathname) ||
    fileContents.get(url.pathname.slice(1)) ||
    fileContents.get(url.pathname.replace(/^\//, "./")) ||
    null
  );
}

export function getContentType(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  const contentTypes: Record<string, string> = {
    html: "text/html",
    js: "application/javascript",
    css: "text/css",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject",
  };
  return contentTypes[extension] || "text/plain";
}
