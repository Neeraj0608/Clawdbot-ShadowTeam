'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface StudentProfile {
  id: number;
  userId: number;
  skills: string | null;
  experience: string | null;
  interests: string | null;
  resumeUrl: string | null;
  isComplete: boolean;
  updatedAt: string;
}

type ModalType = 'internship' | 'project' | 'certification' | 'awards' | 'skills' | 'education' | 'edu_10th' | 'edu_12th' | 'summary' | 'accomplishments' | 'preferences' | 'language' | 'employment' | 'academic' | null;

interface EduItem {
  type: 'higher' | '10th' | '12th';
  degree?: string;
  course?: string;
  specialization?: string;
  college?: string;
  board?: string;
  medium?: string;
  percentage?: string;
  cgpa?: string;
  startYear?: string;
  endYear?: string;
  passYear?: string;
  courseType?: string;
}

const months = ['Month', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const years = ['YYYY', ...Array.from({ length: 101 }, (_, i) => (2080 - i).toString())];

const quickLinks = [
  { name: 'Preference', id: 'preference' },
  { name: 'Education', id: 'education' },
  { name: 'Key skills', id: 'skills' },
  { name: 'Languages', id: 'languages' },
  { name: 'Internships', id: 'internships' },
  { name: 'Projects', id: 'projects' },
  { name: 'Profile summary', id: 'summary' },
  { name: 'Accomplishments', id: 'accomplishments' },
  { name: 'Employment', id: 'employment' },
  { name: 'Academic achievements', id: 'academic' },
  { name: 'Resume', id: 'resume' }
];

// STABLE MODAL COMPONENT
const ProfileModal = ({ 
  type, onClose, onSave, editingIndex, isSaving,
  mCompany, setMCompany, mRole, setMRole, mStartMonth, setMStartMonth, mStartYear, setMStartYear,
  mEndMonth, setMEndMonth, mEndYear, setMEndYear, mDesc, setMDesc,
  summary, setSummary, accomplishments, setAccomplishments,
  skills, setSkills, mLanguage, setMLanguage, mPrefLocation, setMPrefLocation,
  mEmployment, setMEmployment, mAcademic, setMAcademic,
  mEdu, setMEdu
}: any) => {
  if (!type) return null;

  const titles: any = {
    internship: { title: 'Internships', subtitle: 'Show your professional learnings' },
    project: { title: 'Projects', subtitle: 'Showcase your talent' },
    skills: { title: 'Key skills', subtitle: 'Recruiters look for specific keyskills' },
    education: { title: 'Education (Higher)', subtitle: 'Add your degree details' },
    edu_10th: { title: 'Education (Class 10th)', subtitle: 'Add your 10th details' },
    edu_12th: { title: 'Education (Class 12th)', subtitle: 'Add your 12th details' },
    summary: { title: 'Profile summary', subtitle: 'Give a brief overview' },
    accomplishments: { title: 'Accomplishments', subtitle: 'List your key achievements' },
    preferences: { title: 'Career preferences', subtitle: 'Set your job and location preferences' },
    language: { title: 'Languages', subtitle: 'Add languages you know' },
    employment: { title: 'Employment', subtitle: 'Add your work experience' },
    academic: { title: 'Academic achievements', subtitle: 'Add your academic wins' }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#00142d]/60 backdrop-blur-sm" onClick={isSaving ? undefined : onClose} />
      <div className="relative bg-white w-full max-w-[650px] max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-bold text-[#002155]">{titles[type]?.title || 'Edit Section'}</h2>
              <p className="text-xs text-[#747782] mt-1 font-medium">{titles[type]?.subtitle || 'Update your details'}</p>
            </div>
            <button onClick={onClose} disabled={isSaving} className="text-[#747782] hover:text-[#002155] disabled:opacity-50"><span className="material-symbols-outlined">close</span></button>
          </div>

          <form className="space-y-6">
            {type === 'summary' && <textarea rows={6} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Explain your career goals..." className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none resize-none" />}
            {type === 'accomplishments' && <textarea rows={6} value={accomplishments} onChange={(e) => setAccomplishments(e.target.value)} placeholder="List your key achievements..." className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none resize-none" />}
            {type === 'employment' && <textarea rows={6} value={mEmployment} onChange={(e) => setMEmployment(e.target.value)} placeholder="Add your employment history..." className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none resize-none" />}
            {type === 'academic' && <textarea rows={6} value={mAcademic} onChange={(e) => setMAcademic(e.target.value)} placeholder="Add your academic achievements..." className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none resize-none" />}
            
            {type === 'skills' && <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. React, Node.js, Excel" className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none" />}
            {type === 'language' && <input type="text" value={mLanguage} onChange={(e) => setMLanguage(e.target.value)} placeholder="e.g. English (Can speak, read and write)" className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none" />}
            {type === 'preferences' && (
              <div className="space-y-6">
                <input type="text" value={mPrefLocation} onChange={(e) => setMPrefLocation(e.target.value)} placeholder="Preferred Location" className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none" />
              </div>
            )}
            
            {(type === 'education' || type === 'edu_10th' || type === 'edu_12th') && (
              <div className="space-y-6">
                <input type="text" value={mEdu.college || ''} onChange={(e) => setMEdu({...mEdu, college: e.target.value})} placeholder="School / College Name" className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none" />
                {type === 'education' && <input type="text" value={mEdu.degree || ''} onChange={(e) => setMEdu({...mEdu, degree: e.target.value})} placeholder="Degree (e.g. B.Tech)" className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none" />}
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" value={mEdu.board || mEdu.medium || ''} onChange={(e) => setMEdu({...mEdu, board: e.target.value, medium: e.target.value})} placeholder="Board / Medium" className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none" />
                  <input type="text" value={mEdu.percentage || mEdu.cgpa || ''} onChange={(e) => setMEdu({...mEdu, percentage: e.target.value, cgpa: e.target.value})} placeholder="Percentage / CGPA" className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none" />
                </div>
                <div className="flex gap-4 items-center">
                  <select value={mEdu.passYear || 'YYYY'} onChange={(e) => setMEdu({...mEdu, passYear: e.target.value})} className="flex-1 px-4 py-3 border border-[#e0e1e6] rounded-xl text-sm">{years.map(y => <option key={y}>{y}</option>)}</select>
                  <span>Passing Year</span>
                </div>
              </div>
            )}

            {(type === 'internship' || type === 'project') && (
              <div className="space-y-6">
                <input type="text" value={mCompany} onChange={(e) => setMCompany(e.target.value)} placeholder={type === 'internship' ? "Company Name" : "Project Name"} className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none" />
                <div className="flex items-center gap-3">
                   <select value={mStartMonth} onChange={(e) => setMStartMonth(e.target.value)} className="flex-1 px-4 py-3 border border-[#e0e1e6] rounded-xl text-sm">{months.map(m => <option key={m}>{m}</option>)}</select>
                   <select value={mStartYear} onChange={(e) => setMStartYear(e.target.value)} className="flex-1 px-4 py-3 border border-[#e0e1e6] rounded-xl text-sm">{years.map(y => <option key={y}>{y}</option>)}</select>
                   <span>to</span>
                   <select value={mEndMonth} onChange={(e) => setMEndMonth(e.target.value)} className="flex-1 px-4 py-3 border border-[#e0e1e6] rounded-xl text-sm"><option>Present</option>{months.slice(1).map(m => <option key={m}>{m}</option>)}</select>
                   <select value={mEndYear} onChange={(e) => setMEndYear(e.target.value)} className="flex-1 px-4 py-3 border border-[#e0e1e6] rounded-xl text-sm">{years.map(y => <option key={y}>{y}</option>)}</select>
                </div>
                <textarea rows={4} value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="Add description..." className="w-full px-5 py-3.5 border border-[#e0e1e6] rounded-2xl text-sm outline-none resize-none" />
              </div>
            )}

            <div className="flex justify-end gap-4 pt-8">
              <button type="button" onClick={onClose} disabled={isSaving} className="text-sm font-bold text-[#3b82f6] px-4 py-2 hover:underline disabled:opacity-50">Cancel</button>
              <button type="button" onClick={onSave} disabled={isSaving} className="bg-[#3b82f6] text-white text-sm font-bold px-10 py-3 rounded-full shadow-lg flex items-center gap-2">
                {isSaving ? <><span className="material-symbols-outlined animate-spin text-[18px]">sync</span> Saving...</> : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const [internships, setInternships] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [skills, setSkills] = useState<string>('');
  const [languages, setLanguages] = useState<any[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [accomplishments, setAccomplishments] = useState<string>('');
  const [employment, setEmployment] = useState<string>('');
  const [academic, setAcademic] = useState<string>('');
  const [prefLocation, setPrefLocation] = useState<string>('');
  const [educations, setEducations] = useState<EduItem[]>([
    { type: 'higher', degree: 'B.Tech / B.E.', specialization: 'Artificial Intelligence And Machine Learning', college: 'Thakur College of Engineering and Technology KandivaliMumbai, Mumbai', startYear: '2023', endYear: '2027', cgpa: '9.56', courseType: 'Full Time' },
    { type: '10th', board: 'CBSE', medium: 'English', percentage: '90.5', passYear: '2021' }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  // MODAL TEMP STATE
  const [mCompany, setMCompany] = useState('');
  const [mRole, setMRole] = useState('');
  const [mStartMonth, setMStartMonth] = useState('Month');
  const [mStartYear, setMStartYear] = useState('Year');
  const [mEndMonth, setMEndMonth] = useState('Month');
  const [mEndYear, setMEndYear] = useState('Year');
  const [mDesc, setMDesc] = useState('');
  const [mLanguage, setMLanguage] = useState('');
  const [mPrefLocation, setMPrefLocation] = useState('');
  const [mEmployment, setMEmployment] = useState('');
  const [mAcademic, setMAcademic] = useState('');
  const [mEdu, setMEdu] = useState<any>({ college: '', degree: '', board: '', passYear: 'YYYY' });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          const p = data.data;
          setProfile(p);
          if (p.summary) setSummary(p.summary);
          if (p.accomplishments) setAccomplishments(p.accomplishments);
          if (p.internships?.length) setInternships(p.internships);
          if (p.projects?.length) setProjects(p.projects);
          if (p.skills) setSkills(p.skills);
          if (p.languages?.length) setLanguages(p.languages);
          if (p.education?.length) setEducations(p.education);
          
          if (p.interests) setPrefLocation(p.interests);
          else if (p.preferences) setPrefLocation(typeof p.preferences === 'string' ? p.preferences : p.preferences.location || '');

          if (p.employment) setEmployment(p.employment);
          if (p.achievements) setAcademic(p.achievements);
        }
      } catch (err) {} finally { setLoading(false); }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    let payload: any = {};
    let tempState: any = null;

    if (activeModal === 'summary') payload = { summary };
    else if (activeModal === 'accomplishments') payload = { accomplishments };
    else if (activeModal === 'skills') payload = { skills };
    else if (activeModal === 'employment') { tempState = mEmployment; payload = { employment: mEmployment }; }
    else if (activeModal === 'academic') { tempState = mAcademic; payload = { achievements: mAcademic }; }
    else if (activeModal === 'preferences') { tempState = mPrefLocation; payload = { interests: mPrefLocation }; }
    else if (activeModal === 'language') {
      const parts = mLanguage.split('(');
      const newLang = { name: parts[0].trim(), detail: parts[1]?.replace(')', '') || '' };
      tempState = editingIndex !== null ? [...languages] : [...languages, newLang];
      if (editingIndex !== null) tempState[editingIndex] = newLang;
      payload = { languages: tempState };
    }
    else if (activeModal === 'internship' || activeModal === 'project') {
       const newItem = { company: mCompany, name: mCompany, project_name: mRole, duration: `${mStartMonth}'${mStartYear.slice(-2)} to ${mEndMonth === 'Present' ? 'Present' : mEndMonth + "'" + mEndYear.slice(-2)}`, description: mDesc };
       tempState = activeModal === 'internship' ? [...internships] : [...projects];
       if (editingIndex !== null) tempState[editingIndex] = newItem; else tempState.push(newItem);
       payload = { [activeModal + 's']: tempState };
    }
    else if (activeModal === 'education' || activeModal === 'edu_10th' || activeModal === 'edu_12th') {
      const typeMap: any = { education: 'higher', edu_10th: '10th', edu_12th: '12th' };
      const newItem = { ...mEdu, type: typeMap[activeModal] };
      tempState = [...educations];
      if (editingIndex !== null) tempState[editingIndex] = newItem; else tempState.push(newItem);
      payload = { education: tempState };
    }
    
    try {
      const res = await fetch('/api/profile', { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });

      if (res.ok) {
        // UPDATE UI ONLY ON SUCCESS
        if (activeModal === 'employment') setEmployment(tempState);
        else if (activeModal === 'academic') setAcademic(tempState);
        else if (activeModal === 'preferences') setPrefLocation(tempState);
        else if (activeModal === 'language') setLanguages(tempState);
        else if (activeModal === 'internship') setInternships(tempState);
        else if (activeModal === 'project') setProjects(tempState);
        else if (activeModal === 'education' || activeModal === 'edu_10th' || activeModal === 'edu_12th') setEducations(tempState);
        else if (activeModal === 'summary') setSummary(summary);
        else if (activeModal === 'accomplishments') setAccomplishments(accomplishments);
        else if (activeModal === 'skills') setSkills(skills);

        setActiveModal(null); setEditingIndex(null);
      } else {
        alert('Could not save to database. Please check your connection.');
      }
    } catch (e) {
      alert('Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (type: string, index: number) => {
    let updated: any[] = [];
    if (type === 'internship') { updated = internships.filter((_, i) => i !== index); setInternships(updated); }
    if (type === 'project') { updated = projects.filter((_, i) => i !== index); setProjects(updated); }
    if (type === 'language') { updated = languages.filter((_, i) => i !== index); setLanguages(updated); }
    fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [type + 's']: updated }) });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
  };

  if (loading) return <div className="min-h-screen pt-40 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f3f4f7] pt-[140px] pb-20">
      <ProfileModal 
        type={activeModal} onClose={() => {setActiveModal(null); setEditingIndex(null);}} onSave={handleSave} isSaving={isSaving}
        mCompany={mCompany} setMCompany={setMCompany} mRole={mRole} setMRole={setMRole} mStartMonth={mStartMonth} setMStartMonth={setMStartMonth}
        mStartYear={mStartYear} setMStartYear={setMStartYear} mEndMonth={mEndMonth} setMEndMonth={setMEndMonth}
        mEndYear={mEndYear} setMEndYear={setMEndYear} mDesc={mDesc} setMDesc={setMDesc}
        summary={summary} setSummary={setSummary} accomplishments={accomplishments} setAccomplishments={setAccomplishments}
        skills={skills} setSkills={setSkills} mLanguage={mLanguage} setMLanguage={setMLanguage} mPrefLocation={mPrefLocation} setMPrefLocation={setMPrefLocation}
        mEmployment={mEmployment} setMEmployment={setMEmployment} mAcademic={mAcademic} setMAcademic={setMAcademic}
        mEdu={mEdu} setMEdu={setMEdu}
      />

      <div className="max-w-[1100px] mx-auto px-4">
        {/* HEADER */}
        <div className="bg-white border border-[#e0e1e6] p-8 flex flex-col md:flex-row gap-8 items-start shadow-sm mb-8 rounded-2xl relative">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="relative w-32 h-32 flex items-center justify-center cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#f0f1f5" strokeWidth="6" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#fd9923" strokeWidth="6" strokeDasharray="283" strokeDashoffset={283 - (283 * 0.72)} strokeLinecap="round" />
              </svg>
              <div className="w-24 h-24 bg-[#747782] rounded-full flex flex-col items-center justify-center border-2 border-dashed border-[#c4c6d3] overflow-hidden relative">
                {photo ? <img src={photo} className="w-full h-full object-cover" /> : (
                  <div className="flex flex-col items-center">
                    <span className="material-symbols-outlined text-white text-2xl mb-1">add</span>
                    <span className="text-[10px] text-white font-bold">Add photo</span>
                  </div>
                )}
              </div>
              <div className="absolute bottom-[-10px] bg-white px-2 py-0.5 text-[10px] font-bold text-[#fd9923] border border-[#fd9923] rounded-full shadow-sm">72%</div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" />
            </div>
          </div>
          <div className="flex-1">
             <div className="flex items-center gap-2 mb-1"><h1 className="text-2xl font-bold text-[#002155]">Neeraj Gupta</h1><span className="material-symbols-outlined text-[18px] text-[#747782] cursor-pointer">edit</span></div>
             <p className="text-sm font-bold text-[#434651] mb-1">B.Tech / B.E.</p>
             <p className="text-xs text-[#747782] mb-6">Thakur College of Engineering and Technology KandivaliMumbai, Mumbai</p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 pt-4 border-t border-[#f0f1f5]">
                <div className="flex items-center gap-2 text-xs text-[#434651]"><span className="material-symbols-outlined text-[16px] text-[#747782]">location_on</span> Mumbai</div>
                <div className="flex items-center gap-2 text-xs text-[#434651]"><span className="material-symbols-outlined text-[16px] text-[#747782]">call</span> 7208596530 <span className="text-[#3b82f6] font-bold cursor-pointer hover:underline">Verify</span></div>
                <div className="flex items-center gap-2 text-xs text-[#434651]"><span className="material-symbols-outlined text-[16px] text-[#747782]">wc</span> Male</div>
                <div className="flex items-center gap-2 text-xs text-[#434651]"><span className="material-symbols-outlined text-[16px] text-[#747782]">mail</span> neerajg0508@gm... <span className="material-symbols-outlined text-[16px] text-green-500">check_circle</span></div>
                <div className="flex items-center gap-2 text-xs text-[#434651]"><span className="material-symbols-outlined text-[16px] text-[#747782]">cake</span> 6th August 2005</div>
             </div>
          </div>
          <div className="w-full md:w-[280px] bg-[#fffaf5] border border-[#ffe8d0] p-6 rounded-2xl shadow-sm">
             <div className="space-y-4 mb-5">
               {[{l:'Verify mobile',v:'2%',i:'task_alt'},{l:'Add details',v:'8%',i:'school'},{l:'Add accomplishment',v:'6%',i:'military_tech'}].map((item,idx) => (
                 <div key={idx} className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="material-symbols-outlined text-[18px] text-[#747782]">{item.i}</span><span className="text-[11px] font-medium text-[#434651]">{item.l}</span></div><span className="text-[10px] font-bold text-green-600">↑ {item.v}</span></div>
               ))}
             </div>
             <button className="w-full py-3 bg-[#f44336] text-white text-[11px] font-bold rounded-full shadow-lg">Add 6 missing details</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-8">
            {/* CAREER PREFERENCES */}
            <section id="preference" className="bg-white border border-[#e0e1e6] p-8 rounded-2xl shadow-sm relative scroll-mt-32">
               <span onClick={() => {setMPrefLocation(prefLocation); setActiveModal('preferences');}} className="absolute top-8 right-8 material-symbols-outlined text-[20px] text-[#747782] cursor-pointer hover:text-[#3b82f6]">edit</span>
               <h3 className="text-[15px] font-bold text-[#002155] mb-6">Your career preferences</h3>
               <div className="grid grid-cols-2 gap-8">
                 <div><p className="text-[11px] text-[#747782] mb-1">Preferred job type</p><p className="text-[13px] font-medium text-[#434651]">Jobs, Internships</p></div>
                 <div><p className="text-[11px] text-[#747782] mb-1">Availability to work</p><p onClick={() => {setMPrefLocation(prefLocation); setActiveModal('preferences');}} className="text-[13px] text-[#3b82f6] font-bold cursor-pointer hover:underline">Add work availability</p></div>
                 <div><p className="text-[11px] text-[#747782] mb-1">Preferred location</p><p className="text-[13px] font-medium text-[#434651]">{prefLocation || 'Not set'}</p></div>
               </div>
            </section>

            {/* EDUCATION */}
            <section id="education" className="bg-white border border-[#e0e1e6] p-8 rounded-2xl shadow-sm relative scroll-mt-32">
               <button onClick={() => {setMEdu({college:'',degree:'',board:'',passYear:'YYYY'}); setActiveModal('education');}} className="absolute top-8 right-8 text-sm font-bold text-[#3b82f6] hover:underline">Add</button>
               <h3 className="text-[15px] font-bold text-[#002155] mb-6">Education</h3>
               <div className="space-y-8">
                 {educations.map((edu, i) => (
                   <div key={i} className="relative group">
                     <div className="flex items-center gap-2">
                       <p className="text-[13px] font-bold text-[#002155]">{edu.type === 'higher' ? `${edu.degree} from ${edu.college}` : `Class ${edu.type === '10th' ? 'X' : 'XII'}`}</p>
                       <span onClick={() => {setMEdu(edu); setEditingIndex(i); setActiveModal(edu.type === 'higher' ? 'education' : edu.type === '10th' ? 'edu_10th' : 'edu_12th');}} className="material-symbols-outlined text-[16px] text-[#747782] cursor-pointer hover:text-[#3b82f6]">edit</span>
                     </div>
                     <p className="text-[11px] text-[#747782] mt-1 italic">{edu.type === 'higher' ? `Graduating in ${edu.endYear}, ${edu.courseType}` : `${edu.board}, ${edu.medium}`}</p>
                     <p className="text-[11px] text-[#747782] mt-0.5">{edu.type === 'higher' ? '' : `Scored ${edu.percentage}%, Passed out in ${edu.passYear}`}</p>
                   </div>
                 ))}
                 {!educations.some(e => e.type === '12th') && (
                   <p onClick={() => {setMEdu({college:'',degree:'',board:'',passYear:'YYYY'}); setActiveModal('edu_12th');}} className="text-[13px] text-[#3b82f6] font-bold cursor-pointer hover:underline">Add Class XII Details</p>
                 )}
               </div>
            </section>

            {/* KEY SKILLS */}
            <section id="skills" className="bg-white border border-[#e0e1e6] p-8 rounded-2xl shadow-sm relative scroll-mt-32">
               <span onClick={() => {setSkills(skills); setActiveModal('skills');}} className="absolute top-8 right-8 material-symbols-outlined text-[20px] text-[#747782] cursor-pointer hover:text-[#3b82f6]">edit</span>
               <h3 className="text-[15px] font-bold text-[#002155] mb-6">Key skills</h3>
               <div className="flex flex-wrap gap-3">
                 {skills ? skills.split(',').map((s, idx) => (
                   <span key={idx} className="px-5 py-2 text-[12px] border border-[#e0e1e6] rounded-full text-[#434651] font-medium bg-[#f8f9fb]">{s.trim()}</span>
                 )) : <p className="text-[13px] text-[#747782]">Add your key skills here.</p>}
               </div>
            </section>

            {/* LANGUAGES */}
            <section id="languages" className="bg-white border border-[#e0e1e6] p-8 rounded-2xl shadow-sm relative scroll-mt-32">
               <button onClick={() => {setMLanguage(''); setActiveModal('language');}} className="absolute top-8 right-8 text-sm font-bold text-[#3b82f6] hover:underline">Add</button>
               <h3 className="text-[15px] font-bold text-[#002155] mb-6">Languages</h3>
               <div className="space-y-6">
                 {languages.length > 0 ? languages.map((lang, i) => (
                   <div key={i} className="group relative">
                     <div className="flex items-center gap-2">
                       <p className="text-[13px] font-bold text-[#002155]">{lang.name}</p>
                       <span onClick={() => {setMLanguage(`${lang.name} (${lang.detail})`); setEditingIndex(i); setActiveModal('language');}} className="material-symbols-outlined text-[16px] text-[#747782] cursor-pointer hover:text-[#3b82f6]">edit</span>
                       <span onClick={() => deleteItem('language', i)} className="material-symbols-outlined text-[16px] text-[#f44336] cursor-pointer hidden group-hover:block ml-auto">delete</span>
                     </div>
                     <p className="text-[12px] text-[#747782] mt-1">{lang.detail}</p>
                   </div>
                 )) : <p className="text-[13px] text-[#747782]">Add the languages you know.</p>}
               </div>
            </section>

            {/* INTERNSHIPS */}
            <section id="internships" className="bg-white border border-[#e0e1e6] p-8 rounded-2xl shadow-sm relative scroll-mt-32">
               <button onClick={() => {setMCompany(''); setMRole(''); setMDesc(''); setActiveModal('internship');}} className="absolute top-8 right-8 text-sm font-bold text-[#3b82f6] hover:underline">Add</button>
               <h3 className="text-[15px] font-bold text-[#002155] mb-6">Internships</h3>
               <div className="space-y-8">
                 {internships.length > 0 ? internships.map((intern, i) => (
                   <div key={i} className="flex gap-4 items-start group">
                     <div className="w-12 h-12 bg-[#f8f9fb] border border-[#e0e1e6] rounded-xl flex items-center justify-center shrink-0">
                       <span className="material-symbols-outlined text-[#747782] text-xl">work</span>
                     </div>
                     <div className="flex-1">
                       <div className="flex items-center gap-2">
                         <p className="text-sm font-bold text-[#002155]">{intern.company || intern.name}</p>
                         <span onClick={() => {setMCompany(intern.company || intern.name); setMRole(intern.project_name); setMDesc(intern.description); setEditingIndex(i); setActiveModal('internship');}} className="material-symbols-outlined text-[16px] text-[#747782] cursor-pointer hover:text-[#3b82f6]">edit</span>
                         <span onClick={() => deleteItem('internship', i)} className="material-symbols-outlined text-[16px] text-[#f44336] cursor-pointer hidden group-hover:block ml-auto">delete</span>
                       </div>
                       <p className="text-xs text-[#002155] font-medium mt-1">{intern.project_name}</p>
                       <p className="text-[11px] text-[#747782] mt-1">{intern.duration}</p>
                       <p className="text-[12px] text-[#434651] mt-3 leading-relaxed">{intern.description}</p>
                     </div>
                   </div>
                 )) : <p className="text-[13px] text-[#747782]">Add your professional internship experience.</p>}
               </div>
            </section>

            {/* PROJECTS */}
            <section id="projects" className="bg-white border border-[#e0e1e6] p-8 rounded-2xl shadow-sm relative scroll-mt-32">
               <button onClick={() => {setMCompany(''); setMRole(''); setMDesc(''); setActiveModal('project');}} className="absolute top-8 right-8 text-sm font-bold text-[#3b82f6] hover:underline">Add</button>
               <h3 className="text-[15px] font-bold text-[#002155] mb-6">Projects</h3>
               <div className="space-y-8">
                 {projects.length > 0 ? projects.map((proj, i) => (
                   <div key={i} className="flex gap-4 items-start group">
                     <div className="w-12 h-12 bg-[#f8f9fb] border border-[#e0e1e6] rounded-xl flex items-center justify-center shrink-0">
                       <span className="material-symbols-outlined text-[#747782] text-xl">deployed_code</span>
                     </div>
                     <div className="flex-1">
                       <div className="flex items-center gap-2">
                         <p className="text-sm font-bold text-[#002155]">{proj.name}</p>
                         <span onClick={() => {setMCompany(proj.name); setMDesc(proj.description); setEditingIndex(i); setActiveModal('project');}} className="material-symbols-outlined text-[16px] text-[#747782] cursor-pointer hover:text-[#3b82f6]">edit</span>
                         <span onClick={() => deleteItem('project', i)} className="material-symbols-outlined text-[16px] text-[#f44336] cursor-pointer hidden group-hover:block ml-auto">delete</span>
                       </div>
                       <p className="text-[11px] text-[#747782] mt-1">{proj.duration}</p>
                       <p className="text-[12px] text-[#434651] mt-3 leading-relaxed">{proj.description}</p>
                     </div>
                   </div>
                 )) : <p className="text-[13px] text-[#747782]">Add your top projects here.</p>}
               </div>
            </section>

            {/* PROFILE SUMMARY */}
            <section id="summary" className="bg-white border border-[#e0e1e6] p-8 rounded-2xl shadow-sm relative scroll-mt-32">
               <span onClick={() => {setSummary(summary); setActiveModal('summary');}} className="absolute top-8 right-8 material-symbols-outlined text-[20px] text-[#747782] cursor-pointer hover:text-[#3b82f6]">edit</span>
               <h3 className="text-[15px] font-bold text-[#002155] mb-4">Profile summary</h3>
               <p className="text-[13px] text-[#434651] leading-relaxed">{summary || 'Add a summary to your profile to highlight your career goals.'}</p>
            </section>

            {/* ACCOMPLISHMENTS */}
            <section id="accomplishments" className="bg-white border border-[#e0e1e6] p-8 rounded-2xl shadow-sm relative scroll-mt-32">
               <span onClick={() => {setAccomplishments(accomplishments); setActiveModal('accomplishments');}} className="absolute top-8 right-8 material-symbols-outlined text-[20px] text-[#747782] cursor-pointer hover:text-[#3b82f6]">edit</span>
               <h3 className="text-[15px] font-bold text-[#002155] mb-4">Accomplishments</h3>
               <p className="text-[13px] text-[#434651] leading-relaxed">{accomplishments || 'List your key milestones and achievements here.'}</p>
            </section>

            {/* EMPLOYMENT */}
            <section id="employment" className="bg-white border border-[#e0e1e6] p-8 rounded-2xl shadow-sm relative scroll-mt-32">
               <span onClick={() => {setMEmployment(employment); setActiveModal('employment');}} className="absolute top-8 right-8 material-symbols-outlined text-[20px] text-[#747782] cursor-pointer hover:text-[#3b82f6]">edit</span>
               <h3 className="text-[15px] font-bold text-[#002155] mb-4">Employment</h3>
               <p className="text-[13px] text-[#434651] leading-relaxed">{employment || 'Add your work experience details here.'}</p>
            </section>

            {/* ACADEMIC ACHIEVEMENTS */}
            <section id="academic" className="bg-white border border-[#e0e1e6] p-8 rounded-2xl shadow-sm relative scroll-mt-32">
               <span onClick={() => {setMAcademic(academic); setActiveModal('academic');}} className="absolute top-8 right-8 material-symbols-outlined text-[20px] text-[#747782] cursor-pointer hover:text-[#3b82f6]">edit</span>
               <h3 className="text-[15px] font-bold text-[#002155] mb-4">Academic achievements</h3>
               <p className="text-[13px] text-[#434651] leading-relaxed">{academic || 'Add your scholarships, ranks, or academic wins here.'}</p>
            </section>

            {/* RESUME */}
            <section id="resume" className="bg-white border border-[#e0e1e6] p-8 rounded-2xl shadow-sm scroll-mt-32">
              <h3 className="text-base font-bold text-[#002155] mb-4">Resume</h3>
              <div className="w-full border-2 border-dashed border-[#e0e1e6] rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50/20 transition-all" onClick={() => resumeInputRef.current?.click()}>
                <button className="px-6 py-2.5 border border-[#3b82f6] text-[#3b82f6] text-sm font-bold rounded-full flex items-center gap-2">
                   <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                   Upload & Auto-Fill with AI
                </button>
                <input type="file" ref={resumeInputRef} className="hidden" accept=".pdf" />
              </div>
            </section>
          </div>

          <aside className="w-[240px] shrink-0">
             <div className="bg-white border border-[#e0e1e6] p-6 rounded-2xl shadow-sm sticky top-[140px]">
                <h2 className="text-[15px] font-bold text-[#002155] mb-6">Quick links</h2>
                <nav className="space-y-5">
                   {quickLinks.map((link, i) => (
                     <div key={i} className="flex items-center justify-between group cursor-pointer" onClick={() => scrollToSection(link.id)}>
                        <span className="text-[13px] text-[#434651] group-hover:text-[#3b82f6]">{link.name}</span>
                     </div>
                   ))}
                </nav>
             </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
