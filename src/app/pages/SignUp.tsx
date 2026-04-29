import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAppContext } from '../context/AppContext';
import { Lock, Shield, CheckCircle, FileText } from 'lucide-react';

export function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'user';
  const { 
    setIsAuthenticated, setInterviewCompleted, setUserRole, 
    setLawyerOnboardingCompleted, setUserEmail, setLawyerProfile,
    setRawChatHistory, setUserProfile
  } = useAppContext();
  const [showLogin, setShowLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email, password: formData.password, role }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error(`Server error: ${response.statusText || response.status}`);
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to sign up');
      }

      // Store token in localStorage
      localStorage.setItem('auth_token', data.token);
      setIsAuthenticated(true);
      setInterviewCompleted(data.user?.interview_completed || false);
      setUserRole(data.user?.role || 'user');
      setLawyerOnboardingCompleted(data.user?.lawyer_onboarding_completed || false);
      setUserEmail(data.user?.email || '');

      if (data.user?.profile_summary) {
        setUserProfile(data.user?.profile_summary);
      }
      if (data.user?.chat_history) {
        setRawChatHistory(data.user?.chat_history);
      }

      if (data.user?.role === 'admin') {
        navigate('/admin');
      } else if (data.user?.role === 'lawyer') {
        if (data.user?.lawyer_onboarding_completed) {
          navigate('/lawyer-dashboard');
        } else {
          navigate('/lawyer-onboarding');
        }
      } else {
        if (data.user?.interview_completed) {
          navigate('/chat');
        } else {
          navigate('/interview');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error(`Server error: ${response.statusText || response.status}`);
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to login');
      }

      // Store token in localStorage
      localStorage.setItem('auth_token', data.token);
      setIsAuthenticated(true);
      setInterviewCompleted(data.user?.interview_completed || false);
      setUserRole(data.user?.role || 'user');
      setLawyerOnboardingCompleted(data.user?.lawyer_onboarding_completed || false);
      setUserEmail(data.user?.email || '');
      setLawyerProfile(data.user?.lawyer_profile || null);
      
      if (data.user?.profile_summary) {
        setUserProfile(data.user?.profile_summary);
      }
      if (data.user?.chat_history) {
        setRawChatHistory(data.user?.chat_history);
      }

      if (data.user?.role === 'admin') {
        navigate('/admin');
      } else if (data.user?.role === 'lawyer') {
        if (data.user?.lawyer_onboarding_completed) {
          navigate('/lawyer-dashboard');
        } else {
          navigate('/lawyer-onboarding');
        }
      } else {
        if (data.user?.interview_completed) {
          navigate('/chat');
        } else {
          navigate('/interview');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-center bg-no-repeat"
      style={{
        backgroundSize: '100% 100%',
        backgroundImage: 'url("/login.png")',
      }}
    >
      <Header />

      <div className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Benefits */}
          <div className="space-y-8">
            <div>
              <h1 className="text-[42px] font-bold text-foreground leading-[110%] mb-4">
                Access Your Confidential Legal Assessment
              </h1>
              <p className="text-[16px] text-muted-foreground leading-relaxed">
                Create your secure account to begin your personalized 10-question legal assessment and connect with verified legal support.
              </p>
            </div>

            {/* What You'll Get */}
            <div className="space-y-4">
              <h3 className="text-[18px] font-semibold text-foreground">
                What You'll Get:
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <CheckCircle className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-medium text-foreground">
                      Confidential Legal Assessment
                    </h4>
                    <p className="text-[13px] text-muted-foreground">
                      10-question interview to understand your unique situation
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <CheckCircle className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-medium text-foreground">
                      AI-Powered Legal Guidance
                    </h4>
                    <p className="text-[13px] text-muted-foreground">
                      Instant insights based on Pakistani law and your profile
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <CheckCircle className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-medium text-foreground">
                      Verified Lawyer Network
                    </h4>
                    <p className="text-[13px] text-muted-foreground">
                      Connect with trusted legal professionals when ready
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <CheckCircle className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-medium text-foreground">
                      Complete Privacy Protection
                    </h4>
                    <p className="text-[13px] text-muted-foreground">
                      End-to-end encryption and strict confidentiality
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center gap-6 pt-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-secondary" />
                <span className="text-[13px] font-medium text-foreground">100% Confidential</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-secondary" />
                <span className="text-[13px] font-medium text-foreground">Secure & Private</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-secondary" />
                <span className="text-[13px] font-medium text-foreground">Free Assessment</span>
              </div>
            </div>
          </div>

          {/* Right Column - Auth Form */}
          <div className="lg:pl-12">
            <div className="bg-white border border-border rounded-[10px] p-8 shadow-[0px_16px_48px_rgba(15,23,42,0.12)]">
              {/* Lock Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
                  <Lock className="w-7 h-7 text-secondary" />
                </div>
              </div>

              {/* Form Title */}
              <h2 className="text-[24px] font-semibold text-foreground text-center mb-6">
                {showLogin ? 'Log In to Your Account' : 'Create Your Account'}
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-[13px]">
                  {error}
                </div>
              )}

              {/* Login Form */}
              {showLogin ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email Address</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="h-12 rounded-[10px]"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="h-12 rounded-[10px]"
                      required
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      className="w-full bg-primary text-white hover:bg-primary/90 h-12 text-[15px] font-semibold rounded-[10px]"
                    >
                      Log In
                    </Button>
                  </div>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-[13px]">
                      <span className="bg-white px-4 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setShowLogin(false)}
                    variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary/5 h-12 text-[15px] font-semibold rounded-[10px]"
                  >
                    Sign Up
                  </Button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setShowLogin(false)}
                      className="text-[13px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      Don't have an account? <span className="font-semibold text-primary">Create one</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Sign Up Form */
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="h-12 rounded-[10px]"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Create a secure password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="h-12 rounded-[10px]"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Re-enter your password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="h-12 rounded-[10px]"
                      required
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      className="w-full bg-primary text-white hover:bg-primary/90 h-12 text-[15px] font-semibold rounded-[10px]"
                    >
                      Sign Up
                    </Button>
                  </div>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-[13px]">
                      <span className="bg-white px-4 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setShowLogin(true)}
                    variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary/5 h-12 text-[15px] font-semibold rounded-[10px]"
                  >
                    Log In
                  </Button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setShowLogin(true)}
                      className="text-[13px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      Already have an account? <span className="font-semibold text-primary">Log In</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Privacy Notice */}
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-muted-foreground">
                    Your privacy is protected. We use end-to-end encryption and never share your information without consent.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
