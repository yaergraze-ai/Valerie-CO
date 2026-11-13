export const serverMode = import.meta.env.VITE_BACKEND !== "false";
export async function api(path: string, body?: unknown) {
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw Error("Service temporarily unavailable. Please try again shortly.");
  }
  if (!res.ok) throw Error(data.error || "Request failed");
  return data;
}
