import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Search, Star, Filter, ArrowLeft, Video, Clock, Briefcase, X, Loader2, CheckCircle } from 'lucide-react';
import { Link } from 'react-router';
import { useAppContext } from '../context/AppContext';

interface Consultant {
  lawyer_id: number;
  full_name: string;
  title: string;
  bio_snippet: string;
  specialization_tags: string[];
  rate_per_session: string;
  rate_per_hour: string;
  session_duration_minutes: number;
  years_of_experience: number;
}

export function PeerConsultationMarketplace() {
  const { lawyerProfile } = useAppContext();
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isApprovedConsultant, setIsApprovedConsultant] = useState(false);

  // Booking modal state
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
  const [caseSummary, setCaseSummary] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    const fetchConsultants = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/consultations/listings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setConsultants(data);
        }
      } catch (err) {
        console.error('Failed to fetch consultants:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchMyProfile = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/consultations/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.is_approved) {
            setIsApprovedConsultant(true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      }
    };

    fetchConsultants();
    fetchMyProfile();
  }, []);

  const handleOpenBooking = (consultant: Consultant) => {
    setSelectedConsultant(consultant);
    setCaseSummary('');
    setBookingError('');
    setBookingSuccess(false);
  };

  const handleCloseModal = () => {
    setSelectedConsultant(null);
    setBookingSuccess(false);
  };

  const handleSubmitBooking = async () => {
    if (!selectedConsultant || !caseSummary.trim()) return;
    setIsBooking(true);
    setBookingError('');

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/consultations/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          consultant_id: selectedConsultant.lawyer_id,
          case_summary: caseSummary
        })
      });

      if (res.ok) {
        setBookingSuccess(true);
      } else {
        const data = await res.json();
        setBookingError(data.error || 'Failed to submit request. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setBookingError('An unexpected error occurred. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  const filteredConsultants = consultants.filter(c =>
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.specialization_tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
        <div className="mb-6 flex items-center justify-between">
          <Link to="/lawyer-dashboard">
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-muted/10 h-10 px-4 text-[14px] font-medium rounded-[10px]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          {isApprovedConsultant && (
            <Link to="/lawyer/consultant-dashboard">
              <Button className="bg-primary text-white hover:bg-primary/90 h-10 px-4 text-[14px] font-medium rounded-[10px]">
                Manage My Consultations
              </Button>
            </Link>
          )}
        </div>

        <div className="mb-8">
          <h1 className="text-[32px] font-bold text-slate-900 mb-2">Peer Consultation Marketplace</h1>
          <p className="text-slate-600 text-[16px] max-w-2xl">
            Connect with senior legal experts and peers for case reviews, strategic advice, and second opinions. All sessions are secure and confidential.
          </p>
        </div>

        <div className="bg-white p-4 rounded-[12px] shadow-[0px_4px_16px_rgba(15,23,42,0.04)] mb-8 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search by name, specialty, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 bg-slate-50 border-slate-200 text-[15px] rounded-[8px]"
            />
          </div>
          <Button variant="outline" className="h-12 px-6 gap-2 border-slate-200 rounded-[8px]">
            <Filter className="w-4 h-4" /> Filters
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-[16px] h-[300px] animate-pulse border border-slate-100"></div>
            ))}
          </div>
        ) : filteredConsultants.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[16px] border border-slate-100">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No consultants found</h3>
            <p className="text-slate-500">Try adjusting your search criteria or check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredConsultants.map((consultant) => (
              <div key={consultant.lawyer_id} className="bg-white border border-slate-100 rounded-[16px] overflow-hidden hover:shadow-[0px_12px_24px_rgba(15,23,42,0.08)] transition-all duration-300 flex flex-col">
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center text-primary text-xl font-bold border border-primary/10">
                      {consultant.full_name.charAt(0)}
                    </div>
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      4.9
                    </div>
                  </div>

                  <h3 className="text-[18px] font-bold text-slate-900 mb-1 leading-tight">{consultant.full_name}</h3>
                  <p className="text-[14px] text-primary font-medium mb-3">{consultant.title}</p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {(consultant.specialization_tags || []).map(tag => (
                      <span key={tag} className="bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-1 rounded-md">{tag}</span>
                    ))}
                  </div>

                  <p className="text-slate-600 text-[13px] line-clamp-3 mb-4 leading-relaxed">"{consultant.bio_snippet}"</p>

                  <div className="space-y-2 mt-auto pt-4 border-t border-slate-100">
                    <div className="flex items-center text-[13px] text-slate-600">
                      <Briefcase className="w-4 h-4 mr-2 text-slate-400" />
                      {consultant.years_of_experience} Years Experience
                    </div>
                    <div className="flex items-center justify-between text-[13px] text-slate-600">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-slate-400" />
                        {consultant.session_duration_minutes} min session
                      </div>
                      <div className="font-bold text-slate-900">
                        Rs. {consultant.rate_per_session || consultant.rate_per_hour}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <Button
                    onClick={() => handleOpenBooking(consultant)}
                    className="w-full bg-slate-900 text-white hover:bg-slate-800 gap-2 h-11 rounded-[8px]"
                  >
                    <Video className="w-4 h-4" /> Book Consultation
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {selectedConsultant && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-[520px] w-full shadow-[0px_24px_60px_rgba(0,0,0,0.2)] overflow-hidden">
            {bookingSuccess ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-[22px] font-bold text-slate-800 mb-2">Request Sent!</h3>
                <p className="text-slate-500 mb-6">
                  Your consultation request has been sent to <span className="font-semibold text-slate-800">{selectedConsultant.full_name}</span>. You'll be notified once they respond.
                </p>
                <Button onClick={handleCloseModal} className="bg-primary text-white hover:bg-primary/90 px-8">
                  Done
                </Button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center text-primary text-lg font-bold border border-primary/10">
                      {selectedConsultant.full_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-[17px]">{selectedConsultant.full_name}</h3>
                      <p className="text-[13px] text-primary">{selectedConsultant.title}</p>
                    </div>
                  </div>
                  <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Rate info */}
                <div className="px-6 py-4 bg-slate-50 flex items-center gap-6 text-[13px] text-slate-600 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {selectedConsultant.session_duration_minutes} min session
                  </div>
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    Rs. {selectedConsultant.rate_per_session || selectedConsultant.rate_per_hour}
                  </div>
                </div>

                {/* Form */}
                <div className="p-6">
                  <label className="block text-[14px] font-semibold text-slate-700 mb-2">
                    Brief Case Summary <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[12px] text-slate-500 mb-3">
                    Describe the legal matter you need advice on. This is encrypted and only visible to the consultant.
                  </p>
                  <Textarea
                    placeholder="e.g. I need advice on a property dispute involving an inheritance claim under Section 5 of the Family Laws Ordinance..."
                    value={caseSummary}
                    onChange={(e) => setCaseSummary(e.target.value)}
                    rows={5}
                    className="resize-none text-[14px]"
                  />

                  {bookingError && (
                    <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-[13px] p-3 rounded-[8px]">
                      {bookingError}
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={handleCloseModal}
                      className="flex-1"
                      disabled={isBooking}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmitBooking}
                      className="flex-1 bg-primary hover:bg-primary/90 text-white"
                      disabled={!caseSummary.trim() || isBooking}
                    >
                      {isBooking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Video className="w-4 h-4 mr-2" />}
                      {isBooking ? 'Sending Request...' : 'Send Request'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
