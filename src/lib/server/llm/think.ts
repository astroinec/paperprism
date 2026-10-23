/** Removes <think>…</think> blocks from a token stream. */
export function createThinkFilter() {
  let inThink = false;
  let buf = "";
  return (chunk: string): string => {
    buf += chunk;
    let out = "";
    while (buf.length) {
      if (inThink) {
        const end = buf.indexOf("</think>");
        if (end < 0) {
          buf = buf.slice(Math.max(0, buf.length - 8));
          return out;
        }
        buf = buf.slice(end + 8);
        inThink = false;
      } else {
        const start = buf.indexOf("<think>");
        if (start < 0) {
          // keep possible partial tag at the end
          const partial = buf.lastIndexOf("<");
          if (partial >= 0 && buf.length - partial < 7 && "<think>".startsWith(buf.slice(partial))) {
            out += buf.slice(0, partial);
            buf = buf.slice(partial);
          } else {
            out += buf;
            buf = "";
          }
          return out;
        }
        out += buf.slice(0, start);
        buf = buf.slice(start + 7);
        inThink = true;
      }
    }
    return out;
  };
}
