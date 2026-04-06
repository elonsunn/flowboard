import { redirect } from 'next/navigation';

// Root path → redirect to the main app or login.
// AuthGuard inside (app)/layout.tsx handles the actual auth check.
export default function RootPage() {
  redirect('/dashboard');
}
