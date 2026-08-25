function parseAttrs(line='') {
  const attrs = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(line))) attrs[m[1]] = m[2];
  return attrs;
}

function titleFromExtinf(line='') {
  const idx = line.indexOf(',');
  return idx >= 0 ? line.slice(idx + 1).trim() : 'Untitled';
}

function inferKind(group='', url='', title='') {
  const hay = `${group} ${url} ${title}`.toLowerCase();
  if (/\b(movie|movies|vod|films?)\b/.test(hay) || /\/movie\//.test(hay)) return 'movie';
  if (/\b(series|tv shows?|shows?)\b/.test(hay) || /\/series\//.test(hay)) return 'series';
  return 'live';
}

export function parseM3U(text, providerId='m3u') {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
  const items = [];
  let pending = null;
  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      const attrs = parseAttrs(line);
      pending = {
        name: titleFromExtinf(line),
        group: attrs['group-title'] || 'Uncategorised',
        logo: attrs['tvg-logo'] || '',
        tvgId: attrs['tvg-id'] || '',
        tvgName: attrs['tvg-name'] || '',
        catchup: attrs['catchup'] || attrs['catchup-type'] || '',
      };
    } else if (!line.startsWith('#') && pending) {
      const kind = inferKind(pending.group, line, pending.name);
      items.push({
        id: `${providerId}:${items.length}:${pending.tvgId || pending.name}`,
        providerId,
        source: 'm3u',
        kind,
        name: pending.name,
        group: pending.group,
        logo: pending.logo,
        tvgId: pending.tvgId,
        tvgName: pending.tvgName,
        streamUrl: line,
        catchup: pending.catchup
      });
      pending = null;
    }
  }
  return items;
}

export function groupCatalog(items=[]) {
  const groups = new Map();
  for (const item of items) {
    const key = item.group || 'Uncategorised';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].map(([name, entries])=>({name, entries}));
}
