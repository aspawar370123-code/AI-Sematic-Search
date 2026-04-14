import React, { useState, useEffect } from "react";
import { useNavigate,useLocation } from "react-router-dom";

const AUTHORITY_COLORS = {
  UGC: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  AICTE: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  "Ministry of Education": { bg: "#fdf4ff", text: "#7e22ce", border: "#e9d5ff" },
};
const defaultBadge = { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };

function AuthorityBadge({ authority }) {
  const c = AUTHORITY_COLORS[authority] || defaultBadge;
  return (
    <span style={{
      fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "999px",
      backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`,
      letterSpacing: "0.4px", textTransform: "uppercase"
    }}>
      {authority}
    </span>
  );
}

function ScoreBar({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#94a3b8";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ flex: 1, height: "4px", backgroundColor: "#e2e8f0", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: "2px", transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: "12px", fontWeight: "700", color, minWidth: "36px" }}>{pct}%</span>
    </div>
  );
}

// ✅ FIX: Checks if text is human-readable (not garbled Hindi/Marathi OCR gibberish)
const isReadable = (text) => {
  if (!text) return false;
  // If text starts with "[" it's our placeholder message — treat as readable
  if (text.startsWith("[")) return true;
  const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length;
  return nonAscii / text.length < 0.15;
};

export default function SearchPolicy() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [expandedExcerpt, setExpandedExcerpt] = useState(null);
  const [summaryModal, setSummaryModal] = useState(null);
useEffect(() => {
    if (location.state?.autoSearch) {
      setQuery(location.state.queryText || "");
      setSearchResults(location.state.preloadedResults || []);
      setSearched(true);
      // Clean up state so refresh doesn't trigger it again
      window.history.replaceState({}, document.title);
    }
  }, [location]);
  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/officer/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryText: query,
        }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.documents || []);
    } catch (err) {
      console.error("Search error:", err);
      alert("An error occurred during search. Please try again.");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && e.ctrlKey) handleSearch();
  };

  // ✅ FIX: Download now fetches the file as a blob and saves it as .pdf
  // This works correctly even when Cloudinary blocks direct <a> downloads due to CORS
  const handleDownload = async (doc) => {
    if (!doc.fileUrl) {
      alert("Document URL not available.");
      return;
    }
    setDownloadingId(doc._id);
    try {
      const response = await fetch(doc.fileUrl);
      if (!response.ok) throw new Error("Failed to fetch file");
      const blob = await response.blob();
      // Force .pdf extension regardless of what Cloudinary names it
      const fileName = doc.fileName
        ? (doc.fileName.endsWith(".pdf") ? doc.fileName : doc.fileName + ".pdf")
        : `${doc.title || "document"}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      // Fallback: open in new tab so user can save manually
      window.open(doc.fileUrl, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  // ✅ FIX: View Context — pass excerpt text directly to avoid re-fetching from Pinecone
  const handleViewContext = async (doc) => {
    setSummaryModal({
      docId: doc._id,
      title: doc.title,
      authority: doc.authority,
      year: doc.year,
      loading: true,
      text: null,
      error: null,
    });
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/officer/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: doc._id,
          excerptText: doc.excerpt || "",   // pass what we already have
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setSummaryModal(prev => ({
        ...prev,
        loading: false,
        text: data.summary || "No summary returned.",
        error: null,
      }));
    } catch (err) {
      console.error("Summarize error:", err);
     setSummaryModal({
  docId: doc._id,
  title: doc.title,
  authority: doc.authority,
  year: doc.year,
  excerpt: doc.excerpt, // ✅ ADD THIS
  loading: true,
  text: null,
  error: null,
});
    }
  };

  const exampleQueries = [
    "What are the faculty requirements for NAAC accreditation?",
    "How do I apply for UGC research grants in 2026?",
    "What are the AICTE norms for student-teacher ratio?",
  ];

  const renderSummary = (text) => {
    if (!text) return null;
    return text.split("\n").map((line, i) => {
      if (/^\*\*.*\*\*$/.test(line.trim())) {
        return <h4 key={i} style={modalStyles.sectionHead}>{line.replace(/\*\*/g, "")}</h4>;
      }
      if (/^\d+\.\s/.test(line.trim())) {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return <p key={i} style={modalStyles.numberedItem}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</p>;
      }
      if (line.trim().startsWith("- ") || line.trim().startsWith("• ") || line.trim().startsWith("* ")) {
        const content = line.trim().slice(2);
        const parts = content.split(/\*\*(.*?)\*\*/g);
        return <li key={i} style={modalStyles.bullet}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</li>;
      }
      if (line.trim() === "") return <br key={i} />;
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return <p key={i} style={modalStyles.para}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</p>;
    });
  };

  return (
    <div style={styles.dashboardWrapper}>
      {/* ── SIDEBAR ── */}
      <aside style={styles.sidebar}>
        <div style={styles.brandSection}>
          <div style={styles.emblem}>🏛️</div>
          <div>
            <div style={styles.brandTitle}>Dept. of Higher Ed</div>
            <div style={styles.brandSubtitle}>Officer Portal</div>
          </div>
        </div>
        <nav style={styles.navMenu}>
          <div style={styles.navItem} onClick={() => navigate("/officer/dashboard")}><span>🏠</span> Dashboard</div>
          <div style={{ ...styles.navItem, ...styles.activeNavItem }}><span>🔍</span> Search Policy</div>
          <div style={styles.navItem} onClick={() => navigate("/officer/history")}><span>📜</span> Query History</div>
        </nav>
        <div style={styles.logoutBtn} onClick={() => navigate("/officer/login")}>Logout</div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={styles.mainContent}>
        <header style={styles.header}>
          <h2 style={styles.pageTitle}>Search Policy Documents</h2>
          <p style={styles.pageSubtitle}>Describe your query in plain language — AI will find the most relevant policy chunks for you.</p>
        </header>

        {/* ── SEARCH INPUT ── */}
        <section style={styles.searchCard}>
          <label style={styles.inputLabel}>Your Policy Query</label>
          <textarea
            style={styles.queryInput}
            rows="3"
            placeholder="Example: What are the eligibility criteria for faculty promotion under CAS?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div style={styles.searchFooter}>
            <span style={styles.ctrlHint}>Ctrl + Enter to search</span>
            <button style={{ ...styles.searchBtn, opacity: loading ? 0.7 : 1 }} onClick={handleSearch} disabled={loading}>
              {loading ? (
                <span style={styles.loadingDots}>
                  <span>Searching</span>
                  <span style={styles.dot1}>.</span>
                  <span style={styles.dot2}>.</span>
                  <span style={styles.dot3}>.</span>
                </span>
              ) : "🔍  Search"}
            </button>
          </div>
          <div style={styles.examplesRow}>
            <span style={styles.examplesLabel}>Try:</span>
            {exampleQueries.map((q, i) => (
              <button key={i} style={styles.exampleChip} onClick={() => setQuery(q)}>{q}</button>
            ))}
          </div>
        </section>

        {/* ── LOADING ── */}
        {loading && (
          <div style={styles.loadingState}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Searching across policy documents using AI…</p>
          </div>
        )}

        {/* ── RESULTS ── */}
        {!loading && searched && (
          <section style={styles.resultsSection}>
            <div style={styles.resultsHeader}>
              <div>
                <h3 style={styles.resultsTitle}>
                  {searchResults.length > 0
                    ? `${searchResults.length} Relevant Document${searchResults.length > 1 ? "s" : ""} Found`
                    : "No Results Found"}
                </h3>
                <p style={styles.resultsSubtitle}>
                  {searchResults.length > 0
                    ? `Ranked by relevance to: "${query}"`
                    : "Try rephrasing your query or adjusting the filters."}
                </p>
              </div>
              {searchResults.length > 0 && (
                <div style={styles.queryBadge}>
                  <span style={styles.queryBadgeIcon}>🤖</span>
                  <span>AI-ranked</span>
                </div>
              )}
            </div>

            {searchResults.map((doc, index) => (
              <div key={doc._id} style={styles.docCard}>
                <div style={styles.rankBadge}>#{index + 1}</div>
                <div style={styles.docCardInner}>

                  {/* Card Header */}
                  <div style={styles.docHeader}>
                    <div style={styles.docTitleRow}>
                      <h3 style={styles.docTitle}>{doc.title}</h3>
                      <div style={styles.docTags}>
                        <AuthorityBadge authority={doc.authority} />
                        <span style={styles.yearTag}>{doc.year}</span>
                        <span style={styles.typeTag}>{doc.docType}</span>
                      </div>
                    </div>
                    <div style={styles.pdfIcon}>
                      <span style={styles.pdfLabel}>PDF</span>
                    </div>
                  </div>

                  {/* Relevance Score */}
                  <div style={styles.scoreRow}>
                    <span style={styles.scoreLabel}>Relevance</span>
                    <div style={styles.scoreBarWrapper}><ScoreBar score={doc.score} /></div>
                  </div>

                  {/* ✅ FIX: Excerpt — shows clean message instead of garbage for Hindi/Marathi docs */}
                  {doc.excerpt && (
                    <div style={styles.excerptBox}>
                      <span style={styles.excerptLabel}>MATCHED EXCERPT</span>
                      {isReadable(doc.excerpt) ? (
                        <>
                          <p style={styles.excerptText}>
                            {expandedExcerpt === doc._id
                              ? doc.excerpt
                              : doc.excerpt.length > 280
                              ? doc.excerpt.slice(0, 280) + "…"
                              : doc.excerpt}
                          </p>
                          {doc.excerpt.length > 280 && (
                            <button style={styles.expandBtn} onClick={() => setExpandedExcerpt(expandedExcerpt === doc._id ? null : doc._id)}>
                              {expandedExcerpt === doc._id ? "Show less ↑" : "Read more ↓"}
                            </button>
                          )}
                        </>
                      ) : (
                        <p style={{ ...styles.excerptText, color: "#64748b", fontStyle: "italic" }}>
                          🌐 This document is in Hindi or Marathi. Click <strong>View Context</strong> below for an AI-translated English summary.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={styles.docActions}>
                    <button style={styles.contextBtn} onClick={() => handleViewContext(doc)}>
                      🤖 View Context
                    </button>
                    <button
                      style={{ ...styles.downloadBtn, opacity: downloadingId === doc._id ? 0.7 : 1 }}
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc._id}
                    >
                      {downloadingId === doc._id ? "Downloading…" : "⬇ Download PDF"}
                    </button>
                    <span style={styles.fileInfo}>{doc.fileName || `${doc.title}.pdf`}</span>
                  </div>

                </div>
              </div>
            ))}
          </section>
        )}

        {!loading && !searched && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📄</div>
            <p style={styles.emptyText}>Enter a query above to search through policy documents.</p>
          </div>
        )}
      </main>

      {/* ── SUMMARY MODAL ── */}
      {summaryModal && (
        <div style={modalStyles.overlay} onClick={() => setSummaryModal(null)}>
          <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>

            <div style={modalStyles.header}>
              <div style={{ flex: 1 }}>
                <div style={modalStyles.modalBadge}>🤖 AI-Generated Summary</div>
                <h2 style={modalStyles.title}>{summaryModal.title}</h2>
                <div style={modalStyles.docMeta}>
                  <span style={modalStyles.metaChip}>{summaryModal.authority}</span>
                  <span style={modalStyles.metaChip}>{summaryModal.year}</span>
                  <span style={modalStyles.langNote}>🌐 Translated to English</span>
                </div>
              </div>
              <button style={modalStyles.closeBtn} onClick={() => setSummaryModal(null)}>✕</button>
            </div>

            <div style={modalStyles.body}>
              {summaryModal.loading ? (
                <div style={modalStyles.loadingState}>
                  <div style={styles.spinner} />
                  <p style={modalStyles.loadingTitle}>Analyzing document…</p>
                  <p style={modalStyles.loadingSubtitle}>Reading content in Hindi, Marathi & English · Generating English summary</p>
                </div>
              ) : summaryModal.error ? (
                // ✅ FIX: Show error message if summarize fails instead of blank screen
                <div style={{ textAlign: "center", padding: "40px 0", color: "#ef4444" }}>
                  <p style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</p>
                  <p style={{ fontWeight: "600", marginBottom: "8px" }}>{summaryModal.error}</p>
                  <button
                    style={{ ...styles.contextBtn, marginTop: "12px" }}
                    onClick={() => handleViewContext({ _id: summaryModal.docId, title: summaryModal.title, authority: summaryModal.authority, year: summaryModal.year })}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div style={modalStyles.summaryContent}>
                  {renderSummary(summaryModal.text)}
                </div>
              )}
            </div>

            <div style={modalStyles.footer}>
              <span style={modalStyles.disclaimer}>
                ⚠ AI-generated summary. Source document may be in Hindi/Marathi. Always verify with the original PDF.
              </span>
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100% { opacity: 0; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

const styles = {
  dashboardWrapper: { display: "flex", height: "100vh", backgroundColor: "#f1f5f9", fontFamily: "'Inter', sans-serif" },
  sidebar: { width: "260px", backgroundColor: "#ffffff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", padding: "24px", flexShrink: 0 },
  brandSection: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px", cursor: "pointer" },
  emblem: { fontSize: "24px" },
  brandTitle: { fontWeight: "700", color: "#0f172a", fontSize: "14px" },
  brandSubtitle: { fontSize: "11px", color: "#64748b" },
  navMenu: { flex: 1 },
  navItem: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "8px", color: "#475569", cursor: "pointer", fontSize: "14px", marginBottom: "4px", transition: "background 0.15s" },
  activeNavItem: { backgroundColor: "#002d5a", color: "#ffffff", fontWeight: "600" },
  logoutBtn: { color: "#ef4444", cursor: "pointer", fontSize: "14px", fontWeight: "600", padding: "12px 16px" },
  mainContent: { flex: 1, padding: "40px", overflowY: "auto" },
  header: { marginBottom: "28px" },
  pageTitle: { fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: 0 },
  pageSubtitle: { fontSize: "14px", color: "#64748b", marginTop: "6px" },
  searchCard: { backgroundColor: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "24px", marginBottom: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  inputLabel: { display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "10px", letterSpacing: "0.3px" },
  queryInput: { width: "100%", padding: "14px 16px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "15px", resize: "none", fontFamily: "inherit", outline: "none", boxSizing: "border-box", lineHeight: 1.6, color: "#0f172a" },
  searchFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" },
  ctrlHint: { fontSize: "11px", color: "#94a3b8" },
  searchBtn: { padding: "11px 28px", backgroundColor: "#002d5a", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", cursor: "pointer", fontSize: "14px", letterSpacing: "0.3px" },
  loadingDots: { display: "flex", gap: "1px", alignItems: "center" },
  dot1: { animation: "blink 1s 0s infinite" },
  dot2: { animation: "blink 1s 0.2s infinite" },
  dot3: { animation: "blink 1s 0.4s infinite" },
  examplesRow: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "16px" },
  examplesLabel: { fontSize: "12px", color: "#94a3b8", fontWeight: "600" },
  exampleChip: { padding: "6px 14px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "999px", fontSize: "12px", color: "#475569", cursor: "pointer", fontFamily: "inherit" },
  filtersCard: { backgroundColor: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "20px 24px", marginBottom: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  filtersHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  filtersTitle: { fontSize: "14px", fontWeight: "700", color: "#0f172a", margin: 0 },
  filtersGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" },
  filterLabel: { display: "block", fontSize: "11px", fontWeight: "700", color: "#64748b", letterSpacing: "0.5px", marginBottom: "6px", textTransform: "uppercase" },
  filterSelect: { width: "100%", padding: "9px 12px", borderRadius: "7px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", fontSize: "13px", color: "#334155", outline: "none", fontFamily: "inherit" },
  resetBtn: { fontSize: "12px", color: "#64748b", background: "none", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" },
  loadingState: { display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0" },
  spinner: { width: "32px", height: "32px", border: "3px solid #e2e8f0", borderTop: "3px solid #002d5a", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  loadingText: { marginTop: "16px", color: "#64748b", fontSize: "14px" },
  resultsSection: { display: "flex", flexDirection: "column", gap: "0" },
  resultsHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  resultsTitle: { fontSize: "20px", fontWeight: "700", color: "#0f172a", margin: 0 },
  resultsSubtitle: { fontSize: "13px", color: "#64748b", marginTop: "4px" },
  queryBadge: { display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#eff6ff", color: "#1d4ed8", padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: "700", border: "1px solid #bfdbfe" },
  queryBadgeIcon: { fontSize: "14px" },
  docCard: { position: "relative", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", marginBottom: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" },
  rankBadge: { position: "absolute", top: "20px", right: "20px", width: "28px", height: "28px", backgroundColor: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700", color: "#64748b" },
  docCardInner: { padding: "24px" },
  docHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" },
  docTitleRow: { flex: 1, paddingRight: "40px" },
  docTitle: { fontSize: "17px", fontWeight: "700", color: "#0f172a", margin: "0 0 10px 0", lineHeight: 1.3 },
  docTags: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" },
  yearTag: { fontSize: "11px", fontWeight: "600", padding: "3px 8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px", color: "#64748b" },
  typeTag: { fontSize: "11px", fontWeight: "600", padding: "3px 8px", backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "4px", color: "#c2410c" },
  pdfIcon: { flexShrink: 0, backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center" },
  pdfLabel: { fontSize: "11px", fontWeight: "800", color: "#dc2626", letterSpacing: "0.5px" },
  scoreRow: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" },
  scoreLabel: { fontSize: "11px", fontWeight: "700", color: "#94a3b8", letterSpacing: "0.5px", minWidth: "70px", textTransform: "uppercase" },
  scoreBarWrapper: { flex: 1 },
  excerptBox: { backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "3px solid #002d5a", borderRadius: "0 8px 8px 0", padding: "14px 16px", marginBottom: "20px" },
  excerptLabel: { fontSize: "10px", fontWeight: "700", color: "#94a3b8", letterSpacing: "0.8px", display: "block", marginBottom: "6px", textTransform: "uppercase" },
  excerptText: { fontSize: "13px", color: "#334155", lineHeight: 1.7, margin: 0 },
  expandBtn: { background: "none", border: "none", color: "#002d5a", fontSize: "12px", fontWeight: "600", cursor: "pointer", padding: "6px 0 0 0", fontFamily: "inherit" },
  docActions: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
  contextBtn: { padding: "10px 20px", backgroundColor: "#002d5a", color: "#ffffff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" },
  downloadBtn: { padding: "10px 20px", backgroundColor: "#ffffff", color: "#002d5a", border: "1.5px solid #002d5a", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" },
  fileInfo: { fontSize: "11px", color: "#94a3b8", marginLeft: "auto" },
  emptyState: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { fontSize: "40px", marginBottom: "12px" },
  emptyText: { color: "#94a3b8", fontSize: "15px" },
};

const modalStyles = {
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" },
  modal: { backgroundColor: "#ffffff", borderRadius: "16px", width: "100%", maxWidth: "720px", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "24px 28px", borderBottom: "1px solid #e2e8f0" },
  modalBadge: { fontSize: "12px", fontWeight: "700", color: "#1d4ed8", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "999px", padding: "4px 12px", display: "inline-block", marginBottom: "10px" },
  title: { fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: "0 0 10px 0", lineHeight: 1.3 },
  docMeta: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  metaChip: { fontSize: "11px", fontWeight: "600", padding: "3px 10px", backgroundColor: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px", color: "#475569" },
  langNote: { fontSize: "11px", color: "#16a34a", fontWeight: "600" },
  closeBtn: { background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", cursor: "pointer", color: "#64748b", padding: "6px 10px", marginLeft: "16px", flexShrink: 0 },
  body: { flex: 1, overflowY: "auto", padding: "28px" },
  loadingState: { display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", padding: "48px 0" },
  loadingTitle: { fontSize: "15px", fontWeight: "600", color: "#0f172a", margin: 0 },
  loadingSubtitle: { fontSize: "12px", color: "#94a3b8", margin: 0, textAlign: "center" },
  summaryContent: { fontSize: "14px", color: "#334155", lineHeight: 1.8 },
  sectionHead: { fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "20px 0 8px", padding: "8px 12px", backgroundColor: "#f8fafc", borderRadius: "6px", borderLeft: "3px solid #002d5a" },
  numberedItem: { margin: "8px 0", color: "#1e293b" },
  bullet: { marginLeft: "20px", marginBottom: "6px", color: "#334155" },
  para: { margin: "6px 0", color: "#334155" },
  footer: { padding: "16px 28px", borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc", borderRadius: "0 0 16px 16px" },
  disclaimer: { fontSize: "11px", color: "#94a3b8" },
};