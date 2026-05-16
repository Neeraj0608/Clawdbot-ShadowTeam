'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface StudentProfile {
  id: number;
  userId: number;
  skills: string | null;
  experience: string | null;
  interests: string | null;
  resumeUrl: string | null;
  resumeFileName: string | null;
  isComplete: boolean;
  updatedAt: string;
}

interface TicketItem {
  ticketId: string;
  type: 'FACILITY_BOOKING' | 'HACKATHON_SELECTION';
  status: 'ACTIVE' | 'USED' | 'CANCELLED';
  title: string;
  subjectName: string;
  scheduledAt: string | null;
  issuedAt: string;
  usedAt: string | null;
  downloadUrl: string;
}

export default function ProfileClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    skills: '',
    experience: '',
    interests: '',
    resume: null as File | null,
    github: '',
    linkedin: '',
  });
  const [isScanning, setIsScanning] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data.data);
          setFormData({
            skills: data.data.skills || '',
            experience: data.data.experience || '',
            interests: data.data.interests || '',
            resume: null,
          });
        } else if (res.status === 404) {
          setProfile(null);
        } else {
          setError('Failed to load profile');
        }
      } catch (err) {
        setError('Error loading profile');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const fetchTickets = async () => {
      try {
        setTicketsLoading(true);
        setTicketsError(null);
        const res = await fetch('/api/tickets/my', {
          credentials: 'include',
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || 'Failed to load tickets');
        }

        const data = await res.json();
        setTickets((data?.data || []) as TicketItem[]);
      } catch (err) {
        setTickets([]);
        setTicketsError(err instanceof Error ? err.message : 'Error loading tickets');
      } finally {
        setTicketsLoading(false);
      }
    };

    fetchProfile();
    fetchTickets();

    // Voice Command Listener
    const handleVoiceUpdate = (e: any) => {
      const { type, value } = e.detail;
      if (type === 'SKILL') {
        setFormData(prev => ({ 
          ...prev, 
          skills: prev.skills ? `${prev.skills}, ${value}` : value 
        }));
      }
    };
    window.addEventListener('PROFILE_VOICE_UPDATE', handleVoiceUpdate);
    return () => window.removeEventListener('PROFILE_VOICE_UPDATE', handleVoiceUpdate);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.skills.trim() || !formData.experience.trim() || !formData.interests.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (!profile && !formData.resume) {
      setError('Resume is required when creating a profile');
      return;
    }

    try {
      setSaving(true);
      const form = new FormData();
      form.append('skills', formData.skills.trim());
      form.append('experience', formData.experience.trim());
      form.append('interests', formData.interests.trim());
      if (formData.resume) {
        form.append('resume', formData.resume);
      }

      const method = profile ? 'PATCH' : 'POST';
      const res = await fetch('/api/profile', {
        method,
        body: form,
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.message || 'Failed to save profile');
        return;
      }

      const data = await res.json();
      setProfile(data.data);
      setSuccess(true);
      setFormData({ ...formData, resume: null });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Error saving profile');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto mt-10 px-4 md:px-8 pt-[120px] pb-14 min-h-screen">
        <div className="text-center text-[#434651]">Loading profile...</div>
      </main>
    );
  }

  const daysAgoUpdated = profile?.updatedAt ? Math.floor((Date.now() - new Date(profile.updatedAt).getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isProfileStale = daysAgoUpdated !== null && daysAgoUpdated > 30;
  const availableTickets = tickets.filter((ticket) => ticket.status === 'ACTIVE');

  return (
    <main className="max-w-7xl mx-auto mt-10 px-4 md:px-8 pt-[120px] pb-14 min-h-screen">
      {/* Header */}
      <header className="mb-8 border-l-4 border-[#3b82f6] pl-4 md:pl-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-[40px] font-bold tracking-tight text-[#002155] leading-none">
            Campus Copilot Profile
          </h1>
          <p className="mt-2 text-[#434651] max-w-xl font-body text-sm">
            Powered by Veda AI. Auto-sync your skills, projects, and achievements to build a futuristic campus identity.
          </p>
        </div>
        
        {/* Profile Strength Meter */}
        <div className="flex items-center gap-4 bg-white border border-[#c4c6d3] p-4 rounded-xl shadow-sm">
          <div className="relative w-16 h-16">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#f0f1f5" strokeWidth="3" />
              <circle 
                cx="18" cy="18" r="16" fill="none" stroke="#3b82f6" strokeWidth="3" 
                strokeDasharray="100" strokeDashoffset={100 - (profile?.isComplete ? 100 : 45)}
                strokeLinecap="round" className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#002155]">
              {profile?.isComplete ? '100%' : '45%'}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#747782] uppercase tracking-wider">Profile Strength</p>
            <p className="text-xs font-semibold text-[#3b82f6]">{profile?.isComplete ? 'Legendary' : 'Needs Work'}</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl space-y-6">
        {/* Profile Staleness Warning */}
        {isProfileStale && (
          <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
            <p className="text-yellow-800 font-medium text-sm">
              ⚠️ Your profile was last updated {daysAgoUpdated} days ago. Please review and update your profile.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-800 text-sm rounded">
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-800 text-sm rounded">
            <p className="font-medium">✓ Profile saved successfully!</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-[#c4c6d3] p-6 md:p-8">
          {/* AI Automation Toolbar */}
          <div className="flex flex-wrap gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl mb-6">
            <div className="w-full text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              Veda AI Automation
            </div>
            <button 
              type="button"
              onClick={() => {
                setSyncing('GITHUB');
                setTimeout(() => {
                  setFormData(prev => ({ ...prev, github: 'neeraj-tech', skills: prev.skills + ', TypeScript, Python, Docker' }));
                  setSyncing(null);
                }, 2000);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#c4c6d3] rounded-lg text-xs font-semibold text-[#002155] hover:border-blue-500 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] text-black">code</span>
              {syncing === 'GITHUB' ? 'Syncing...' : 'Connect GitHub'}
            </button>
            <button 
              type="button"
              onClick={() => {
                setSyncing('LINKEDIN');
                setTimeout(() => {
                  setFormData(prev => ({ ...prev, linkedin: 'neeraj-profile', experience: 'Full Stack Engineer Intern at Tech Corp' }));
                  setSyncing(null);
                }, 2000);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#c4c6d3] rounded-lg text-xs font-semibold text-[#002155] hover:border-blue-500 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] text-blue-600">link</span>
              {syncing === 'LINKEDIN' ? 'Syncing...' : 'Connect LinkedIn'}
            </button>
          </div>

          {/* Skills */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-[#002155]">
                Skills <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">mic</span> Voice Enabled
              </span>
            </div>
            <textarea
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              placeholder="e.g., React, Node.js, Python, Machine Learning"
              className="w-full p-3 border border-[#c4c6d3] rounded text-[#434651] placeholder-[#747782] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]/50 text-sm bg-white"
              rows={3}
              required
            />
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm font-medium text-[#002155] mb-2">
              Experience <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              placeholder="e.g., 2 years as fullstack developer at XYZ company"
              className="w-full p-3 border border-[#c4c6d3] rounded text-[#434651] placeholder-[#747782] focus:outline-none focus:border-[#fd9923] focus:ring-1 focus:ring-[#fd9923]/50 text-sm"
              rows={3}
              required
            />
            <p className="text-xs text-[#747782] mt-1">Summary of your professional/academic experience</p>
          </div>

          {/* Interests */}
          <div>
            <label className="block text-sm font-medium text-[#002155] mb-2">
              Interests <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.interests}
              onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
              placeholder="e.g., Web development, AI/ML, Blockchain, Mobile apps"
              className="w-full p-3 border border-[#c4c6d3] rounded text-[#434651] placeholder-[#747782] focus:outline-none focus:border-[#fd9923] focus:ring-1 focus:ring-[#fd9923]/50 text-sm"
              rows={3}
              required
            />
            <p className="text-xs text-[#747782] mt-1">Areas you're interested in</p>
          </div>

          {/* Resume */}
          <div className="bg-[#faf9f5] p-4 rounded-xl border border-[#c4c6d3]">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-[#002155]">
                Resume {!profile && <span className="text-red-500">*</span>}
              </label>
              {formData.resume && (
                <button 
                  type="button"
                  onClick={async () => {
                    if (!formData.resume) return;
                    setIsScanning(true);
                    try {
                      const uploadFormData = new FormData();
                      uploadFormData.append('file', formData.resume);

                      // Call the local AI extraction service
                      const res = await fetch('http://localhost:8001/extract-resume', {
                        method: 'POST',
                        body: uploadFormData,
                      });

                      const data = await res.json();
                      if (data.success) {
                        setFormData(prev => ({ 
                          ...prev, 
                          skills: data.skills || prev.skills,
                        }));
                        setSuccess(true);
                        setTimeout(() => setSuccess(false), 3000);
                      } else {
                        setError(`AI Scan failed: ${data.message}`);
                      }
                    } catch (err: any) {
                      setError(`AI Scan error: ${err.message}`);
                    } finally {
                      setIsScanning(false);
                    }
                  }}
                  className="text-[10px] bg-blue-600 text-white px-3 py-1 rounded-full font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm disabled:opacity-50"
                  disabled={isScanning}
                >
                  <span className="material-symbols-outlined text-[14px]">scanner</span>
                  {isScanning ? 'AI Scanning...' : 'Magic Auto-Fill'}
                </button>
              )}
            </div>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFormData({ ...formData, resume: e.target.files?.[0] || null })}
              className="w-full p-2 text-xs text-[#434651] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-[10px] text-[#747782] mt-2 italic">Pro-tip: Use Magic Auto-Fill to extract skills from your resume instantly.</p>
          </div>

          {/* Profile Completion Indicator */}
          <div className="border-t pt-4 space-y-3">
            <label className="block text-sm font-medium text-[#002155]">Profile Status</label>
            <div className={`p-3 rounded ${profile?.isComplete ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
              <p className={`text-sm font-medium ${profile?.isComplete ? 'text-green-800' : 'text-orange-800'}`}>
                {profile?.isComplete ? '✓ Complete' : '❌ Incomplete'}
              </p>
              <p className={`text-xs mt-1 ${profile?.isComplete ? 'text-green-700' : 'text-orange-700'}`}>
                {profile?.isComplete ? 'Your profile is complete. You can apply for open problems.' : 'Complete all fields above to start applying.'}
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#c4c6d3]">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#fd9923] text-white rounded font-medium hover:bg-[#e68a00] disabled:opacity-50 transition-colors text-sm"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            <Link
              href="/innovation/problems"
              className="px-6 py-2.5 bg-[#efeeea] text-[#434651] rounded font-medium hover:bg-[#e0ded8] transition-colors text-sm"
            >
              Back
            </Link>
          </div>
        </form>

        {/* Smart Recommendations Section */}
        <section className="bg-gradient-to-br from-[#002155] to-[#0b2b5a] p-6 md:p-8 rounded-2xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-400">psychology</span>
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold">Veda Smart Suggestions</h2>
              <p className="text-[11px] text-blue-200 uppercase tracking-widest">Powered by your profile</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-all cursor-pointer group">
              <p className="text-[10px] font-bold text-blue-300 uppercase mb-1">Recommended Hackathon</p>
              <p className="text-sm font-semibold group-hover:text-blue-400 transition-colors">AI Innovation Summit 2026</p>
              <p className="text-[10px] text-white/60 mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">bolt</span> Matches your 'Agentic AI' interest
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-all cursor-pointer group">
              <p className="text-[10px] font-bold text-blue-300 uppercase mb-1">Suggested Mentor</p>
              <p className="text-sm font-semibold group-hover:text-blue-400 transition-colors">Dr. Amit Pathak (AI Research)</p>
              <p className="text-[10px] text-white/60 mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">school</span> Matches your 'ML' skills
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
