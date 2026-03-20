import { Outlet, NavLink, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { requireAdmin } from '~/modules/admin.server';

export const meta: MetaFunction = () => [{ name: 'robots', content: 'noindex, nofollow' }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  return { email: user.email };
}

export default function AdminLayout() {
  const { email } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-base-200">
      <nav className="navbar bg-base-100 shadow-sm">
        <div className="flex-1">
          <span className="text-xl font-bold px-4">管理画面</span>
        </div>
        <div className="flex-none gap-4">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
          >
            記事一覧
          </NavLink>
          <NavLink
            to="/admin/merge"
            className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
          >
            記事統合
          </NavLink>
          <span className="text-sm opacity-60">{email}</span>
        </div>
      </nav>
      <main className="container mx-auto p-4 max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}
