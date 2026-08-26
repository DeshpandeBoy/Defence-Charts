import '@fontsource-variable/roboto-flex';
import '@fortawesome/fontawesome-svg-core/styles.css';
import './global.css';
import type { Metadata, Viewport } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'),
  title: {
    default: 'ShiftCharts documentation',
    template: '%s · ShiftCharts documentation',
  },
  description: 'ShiftCharts — charts that shift with their space.',
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#141618' },
    { media: '(prefers-color-scheme: light)', color: '#f4f3ef' },
  ],
};

const designContract = `
<!--
THESIS: ShiftCharts documentation is a calibration instrument, not a marketing page; the live size-to-plan proof leads and generic hero cards do not.
OWN-WORLD: Emission-Line Rail charcoal grounds, exact wavelength signals, square controls, hairline registration, and Roboto Flex.
STORY: A developer sees one chart change meaning, learns the data-to-plan-to-render boundary, and reaches a compiling API route.
FIRST VIEWPORT: Fixed documentation rail, literal product claim, draggable chart instrument, live plan readout, and page outline.
FORM: Calibration console, selected from the established-world surface structures; seed shiftcharts-docs-988c5e23.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->
`;

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="shiftcharts-docs min-h-screen">
        <template
          data-design-contract="shiftcharts-docs-988c5e23"
          dangerouslySetInnerHTML={{ __html: designContract }}
        />
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
