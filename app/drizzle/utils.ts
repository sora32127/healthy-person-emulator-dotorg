export function nowUTC(): string {
  return new Date().toISOString();
}

export function nowJST(): string {
  // JST = UTC+9
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString();
}
