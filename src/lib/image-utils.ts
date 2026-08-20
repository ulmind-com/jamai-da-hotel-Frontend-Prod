import { API_URL } from "@/lib/config";

const API_BASE_URL = API_URL;

/**
 * Resolves an image URL — prepends the API base if the URL is relative,
 * otherwise returns it as-is (Cloudinary, S3, etc.).
 */
export function resolveImageURL(url?: string): string {
  if (!url) return "/placeholder.svg";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
}
