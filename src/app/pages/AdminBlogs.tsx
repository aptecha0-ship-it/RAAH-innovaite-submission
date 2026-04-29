import React, { useState, useEffect } from 'react';
import { BookOpen, Check, X, AlertCircle } from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { Button } from '../components/ui/button';

interface BlogPost {
  id: number;
  lawyer_id: number;
  title: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  author_name: string;
  author_council: string;
}

export function AdminBlogs() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);

  const fetchPosts = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/blog/posts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch pending blog posts');
      const data = await res.json();
      setPosts(data);
    } catch (err: any) {
      setError(err.message || 'Could not load blog data. Ensure you have admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleUpdateStatus = async (id: number, action: 'approve' | 'reject') => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/admin/blog/posts/${id}/${action}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error(`Failed to ${action} post`);
      
      setPosts(posts.filter(p => p.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-slate-800 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            Blog Approvals
          </h1>
          <p className="text-slate-500 mt-2">Review and approve lawyer submitted blog posts.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white px-4 py-2 rounded-[10px] border border-slate-200 shadow-sm flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-slate-400" />
            <span className="text-[15px] font-medium text-slate-700">Pending: {posts.length}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-[10px] mb-8 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500 bg-white rounded-[16px] border border-slate-200 shadow-sm">
            Loading pending blog posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-white rounded-[16px] border border-slate-200 shadow-sm">
            No pending blog posts to review.
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="bg-white rounded-[16px] shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-[20px] font-semibold text-slate-900">{post.title}</h2>
                  <p className="text-[14px] text-slate-500 mt-1">
                    By {post.author_name} ({post.author_council}) • Submitted on {new Date(post.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => handleUpdateStatus(post.id, 'reject')}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button 
                    onClick={() => handleUpdateStatus(post.id, 'approve')}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className={`prose max-w-none text-slate-700 ${expandedPostId === post.id ? '' : 'line-clamp-4'}`}>
                  <div dangerouslySetInnerHTML={{ __html: post.content }} />
                </div>
                
                <Button 
                  variant="ghost" 
                  onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                  className="mt-4 text-primary hover:text-primary/80 p-0 h-auto font-medium"
                >
                  {expandedPostId === post.id ? 'Show Less' : 'Read Full Post'}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
}
