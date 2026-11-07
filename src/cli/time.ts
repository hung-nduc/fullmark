const pad = (n: number): string => String(n).padStart(2, "0");

/** `2026-10-28T14:05:09+07:00`: the time of Finish as the local clock reads it, with its offset (review-v2). */
export function localIso(d: Date): string {
  const offset = -d.getTimezoneOffset();
  const sign = offset < 0 ? "-" : "+";
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${hours}:${minutes}`;
}
