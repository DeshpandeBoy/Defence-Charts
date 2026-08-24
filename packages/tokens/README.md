# @gx/tokens

The generated CSS custom-property themes and TypeScript token names used by Defence-Charts.
Import the theme stylesheet through the public CSS subpath and use the TypeScript exports for
typed token names and theme identifiers.

~~~ts
import { GX_THEMES, toCustomProperty } from '@gx/tokens'
import '@gx/tokens/theme.css'
~~~

The package has no runtime package dependencies. CSS is a deliberate side effect and remains
included in published bundles.

## License

MIT. See the bundled LICENSE file.
