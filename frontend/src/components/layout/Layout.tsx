import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { MobileNav, Sidebar } from './Sidebar';

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      {/* The content's margin follows the sidebar's width. It used to be a
        * fixed ml-64, so collapsing the sidebar left a 192px empty strip. */}
      <div className={clsx('min-w-0 transition-[margin] duration-300', collapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        <MobileNav />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
