/** Reading school emails out of pasted text or a Google Doc/Sheet link: used by the Add pupils page and the "pupils" server function. */

const EMAIL = /^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Every email address in some pasted or exported text, lower case, each once, in order. */
export function emailsIn(text: string): string[] {
  const found = text.toLowerCase().match(/[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9-]+(?:\.[a-z0-9-]+)+/g) ?? [];
  return [...new Set(found.map((e) => e.replace(/\.+$/, '')))].filter((e) => EMAIL.test(e));
}

/** The plain-text export address for a Google Doc or Sheet link, or null if it isn't one. Only docs.google.com. */
export function exportUrlFor(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return null;
  const m = url.pathname.match(/^\/(document|spreadsheets)\/d\/([A-Za-z0-9_-]{10,100})(?:\/|$)/);
  if (!m) return null;
  if (m[1] === 'document') return `https://docs.google.com/document/d/${m[2]}/export?format=txt`;
  const gid = (url.hash.match(/gid=(\d{1,12})/) ?? url.search.match(/gid=(\d{1,12})/))?.[1];
  return `https://docs.google.com/spreadsheets/d/${m[2]}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

