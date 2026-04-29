import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { ArrowLeft, Plus, Send, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

interface BlogPost {
  id: number;
  title: string;
  content: string;
  excerpt: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export function LawyerBlog() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: ''
  });

  useEffect(() => {
    fetchMyPosts();
  }, []);

  const fetchMyPosts = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        navigate('/signup');
        return;
      }

      const res = await fetch('/api/blog/my-posts', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error('Failed to fetch blog posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/blog/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          content: formData.content.trim(),
          excerpt: formData.excerpt.trim() || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(prev => [data.post, ...prev]);
        setFormData({ title: '', content: '', excerpt: '' });
      }
    } catch (err) {
      console.error('Failed to create blog post:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundImage: 'url("/Lawyer dashboard.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Header />
      
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Back button */}
        <div className="mb-6">
          <Link to="/lawyer-dashboard">
            <Button variant="outline" className="border-border text-foreground hover:bg-muted">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[32px] font-bold text-foreground mb-2">My Blog Posts</h1>
          <p className="text-[16px] text-muted-foreground">
            Share legal insights and analysis. Posts require admin approval before appearing publicly.
          </p>
        </div>

        {/* Create New Post Form */}
        <div className="bg-white border border-border rounded-[16px] p-8 mb-8 shadow-[0px_8px_24px_rgba(15,23,42,0.08)]">
          <h2 className="text-[20px] font-semibold text-foreground mb-6">Create New Blog Post</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[14px] font-medium text-foreground mb-2">
                Title
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter a compelling title for your blog post"
                className="w-full"
                required
              />
            </div>

            <div>
              <label className="block text-[14px] font-medium text-foreground mb-2">
                Excerpt (Optional - 3-4 lines preview)
              </label>
              <Input
                value={formData.excerpt}
                onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                placeholder="Brief summary that will appear in blog listings"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-[14px] font-medium text-foreground mb-2">
                Content
              </label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Write your legal insights, analysis, or case studies here..."
                className="w-full min-h-[200px] resize-none"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isCreating || !formData.title.trim() || !formData.content.trim()}
              className="w-full bg-primary text-white hover:bg-primary/90"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin mr-2" />
                  Submitting for Approval...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit for Admin Approval
                </>
              )}
            </Button>
          </form>
        </div>

        {/* My Posts */}
        <div>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-[18px] font-semibold text-foreground mb-2">No Blog Posts Yet</h3>
              <p className="text-[14px] text-muted-foreground">
                Start sharing your legal expertise by creating your first blog post.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map(post => (
                <article key={post.id} className="bg-white border border-border rounded-[16px] p-6 shadow-[0px_8px_24px_rgba(15,23,42,0.08)]">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-[20px] font-semibold text-foreground mb-2">
                        {post.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{formatDate(post.created_at)}</span>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-[12px] font-medium ${getStatusBadge(post.status)}`}>
                          {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Excerpt */}
                  {post.excerpt && (
                    <div className="bg-accent/50 rounded-xl p-4 mb-4 border border-accent/20">
                      <p className="text-[15px] text-foreground leading-relaxed">
                        {post.excerpt}
                      </p>
                    </div>
                  )}

                  {/* Content Preview */}
                  <div className="text-[14px] text-muted-foreground leading-relaxed">
                    {post.content.length > 200 ? (
                      <p>{post.content.substring(0, 200)}...</p>
                    ) : (
                      <p>{post.content}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
