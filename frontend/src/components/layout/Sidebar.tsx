import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  DollarSign,
  Users,
  Workflow,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Github,
} from 'lucide-react';
import clsx from 'clsx';
import { IS_STATIC, getManifest } from '../../services/staticData';
import { formatDate } from '../../utils/formatters';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { name: 'Executive', href: '/', icon: LayoutDashboard },
  { name: 'Revenue', href: '/revenue', icon: DollarSign },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Operations', href: '/operations', icon: Workflow },
  { name: 'Forecasting', href: '/forecasting', icon: TrendingUp },
];

const SOURCE_URL = 'https://github.com/ryansansbury/analytics_dashboard';

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 text-white" aria-hidden="true">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
          <rect x="2" y="8" width="2.5" height="6" rx="1" />
          <rect x="6.75" y="5" width="2.5" height="9" rx="1" />
          <rect x="11.5" y="2" width="2.5" height="12" rx="1" />
        </svg>
      </span>
      {!compact && <span className="text-base font-semibold text-white">Analytics</span>}
    </span>
  );
}

/**
 * The data note. The demo's data is synthetic and frozen at the date it was
 * generated, and its date presets resolve against that date. Saying both is
 * the honest thing: without it the dashboard silently claims to be a real
 * business, current to today.
 */
function DataNote() {
  const manifest = IS_STATIC ? getManifest() : null;
  return (
    <p className="text-[11px] leading-relaxed text-gray-500">
      Synthetic data
      {manifest && <> &middot; as of {formatDate(manifest.snapshotDate)}</>}
    </p>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-gray-800 bg-gray-900 transition-all duration-300 lg:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-gray-800 px-3">
        <Brand compact={collapsed} />
        {!collapsed && (
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 p-2" aria-label="Pages">
        {collapsed && (
          <button
            onClick={onToggle}
            className="mb-1 flex justify-center rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/'}
            title={collapsed ? item.name : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                collapsed && 'justify-center',
                isActive ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white',
              )
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="mt-auto space-y-2 border-t border-gray-800 px-4 py-3">
          <DataNote />
          <a
            href={SOURCE_URL}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"
          >
            <Github className="h-3.5 w-3.5" />
            Source on GitHub
          </a>
        </div>
      )}
    </aside>
  );
}

/** The page links for narrow screens, where the sidebar would take half the width. */
export function MobileNav() {
  return (
    <div className="border-b border-gray-800 bg-gray-900 lg:hidden">
      <div className="flex items-center justify-between px-4 pt-3">
        <Brand />
        <DataNote />
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 py-2" aria-label="Pages">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              clsx(
                'flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
                isActive ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white',
              )
            }
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
