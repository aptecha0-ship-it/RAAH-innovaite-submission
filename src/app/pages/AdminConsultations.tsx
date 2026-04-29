import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Briefcase, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

interface ConsultantProfile {
  id: number;
  lawyer_id: number;
  full_name: string;
  city: string;
  practice_areas: string;
  years_of_experience: number;
  bar_council_name: string;
  bar_council_number: string;
  title: string;
  bio_snippet: string;
  rate_per_session: number;
  is_approved: boolean;
  created_at: string;
}

export function AdminConsultations() {
  const [profiles, setProfiles] = useState<ConsultantProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; id: number | null; approve: boolean }>({ isOpen: false, id: null, approve: false });

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/consultations/applications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch applications');
      const data = await res.json();
      setProfiles(data);
    } catch (err) {
      setError('Could not load consultant applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleStatusChange = async (id: number, approve: boolean) => {
    setConfirmDialog({ isOpen: false, id: null, approve: false });
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/admin/consultations/applications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_approved: approve })
      });
      if (!res.ok) throw new Error('Failed to update status');
      fetchProfiles();
    } catch (err) {
      console.error(err);
      alert('Error updating status.');
    }
  };

  const filteredProfiles = profiles.filter(p => {
    if (filter === 'pending') return !p.is_approved;
    if (filter === 'approved') return p.is_approved;
    return true;
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-slate-800 flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-primary" />
            Peer Consultant Applications
          </h1>
          <p className="text-slate-500 mt-2">Review and approve lawyers applying to offer paid peer consultations.</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-[10px] mb-8">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <Button 
          variant={filter === 'pending' ? 'default' : 'outline'} 
          onClick={() => setFilter('pending')}
          className="rounded-full"
        >
          <Clock className="w-4 h-4 mr-2" /> Pending Applications
        </Button>
        <Button 
          variant={filter === 'approved' ? 'default' : 'outline'} 
          onClick={() => setFilter('approved')}
          className="rounded-full"
        >
          <CheckCircle className="w-4 h-4 mr-2" /> Approved Consultants
        </Button>
        <Button 
          variant={filter === 'all' ? 'default' : 'outline'} 
          onClick={() => setFilter('all')}
          className="rounded-full"
        >
          All
        </Button>
      </div>

      <div className="bg-white rounded-[16px] shadow-[0px_8px_24px_rgba(15,23,42,0.04)] border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading records...</div>
        ) : filteredProfiles.length === 0 ? (
          <div className="p-12 text-center text-slate-500">No {filter} applications found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] text-slate-600">
              <thead className="bg-slate-50 text-[12px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Lawyer Details</th>
                  <th className="px-6 py-4">Proposed Title & Rate</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProfiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{profile.full_name}</div>
                      <div className="text-[12px] text-slate-500 mt-0.5">{profile.years_of_experience} years exp. | {profile.city}</div>
                      <div className="text-[11px] text-slate-400 mt-1">Bar: {profile.bar_council_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{profile.title}</div>
                      <div className="text-[12px] text-primary mt-0.5">Rs {profile.rate_per_session} / session</div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 max-w-xs mt-1">{profile.bio_snippet}</p>
                    </td>
                    <td className="px-6 py-4">
                      {profile.is_approved ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200"><CheckCircle className="w-3 h-3" /> Approved</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200"><Clock className="w-3 h-3" /> Pending</span>
                      )}
                      <div className="text-[11px] text-slate-400 mt-2">
                        Applied: {new Date(profile.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!profile.is_approved ? (
                        <Button size="sm" onClick={() => setConfirmDialog({ isOpen: true, id: profile.id, approve: true })} className="bg-green-600 hover:bg-green-700 text-white h-7 px-3 text-[12px] rounded">
                          Approve Profile
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setConfirmDialog({ isOpen: true, id: profile.id, approve: false })} className="border-red-200 text-red-600 hover:bg-red-50 h-7 px-3 text-[12px] rounded">
                          Revoke Approval
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog({ isOpen: false, id: null, approve: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmDialog.approve ? 'approve' : 'revoke'} this consultant profile? 
              {confirmDialog.approve ? " They will now appear in the Peer Consultation Marketplace." : " They will be hidden from the Marketplace."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDialog.id && handleStatusChange(confirmDialog.id, confirmDialog.approve)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
