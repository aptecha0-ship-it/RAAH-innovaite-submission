import { Link } from 'react-router';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Lock, CheckCircle, Shield, Users } from 'lucide-react';

export function Landing() {
  return (
    <div 
      className="min-h-screen bg-center bg-no-repeat"
      style={{
        backgroundSize: '100% 100%',
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.35)), url("/home-bg.png?v=5")',
      }}
    >
      <Header />
      
      {/* Hero Section */}
      <section className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-12 items-center">
          {/* Left Column */}
          <div className="space-y-6">
            <h1 className="text-[52px] font-bold leading-[110%] text-foreground">
              Understand Your Rights. Take the Right Step.
            </h1>
            
            <p className="text-[16px] text-foreground leading-relaxed max-w-[560px]">
              RAAH provides AI-powered legal guidance for Pakistani women and connects you with verified lawyers when you're ready to take action.
            </p>
            
            <div className="flex items-center gap-4 pt-4">
              <Link to="/signup">
                <Button className="bg-primary text-white hover:bg-primary/90 h-12 px-6 text-[15px] font-semibold rounded-[10px]">
                  Start Confidential Legal Check
                </Button>
              </Link>
              <Link to="/signup?role=lawyer">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary/5 h-12 px-6 text-[15px] font-semibold rounded-[10px]">
                  I'm a Lawyer
                </Button>
              </Link>
            </div>

            <div className="pt-2">
              <Link to="/why-join-raah" className="text-[13px] text-primary hover:underline font-medium">
                Why join RAAH as a lawyer? →
              </Link>
            </div>
            
            <div className="pt-4">
              <div className="inline-flex items-center gap-2 bg-accent px-4 py-2.5 rounded-full">
                <Lock className="w-4 h-4 text-secondary" />
                <span className="text-[13px] font-medium text-secondary">
                  100% Confidential & Secure
                </span>
              </div>
            </div>
          </div>
          
          {/* Right Column */}
          <div className="bg-white border border-border rounded-[10px] p-6 shadow-[0px_8px_24px_rgba(15,23,42,0.08)]">
            <h3 className="text-[20px] font-semibold text-foreground mb-4">
              AI Guidance Preview
            </h3>
            
            <div className="space-y-3">
              <div className="bg-[#F1F5F9] rounded-[10px] p-4">
                <p className="text-[14px] text-foreground">
                  "I need help understanding my legal options..."
                </p>
              </div>
              
              <div className="bg-accent/50 rounded-[10px] p-4">
                <p className="text-[14px] text-foreground font-medium mb-2">
                  AI Assistant Response:
                </p>
                <p className="text-[13px] text-muted-foreground">
                  I understand you're seeking legal guidance. Let me help you understand your rights and options under Pakistani law.
                </p>
              </div>
              
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  <span className="text-[13px] text-foreground">
                    Identify your legal issue
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  <span className="text-[13px] text-foreground">
                    Understand relevant laws
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  <span className="text-[13px] text-foreground">
                    Connect with verified lawyers
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Trust Bar */}
      <section className="bg-[#F8FAFC] border-t border-b border-border py-8">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-secondary" />
              <span className="text-[15px] font-medium text-foreground">
                Verified Lawyers
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-secondary" />
              <span className="text-[15px] font-medium text-foreground">
                Pakistan Law Coverage
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Lock className="w-8 h-8 text-secondary" />
              <span className="text-[15px] font-medium text-foreground">
                Privacy Protected
              </span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-secondary" />
              <span className="text-[15px] font-medium text-foreground">
                Built for Women's Safety
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}