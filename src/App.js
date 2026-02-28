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
      bodyXml += `<w:p>
        <w:pPr><w:spacing w:after="0"/></w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
            <w:sz w:val="20"/>
            ${isBold ? '<w:b/>' : ''}
          </w:rPr>
          <w:t xml:space="preserve">${escaped}</w:t>
        </w:r>
      </w:p>`;
    }
  }
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}<w:sectPr/></w:body>
</w:document>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const loadJSZip = () => new Promise((resolve) => {
    if (window.JSZip) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = resolve;
    document.head.appendChild(s);
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
function downloadAsPDF(resumeText, filename = 'tailored_resume.pdf') {
  const loadjsPDF = () => new Promise((resolve) => {
    if (window.jspdf) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = resolve;
    document.head.appendChild(s);
  });
  loadjsPDF().then(() => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight();
    const lineHeight = 14;
    let y = margin;
    for (const line of resumeText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) { y += 6; continue; }
      const isBold = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && /^[A-Z\s]+$/.test(trimmed);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(10);
      for (const wLine of doc.splitTextToSize(trimmed, maxWidth)) {
        if (y + lineHeight > pageHeight - margin) { doc.addPage(); y = margin; }
        doc.text(wLine, margin, y);
        y += lineHeight;
      }
    }
    doc.save(filename);
  });
}

function getScoreColor(score) {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

// ── Responsive hook ──
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ── Score Card ──
function ScoreCard({ originalScore, tailoredScore, isMobile }) {
  if (!originalScore && !tailoredScore) return null;
  return (
    <div style={{
      background: 'white', borderRadius: '12px', padding: '16px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: isMobile ? 'row' : 'column',
      justifyContent: isMobile ? 'space-around' : 'center',
      alignItems: 'center',
      gap: isMobile ? '0' : '8px',
      marginBottom: isMobile ? '14px' : '0'
    }}>
      {originalScore !== null && (
        <div style={{ textAlign: 'center', flex: isMobile ? 1 : 'unset' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Original</div>
          <div style={{ fontSize: isMobile ? '36px' : '44px', fontWeight: '800', color: getScoreColor(originalScore), lineHeight: 1 }}>{originalScore}%</div>
          <div style={{ background: '#F1F5F9', borderRadius: '20px', height: '6px', maxWidth: '120px', margin: '6px auto 0', overflow: 'hidden' }}>
            <div style={{ background: getScoreColor(originalScore), height: '100%', width: `${originalScore}%`, borderRadius: '20px' }} />
          </div>
          <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
            {originalScore >= 80 ? '🎉 Excellent' : originalScore >= 60 ? '⚡ Good' : '⚠️ Needs work'}
          </div>
        </div>
      )}
      {originalScore !== null && tailoredScore !== null && (
        <div style={{ color: '#CBD5E1', fontSize: isMobile ? '20px' : '14px', padding: isMobile ? '0 8px' : '8px 0' }}>→</div>
      )}
      {tailoredScore !== null && (
        <div style={{ textAlign: 'center', flex: isMobile ? 1 : 'unset' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Tailored</div>
          <div style={{ fontSize: isMobile ? '36px' : '44px', fontWeight: '800', color: getScoreColor(tailoredScore), lineHeight: 1 }}>{tailoredScore}%</div>
          <div style={{ background: '#F1F5F9', borderRadius: '20px', height: '6px', maxWidth: '120px', margin: '6px auto 0', overflow: 'hidden' }}>
            <div style={{ background: getScoreColor(tailoredScore), height: '100%', width: `${tailoredScore}%`, borderRadius: '20px' }} />
          </div>
          <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
            {tailoredScore >= 80 ? '🎉 Excellent' : tailoredScore >= 60 ? '⚡ Good' : '⚠️ Needs work'}
          </div>
        </div>
      )}
    </div>
  );
}

// ── File Upload Box ──
function FileUploadBox({ onFileRead }) {
  const inputRef = useRef();
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);

  async function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await readFileAsText(file);
      onFileRead(text);
    } catch {
      onFileRead(`[Could not auto-read "${file.name}" — please paste the text content manually]`);
    }
  }

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragging ? '#3B82F6' : '#CBD5E1'}`,
        borderRadius: '8px', padding: '9px 12px', textAlign: 'center',
        cursor: 'pointer', background: dragging ? '#EFF6FF' : '#F8FAFC',
        transition: 'all 0.2s', marginTop: '8px'
      }}
    >
      <input ref={inputRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])} />
      {fileName ? (
        <div style={{ fontSize: '11px', color: '#10B981', fontWeight: '600' }}>✅ {fileName}</div>
      ) : (
        <div style={{ fontSize: '11px', color: '#94A3B8' }}>📎 Tap or drag & drop a file (.txt works best)</div>
      )}
    </div>
  );
}

// ── Keyword Badge ──
function KeywordBadge({ text, color, bg }) {
  return (
    <span style={{ background: bg, color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', display: 'inline-block', margin: '3px' }}>
      {text}
    </span>
  );
}

export default function App() {
  const isMobile = useIsMobile();
  const [jd, setJd] = useState('');
  const [resume, setResume] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [result, setResult] = useState(null);
  const [tailored, setTailored] = useState(null);
  const [tailoredScore, setTailoredScore] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [targetScoreInput, setTargetScoreInput] = useState('90');
  const [boostLoading, setBoostLoading] = useState(false);

  async function analyzeResume() {
    if (!jd.trim() || !resume.trim()) {
      setErrorMsg('Please provide both the job description and your resume.');
      return;
    }
    setLoading(true);
    setResult(null);
    setTailored(null);
    setTailoredScore(null);
    setErrorMsg('');

    try {
      setLoadingStep('🔍 Step 1/3 — Analyzing resume vs JD...');
      const analysisPrompt = `
You are an expert ATS specialist and resume coach.
Analyze the resume against the job description. Return JSON only — no markdown, no backticks, no extra text.
JOB DESCRIPTION: ${jd}
RESUME: ${resume}
Return exactly:
{
  "matchScore": <0-100>,
  "matchingKeywords": [<keywords in both>],
  "missingKeywords": [<important JD keywords missing>],
  "improvements": ["<tip 1>","<tip 2>","<tip 3>","<tip 4>","<tip 5>"],
  "improvedSummary": "<rewritten summary for this JD>",
  "overallFeedback": "<2-3 sentence assessment>"
}`;
      const analysisText = await callGroq(analysisPrompt);
      const analysis = JSON.parse(analysisText.replace(/```json|```/g, '').trim());
      setResult(analysis);

      setLoadingStep('✍️ Step 2/3 — Writing tailored resume...');
      const tailorPrompt = `
You are an expert resume writer. Create a fully tailored resume for this job.
JOB DESCRIPTION: ${jd}
ORIGINAL RESUME: ${resume}
MISSING KEYWORDS TO INCLUDE: ${analysis.missingKeywords.join(', ')}
Rules:
- Arial 10pt plain text, section headers in UPPERCASE
- Keep ALL experience TRUTHFUL — never fabricate
- Naturally include missing keywords where relevant
- Strong action verbs, quantifiable metrics
- Rewrite summary to match JD
- Return ONLY the resume text — no commentary`;
      const tailoredText = await callGroq(tailorPrompt);
      setTailored(tailoredText.trim());

      setLoadingStep('📊 Step 3/3 — Scoring tailored resume...');
      const scorePrompt = `
Analyze this tailored resume vs JD. Return JSON only — no markdown, no backticks.
JOB DESCRIPTION: ${jd}
TAILORED RESUME: ${tailoredText}
Return exactly:
{
  "matchScore": <0-100>,
  "matchingKeywords": [<keywords in both>],
  "missingKeywords": [<remaining missing>],
  "overallFeedback": "<2-3 sentence assessment>"
}`;
      const scoreText = await callGroq(scorePrompt);
      const scoreResult = JSON.parse(scoreText.replace(/```json|```/g, '').trim());
      setTailoredScore(scoreResult);

    } catch (err) {
      console.error(err);
      setErrorMsg('❌ ' + err.message + ' — Please wait 30 seconds and try again.');
    }
    setLoadingStep('');
    setLoading(false);
  }

  async function boostScore() {
    const finalTarget = Math.min(99, Math.max(50, Number(targetScoreInput) || 90));
    if (!tailored || !jd) return;
    setBoostLoading(true);
    setErrorMsg('');
    try {
      const boostPrompt = `
Improve this resume to achieve ${finalTarget}%+ ATS match score.
JOB DESCRIPTION: ${jd}
CURRENT RESUME: ${tailored}
STILL MISSING: ${tailoredScore?.missingKeywords?.join(', ') || 'none'}
Rules: target ${finalTarget}%+, keep TRUTHFUL, include missing keywords naturally, Arial 10pt, UPPERCASE headers, return ONLY resume text.`;
      const boostedText = await callGroq(boostPrompt);
      setTailored(boostedText.trim());

      const rescorePrompt = `
Analyze this resume vs JD. Return JSON only — no markdown, no backticks.
JOB DESCRIPTION: ${jd}
RESUME: ${boostedText}
Return exactly:
{
  "matchScore": <0-100>,
  "matchingKeywords": [<keywords in both>],
  "missingKeywords": [<remaining missing>],
  "overallFeedback": "<2-3 sentence assessment>"
}`;
      const rescoreText = await callGroq(rescorePrompt);
      const rescore = JSON.parse(rescoreText.replace(/```json|```/g, '').trim());
      setTailoredScore(rescore);
    } catch (err) {
      setErrorMsg('❌ Boost failed: ' + err.message);
    }
    setBoostLoading(false);
  }

  // ── Shared styles ──
  const card = {
    background: 'white', borderRadius: '12px',
    padding: isMobile ? '14px' : '18px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    marginBottom: '14px'
  };

  const textarea = {
    width: '100%',
    height: isMobile ? '130px' : '165px',
    padding: '10px', borderRadius: '8px',
    border: '1.5px solid #E2E8F0',
    fontSize: isMobile ? '13px' : '12px',
    fontFamily: 'Segoe UI', resize: 'vertical',
    outline: 'none', boxSizing: 'border-box', lineHeight: '1.5'
  };

  const label = {
    fontSize: '13px', fontWeight: '700', color: '#1A3F6F',
    display: 'block', marginBottom: '6px'
  };

  const banner = (text, color) => (
    <div style={{ background: color, borderRadius: '10px', padding: '11px 16px', marginBottom: '14px' }}>
      <div style={{ color: 'white', fontWeight: '800', fontSize: isMobile ? '13px' : '14px' }}>{text}</div>
    </div>
  );

  const secTitle = (text) => (
    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A3F6F', marginBottom: '10px' }}>{text}</div>
  );

  return (
    <>
      {/* Global responsive meta handled in index.html — add styles here */}
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
        textarea { touch-action: pan-y; }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>

      <div style={{
        minHeight: '100vh', background: '#F1F5F9',
        padding: isMobile ? '16px 14px' : '22px 20px',
        fontFamily: 'Segoe UI, sans-serif'
      }}>

        {/* ── HEADER ── */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '16px' : '20px' }}>
          <h1 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: '#1A3F6F', margin: 0, lineHeight: 1.2 }}>
            🤖 ATS Resume Scorer<br />& Tailoring Agent
          </h1>
          <p style={{ color: '#64748B', fontSize: isMobile ? '12px' : '13px', marginTop: '6px' }}>
            Upload or paste your JD and resume — AI scores, tailors & optimizes
          </p>
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* ── INPUTS: stacked on mobile, 3-col on desktop ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 200px',
            gap: isMobile ? '14px' : '14px',
            marginBottom: '14px',
            alignItems: 'start'
          }}>

            {/* JD */}
            <div style={{ ...card, marginBottom: 0 }}>
              <label style={label}>📋 Job Description</label>
              <textarea style={textarea} value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full job description here..." />
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px' }}>{jd.length} characters</div>
              <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center', margin: '5px 0 2px' }}>— or upload a file —</div>
              <FileUploadBox onFileRead={text => setJd(text)} />
            </div>

            {/* Resume */}
            <div style={{ ...card, marginBottom: 0 }}>
              <label style={label}>📄 Your Resume</label>
              <textarea style={textarea} value={resume} onChange={e => setResume(e.target.value)} placeholder="Paste your resume text here..." />
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px' }}>{resume.length} characters</div>
              <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center', margin: '5px 0 2px' }}>— or upload a file —</div>
              <FileUploadBox onFileRead={text => setResume(text)} />
            </div>

            {/* Score Card — below on mobile, right column on desktop */}
            {result && (
              <div style={isMobile ? {} : { marginBottom: 0 }}>
                <ScoreCard
                  originalScore={result?.matchScore ?? null}
                  tailoredScore={tailoredScore?.matchScore ?? null}
                  isMobile={isMobile}
                />
              </div>
            )}

          </div>

          {/* ── ERROR ── */}
          {errorMsg && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '11px 14px', color: '#EF4444', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
              {errorMsg}
            </div>
          )}

          {/* ── ANALYZE BUTTON ── */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <button onClick={analyzeResume} disabled={loading} style={{
              padding: isMobile ? '13px 32px' : '12px 52px',
              width: isMobile ? '100%' : 'auto',
              background: loading ? '#94A3B8' : 'linear-gradient(135deg, #1A3F6F, #2E6DA4)',
              color: 'white', border: 'none', borderRadius: '10px',
              fontSize: isMobile ? '14px' : '14px', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(30,64,175,0.3)'
            }}>
              {loading ? loadingStep || '⏳ Working...' : '🤖 Analyze & Tailor My Resume'}
            </button>
            {loading && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748B' }}>
                Takes ~20 seconds — AI running 3 tasks in sequence...
              </div>
            )}
          </div>

          {/* ── RESULTS ── */}
          {result && (
            <>
              {/* ══ SECTION A ══ */}
              {banner('📊 Section A — Original Resume Analysis', '#1A3F6F')}

              <div style={{ ...card, background: '#EFF6FF', borderLeft: '4px solid #3B82F6' }}>
                {secTitle('💬 Overall Feedback')}
                <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.6' }}>{result.overallFeedback}</p>
              </div>

              {/* Keywords — stacked on mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div style={card}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#10B981', marginBottom: '10px' }}>✅ Matching ({result.matchingKeywords.length})</div>
                  <div>{result.matchingKeywords.map((kw, i) => <KeywordBadge key={i} text={kw} color="#10B981" bg="#ECFDF5" />)}</div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#EF4444', marginBottom: '10px' }}>❌ Missing ({result.missingKeywords.length})</div>
                  <div>{result.missingKeywords.map((kw, i) => <KeywordBadge key={i} text={kw} color="#EF4444" bg="#FEF2F2" />)}</div>
                </div>
              </div>

              <div style={card}>
                {secTitle('💡 Top 5 Improvements')}
                {result.improvements.map((imp, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 0', borderBottom: i < result.improvements.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <span style={{ background: '#1A3F6F', color: 'white', borderRadius: '50%', minWidth: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>{i + 1}</span>
                    <span style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>{imp}</span>
                  </div>
                ))}
              </div>

              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  {secTitle('✍️ AI Improved Summary')}
                  <button onClick={() => { navigator.clipboard.writeText(result.improvedSummary); alert('Copied!'); }}
                    style={{ padding: '5px 12px', background: '#EFF6FF', border: '1.5px solid #3B82F6', borderRadius: '8px', fontSize: '11px', fontWeight: '600', color: '#3B82F6', cursor: 'pointer' }}>
                    📋 Copy
                  </button>
                </div>
                <p style={{ fontSize: '10pt', fontFamily: 'Arial, sans-serif', color: '#1A1A1A', lineHeight: '1.8', background: '#F8FAFC', padding: '13px', borderRadius: '8px', margin: 0 }}>
                  {result.improvedSummary}
                </p>
              </div>

              {/* ══ SECTION B ══ */}
              {tailored && tailoredScore && (
                <>
                  {banner('🎯 Section B — AI Custom Tailored Resume', '#10B981')}

                  <div style={{ ...card, background: '#ECFDF5', borderLeft: '4px solid #10B981' }}>
                    {secTitle('💬 Tailored Resume Feedback')}
                    <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.6' }}>{tailoredScore.overallFeedback}</p>
                  </div>

                  {tailoredScore.missingKeywords?.length > 0 && (
                    <div style={card}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#F59E0B', marginBottom: '10px' }}>⚠️ Still Missing ({tailoredScore.missingKeywords.length})</div>
                      <div>{tailoredScore.missingKeywords.map((kw, i) => <KeywordBadge key={i} text={kw} color="#F59E0B" bg="#FEF3C7" />)}</div>
                    </div>
                  )}

                  {/* Boost Score */}
                  <div style={{ ...card, background: '#F5F3FF', borderLeft: '4px solid #8B5CF6' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#8B5CF6', marginBottom: '8px' }}>🚀 Boost My Score</div>
                    <p style={{ fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
                      Current: <strong style={{ color: getScoreColor(tailoredScore.matchScore) }}>{tailoredScore.matchScore}%</strong> — Enter a target and AI will re-optimize.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Target:</label>
                      <input
                        type="number" min="50" max="99"
                        value={targetScoreInput}
                        onChange={e => setTargetScoreInput(e.target.value)}
                        placeholder="90"
                        style={{
                          width: '72px', padding: '7px 8px', borderRadius: '8px',
                          border: '1.5px solid #DDD8FE', fontSize: '14px',
                          fontFamily: 'Segoe UI', outline: 'none',
                          textAlign: 'center', fontWeight: '700', color: '#7C3AED'
                        }}
                      />
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>% (50–99)</span>
                      <button onClick={boostScore} disabled={boostLoading} style={{
                        padding: '8px 18px',
                        background: boostLoading ? '#94A3B8' : 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
                        color: 'white', border: 'none', borderRadius: '8px',
                        fontSize: '12px', fontWeight: '700',
                        cursor: boostLoading ? 'not-allowed' : 'pointer',
                        width: isMobile ? '100%' : 'auto',
                        marginTop: isMobile ? '6px' : '0'
                      }}>
                        {boostLoading ? '⏳ Boosting...' : `🚀 Boost to ${targetScoreInput || 90}%`}
                      </button>
                    </div>
                  </div>

                  {/* Tailored Resume */}
                  <div style={card}>
                    <div style={{ marginBottom: '12px' }}>
                      {secTitle('📄 Your Custom Tailored Resume (Arial 10pt)')}
                      {/* Buttons — stack on mobile */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                        <button onClick={() => { navigator.clipboard.writeText(tailored); alert('Copied!'); }}
                          style={{ padding: '8px 14px', background: '#EFF6FF', border: '1.5px solid #3B82F6', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#3B82F6', cursor: 'pointer', flex: isMobile ? '1' : 'unset' }}>
                          📋 Copy
                        </button>
                        <button onClick={() => downloadAsWord(tailored)}
                          style={{ padding: '8px 14px', background: '#EFF6FF', border: '1.5px solid #1A3F6F', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#1A3F6F', cursor: 'pointer', flex: isMobile ? '1' : 'unset' }}>
                          📝 Word
                        </button>
                        <button onClick={() => downloadAsPDF(tailored)}
                          style={{ padding: '8px 14px', background: '#FEF2F2', border: '1.5px solid #EF4444', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#EF4444', cursor: 'pointer', flex: isMobile ? '1' : 'unset' }}>
                          📄 PDF
                        </button>
                      </div>
                    </div>
                    <pre style={{
                      fontSize: isMobile ? '9pt' : '10pt',
                      fontFamily: 'Arial, sans-serif',
                      color: '#1A1A1A', lineHeight: '1.6', whiteSpace: 'pre-wrap',
                      background: '#F8FAFC', padding: '14px', borderRadius: '8px',
                      margin: 0, border: '1px solid #E2E8F0',
                      maxHeight: isMobile ? '400px' : '600px', overflowY: 'auto',
                      wordBreak: 'break-word'
                    }}>
                      {tailored}
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