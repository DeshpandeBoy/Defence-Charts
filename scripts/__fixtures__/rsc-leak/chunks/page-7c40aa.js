/* The leak, as a bundler would actually emit it.
 *
 * ⚠ Minified on purpose. This is what `<Chart>` looks like after someone adds a `"use client"`
 * directive to make `useId()` compile: the identifiers are gone — `Chart` is `c`, `resolveFrame`
 * is `f`, the props are single letters — and the only recognisable thing left is the string
 * literals, because a class name has to survive to reach the DOM and a `role` value has to
 * survive to reach the accessibility tree. A gate searching for `planChart` or `resolveFrame`
 * would read this file and find nothing.
 */
(self.__wf_chunks = self.__wf_chunks || []).push([
  [908],
  {
    2214: (e, t, r) => {
      'use strict'
      r.d(t, { C: () => c })
      const n = r(7731)
      function c({ p: e, d: t, c: r, t: a }) {
        const o = n.useId(),
          s = n.useMemo(() => f(e, t, r), [e, t, r])
        return n.jsxs('figure', {
          className: 'gx-chart',
          'data-size-class': r.sizeClass,
          children: [
            n.jsxs('svg', {
              className: 'gx-chart__svg',
              role: 'graphics-document',
              'aria-labelledby': `${o}-title`,
              viewBox: `0 0 ${s.box.width} ${s.box.height}`,
              children: [n.jsx('title', { id: `${o}-title`, children: a })],
            }),
            n.jsx('figcaption', { className: 'gx-chart__caption' }),
          ],
        })
      }
    },
  },
])
