/**
 * URL of a file that ships next to the app (OCR engine, language data, …).
 * Resolved against the current document so the app also works from a sub-folder of an FTP host
 * (build with a relative base) and not only from the domain root.
 */
export function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.href).href;
}
