import { useState, useRef, useEffect } from 'react';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = process.env.REACT_APP_GROQ_KEY;

// ── Call Groq AI ──
async function callGroq(prompt) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
  return data.choices[0].message.content;
}

// ── Read file as text ──
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ── Download as Word ──
function downloadAsWord(resumeText, filename = 'tailored_resume.docx') {
  const lines = resumeText.split('\n');
  let bodyXml = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      bodyXml += `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;
    } else {
      const isBold = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && /^[A-Z\s]+$/.test(trimmed);
      const escaped = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      bodyXml += `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/>${isBold ? '<w:b/>' : ''}</w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
    }
  }
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}<w:sectPr/></w:body></w:document>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const loadJSZip = () => new Promise((resolve) => {
    if (window.JSZip) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = resolve; document.head.appendChild(s);
  });
  loadJSZip().then(() => {
    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', contentTypesXml);
    zip.file('_rels/.rels', relsXml);
    zip.file('word/document.xml', docXml);
    zip.file('word/_rels/document.xml.rels', wordRelsXml);
    zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      });
  });
}

// ── Download as PDF ──
function downloadAsPDF(text, filename = 'tailored_resume.pdf') {
  const loadjsPDF = () => new Promise((resolve) => {
    if (window.jspdf) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = resolve; document.head.appendChild(s);
  });
  loadjsPDF().then(() => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = margin;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) { y += 6; continue; }
      const isBold = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && /^[A-Z\s]+$/.test(trimmed);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(10);
      for (const wLine of doc.splitTextToSize(trimmed, maxWidth)) {
        if (y + 14 > pageHeight - margin) { doc.addPage(); y = margin; }
        doc.text(wLine, margin, y); y += 14;
      }
    }
    doc.save(filename);
  });
}

function getScoreColor(score, dark) {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

// ── Responsive hook ──
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
}

// ── Progress Bar Component ──
function ProgressBar({ step, dark }) {
  const steps = [
    { label: 'Analyzing Resume', pct: 25 },
    { label: 'Writing Tailored Resume', pct: 60 },
    { label: 'Scoring Tailored Resume', pct: 85 },
    { label: 'Generating Cover Letter', pct: 95 },
    { label: 'Complete!', pct: 100 },
  ];
  const current = steps[step] || steps[0];
  // eslint-disable-next-line no-unused-vars
  const barBg = dark ? '#374151' : '#E2E8F0';
  const trackBg = dark ? '#1F2937' : '#F1F5F9';

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: '13px', fontWeight: '700', color: dark ? '#93C5FD' : '#1A3F6F', marginBottom: '10px' }}>
        {current.label}
      </div>
      <div style={{ background: barBg, borderRadius: '20px', height: '10px', overflow: 'hidden', marginBottom: '6px' }}>
        <div style={{
          background: 'linear-gradient(90deg, #1A3F6F, #3B82F6)',
          height: '100%',
          width: `${current.pct}%`,
          borderRadius: '20px',
          transition: 'width 0.6s ease'
        }} />
      </div>
      <div style={{ fontSize: '12px', color: dark ? '#6B7280' : '#94A3B8' }}>{current.pct}% complete</div>
    </div>
  );
}

// ── Score Card ──
function ScoreCard({ originalScore, tailoredScore, isMobile, dark }) {
  if (originalScore === null) return null;
  const bg = dark ? '#1F2937' : 'white';
  const border = dark ? '1px solid #374151' : 'none';
  return (
    <div style={{
      background: bg, borderRadius: '12px', padding: '16px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.12)', border,
      display: 'flex',
      flexDirection: isMobile ? 'row' : 'column',
      justifyContent: isMobile ? 'space-around' : 'center',
      alignItems: 'center', gap: isMobile ? 0 : '8px',
      marginBottom: isMobile ? '14px' : 0
    }}>
      <div style={{ textAlign: 'center', flex: isMobile ? 1 : 'unset' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: dark ? '#6B7280' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Original</div>
        <div style={{ fontSize: isMobile ? '34px' : '42px', fontWeight: '800', color: getScoreColor(originalScore, dark), lineHeight: 1 }}>{originalScore}%</div>
        <div style={{ background: dark ? '#374151' : '#F1F5F9', borderRadius: '20px', height: '6px', maxWidth: '110px', margin: '6px auto 0', overflow: 'hidden' }}>
          <div style={{ background: getScoreColor(originalScore, dark), height: '100%', width: `${originalScore}%`, borderRadius: '20px', transition: 'width 1s ease' }} />
        </div>
        <div style={{ fontSize: '10px', color: dark ? '#6B7280' : '#64748B', marginTop: '4px' }}>
          {originalScore >= 80 ? '🎉 Excellent' : originalScore >= 60 ? '⚡ Good' : '⚠️ Needs work'}
        </div>
      </div>
      {tailoredScore !== null && (
        <>
          <div style={{ color: dark ? '#4B5563' : '#CBD5E1', fontSize: isMobile ? '18px' : '14px', padding: isMobile ? '0 8px' : '6px 0' }}>→</div>
          <div style={{ textAlign: 'center', flex: isMobile ? 1 : 'unset' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: dark ? '#6B7280' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Tailored</div>
            <div style={{ fontSize: isMobile ? '34px' : '42px', fontWeight: '800', color: getScoreColor(tailoredScore, dark), lineHeight: 1 }}>{tailoredScore}%</div>
            <div style={{ background: dark ? '#374151' : '#F1F5F9', borderRadius: '20px', height: '6px', maxWidth: '110px', margin: '6px auto 0', overflow: 'hidden' }}>
              <div style={{ background: getScoreColor(tailoredScore, dark), height: '100%', width: `${tailoredScore}%`, borderRadius: '20px', transition: 'width 1s ease' }} />
            </div>
            <div style={{ fontSize: '10px', color: dark ? '#6B7280' : '#64748B', marginTop: '4px' }}>
              {tailoredScore >= 80 ? '🎉 Excellent' : tailoredScore >= 60 ? '⚡ Good' : '⚠️ Needs work'}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── File Upload Box ──
function FileUploadBox({ onFileRead, dark }) {
  const inputRef = useRef();
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  async function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    try { onFileRead(await readFileAsText(file)); }
    catch { onFileRead(`[Could not read "${file.name}" — please paste text manually]`); }
  }
  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragging ? '#3B82F6' : dark ? '#4B5563' : '#CBD5E1'}`,
        borderRadius: '8px', padding: '9px 12px', textAlign: 'center',
        cursor: 'pointer', background: dragging ? (dark ? '#1E3A5F' : '#EFF6FF') : (dark ? '#111827' : '#F8FAFC'),
        transition: 'all 0.2s', marginTop: '8px'
      }}
    >
      <input ref={inputRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])} />
      {fileName
        ? <div style={{ fontSize: '11px', color: '#10B981', fontWeight: '600' }}>✅ {fileName}</div>
        : <div style={{ fontSize: '11px', color: dark ? '#6B7280' : '#94A3B8' }}>📎 Tap or drag & drop (.txt works best)</div>
      }
    </div>
  );
}

// ── Keyword Badge ──
function KW({ text, color, bg }) {
  return <span style={{ background: bg, color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', display: 'inline-block', margin: '3px' }}>{text}</span>;
}

export default function App() {
  const isMobile = useIsMobile();
  const [dark, setDark] = useState(false);
  const [jd, setJd] = useState('');
  const [resume, setResume] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState(null);
  const [tailored, setTailored] = useState(null);
  const [tailoredScore, setTailoredScore] = useState(null);
  const [coverLetter, setCoverLetter] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [targetScoreInput, setTargetScoreInput] = useState('90');
  const [boostLoading, setBoostLoading] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);

  // ── Dark mode colors ──
  const D = {
    bg: dark ? '#111827' : '#F1F5F9',
    card: dark ? '#1F2937' : 'white',
    cardBorder: dark ? '1px solid #374151' : 'none',
    text: dark ? '#F9FAFB' : '#1A1A1A',
    subtext: dark ? '#9CA3AF' : '#64748B',
    label: dark ? '#93C5FD' : '#1A3F6F',
    input: dark ? '#111827' : '#F8FAFC',
    inputBorder: dark ? '#374151' : '#E2E8F0',
    inputText: dark ? '#F9FAFB' : '#1E293B',
    divider: dark ? '#374151' : '#F1F5F9',
    shadow: dark ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.06)',
    previewBg: dark ? '#111827' : '#F8FAFC',
    previewBorder: dark ? '#374151' : '#E2E8F0',
  };

  const card = { background: D.card, borderRadius: '12px', padding: isMobile ? '14px' : '18px', boxShadow: D.shadow, border: D.cardBorder, marginBottom: '14px' };
  const textarea = { width: '100%', height: isMobile ? '130px' : '160px', padding: '10px', borderRadius: '8px', border: `1.5px solid ${D.inputBorder}`, fontSize: '12px', fontFamily: 'Segoe UI', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: '1.5', background: D.input, color: D.inputText };
  const labelStyle = { fontSize: '13px', fontWeight: '700', color: D.label, display: 'block', marginBottom: '6px' };

  const btn = (bg, color, border = 'none') => ({
    padding: '7px 14px', background: bg, border: border || 'none',
    borderRadius: '8px', fontSize: '11px', fontWeight: '600',
    color, cursor: 'pointer'
  });

  const banner = (text, color) => (
    <div style={{ background: color, borderRadius: '10px', padding: '11px 16px', marginBottom: '14px' }}>
      <div style={{ color: 'white', fontWeight: '800', fontSize: isMobile ? '13px' : '14px' }}>{text}</div>
    </div>
  );

  const secTitle = (text) => (
    <div style={{ fontSize: '13px', fontWeight: '700', color: D.label, marginBottom: '10px' }}>{text}</div>
  );

  // ── Main Analysis ──
  async function analyzeResume() {
    if (!jd.trim() || !resume.trim()) { setErrorMsg('Please provide both the job description and your resume.'); return; }
    setLoading(true); setResult(null); setTailored(null); setTailoredScore(null); setCoverLetter(null); setErrorMsg(''); setProgressStep(0);

    try {
      // Step 1 — Analyze
      setProgressStep(0);
      const aText = await callGroq(`You are an expert ATS specialist. Analyze resume vs JD. Return JSON only — no markdown, no backticks.
JOB DESCRIPTION: ${jd}
RESUME: ${resume}
Return exactly: {"matchScore":<0-100>,"matchingKeywords":[<list>],"missingKeywords":[<list>],"improvements":["<tip1>","<tip2>","<tip3>","<tip4>","<tip5>"],"improvedSummary":"<rewritten summary>","overallFeedback":"<2-3 sentences>"}`);
      const analysis = JSON.parse(aText.replace(/```json|```/g, '').trim());
      setResult(analysis);

      // Step 2 — Tailor
      setProgressStep(1);
      const tText = await callGroq(`You are an expert resume writer. Create a fully tailored resume.
JOB DESCRIPTION: ${jd}
ORIGINAL RESUME: ${resume}
MISSING KEYWORDS: ${analysis.missingKeywords.join(', ')}
Rules: Arial 10pt plain text, UPPERCASE section headers, TRUTHFUL experience, strong action verbs, quantifiable metrics, rewrite summary for JD. Return ONLY resume text.`);
      setTailored(tText.trim());

      // Step 3 — Score tailored
      setProgressStep(2);
      const sText = await callGroq(`Analyze tailored resume vs JD. Return JSON only — no markdown, no backticks.
JOB DESCRIPTION: ${jd}
TAILORED RESUME: ${tText}
Return exactly: {"matchScore":<0-100>,"matchingKeywords":[<list>],"missingKeywords":[<list>],"overallFeedback":"<2-3 sentences>"}`);
      const scoreResult = JSON.parse(sText.replace(/```json|```/g, '').trim());
      setTailoredScore(scoreResult);

      // Step 4 — Cover Letter
      setProgressStep(3);
      const cText = await callGroq(`You are an expert cover letter writer. Write a professional cover letter based on the tailored resume and job description.
JOB DESCRIPTION: ${jd}
TAILORED RESUME: ${tText}
Rules:
- Professional business letter format
- 3-4 paragraphs: opening hook, key experience match, specific achievements with metrics, closing call to action
- Match the tone and keywords of the JD
- Personalize based on actual experience in the resume — never fabricate
- Keep it under 400 words
- Do NOT include placeholder text like [Your Name] — use "Jaisukh Bangalore Krishne Gowda" as the name
- Return ONLY the cover letter text`);
      setCoverLetter(cText.trim());

      setProgressStep(4);

    } catch (err) {
      console.error(err);
      setErrorMsg('❌ ' + err.message + ' — Please wait 30 seconds and try again.');
    }
    setLoading(false);
  }

  // ── Regenerate Cover Letter separately ──
  async function regenerateCoverLetter() {
    if (!tailored || !jd) return;
    setCoverLoading(true);
    try {
      const cText = await callGroq(`You are an expert cover letter writer. Write a professional cover letter.
JOB DESCRIPTION: ${jd}
TAILORED RESUME: ${tailored}
Rules: 3-4 paragraphs, professional tone, match JD keywords, use real experience only, under 400 words, use "Jaisukh Bangalore Krishne Gowda" as the name. Return ONLY the cover letter.`);
      setCoverLetter(cText.trim());
    } catch (err) {
      setErrorMsg('❌ Cover letter failed: ' + err.message);
    }
    setCoverLoading(false);
  }

  // ── Boost Score ──
  async function boostScore() {
    const finalTarget = Math.min(99, Math.max(50, Number(targetScoreInput) || 90));
    if (!tailored || !jd) return;
    setBoostLoading(true); setErrorMsg('');
    try {
      const boostedText = await callGroq(`Improve this resume to achieve ${finalTarget}%+ ATS score.
JOB DESCRIPTION: ${jd}
CURRENT RESUME: ${tailored}
STILL MISSING: ${tailoredScore?.missingKeywords?.join(', ') || 'none'}
Rules: target ${finalTarget}%+, TRUTHFUL, include missing keywords, Arial 10pt, UPPERCASE headers. Return ONLY resume text.`);
      setTailored(boostedText.trim());
      const rText = await callGroq(`Analyze resume vs JD. Return JSON only — no markdown.
JOB DESCRIPTION: ${jd}
RESUME: ${boostedText}
Return: {"matchScore":<0-100>,"matchingKeywords":[<list>],"missingKeywords":[<list>],"overallFeedback":"<2-3 sentences>"}`);
      setTailoredScore(JSON.parse(rText.replace(/```json|```/g, '').trim()));
    } catch (err) { setErrorMsg('❌ Boost failed: ' + err.message); }
    setBoostLoading(false);
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; transition: background 0.3s; }
        textarea:focus, input:focus { border-color: #3B82F6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
        button { transition: opacity 0.15s, transform 0.15s; }
        button:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        button:active { transform: translateY(0); }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: '100vh', background: D.bg, padding: isMobile ? '14px' : '22px 20px', fontFamily: 'Segoe UI, sans-serif', transition: 'background 0.3s' }}>

        {/* ── HEADER ── */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isMobile ? '16px' : '20px' }}>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <h1 style={{ fontSize: isMobile ? '19px' : '26px', fontWeight: '800', color: dark ? '#93C5FD' : '#1A3F6F', margin: 0, lineHeight: 1.2 }}>
              🤖 ATS Resume Scorer<br />& Tailoring Agent
            </h1>
            <p style={{ color: D.subtext, fontSize: isMobile ? '11px' : '13px', marginTop: '5px' }}>
              Upload or paste your JD and resume — AI scores, tailors & optimizes
            </p>
          </div>

          {/* Dark Mode Toggle */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
            <button
              onClick={() => setDark(d => !d)}
              style={{
                padding: '8px 14px', borderRadius: '20px',
                background: dark ? '#374151' : '#E2E8F0',
                border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: '600',
                color: dark ? '#F9FAFB' : '#475569',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              {dark ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* ── INPUTS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 200px', gap: '14px', marginBottom: '14px', alignItems: 'start' }}>

            <div style={{ ...card, marginBottom: 0 }}>
              <label style={labelStyle}>📋 Job Description</label>
              <textarea style={textarea} value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full job description here..." />
              <div style={{ fontSize: '10px', color: D.subtext, marginTop: '3px' }}>{jd.length} characters</div>
              <div style={{ fontSize: '11px', color: D.subtext, textAlign: 'center', margin: '5px 0 2px' }}>— or upload a file —</div>
              <FileUploadBox onFileRead={text => setJd(text)} dark={dark} />
            </div>

            <div style={{ ...card, marginBottom: 0 }}>
              <label style={labelStyle}>📄 Your Resume</label>
              <textarea style={textarea} value={resume} onChange={e => setResume(e.target.value)} placeholder="Paste your resume text here..." />
              <div style={{ fontSize: '10px', color: D.subtext, marginTop: '3px' }}>{resume.length} characters</div>
              <div style={{ fontSize: '11px', color: D.subtext, textAlign: 'center', margin: '5px 0 2px' }}>— or upload a file —</div>
              <FileUploadBox onFileRead={text => setResume(text)} dark={dark} />
            </div>

            {result && (
              <div style={isMobile ? {} : { marginBottom: 0 }}>
                <ScoreCard originalScore={result?.matchScore ?? null} tailoredScore={tailoredScore?.matchScore ?? null} isMobile={isMobile} dark={dark} />
              </div>
            )}
          </div>

          {/* ── ERROR ── */}
          {errorMsg && (
            <div style={{ background: dark ? '#450A0A' : '#FEF2F2', border: `1px solid ${dark ? '#7F1D1D' : '#FECACA'}`, borderRadius: '10px', padding: '11px 14px', color: '#EF4444', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
              {errorMsg}
            </div>
          )}

          {/* ── ANALYZE BUTTON ── */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <button onClick={analyzeResume} disabled={loading} style={{
              padding: isMobile ? '13px 32px' : '12px 52px',
              width: isMobile ? '100%' : 'auto',
              background: loading ? '#6B7280' : 'linear-gradient(135deg, #1A3F6F, #2E6DA4)',
              color: 'white', border: 'none', borderRadius: '10px',
              fontSize: '14px', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(30,64,175,0.3)'
            }}>
              {loading ? '⏳ Analyzing...' : '🤖 Analyze & Tailor My Resume'}
            </button>

            {/* ── PROGRESS BAR ── */}
            {loading && (
              <div style={{ marginTop: '18px' }}>
                <ProgressBar step={progressStep} dark={dark} />
              </div>
            )}
          </div>

          {/* ── RESULTS ── */}
          {result && (
            <>
              {/* ══ SECTION A ══ */}
              {banner('📊 Section A — Original Resume Analysis', '#1A3F6F')}

              <div style={{ ...card, background: dark ? '#1E3A5F' : '#EFF6FF', borderLeft: '4px solid #3B82F6' }}>
                {secTitle('💬 Overall Feedback')}
                <p style={{ fontSize: '13px', color: D.text, margin: 0, lineHeight: '1.6' }}>{result.overallFeedback}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div style={card}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#10B981', marginBottom: '10px' }}>✅ Matching ({result.matchingKeywords.length})</div>
                  <div>{result.matchingKeywords.map((kw, i) => <KW key={i} text={kw} color="#10B981" bg={dark ? '#064E3B' : '#ECFDF5'} />)}</div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#EF4444', marginBottom: '10px' }}>❌ Missing ({result.missingKeywords.length})</div>
                  <div>{result.missingKeywords.map((kw, i) => <KW key={i} text={kw} color="#EF4444" bg={dark ? '#450A0A' : '#FEF2F2'} />)}</div>
                </div>
              </div>

              <div style={card}>
                {secTitle('💡 Top 5 Improvements')}
                {result.improvements.map((imp, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 0', borderBottom: i < result.improvements.length - 1 ? `1px solid ${D.divider}` : 'none' }}>
                    <span style={{ background: dark ? '#1E3A5F' : '#1A3F6F', color: 'white', borderRadius: '50%', minWidth: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>{i + 1}</span>
                    <span style={{ fontSize: '12px', color: D.text, lineHeight: '1.6' }}>{imp}</span>
                  </div>
                ))}
              </div>

              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  {secTitle('✍️ AI Improved Summary')}
                  <button onClick={() => { navigator.clipboard.writeText(result.improvedSummary); alert('Copied!'); }}
                    style={btn(dark ? '#1E3A5F' : '#EFF6FF', '#3B82F6', `1.5px solid #3B82F6`)}>📋 Copy</button>
                </div>
                <p style={{ fontSize: '10pt', fontFamily: 'Arial, sans-serif', color: D.text, lineHeight: '1.8', background: D.previewBg, padding: '13px', borderRadius: '8px', margin: 0, border: `1px solid ${D.previewBorder}` }}>
                  {result.improvedSummary}
                </p>
              </div>

              {/* ══ SECTION B ══ */}
              {tailored && tailoredScore && (
                <>
                  {banner('🎯 Section B — AI Custom Tailored Resume', '#10B981')}

                  <div style={{ ...card, background: dark ? '#064E3B' : '#ECFDF5', borderLeft: '4px solid #10B981' }}>
                    {secTitle('💬 Tailored Resume Feedback')}
                    <p style={{ fontSize: '13px', color: D.text, margin: 0, lineHeight: '1.6' }}>{tailoredScore.overallFeedback}</p>
                  </div>

                  {tailoredScore.missingKeywords?.length > 0 && (
                    <div style={card}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#F59E0B', marginBottom: '10px' }}>⚠️ Still Missing ({tailoredScore.missingKeywords.length})</div>
                      <div>{tailoredScore.missingKeywords.map((kw, i) => <KW key={i} text={kw} color="#F59E0B" bg={dark ? '#451A03' : '#FEF3C7'} />)}</div>
                    </div>
                  )}

                  {/* Boost Score */}
                  <div style={{ ...card, background: dark ? '#1E1B4B' : '#F5F3FF', borderLeft: '4px solid #8B5CF6' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#8B5CF6', marginBottom: '8px' }}>🚀 Boost My Score</div>
                    <p style={{ fontSize: '12px', color: D.subtext, marginBottom: '12px' }}>
                      Current: <strong style={{ color: getScoreColor(tailoredScore.matchScore) }}>{tailoredScore.matchScore}%</strong> — Enter a target and AI re-optimizes.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: D.subtext }}>Target:</label>
                      <input type="number" min="50" max="99" value={targetScoreInput} onChange={e => setTargetScoreInput(e.target.value)}
                        style={{ width: '72px', padding: '7px 8px', borderRadius: '8px', border: `1.5px solid ${dark ? '#4C1D95' : '#DDD8FE'}`, fontSize: '14px', fontFamily: 'Segoe UI', outline: 'none', textAlign: 'center', fontWeight: '700', color: '#7C3AED', background: dark ? '#1E1B4B' : 'white' }} />
                      <span style={{ fontSize: '11px', color: D.subtext }}>% (50–99)</span>
                      <button onClick={boostScore} disabled={boostLoading} style={{
                        padding: '8px 18px', background: boostLoading ? '#6B7280' : 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
                        color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                        cursor: boostLoading ? 'not-allowed' : 'pointer', width: isMobile ? '100%' : 'auto', marginTop: isMobile ? '6px' : 0
                      }}>{boostLoading ? '⏳ Boosting...' : `🚀 Boost to ${targetScoreInput || 90}%`}</button>
                    </div>
                  </div>

                  {/* Tailored Resume */}
                  <div style={card}>
                    <div style={{ marginBottom: '12px' }}>
                      {secTitle('📄 Your Custom Tailored Resume (Arial 10pt)')}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                        <button onClick={() => { navigator.clipboard.writeText(tailored); alert('Copied!'); }}
                          style={{ ...btn(dark ? '#1E3A5F' : '#EFF6FF', '#3B82F6', `1.5px solid #3B82F6`), flex: isMobile ? '1' : 'unset' }}>📋 Copy</button>
                        <button onClick={() => downloadAsWord(tailored)}
                          style={{ ...btn(dark ? '#1E3A5F' : '#EFF6FF', D.label, `1.5px solid ${D.label}`), flex: isMobile ? '1' : 'unset' }}>📝 Word</button>
                        <button onClick={() => downloadAsPDF(tailored)}
                          style={{ ...btn(dark ? '#450A0A' : '#FEF2F2', '#EF4444', '1.5px solid #EF4444'), flex: isMobile ? '1' : 'unset' }}>📄 PDF</button>
                      </div>
                    </div>
                    <pre style={{ fontSize: isMobile ? '9pt' : '10pt', fontFamily: 'Arial, sans-serif', color: D.text, lineHeight: '1.6', whiteSpace: 'pre-wrap', background: D.previewBg, padding: '14px', borderRadius: '8px', margin: 0, border: `1px solid ${D.previewBorder}`, maxHeight: isMobile ? '400px' : '600px', overflowY: 'auto', wordBreak: 'break-word' }}>
                      {tailored}
                    </pre>
                  </div>
                </>
              )}

              {/* ══ SECTION C — COVER LETTER ══ */}
              {coverLetter && (
                <>
                  {banner('✉️ Section C — AI Generated Cover Letter', '#8B5CF6')}

                  <div style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      {secTitle('✉️ Your Personalized Cover Letter')}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={() => { navigator.clipboard.writeText(coverLetter); alert('Cover letter copied!'); }}
                          style={{ ...btn(dark ? '#1E3A5F' : '#EFF6FF', '#3B82F6', `1.5px solid #3B82F6`), flex: isMobile ? '1' : 'unset' }}>📋 Copy</button>
                        <button onClick={() => downloadAsPDF(coverLetter, 'cover_letter.pdf')}
                          style={{ ...btn(dark ? '#450A0A' : '#FEF2F2', '#EF4444', '1.5px solid #EF4444'), flex: isMobile ? '1' : 'unset' }}>📄 PDF</button>
                        <button onClick={() => downloadAsWord(coverLetter, 'cover_letter.docx')}
                          style={{ ...btn(dark ? '#1E3A5F' : '#EFF6FF', D.label, `1.5px solid ${D.label}`), flex: isMobile ? '1' : 'unset' }}>📝 Word</button>
                        <button onClick={regenerateCoverLetter} disabled={coverLoading}
                          style={{ ...btn(dark ? '#1E1B4B' : '#F5F3FF', '#8B5CF6', '1.5px solid #8B5CF6'), flex: isMobile ? '1' : 'unset', cursor: coverLoading ? 'not-allowed' : 'pointer' }}>
                          {coverLoading ? '⏳...' : '🔄 Regenerate'}
                        </button>
                      </div>
                    </div>
                    <pre style={{ fontSize: isMobile ? '9pt' : '10pt', fontFamily: 'Arial, sans-serif', color: D.text, lineHeight: '1.8', whiteSpace: 'pre-wrap', background: D.previewBg, padding: '16px', borderRadius: '8px', margin: 0, border: `1px solid ${D.previewBorder}`, maxHeight: isMobile ? '400px' : '500px', overflowY: 'auto', wordBreak: 'break-word' }}>
                      {coverLetter}
                    </pre>
                  </div>
                </>
              )}

            </>
          )}

        </div>
      </div>
    </>
  );
}