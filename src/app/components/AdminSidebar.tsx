import { Link, useLocation } from 'react-router';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Bot, 
  Scale, 
  CreditCard, 
  BarChart3,
  Briefcase
} from 'lucide-react';

const sidebarLinks = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { name: 'Users', path: '/admin/users', icon: Users },
  { name: 'Interviews', path: '/admin/interviews', icon: FileText },
  { name: 'AI System', path: '/admin/ai-system', icon: Bot },
  { name: 'Lawyers', path: '/admin/lawyers', icon: Scale },
  { name: 'Consultants', path: '/admin/consultations', icon: Briefcase },
  { name: 'Blog Approvals', path: '/admin/blogs', icon: FileText },
  { name: 'Payments', path: '/admin/payments', icon: CreditCard },
  { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
];

export function AdminSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-slate-900 min-h-screen text-slate-300 flex flex-col fixed left-0 top-0 bottom-0">
      <div className="h-20 flex items-center px-6 border-b border-slate-800">
        <Link to="/admin" className="flex items-center gap-2">
          <div className="font-bold text-[20px] text-white">RAAH Admin</div>
        </Link>
      </div>
      
      <div className="flex-1 py-6 px-4 flex flex-col gap-2 overflow-y-auto">
        {sidebarLinks.map((link) => {
          const isActive = location.pathname === link.path || 
                          (link.path !== '/admin' && location.pathname.startsWith(link.path));
          const Icon = link.icon;
          
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-[10px] transition-colors ${
                isActive 
                  ? 'bg-primary text-white' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium text-[15px]">{link.name}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
