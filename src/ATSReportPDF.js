// ATSReportPDF.jsx — includes Section D: Interview Preparation
// Drop next to App.js in src/. Imported as: import ATSReportPDF from './ATSReportPDF';

import { useState } from 'react';

// ─── Utilities ────────────────────────────────────────────────────────────────

function getScoreColor(s) {
  return s >= 80 ? '#10B981' : s >= 60 ? '#F59E0B' : '#EF4444';
}
function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}
function loadScript(src) {
  return new Promise(res => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; document.head.appendChild(s);
  });
}
async function ensureLibs() {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
}
function stripEmoji(s='') {
  return s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu,'').trim();
}
function esc(s='') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function cleanMd(s='') {
  return s.replace(/\*\*/g,'').replace(/\*/g,'').replace(/^#+\s/gm,'');
}

// ─── PDF layout constants ──────────────────────────────────────────────────────

const PW    = 595.28;
const PH    = 841.89;
const ML    = 30;
const MR    = 30;
const MT    = 22;
const MB    = 26;
const TW    = PW - ML - MR;
const RPX   = 860;
const SCALE = 2;
const PX2PT = PW / RPX;

// ─── Page cursor manager ──────────────────────────────────────────────────────

function makePM(pdf) {
  let y = MT;
  const pm = {
    get y()   { return y; },
    set y(v)  { y = v; },
    get rem() { return PH - MB - y; },
    need(h)   { if (y + h > PH - MB) { pdf.addPage(); y = MT; } },
    canvas(c) {
      const ih = (c.height / SCALE) * PX2PT;
      if (y > MT && y + ih > PH - MB) { pdf.addPage(); y = MT; }
      pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, y, PW, ih, undefined, 'FAST');
      y += ih + 6;
    },
    gap(n=6) { y += n; },
  };
  return pm;
}

// ─── Low-level text writer ────────────────────────────────────────────────────
// jsPDF baseline model: pdf.text(str, x, y) places BASELINE at y.
// We advance by fontSize * lineHeight per wrapped sub-line.

function writeLine(pdf, pm, text, {
  size=9, style='normal', family='helvetica',
  rgb=[30,41,59], lh=1.5, indent=0, maxW=TW,
}={}) {
  pdf.setFont(family, style);
  pdf.setFontSize(size);
  const lineH = size * lh;
  const wrapped = pdf.splitTextToSize(text, maxW - indent);
  for (const w of wrapped) {
    pm.need(lineH + 2);
    pdf.setTextColor(...rgb);
    pdf.text(w, ML + indent, pm.y);
    pm.y += lineH;
  }
  return wrapped.length * lineH;
}

// ─── Section banner ───────────────────────────────────────────────────────────

function drawBanner(pdf, pm, text, hex) {
  pm.need(30);
  const [r,g,b] = hexToRgb(hex);
  pdf.setFillColor(r,g,b);
  pdf.rect(0, pm.y, PW, 28, 'F');
  pdf.setFont('helvetica','bold');
  pdf.setFontSize(11);
  pdf.setTextColor(255,255,255);
  pdf.text(stripEmoji(text), ML, pm.y + 19);
  pm.y += 28 + 8;
}

// ─── Resume renderer ──────────────────────────────────────────────────────────

function renderResume(pdf, pm, raw) {
  drawBanner(pdf, pm, 'Tailored Resume Text', '#1A3F6F');
  const lines = cleanMd(raw).split('\n');
  let prevWasHeader = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) { pm.gap(prevWasHeader ? 2 : 4); prevWasHeader = false; continue; }
    const isHeader   = /^[A-Z][A-Z0-9\s\/\-&]+$/.test(t) && t.length >= 3 && !/^https?:/.test(t);
    const isJobTitle = /\s[–\-]\s/.test(t) && /\d{4}/.test(t);
    const isBullet   = /^[•·\-]\s/.test(t);
    if (isHeader) {
      pm.gap(8);
      const baseY = pm.y;
      writeLine(pdf, pm, t, { size:9.5, style:'bold', rgb:[26,63,111], lh:1.3 });
      pdf.setFontSize(9.5);
      const uw = pdf.getTextWidth(t);
      pdf.setFillColor(26,63,111);
      pdf.rect(ML, baseY + 1, uw, 0.6, 'F');
      pm.gap(3); prevWasHeader = true;
    } else if (isJobTitle) {
      pm.gap(6);
      writeLine(pdf, pm, t, { size:9, style:'bold', rgb:[15,23,42], lh:1.4 });
      prevWasHeader = false;
    } else if (isBullet) {
      const bt = t.replace(/^[•·\-]\s*/,'');
      writeLine(pdf, pm, '• '+bt, { size:8.5, indent:10, lh:1.45, rgb:[30,41,59], maxW:TW-10 });
      prevWasHeader = false;
    } else {
      writeLine(pdf, pm, t, { size:8.5, lh:1.45, rgb:[30,41,59] });
      prevWasHeader = false;
    }
  }
  pm.gap(10);
}

// ─── Cover letter renderer ────────────────────────────────────────────────────

function renderCoverLetter(pdf, pm, raw) {
  drawBanner(pdf, pm, 'Section C — Cover Letter', '#7C3AED');
  const normalised = cleanMd(raw)
    .replace(/([^\n])\s*(Sincerely,)/g, '$1\n\n$2')
    .replace(/(Sincerely,)\s*([^\n]+)/g, '$1\n$2');
  for (const line of normalised.split('\n')) {
    const t = line.trim();
    if (!t) { pm.gap(6); continue; }
    const isSalutation = /^(Dear|Sincerely|Best|Regards|Yours|To Whom)/i.test(t);
    const isSignOff    = /^(Jaisukh|Sincerely)/i.test(t);
    if (isSalutation && !isSignOff) {
      writeLine(pdf, pm, t, { size:9.5, style:'bold', rgb:[30,41,59], lh:1.5 });
      pm.gap(4);
    } else if (isSignOff) {
      pm.gap(4);
      writeLine(pdf, pm, t, { size:9, style: t.toLowerCase().startsWith('sincerely')?'normal':'bold', rgb:[30,41,59], lh:1.5 });
    } else {
      writeLine(pdf, pm, t, { size:9, lh:1.65, rgb:[30,41,59] });
    }
  }
  pm.gap(10);
}

// ─── JD renderer ──────────────────────────────────────────────────────────────

function renderJD(pdf, pm, raw) {
  drawBanner(pdf, pm, 'Appendix — Job Description', '#475569');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) { pm.gap(3); continue; }
    const isBullet  = /^[·•\-]\s/.test(t);
    const isHeading = !isBullet && t.length < 55 && /^[A-Z]/.test(t) && !t.endsWith('.') && !t.endsWith(',');
    if (isHeading) {
      pm.gap(6);
      writeLine(pdf, pm, t, { size:9, style:'bold', rgb:[71,85,105], lh:1.4 });
    } else if (isBullet) {
      const bt = t.replace(/^[·•\-]\s*/,'');
      writeLine(pdf, pm, '· '+bt, { size:8.5, indent:10, lh:1.45, rgb:[71,85,105], maxW:TW-10 });
    } else {
      writeLine(pdf, pm, t, { size:8.5, lh:1.45, rgb:[71,85,105] });
    }
  }
  pm.gap(10);
}

// ─── Interview Prep renderer (Section D) ──────────────────────────────────────
// Renders natively so questions flow across pages without clipping.
// Layout per question:
//   • Numbered header row with category badge and difficulty tag
//   • "Why they ask" italic line
//   • 2×2 STAR grid (filled coloured rects + text)
//   • Key phrases as inline chips (simulated with coloured rects)

function renderInterviewPrep(pdf, pm, prep) {
  if (!prep) return;

  // ── Talking Points ──────────────────────────────────────────────────────────
  drawBanner(pdf, pm, 'Section D — Interview Preparation', '#0369A1');

  // Sub-heading
  writeLine(pdf, pm, 'Key Talking Points to Emphasize', {
    size:10, style:'bold', rgb:[3,105,161], lh:1.4,
  });
  pm.gap(6);

  const pts = prep.talkingPoints || [];
  pts.forEach((pt, i) => {
    pm.need(28);
    // Numbered circle
    pdf.setFillColor(3,105,161);
    pdf.circle(ML + 7, pm.y - 4, 7, 'F');
    pdf.setFont('helvetica','bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255,255,255);
    pdf.text(String(i+1), ML + 7 - (i >= 9 ? 2.5 : 1.5), pm.y - 1);
    // Point text
    const lines = pdf.splitTextToSize(pt, TW - 22);
    pdf.setFont('helvetica','normal');
    pdf.setFontSize(9);
    pdf.setTextColor(30,41,59);
    for (let li = 0; li < lines.length; li++) {
      if (li > 0) pm.need(13);
      pdf.text(lines[li], ML + 18, li === 0 ? pm.y : pm.y);
      if (li < lines.length - 1) pm.y += 13;
    }
    pm.y += 14;
  });
  pm.gap(12);

  // ── 10 Interview Questions ──────────────────────────────────────────────────
  writeLine(pdf, pm, '10 Likely Interview Questions', {
    size:10, style:'bold', rgb:[3,105,161], lh:1.4,
  });
  pm.gap(8);

  const categoryRgb = {
    Behavioral:  { bg:[219,234,254], text:[29,78,216] },
    Technical:   { bg:[209,250,229], text:[6,95,70]   },
    Situational: { bg:[254,243,199], text:[146,64,14]  },
    Leadership:  { bg:[243,232,255], text:[107,33,168] },
    General:     { bg:[241,245,249], text:[71,85,105]  },
  };
  const starConfig = [
    { key:'Situation', bg:[239,246,255], border:[191,219,254], label:[59,130,246] },
    { key:'Task',      bg:[236,253,245], border:[167,243,208], label:[16,185,129] },
    { key:'Action',    bg:[255,251,235], border:[253,230,138], label:[217,119,6]  },
    { key:'Result',    bg:[245,243,255], border:[221,216,254], label:[124,58,237] },
  ];

  const qs = prep.questions || [];
  qs.forEach((q, qi) => {
    // ── Question header: needs at least 80pt to start meaningfully ──
    pm.need(80);
    pm.gap(4);

    // Question number + text row
    const qNumStr = `Q${qi+1}.`;
    pdf.setFont('helvetica','bold');
    pdf.setFontSize(9);
    pdf.setFillColor(26,63,111);
    pdf.setTextColor(26,63,111);
    pdf.text(qNumStr, ML, pm.y);
    const qNumW = pdf.getTextWidth(qNumStr) + 4;

    // Question text (bold, wraps)
    const qLines = pdf.splitTextToSize(q.question || '', TW - qNumW);
    for (let li = 0; li < qLines.length; li++) {
      if (li > 0) pm.need(13);
      pdf.text(qLines[li], ML + qNumW, pm.y);
      if (li < qLines.length - 1) pm.y += 13;
    }
    pm.y += 13;

    // Category + difficulty badges (inline coloured pill simulation)
    const cat  = q.category || 'General';
    const diff = q.difficulty || 'Medium';
    const cc   = categoryRgb[cat] || categoryRgb.General;

    // Category pill
    pdf.setFillColor(...cc.bg);
    const catW = pdf.getTextWidth(cat) + 10;
    pdf.roundedRect(ML, pm.y - 7, catW, 11, 2, 2, 'F');
    pdf.setFont('helvetica','bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...cc.text);
    pdf.text(cat, ML + 5, pm.y + 1);

    // Difficulty pill
    pdf.setFillColor(241,245,249);
    const diffW = pdf.getTextWidth(diff) + 10;
    pdf.roundedRect(ML + catW + 4, pm.y - 7, diffW, 11, 2, 2, 'F');
    pdf.setTextColor(71,85,105);
    pdf.text(diff, ML + catW + 9, pm.y + 1);

    pm.y += 14;

    // "Why they ask" line
    if (q.whyAsked) {
      const why = 'Why asked: ' + q.whyAsked;
      const whyLines = pdf.splitTextToSize(why, TW);
      pdf.setFont('helvetica','italic');
      pdf.setFontSize(8.5);
      pdf.setTextColor(71,85,105);
      for (const wl of whyLines) {
        pm.need(12);
        pdf.text(wl, ML, pm.y);
        pm.y += 12;
      }
      pm.gap(5);
    }

    // STAR boxes — 2×2 grid
    // Compute row heights first to decide page breaks
    const starCols = 2;
    const cellW    = (TW - 6) / starCols;  // 6pt gap between cols
    const cellPad  = 6;

    // We render in 2 rows of 2
    for (let row = 0; row < 2; row++) {
      const rowItems = starConfig.slice(row*2, row*2+2);

      // Measure tallest cell in this row
      let maxCellH = 32; // minimum
      rowItems.forEach(sc => {
        const val = (q.star || {})[sc.key] || '';
        pdf.setFontSize(8.5);
        const vLines = pdf.splitTextToSize(val, cellW - cellPad*2);
        const cellH  = 14 + vLines.length * 12 + cellPad;
        if (cellH > maxCellH) maxCellH = cellH;
      });

      pm.need(maxCellH + 4);
      const rowY = pm.y;

      rowItems.forEach((sc, ci) => {
        const cx  = ML + ci * (cellW + 6);
        const val = (q.star || {})[sc.key] || '';

        // Cell background
        pdf.setFillColor(...sc.bg);
        pdf.roundedRect(cx, rowY, cellW, maxCellH, 3, 3, 'F');

        // Label
        pdf.setFont('helvetica','bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...sc.label);
        pdf.text(sc.key.toUpperCase(), cx + cellPad, rowY + 11);

        // Value text
        pdf.setFont('helvetica','normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(30,41,59);
        const vLines = pdf.splitTextToSize(val, cellW - cellPad*2);
        vLines.forEach((vl, vli) => {
          pdf.text(vl, cx + cellPad, rowY + 11 + 11 + vli*12);
        });
      });

      pm.y += maxCellH + 4;
    }

    // Key phrases
    if (q.keyPhrases && q.keyPhrases.length > 0) {
      pm.gap(5);
      pdf.setFont('helvetica','bold');
      pdf.setFontSize(8);
      pdf.setTextColor(71,85,105);
      pdf.text('Key Phrases:', ML, pm.y);
      pm.y += 11;

      let phraseX = ML;
      q.keyPhrases.forEach(ph => {
        pdf.setFontSize(8);
        const phW = pdf.getTextWidth(ph) + 10;
        if (phraseX + phW > PW - MR) { phraseX = ML; pm.y += 13; }
        pm.need(13);
        pdf.setFillColor(239,246,255);
        pdf.roundedRect(phraseX, pm.y - 8, phW, 11, 2, 2, 'F');
        pdf.setFont('helvetica','normal');
        pdf.setTextColor(26,63,111);
        pdf.text(ph, phraseX + 5, pm.y + 1);
        phraseX += phW + 5;
      });
      pm.y += 14;
    }

    pm.gap(10);

    // Thin separator between questions (not after last)
    if (qi < qs.length - 1) {
      pm.need(4);
      pdf.setFillColor(226,232,240);
      pdf.rect(ML, pm.y, TW, 0.4, 'F');
      pm.gap(8);
    }
  });

  pm.gap(12);

  // ── Company Research Tips ───────────────────────────────────────────────────
  writeLine(pdf, pm, 'Company Research Tips', {
    size:10, style:'bold', rgb:[3,105,161], lh:1.4,
  });
  pm.gap(6);

  const tips = prep.researchTips || [];
  tips.forEach(tip => {
    pm.need(36);
    // Title bold
    const titleStr = (tip.title || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/gu,'').trim();
    writeLine(pdf, pm, titleStr, { size:9, style:'bold', rgb:[3,105,161], lh:1.4 });
    // Detail
    writeLine(pdf, pm, tip.detail || '', { size:8.5, indent:8, lh:1.45, rgb:[71,85,105], maxW:TW-8 });
    pm.gap(5);
  });

  pm.gap(10);
}

// ─── HTML helpers for canvas groups ──────────────────────────────────────────

const scoreBar = (pct, color) =>
  `<div style="background:#E2E8F0;border-radius:20px;height:8px;overflow:hidden;margin:6px 0 4px;">
     <div style="background:${color};height:100%;width:${pct}%;border-radius:20px;"></div>
   </div>`;
const pill = (t,c,bg) =>
  `<span style="background:${bg};color:${c};padding:2px 9px;border-radius:20px;font-size:10px;
   font-weight:600;display:inline-block;margin:2px 2px;">${esc(t)}</span>`;
const hCard = (body, extra='') =>
  `<div style="background:white;border-radius:8px;padding:14px 18px;border:1px solid #E2E8F0;${extra}">${body}</div>`;
const hBanner = (t,c) =>
  `<div style="background:${c};color:white;border-radius:8px;padding:10px 18px;font-size:13px;
   font-weight:800;letter-spacing:.02em;margin-bottom:10px;">${stripEmoji(t)}</div>`;

async function toCanvas(html, wrapper) {
  wrapper.innerHTML = `<div id="g" style="background:#F1F5F9;">${html}</div>`;
  await new Promise(r=>setTimeout(r,30));
  return window.html2canvas(wrapper.querySelector('#g'), {
    scale:SCALE, useCORS:true, allowTaint:false,
    logging:false, backgroundColor:'#F1F5F9', windowWidth:RPX,
  });
}

// ─── Build visual canvas groups ───────────────────────────────────────────────

function buildCanvasGroups({ result, tailoredScore }) {
  const orig = result?.matchScore ?? 0;
  const tail = tailoredScore?.matchScore ?? null;
  const imp  = tail !== null ? tail - orig : null;

  const sBox = (label, score, isImp=false, pos=true) => {
    const c  = isImp ? (pos?'#10B981':'#EF4444') : getScoreColor(score);
    const bg = isImp ? (pos?'#ECFDF5':'#FEF2F2') : 'white';
    const bd = isImp ? (pos?'#10B981':'#EF4444') : '#E2E8F0';
    const dv = isImp ? `${pos?'+':''}${score}%` : `${score}%`;
    const sb = isImp
      ? (score>=10?'Great boost!':score>=0?'Improved':'Check resume')
      : (score>=80?'Excellent':score>=60?'Good':'Needs work');
    return `<div style="text-align:center;background:${bg};border-radius:12px;padding:18px 28px;
      border:1px solid ${bd};min-width:130px;flex:1;max-width:190px;">
      <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;
        letter-spacing:.07em;margin-bottom:6px;">${label}</div>
      <div style="font-size:48px;font-weight:800;color:${c};line-height:1;">${dv}</div>
      ${!isImp?scoreBar(score,c):'<div style="height:14px;"></div>'}
      <div style="font-size:10px;color:#64748B;margin-top:2px;">${sb}</div>
    </div>`;
  };
  const arr = `<div style="display:flex;align-items:center;font-size:24px;color:#CBD5E1;
    padding:0 6px;margin-top:10px;">&rarr;</div>`;

  const G = [];

  // G1 — Header
  G.push(`<div style="background:linear-gradient(135deg,#1A3F6F,#2E6DA4);border-radius:12px;
    padding:22px 28px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:20px;font-weight:800;color:white;">ATS Resume Analysis Report</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.72);margin-top:4px;">
        Generated ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;color:rgba(255,255,255,0.65);margin-bottom:2px;">Candidate</div>
      <div style="font-size:14px;font-weight:700;color:white;">Jaisukh Bangalore Krishne Gowda</div>
    </div>
  </div>`);

  // G2 — Score hero
  G.push(`<div style="display:flex;gap:12px;justify-content:center;align-items:flex-start;flex-wrap:wrap;">
    ${sBox('Original Score',orig)}
    ${tail!==null?`${arr}${sBox('Tailored Score',tail)}`:''}
    ${imp!==null?`${arr}${sBox('Improvement',imp,true,imp>=0)}`:''}
  </div>`);

  // G3 — Sec A banner + Overall Feedback (FUSED)
  G.push(
    hBanner('Section A — Original Resume Analysis','#1A3F6F') +
    `<div style="background:#1E3A5F;border-radius:8px;padding:14px 18px;">
       <div style="font-size:12px;font-weight:700;color:white;margin-bottom:6px;">Overall Feedback</div>
       <p style="font-size:12px;color:rgba(255,255,255,0.88);margin:0;line-height:1.7;">${esc(result.overallFeedback||'')}</p>
     </div>`
  );

  // G4 — Keywords A
  const mKW = result.matchingKeywords||[], miKW = result.missingKeywords||[];
  G.push(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    ${hCard(`<div style="font-size:12px;font-weight:700;color:#10B981;margin-bottom:8px;">Matching Keywords (${mKW.length})</div>
             <div>${mKW.map(k=>pill(k,'#10B981','#ECFDF5')).join('')}</div>`)}
    ${hCard(`<div style="font-size:12px;font-weight:700;color:#EF4444;margin-bottom:8px;">Missing Keywords (${miKW.length})</div>
             <div>${miKW.map(k=>pill(k,'#EF4444','#FEF2F2')).join('')}</div>`)}
  </div>`);

  // G5 — Improvements
  G.push(hCard(`
    <div style="font-size:12px;font-weight:700;color:#1A3F6F;margin-bottom:10px;">Top 5 Improvements</div>
    ${(result.improvements||[]).map((x,i)=>`
      <div style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;
        border-bottom:${i<result.improvements.length-1?'1px solid #F1F5F9':'none'};">
        <span style="background:#1A3F6F;color:white;border-radius:50%;min-width:20px;height:20px;
          display:inline-flex;align-items:center;justify-content:center;font-size:10px;
          font-weight:700;flex-shrink:0;">${i+1}</span>
        <span style="font-size:11px;color:#1E293B;line-height:1.6;">${esc(x)}</span>
      </div>`).join('')}`));

  // G6 — AI Improved Summary
  G.push(hCard(`
    <div style="font-size:12px;font-weight:700;color:#1A3F6F;margin-bottom:8px;">AI Improved Summary</div>
    <p style="font-size:10pt;font-family:Arial,sans-serif;color:#1E293B;line-height:1.8;
      background:#F8FAFC;padding:12px;border-radius:8px;margin:0;border:1px solid #E2E8F0;">
      ${esc(result.improvedSummary||'')}</p>`));

  if (tailoredScore) {
    // G7 — Sec B banner + Tailored Feedback (FUSED)
    G.push(
      hBanner('Section B — AI Tailored Resume Analysis','#10B981') +
      `<div style="background:#065F46;border-radius:8px;padding:14px 18px;">
         <div style="font-size:12px;font-weight:700;color:white;margin-bottom:6px;">Tailored Resume Feedback</div>
         <p style="font-size:12px;color:rgba(255,255,255,0.88);margin:0;line-height:1.7;">
           ${esc(tailoredScore.overallFeedback||'')}</p>
       </div>`
    );

    // G8 — Tailored keywords
    const tM = tailoredScore.matchingKeywords||[], tMi = tailoredScore.missingKeywords||[];
    G.push(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${hCard(`<div style="font-size:12px;font-weight:700;color:#10B981;margin-bottom:8px;">Matching (${tM.length})</div>
               <div>${tM.map(k=>pill(k,'#10B981','#ECFDF5')).join('')}</div>`)}
      ${hCard(`<div style="font-size:12px;font-weight:700;color:#F59E0B;margin-bottom:8px;">Still Missing (${tMi.length})</div>
               <div>${tMi.map(k=>pill(k,'#F59E0B','#FEF3C7')).join('')}</div>`)}
    </div>`);
  }

  return G;
}

// ─── Main PDF builder ─────────────────────────────────────────────────────────

async function buildFullPDF({ result, tailoredScore, tailored, coverLetter, jd, interviewPrep }) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit:'pt', format:'a4', orientation:'portrait' });
  const pm  = makePM(pdf);

  // ── Phase 1: Visual canvas groups ────────────────────────────────────────────
  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    position:'fixed', left:'-9999px', top:'0', zIndex:'-999',
    width:`${RPX}px`, background:'#F1F5F9',
    fontFamily:"'Segoe UI',Arial,sans-serif", color:'#1A1A1A',
    padding:'0 28px', margin:'0', boxSizing:'border-box',
  });
  document.body.appendChild(wrapper);
  await new Promise(r=>setTimeout(r,80));

  for (const html of buildCanvasGroups({ result, tailoredScore })) {
    pm.canvas(await toCanvas(html, wrapper));
  }
  document.body.removeChild(wrapper);

  // ── Phase 2: Tailored resume (native text) ────────────────────────────────────
  if (tailored) {
    if (pm.rem < 120) { pdf.addPage(); pm.y = MT; } else pm.gap(4);
    renderResume(pdf, pm, tailored);
  }

  // ── Phase 3: Cover letter (native text) ──────────────────────────────────────
  if (coverLetter) {
    if (pm.rem < 120) { pdf.addPage(); pm.y = MT; } else pm.gap(8);
    renderCoverLetter(pdf, pm, coverLetter);
  }

  // ── Phase 4: Full JD (native text, no truncation) ─────────────────────────────
  if (jd) {
    if (pm.rem < 120) { pdf.addPage(); pm.y = MT; } else pm.gap(8);
    renderJD(pdf, pm, jd);
  }

  // ── Phase 5: Interview Prep Section D (native, flows across pages) ────────────
  if (interviewPrep) {
    if (pm.rem < 120) { pdf.addPage(); pm.y = MT; } else pm.gap(8);
    renderInterviewPrep(pdf, pm, interviewPrep);
  }

  // ── Phase 6: Footer ───────────────────────────────────────────────────────────
  pm.need(24);
  pm.gap(8);
  pdf.setFillColor(226,232,240);
  pdf.rect(ML, pm.y, TW, 0.5, 'F');
  pm.gap(9);
  pdf.setFont('helvetica','normal');
  pdf.setFontSize(8);
  pdf.setTextColor(148,163,184);
  const ft = 'Generated by ATS Resume Scorer & Tailoring Agent \u00B7 Powered by AI';
  pdf.text(ft, (PW - pdf.getTextWidth(ft))/2, pm.y);

  return pdf;
}

// ─── React component ──────────────────────────────────────────────────────────

export default function ATSReportPDF({ result, tailoredScore, tailored, coverLetter, jd, interviewPrep, dark }) {
  const [generating, setGenerating] = useState(false);
  const [progress,   setProgress]   = useState('');

  async function generatePDF() {
    if (!result) return;
    setGenerating(true); setProgress('Loading libraries...');
    try {
      await ensureLibs();
      setProgress('Building PDF...');
      const pdf = await buildFullPDF({ result, tailoredScore, tailored, coverLetter, jd, interviewPrep });
      setProgress('Saving...');
      const orig = result?.matchScore??0;
      const tail = tailoredScore?.matchScore??null;
      const tag  = tail!==null?`orig${orig}_tail${tail}`:`score${orig}`;
      pdf.save(`ATS_Report_${tag}_${new Date().toISOString().slice(0,10)}.pdf`);
      setProgress('');
    } catch(err) {
      console.error(err);
      alert('PDF generation failed: '+err.message);
      setProgress('');
    }
    setGenerating(false);
  }

  if (!result) return null;

  return (
    <div style={{margin:0}}>
      <button onClick={generatePDF} disabled={generating} title="Download full ATS report as PDF"
        style={{
          padding:'7px 14px',
          background: generating ? '#6B7280'
            : dark ? 'linear-gradient(135deg,#1E3A5F,#2E6DA4)'
                   : 'linear-gradient(135deg,#1A3F6F,#2E6DA4)',
          color:'white', border:'none', borderRadius:'8px',
          fontSize:'11px', fontWeight:'600',
          cursor: generating?'not-allowed':'pointer',
          boxShadow: generating?'none':'0 3px 12px rgba(30,64,175,.35)',
          display:'inline-flex', alignItems:'center', gap:'6px',
          transition:'opacity .15s,transform .15s', whiteSpace:'nowrap',
        }}>
        {generating ? `⏳ ${progress||'Building...'}` : '📊 Full Report PDF'}
      </button>
      {generating && (
        <div style={{marginTop:5,fontSize:10,color:dark?'#9CA3AF':'#64748B'}}>
          {interviewPrep ? '30–60s — includes interview prep section' : '20–40s — rendering all sections'}
        </div>
      )}
    </div>
  );
}
