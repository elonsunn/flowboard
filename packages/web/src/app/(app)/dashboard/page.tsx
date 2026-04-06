import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-500">Select a workspace and project from the sidebar to get started.</p>
    </div>
  );
}
