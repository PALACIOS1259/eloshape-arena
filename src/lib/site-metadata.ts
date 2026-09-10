export function parseSiteOrigin(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;

  try {
    const url = new URL(value.trim());
    const isWebUrl = url.protocol === "https:" || url.protocol === "http:";
    const isOriginOnly =
      url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;

    return isWebUrl && isOriginOnly ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export const siteOrigin = parseSiteOrigin(import.meta.env["VITE_SITE_URL"]);

export const productionSiteOrigin = "https://eloshape.com.ar";

export function shouldNoIndexSite(origin: string | undefined, maintenanceMode: boolean) {
  return maintenanceMode || (origin !== undefined && origin !== productionSiteOrigin);
}

export function absoluteSiteUrl(path = "/"): string | undefined {
  if (!siteOrigin) return undefined;
  return new URL(path, `${siteOrigin}/`).toString();
}

export function canonicalMetadata(path: string) {
  const url = absoluteSiteUrl(path);

  return {
    meta: url ? [{ property: "og:url", content: url }] : [],
    links: url ? [{ rel: "canonical", href: url }] : [],
  };
}
