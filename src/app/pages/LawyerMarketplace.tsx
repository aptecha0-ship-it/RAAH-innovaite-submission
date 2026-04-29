
import { useState, useEffect, useMemo } from 'react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Lawyer } from '../context/AppContext';
import {
  CheckCircle,
  Search,
  MapPin,
  Briefcase,
  Star,
  Loader2,
  Phone,
  Mail,
  Building2,
  X,
} from 'lucide-react';

// ─── Contact Modal ────────────────────────────────────────────────────────────
function ContactModal({ lawyer, onClose }: { lawyer: Lawyer; onClose: () => void }) {
  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-[460px] p-8 relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[22px] font-semibold text-foreground">{lawyer.name}</h2>
            {lawyer.verified && (
              <CheckCircle className="w-5 h-5 text-secondary flex-shrink-0" />
            )}
          </div>
          <p className="text-[14px] text-muted-foreground">{lawyer.specialization}</p>
        </div>

        {/* Details */}
        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">City</p>
              <p className="text-[15px] text-foreground">{lawyer.city}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Briefcase className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Experience</p>
              <p className="text-[15px] text-foreground">{lawyer.experience}</p>
            </div>
          </div>

          {lawyer.phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Phone</p>
                <a
                  href={`tel:${lawyer.phone}`}
                  className="text-[15px] text-secondary font-medium hover:underline"
                >
                  {lawyer.phone}
                </a>
              </div>
            </div>
          )}

          {lawyer.email && (
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Email</p>
                <a
                  href={`mailto:${lawyer.email}`}
                  className="text-[15px] text-secondary font-medium hover:underline break-all"
                >
                  {lawyer.email}
                </a>
              </div>
            </div>
          )}

          {lawyer.chamberAddress && (
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Chamber Address</p>
                <p className="text-[15px] text-foreground">{lawyer.chamberAddress}</p>
              </div>
            </div>
          )}

          {!lawyer.phone && !lawyer.email && !lawyer.chamberAddress && (
            <p className="text-[14px] text-muted-foreground italic">
              Contact details not available yet. Please check back later.
            </p>
          )}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col gap-3">
          {lawyer.phone && (
            <Button
              asChild
              className="w-full bg-secondary text-white hover:bg-secondary/90 rounded-[10px]"
            >
              <a href={`tel:${lawyer.phone}`} target="_blank" rel="noopener noreferrer">
                <Phone className="w-4 h-4 mr-2" />
                Call Now
              </a>
            </Button>
          )}
          {lawyer.email && (
            <Button
              asChild
              variant="outline"
              className="w-full rounded-[10px]"
            >
              <a 
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${lawyer.email}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </a>
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="w-full rounded-[10px] text-muted-foreground">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function LawyerMarketplace() {
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('All Cities');
  const [specFilter, setSpecFilter] = useState('All Specializations');
  const [expFilter, setExpFilter] = useState('All Experience');

  const [selectedLawyer, setSelectedLawyer] = useState<Lawyer | null>(null);

  useEffect(() => {
    const fetchLawyers = async () => {
      try {
        const res = await fetch('/api/lawyers');
        if (res.ok) {
          const data = await res.json();
          setLawyers(data);
        }
      } catch (err) {
        console.error('Failed to fetch lawyers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLawyers();
  }, []);

  const filteredLawyers = useMemo(() => {
    return lawyers.filter(lawyer => {
      const matchesSearch =
        lawyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lawyer.specialization.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCity = cityFilter === 'All Cities' || lawyer.city === cityFilter;
      const matchesSpec =
        specFilter === 'All Specializations' || lawyer.specialization.includes(specFilter);
      let matchesExp = true;
      if (expFilter !== 'All Experience') {
        const expYears = parseInt(lawyer.experience) || 0;
        if (expFilter === '5+ years') matchesExp = expYears >= 5;
        if (expFilter === '10+ years') matchesExp = expYears >= 10;
      }
      return matchesSearch && matchesCity && matchesSpec && matchesExp;
    });
  }, [lawyers, searchQuery, cityFilter, specFilter, expFilter]);

  const cities = useMemo(
    () => ['All Cities', ...Array.from(new Set(lawyers.map(l => l.city).filter(Boolean)))],
    [lawyers],
  );
  const defaultSpecs = ['Family Law', 'Domestic Violence', "Women's Rights", 'Divorce', 'Child Custody'];

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage: 'url("/varified lawyers.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Header />

      <div className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Page Header */}
        <div className="mb-8 bg-white/60 backdrop-blur-sm rounded-[14px] px-6 py-5">
          <h1 className="text-[32px] font-semibold text-foreground mb-2">
            Verified Lawyers Marketplace
          </h1>
          <p className="text-[16px] text-muted-foreground">
            Choose a trusted lawyer based on your city and issue type.
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-white/60 backdrop-blur-sm rounded-[12px] p-4">
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="px-4 py-2.5 border border-border rounded-[10px] text-[15px] text-foreground bg-white/80"
          >
            {cities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={specFilter}
            onChange={e => setSpecFilter(e.target.value)}
            className="px-4 py-2.5 border border-border rounded-[10px] text-[15px] text-foreground bg-white/80"
          >
            <option value="All Specializations">All Specializations</option>
            {defaultSpecs.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={expFilter}
            onChange={e => setExpFilter(e.target.value)}
            className="px-4 py-2.5 border border-border rounded-[10px] text-[15px] text-foreground bg-white/80"
          >
            <option value="All Experience">All Experience</option>
            <option value="5+ years">5+ years</option>
            <option value="10+ years">10+ years</option>
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search lawyers..."
              className="pl-10 rounded-[10px] bg-white/80"
            />
          </div>
        </div>

        {/* Lawyer Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-white/60 backdrop-blur-sm rounded-[16px]">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Loading verified lawyers...</p>
          </div>
        ) : filteredLawyers.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground bg-white/70 backdrop-blur-sm rounded-[10px] border border-border">
            <p className="text-[16px] font-medium text-slate-600">
              No lawyers found matching your filters.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery('');
                setCityFilter('All Cities');
                setSpecFilter('All Specializations');
                setExpFilter('All Experience');
              }}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLawyers.map(lawyer => (
              <div
                key={lawyer.id}
                className="bg-white/75 backdrop-blur-md border border-white/50 rounded-[10px] p-6 shadow-[0px_8px_24px_rgba(15,23,42,0.10)] hover:shadow-[0px_12px_32px_rgba(15,23,42,0.15)] hover:bg-white/90 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-[18px] font-semibold text-foreground mb-1">
                      {lawyer.name}
                    </h3>
                    {lawyer.verified && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-secondary" />
                        <span className="text-[13px] font-medium text-secondary">Verified</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 mb-6">
                  <div className="flex items-center gap-2 text-[14px] text-foreground">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{lawyer.city}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[14px] text-foreground">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span>{lawyer.specialization}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[14px] text-foreground">
                    <span className="text-muted-foreground">Experience:</span>
                    <span className="font-medium">{lawyer.experience}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-[14px] font-semibold text-foreground">{lawyer.rating}</span>
                  </div>
                </div>

                <Button
                  onClick={() => setSelectedLawyer(lawyer)}
                  className="w-full bg-secondary text-white hover:bg-secondary/90 rounded-[10px]"
                >
                  Consult Lawyer
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {selectedLawyer && (
        <ContactModal lawyer={selectedLawyer} onClose={() => setSelectedLawyer(null)} />
      )}
    </div>
  );
}
