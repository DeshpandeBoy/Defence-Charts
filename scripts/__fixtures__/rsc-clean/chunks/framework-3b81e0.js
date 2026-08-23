/* A stand-in for a framework chunk: real client JavaScript, none of it ours.
 *
 * The bytes exist so `scanForChartCode()` returns a non-trivial `bytes` total and the vacuity
 * floor has something to measure. The content is deliberately the sort of thing a bundler
 * emits — string literals, a registry, DOM work — so that "no markers found" is a statement
 * about a file that plausibly could have contained them.
 */
(self.__wf_chunks = self.__wf_chunks || []).push([
  [412],
  {
    7731: (e, t, r) => {
      'use strict'
      const n = new Map()
      const a = ['click', 'keydown', 'pointerdown', 'focusin', 'submit']
      function o(e, t) {
        const r = document.createElement('div')
        r.className = 'app-shell__region'
        r.setAttribute('role', 'region')
        r.setAttribute('data-hydrated', 'true')
        return e.appendChild(r), n.set(t, r), r
      }
      function s(e) {
        for (const t of a) e.addEventListener(t, () => {}, { passive: !0 })
      }
      e.exports = { mount: o, listen: s, registry: n }
    },
  },
])
