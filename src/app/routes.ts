import { createBrowserRouter } from 'react-router';
import { Landing } from './pages/Landing';
import { AIChat } from './pages/AIChat';
import { GuidanceSummary } from './pages/GuidanceSummary';
import { LawyerMarketplace } from './pages/LawyerMarketplace';
import { LawyerDashboard } from './pages/LawyerDashboard';
import { Interview } from './pages/Interview';
import { SignUp } from './pages/SignUp';
import { LawyerOnboarding } from './pages/LawyerOnboarding';
import { LawyerSubscription } from './pages/LawyerSubscription';
import { About } from './pages/About';
import { HowItWorks } from './pages/HowItWorks';
import { WhyJoinRaah } from './pages/WhyJoinRaah';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminUsers } from './pages/AdminUsers';
import { AdminInterviews } from './pages/AdminInterviews';
import { AdminAiSystem } from './pages/AdminAiSystem';
import { AdminLawyers } from './pages/AdminLawyers';
import { AdminPayments } from './pages/AdminPayments';
import { AdminAnalytics } from './pages/AdminAnalytics';
import { AdminConsultations } from './pages/AdminConsultations';
import { MatchedLawyers } from './pages/MatchedLawyers';
import { UserConsultations } from './pages/UserConsultations';
import { PeerConsultationMarketplace } from './pages/PeerConsultationMarketplace';
import { PeerConsultantDashboard } from './pages/PeerConsultantDashboard';
import { PeerConsultationSession } from './pages/PeerConsultationSession';
import { Blog } from './pages/Blog';
import { LawyerBlog } from './pages/LawyerBlog';
import { AdminBlogs } from './pages/AdminBlogs';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Landing,
  },
  {
    path: '/interview',
    Component: Interview,
  },
  {
    path: '/signup',
    Component: SignUp,
  },
  {
    path: '/chat',
    Component: AIChat,
  },
  {
    path: '/guidance-summary',
    Component: GuidanceSummary,
  },
  {
    path: '/lawyers',
    Component: LawyerMarketplace,
  },
  {
    path: '/lawyer-dashboard',
    Component: LawyerDashboard,
  },
  {
    path: '/lawyer-onboarding',
    Component: LawyerOnboarding,
  },
  {
    path: '/lawyer-subscription',
    Component: LawyerSubscription,
  },
  {
    path: '/how-it-works',
    Component: HowItWorks,
  },
  {
    path: '/about',
    Component: About,
  },
  {
    path: '/admin',
    Component: AdminDashboard,
  },
  {
    path: '/admin/users',
    Component: AdminUsers,
  },
  {
    path: '/admin/interviews',
    Component: AdminInterviews,
  },
  {
    path: '/admin/ai-system',
    Component: AdminAiSystem,
  },
  {
    path: '/admin/lawyers',
    Component: AdminLawyers,
  },
  {
    path: '/admin/payments',
    Component: AdminPayments,
  },
  {
    path: '/admin/analytics',
    Component: AdminAnalytics,
  },
  {
    path: '/admin/consultations',
    Component: AdminConsultations,
  },
  {
    path: '/why-join-raah',
    Component: WhyJoinRaah,
  },
  {
    path: '/matched-lawyers',
    Component: MatchedLawyers,
  },
  {
    path: '/my-consultations',
    Component: UserConsultations,
  },
  {
    path: '/lawyer/consultants',
    Component: PeerConsultationMarketplace,
  },
  {
    path: '/lawyer/consultant-dashboard',
    Component: PeerConsultantDashboard,
  },
  {
    path: '/lawyer/consult-session/:id',
    Component: PeerConsultationSession,
  },
  {
    path: '/blog',
    Component: Blog,
  },
  {
    path: '/lawyer-blog',
    Component: LawyerBlog,
  },
  {
    path: '/admin/blogs',
    Component: AdminBlogs,
  },
]);