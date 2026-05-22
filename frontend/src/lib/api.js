import axios from "axios";

export const API = axios.create({
  baseURL: "https://rintaki.org/wp-json/wp/v2"
});

export const api = axios.create({
  baseURL: "https://rintaki.org/wp-json/wp/v2",
  withCredentials: true,
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
