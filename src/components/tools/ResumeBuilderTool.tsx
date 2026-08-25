import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  FileSpreadsheet,
  Sparkles,
  Download,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  Wand2,
  Check,
  Briefcase,
  GraduationCap,
  Award,
  Layers,
} from 'lucide-react';
import { ResumeData } from '../../types';
import { aiService } from '../../services/aiService';
import { creditService } from '../../services/creditService';

const defaultResume: ResumeData = {
  fullName: 'Shan Palia',
  email: 'shanpalia786@gmail.com',
  phone: '+1 (555) 349-8201',
  location: 'San Francisco, CA',
  website: 'shanpalia.dev',
  headline: 'Senior Full-Stack AI Engineer & Systems Architect',
  summary:
    'Innovative engineering leader with 7+ years of experience architecting high-throughput distributed applications, deep learning interfaces, and cloud-native systems. Proven track record scaling resilient platforms to millions of active users.',
  experience: [
    {
      id: 'exp_1',
      role: 'Lead AI Engineer',
      company: 'Palia AI Labs',
      location: 'San Francisco, CA',
      startDate: '2023',
      endDate: 'Present',
      current: true,
      description:
        '• Architected ultra-low latency multimodal streaming inference engine supporting real-time audio and vision models.\n• Led cross-functional squad of 8 engineers delivering enterprise-grade search grounding and vector retrieval systems.\n• Reduced inference cold-start latency by 42% through intelligent server-side caching and dynamic model quantizations.',
    },
    {
      id: 'exp_2',
      role: 'Senior Software Engineer',
      company: 'Nexus Cloud Technologies',
      location: 'Austin, TX',
      startDate: '2020',
      endDate: '2023',
      current: false,
      description:
        '• Developed high-performance React and Express cloud orchestration microservices processing 50M+ API requests daily.\n• Built automated CI/CD deployment pipelines cutting deployment cycle from 45 minutes to 6 minutes.',
    },
  ],
  education: [
    {
      id: 'edu_1',
      institution: 'University of California, Berkeley',
      degree: 'B.S. in Computer Science',
      field: 'Artificial Intelligence & Systems',
      graduationYear: '2020',
    },
  ],
  skills: [
    'TypeScript',
    'React',
    'Node.js / Express',
    'Palia AI Neural SDKs',
    'Python',
    'Tailwind CSS',
    'PostgreSQL / Firestore',
    'Docker & Cloud Run',
    'System Architecture',
  ],
  projects: [
    {
      id: 'proj_1',
      name: 'Palia AI Suite',
      link: 'https://palia.ai',
      description:
        'Production-grade next-generation web intelligence assistant featuring real-time multimodal inference, document AI, and voice synthesis.',
    },
  ],
};

export const ResumeBuilderTool: React.FC = () => {
  const [resume, setResume] = useState<ResumeData>(defaultResume);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [template, setTemplate] = useState<'minimal' | 'modern' | 'executive'>('modern');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  // AI Assistance Handlers
  const handleGenerateSummary = async () => {
    const successDeduct = await creditService.deductCredits('AI Resume Summary', 10);
    if (!successDeduct) {
      alert('Insufficient credits for Resume AI.');
      return;
    }

    setIsAiLoading(true);
    try {
      const res = await aiService.assistResume({
        section: 'summary',
        role: resume.headline || 'Software Engineer',
        details: resume.experience.map((e) => `${e.role} at ${e.company}`).join(', '),
        action: 'summary',
      });
      if (res.success && res.result) {
        setResume((prev) => ({ ...prev, summary: res.result! }));
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleEnhanceBullets = async (expId: string) => {
    const target = resume.experience.find((e) => e.id === expId);
    if (!target) return;

    const successDeduct = await creditService.deductCredits('AI Resume Bullet Points', 10);
    if (!successDeduct) {
      alert('Insufficient credits for Resume AI.');
      return;
    }

    setIsAiLoading(true);
    try {
      const res = await aiService.assistResume({
        section: 'experience',
        role: target.role,
        details: target.description,
        action: 'bullet_points',
      });
      if (res.success && res.result) {
        setResume((prev) => ({
          ...prev,
          experience: prev.experience.map((e) =>
            e.id === expId ? { ...e, description: res.result! } : e
          ),
        }));
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddExperience = () => {
    setResume((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        {
          id: `exp_${Date.now()}`,
          role: 'Software Engineer',
          company: 'Company Name',
          location: 'City, State',
          startDate: '2022',
          endDate: '2024',
          current: false,
          description: '• Developed key features and collaborated with cross-functional teams.',
        },
      ],
    }));
  };

  const handleRemoveExperience = (id: string) => {
    setResume((prev) => ({
      ...prev,
      experience: prev.experience.filter((e) => e.id !== id),
    }));
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !resume.skills.includes(newSkill.trim())) {
      setResume((prev) => ({ ...prev, skills: [...prev.skills, newSkill.trim()] }));
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setResume((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter',
    });

    const margin = 40;
    let y = 50;

    // Header Name & Headline
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(resume.fullName, margin, y);

    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(resume.headline, margin, y);

    y += 16;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(
      `${resume.email}  |  ${resume.phone}  |  ${resume.location}  |  ${resume.website}`,
      margin,
      y
    );

    // Divider
    y += 12;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(margin, y, 612 - margin, y);
    y += 18;

    // Summary Section
    if (resume.summary) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('PROFESSIONAL SUMMARY', margin, y);
      y += 14;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const splitSummary = doc.splitTextToSize(resume.summary, 612 - 2 * margin);
      doc.text(splitSummary, margin, y);
      y += splitSummary.length * 13 + 12;
    }

    // Work Experience
    if (resume.experience.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('WORK EXPERIENCE', margin, y);
      y += 14;

      for (const exp of resume.experience) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(exp.role, margin, y);

        const dateStr = `${exp.startDate} - ${exp.endDate}`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(dateStr, 612 - margin - doc.getTextWidth(dateStr), y);

        y += 12;
        doc.setFont('helvetica', 'italic');
        doc.text(`${exp.company} — ${exp.location}`, margin, y);

        y += 14;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const splitDesc = doc.splitTextToSize(exp.description, 612 - 2 * margin);
        doc.text(splitDesc, margin, y);
        y += splitDesc.length * 12 + 10;
      }
    }

    // Education
    if (resume.education.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('EDUCATION', margin, y);
      y += 14;

      for (const edu of resume.education) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(edu.degree, margin, y);

        const yrStr = edu.graduationYear;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(yrStr, 612 - margin - doc.getTextWidth(yrStr), y);

        y += 12;
        doc.text(`${edu.institution} · ${edu.field}`, margin, y);
        y += 16;
      }
    }

    // Skills
    if (resume.skills.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('KEY SKILLS & COMPETENCIES', margin, y);
      y += 14;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const skillsStr = resume.skills.join('  •  ');
      const splitSkills = doc.splitTextToSize(skillsStr, 612 - 2 * margin);
      doc.text(splitSkills, margin, y);
    }

    doc.save(`${resume.fullName.replace(/\s+/g, '_')}_Resume_PaliaAI.pdf`);
  };

  return (
    <div id="resume-builder-tool" className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">AI Resume Architect</h1>
              <p className="text-xs text-slate-500">
                Craft ATS-optimized resumes with AI impact enhancement and export to PDF.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <button
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'edit'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Editor
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'preview'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Preview
              </button>
            </div>

            <button
              id="btn-export-resume-pdf"
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-sm transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Tab View: Editor vs Live Preview */}
        {activeTab === 'edit' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Inputs */}
            <div className="lg:col-span-7 space-y-5">
              {/* Personal Details */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  1. Personal & Contact Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Full Name</label>
                    <input
                      type="text"
                      value={resume.fullName}
                      onChange={(e) => setResume({ ...resume, fullName: e.target.value })}
                      className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">
                      Professional Headline
                    </label>
                    <input
                      type="text"
                      value={resume.headline}
                      onChange={(e) => setResume({ ...resume, headline: e.target.value })}
                      className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Email Address</label>
                    <input
                      type="email"
                      value={resume.email}
                      onChange={(e) => setResume({ ...resume, email: e.target.value })}
                      className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Phone</label>
                    <input
                      type="text"
                      value={resume.phone}
                      onChange={(e) => setResume({ ...resume, phone: e.target.value })}
                      className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Location</label>
                    <input
                      type="text"
                      value={resume.location}
                      onChange={(e) => setResume({ ...resume, location: e.target.value })}
                      className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">
                      Website / Portfolio
                    </label>
                    <input
                      type="text"
                      value={resume.website}
                      onChange={(e) => setResume({ ...resume, website: e.target.value })}
                      className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    2. Executive Summary
                  </h3>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={isAiLoading}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>AI Generate (10 Cr)</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={resume.summary}
                  onChange={(e) => setResume({ ...resume, summary: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-none"
                />
              </div>

              {/* Work Experience */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    3. Work Experience
                  </h3>
                  <button
                    onClick={handleAddExperience}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Role</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {resume.experience.map((exp) => (
                    <div
                      key={exp.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="grid grid-cols-2 gap-2 flex-1 pr-2">
                          <input
                            type="text"
                            value={exp.role}
                            placeholder="Job Title"
                            onChange={(e) =>
                              setResume({
                                ...resume,
                                experience: resume.experience.map((item) =>
                                  item.id === exp.id ? { ...item, role: e.target.value } : item
                                ),
                              })
                            }
                            className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                          />
                          <input
                            type="text"
                            value={exp.company}
                            placeholder="Company"
                            onChange={(e) =>
                              setResume({
                                ...resume,
                                experience: resume.experience.map((item) =>
                                  item.id === exp.id ? { ...item, company: e.target.value } : item
                                ),
                              })
                            }
                            className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveExperience(exp.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Remove experience"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-500">
                          Achievements & Responsibilities
                        </span>
                        <button
                          onClick={() => handleEnhanceBullets(exp.id)}
                          disabled={isAiLoading}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>AI Polish Bullets (10 Cr)</span>
                        </button>
                      </div>

                      <textarea
                        rows={3}
                        value={exp.description}
                        onChange={(e) =>
                          setResume({
                            ...resume,
                            experience: resume.experience.map((item) =>
                              item.id === exp.id ? { ...item, description: e.target.value } : item
                            ),
                          })
                        }
                        className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Skills Section */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  4. Skills & Competencies
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                    placeholder="Add technical or soft skill (e.g. Next.js, Cloud Architecture)"
                    className="flex-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAddSkill}
                    className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2">
                  {resume.skills.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200"
                    >
                      <span>{s}</span>
                      <button
                        onClick={() => handleRemoveSkill(s)}
                        className="text-slate-400 hover:text-rose-600 text-xs font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Preview Column in Edit Mode */}
            <div className="lg:col-span-5 space-y-4">
              <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-semibold text-slate-900">Live Render Preview</span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-slate-400">Template:</span>
                    <select
                      value={template}
                      onChange={(e) => setTemplate(e.target.value as any)}
                      className="bg-slate-50 font-semibold text-slate-800 rounded px-1.5 py-0.5 border border-slate-200 text-xs"
                    >
                      <option value="modern">Modern Tech</option>
                      <option value="executive">Minimal Executive</option>
                    </select>
                  </div>
                </div>

                {/* Rendered Resume Document Mockup */}
                <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-md text-slate-900 space-y-4 text-xs font-sans">
                  {/* Name & Headline */}
                  <div className="border-b border-slate-200 pb-3">
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">
                      {resume.fullName || 'Your Name'}
                    </h2>
                    <p className="text-indigo-600 font-medium text-xs mt-0.5">
                      {resume.headline || 'Your Headline'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {resume.email} · {resume.phone} · {resume.location}
                    </p>
                  </div>

                  {/* Summary */}
                  {resume.summary && (
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Summary
                      </h4>
                      <p className="text-[11px] text-slate-700 leading-relaxed">{resume.summary}</p>
                    </div>
                  )}

                  {/* Experience */}
                  {resume.experience.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Experience
                      </h4>
                      {resume.experience.map((exp) => (
                        <div key={exp.id} className="space-y-0.5">
                          <div className="flex items-center justify-between font-semibold text-slate-800 text-[11px]">
                            <span>{exp.role}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {exp.startDate} - {exp.endDate}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 italic">{exp.company}</p>
                          <p className="text-[10px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {exp.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Skills */}
                  {resume.skills.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Skills
                      </h4>
                      <p className="text-[10px] text-slate-700">{resume.skills.join(' • ')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Full View Live Preview */
          <div className="max-w-4xl mx-auto rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 shadow-lg space-y-6 text-slate-900">
            <div className="border-b-2 border-indigo-600 pb-4">
              <h2 className="text-3xl font-bold text-slate-900">{resume.fullName}</h2>
              <p className="text-base text-indigo-600 font-semibold mt-1">{resume.headline}</p>
              <p className="text-xs text-slate-500 mt-2">
                {resume.email}  |  {resume.phone}  |  {resume.location}  |  {resume.website}
              </p>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                Executive Summary
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">{resume.summary}</p>
            </div>

            {/* Experience */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                Professional Experience
              </h3>
              {resume.experience.map((exp) => (
                <div key={exp.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{exp.role}</span>
                    <span className="text-xs text-slate-500">
                      {exp.startDate} – {exp.endDate}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-indigo-600">
                    {exp.company} — <span className="text-slate-500">{exp.location}</span>
                  </p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed pt-1">
                    {exp.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Education */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                Education
              </h3>
              {resume.education.map((edu) => (
                <div key={edu.id} className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{edu.degree}</p>
                    <p className="text-slate-500">
                      {edu.institution} · {edu.field}
                    </p>
                  </div>
                  <span className="text-slate-400">{edu.graduationYear}</span>
                </div>
              ))}
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                Skills & Technologies
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                {resume.skills.join('  •  ')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
