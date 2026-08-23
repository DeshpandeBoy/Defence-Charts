import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleCheck,
  faCircleInfo,
  faCircleXmark,
  faLightbulb,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { ResizeLab } from './resize-lab';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Callout: DocsCallout,
    ResizeLab,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}

type CalloutType = 'info' | 'warn' | 'error' | 'success' | 'idea';

function DocsCallout({
  children,
  title,
  type = 'info',
}: {
  readonly children: ReactNode;
  readonly title?: ReactNode;
  readonly type?: CalloutType;
}) {
  const icons = {
    info: faCircleInfo,
    warn: faTriangleExclamation,
    error: faCircleXmark,
    success: faCircleCheck,
    idea: faLightbulb,
  } as const;

  return (
    <aside className="gx-callout" data-type={type}>
      <FontAwesomeIcon icon={icons[type]} aria-hidden="true" />
      <div>
        {title === undefined ? null : <strong>{title}</strong>}
        <div className="gx-callout__body">{children}</div>
      </div>
    </aside>
  );
}
