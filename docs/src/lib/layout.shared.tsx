import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="gx-docs-brand">
          <strong>{appName}</strong>
          <span>documentation</span>
        </span>
      ),
      url: '/docs',
      transparentMode: 'none',
    },
    links: [
      {
        text: 'Roadmap',
        url: '/docs/roadmap',
        active: 'url',
      },
    ],
  };
}
