const root = `${import.meta.dir}/dist`
Bun.serve({
  port: 8788,
  async fetch(request) {
    const path = new URL(request.url).pathname
    const candidates = [path, `${path.replace(/\/$/, '')}/index.html`, `${path}/index.html`]
    for (const candidate of candidates) {
      const file = Bun.file(`${root}${candidate}`)
      if (await file.exists()) return new Response(file)
    }
    return new Response('404', { status: 404 })
  },
})
console.log('serving dist on http://localhost:8788')
