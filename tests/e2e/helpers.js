// Garde-fous communs : aucune requête externe, aucune erreur console.
export function watchPage(page) {
  const errors = [];
  const external = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  page.context().route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.protocol === 'data:') return route.continue();
    external.push(url.href);
    return route.abort();
  });
  return { errors, external };
}
