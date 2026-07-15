const MAX_BASE_LENGTH = 100;

function sanitizeBaseName(title, id) {
  const base = String(title || '')
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_BASE_LENGTH)
    .trim();
  return base || `song-${id}`;
}

function makeUniqueNamer() {
  const used = new Set();
  return (title, id) => {
    const base = sanitizeBaseName(title, id);
    let candidate = base;
    let n = 1;
    while (used.has(candidate.toLowerCase())) {
      n += 1;
      candidate = `${base}-${n}`;
    }
    used.add(candidate.toLowerCase());
    return `${candidate}.cho`;
  };
}

module.exports = { sanitizeBaseName, makeUniqueNamer };
