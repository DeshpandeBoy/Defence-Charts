import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      sidebar={{
        collapsible: true,
        banner: (
          <div key="implementation-status" className="gx-docs-status">
            <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
            <span>A1–A6 and B1–B3 implemented</span>
          </div>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
