import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="h-screen bg-gray-950 overflow-hidden">
      <Sidebar />
      <main className="ml-64 h-screen transition-all duration-300 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
