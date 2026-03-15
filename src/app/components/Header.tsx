import { Link, useLocation } from 'react-router';
import { Button } from './ui/button';
import { useAppContext } from '../context/AppContext';
import { LogOut, User, Menu, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export function Header() {
  const location = useLocation();
  const { 
    isAuthenticated, setIsAuthenticated, setUserProfile, 
    clearAllSessions, setGuidanceSummary, lawyerProfile, userEmail,
    setUserEmail, setLawyerProfile, setInterviewCompleted,
    setUserRole, setLawyerOnboardingCompleted, userRole
  } = useAppContext();
  const isLawyerDashboard = location.pathname === '/lawyer-dashboard';
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const getInitials = () => {
    if (lawyerProfile?.full_name) {
      const names = lawyerProfile.full_name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    if (userEmail) {
      return userEmail[0].toUpperCase();
    }
    return 'U';
  };

  const getDisplayName = () => {
    if (lawyerProfile?.full_name) {
      return `Adv. ${lawyerProfile.full_name}`;
    }
    if (userEmail) {
      return userEmail.split('@')[0];
    }
    return 'User';
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setShowMobileMenu(false);
      }
    };

    if (showUserMenu || showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu, showMobileMenu]);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUserProfile(null);
    clearAllSessions();
    setGuidanceSummary(null);
    setUserEmail('');
    setLawyerProfile(null);
    setInterviewCompleted(false);
    setUserRole('user');
    setLawyerOnboardingCompleted(false);
    setShowUserMenu(false);
    window.location.href = '/';
  };
  
  if (isLawyerDashboard) {
    return (
      <header className="bg-white border-b border-border">
        <div className="max-w-[1200px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="font-bold text-[20px] text-foreground">RAAH</div>
            </Link>
          </div>
          <div className="flex items-center gap-3 relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                {getInitials()}
              </div>
              <span className="text-[15px] font-semibold">{getDisplayName()}</span>
            </button>
            
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-border rounded-[10px] shadow-[0px_8px_24px_rgba(15,23,42,0.15)] py-2 z-50" ref={menuRef}>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-[14px] text-foreground hover:bg-accent flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-border">
      <div className="max-w-[1200px] mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex flex-col">
            <div className="font-bold text-[20px] text-foreground">RAAH</div>
            <div className="text-[11px] text-muted-foreground">Rights Awareness Assistance Hub</div>
          </Link>
        </div>
        <div className="flex items-center gap-4 lg:gap-6">
          <button
            className="md:hidden text-foreground p-1"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            {showMobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-[15px] text-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <Link to="/how-it-works" className="text-[15px] text-foreground hover:text-primary transition-colors">
              How It Works
            </Link>
            <Link to="/lawyers" className="text-[15px] text-foreground hover:text-primary transition-colors">
              Verified Lawyers
            </Link>
            <Link to="/about" className="text-[15px] text-foreground hover:text-primary transition-colors">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {userRole === 'admin' ? (
                  <Link to="/admin">
                    <Button className="bg-purple-600 text-white hover:bg-purple-700">
                      Admin Panel
                    </Button>
                  </Link>
                ) : (
                  <Link to={userRole === 'lawyer' ? '/lawyer-dashboard' : '/chat'}>
                    <Button className="bg-primary text-white hover:bg-primary/90">
                      My Dashboard
                    </Button>
                  </Link>
                )}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white font-semibold">
                      {getInitials()}
                    </div>
                  </button>
                  
                  {showUserMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-border rounded-[10px] shadow-[0px_8px_24px_rgba(15,23,42,0.15)] py-2 z-50" ref={menuRef}>
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left text-[14px] text-foreground hover:bg-accent flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/signup" className="hidden sm:block">
                  <Button variant="outline" className="border-primary text-primary hover:bg-primary/5">
                    Login
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="bg-primary text-white hover:bg-primary/90">
                    Start Legal Check
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {showMobileMenu && (
        <div ref={mobileMenuRef} className="md:hidden absolute top-20 left-0 w-full bg-white border-b border-border shadow-lg z-40 py-4 px-6 flex flex-col gap-4">
          <Link to="/" onClick={() => setShowMobileMenu(false)} className="text-[15px] font-medium text-foreground hover:text-primary transition-colors py-2 border-b border-border/50">
            Home
          </Link>
          <Link to="/how-it-works" onClick={() => setShowMobileMenu(false)} className="text-[15px] font-medium text-foreground hover:text-primary transition-colors py-2 border-b border-border/50">
            How It Works
          </Link>
          <Link to="/lawyers" onClick={() => setShowMobileMenu(false)} className="text-[15px] font-medium text-foreground hover:text-primary transition-colors py-2 border-b border-border/50">
            Verified Lawyers
          </Link>
          <Link to="/about" onClick={() => setShowMobileMenu(false)} className="text-[15px] font-medium text-foreground hover:text-primary transition-colors py-2">
            About
          </Link>
        </div>
      )}
    </header>
  );
}