import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      <main className="ml-64 min-h-screen transition-all duration-300">
        <Outlet />
      </main>
    </div>
  );
}
