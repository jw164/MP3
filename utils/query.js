
export function parseJSON(q) {
  if (!q) return undefined;
  try {
    return JSON.parse(q);
  } catch {
    throw new Error('Invalid JSON in query parameter');
  }
}

export async function runQuery(model, req, base = {}) {
  const { where, sort, select, skip, limit, count } = req.query;

  const filter = { ...base, ...(parseJSON(where) || {}) };
  const projection = parseJSON(select);
  const sortObj = parseJSON(sort);

  if (String(count).toLowerCase() === 'true') {
    const n = await model.countDocuments(filter);
    return { type: 'count', data: n };
  }

  let q = model.find(filter, projection || undefined);

  if (sortObj) q = q.sort(sortObj);
  if (skip) q = q.skip(Number(skip));
  if (limit) q = q.limit(Number(limit));
  const docs = await q.exec();
  return { type: 'docs', data: docs };
}
