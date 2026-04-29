import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Calendar, User, Clock, ArrowLeft, BookOpen } from 'lucide-react';
import { Link } from 'react-router';

interface BlogPost {
  id: number;
  title: string;
  content: string;
  excerpt: string | null;
  author_name: string;
  author_council: string;
  approved_at: string;
  created_at: string;
}

export function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPost, setExpandedPost] = useState<number | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/blog/posts');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary to-primary/90 text-white py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center">
            <h1 className="text-[48px] font-semibold mb-4">
              Legal Insights & Perspectives
            </h1>
            <p className="text-[18px] opacity-90 leading-relaxed max-w-[800px] mx-auto">
              Expert legal analysis and insights from verified Pakistani lawyers on women's rights, family law, and emerging legal trends.
            </p>
          </div>
        </div>
      </div>

      {/* Blog Posts Section */}
      <div className="py-16">
        <div className="max-w-[1200px] mx-auto px-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-[24px] font-semibold text-foreground mb-2">No Blog Posts Yet</h3>
              <p className="text-[16px] text-muted-foreground">
                Our legal experts are preparing insightful content. Check back soon for valuable legal perspectives.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {posts.map(post => (
                <article key={post.id} className="bg-white border border-border rounded-[16px] p-8 shadow-[0px_8px_24px_rgba(15,23,42,0.08)] hover:shadow-[0px_12px_32px_rgba(15,23,42,0.12)] transition-shadow">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h2 className="text-[28px] font-bold text-foreground mb-2 leading-tight">
                        {post.title}
                      </h2>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{post.author_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(post.approved_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          <span>{post.author_council}</span>
                        </div>
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

                  {/* Content */}
                  <div className="text-[16px] text-foreground leading-relaxed">
                    {expandedPost === post.id ? (
                      <div className="prose max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: post.content }} />
                        <Button
                          variant="outline"
                          onClick={() => setExpandedPost(null)}
                          className="mt-6 text-primary border-primary hover:bg-primary hover:text-white"
                        >
                          Show Less
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="prose max-w-none line-clamp-4 mb-4">
                          <div dangerouslySetInnerHTML={{ __html: post.content }} />
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setExpandedPost(post.id)}
                          className="text-primary border-primary hover:bg-primary hover:text-white"
                        >
                          Read
                        </Button>
                      </div>
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
