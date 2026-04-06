import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function QueryHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch history from backend
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/officer/history");
        const data = await res.json();
        setHistory(data);
      } catch (err) {
        console.error("Failed to fetch history", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const handleViewAnswer = (item) => {
    // Navigate to search page and pass the query and results via state
    navigate("/officer/search", { 
      state: { 
        autoSearch: true, 
        queryText: item.queryText,
        preloadedResults: item.results 
      } 
    });
  };

  return (
    <div style={styles.dashboardWrapper}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brandSection} onClick={() => navigate("/officer/dashboard")}>
          <div style={styles.emblem}>🏛️</div>
          <div>
            <div style={styles.brandTitle}>Dept. of Higher Ed</div>
            <div style={styles.brandSubtitle}>Officer Portal</div>
          </div>
        </div>
        <nav style={styles.navMenu}>
          <div style={styles.navItem} onClick={() => navigate("/officer/dashboard")}><span>🏠</span> Dashboard</div>
          <div style={styles.navItem} onClick={() => navigate("/officer/search")}><span>🔍</span> Search Policy</div>
          <div style={{ ...styles.navItem, ...styles.activeNavItem }}><span>📜</span> Query History</div>
        </nav>
        <div style={styles.logoutBtn} onClick={() => navigate("/officer/login")}>Logout</div>
      </aside>

      {/* Main Content */}
      <main style={styles.mainContent}>
        <header style={styles.header}>
          <h2 style={styles.pageTitle}>Query History</h2>
          <p style={styles.pageSubtitle}>View your previous questions and answers</p>
        </header>

        <section style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>Question Asked</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Document Referenced</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" style={styles.tdCenter}>Loading history...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan="4" style={styles.tdCenter}>No history found.</td></tr>
              ) : (
                history.map((item) => (
                  <tr key={item._id} style={styles.tableRow}>
                    <td style={styles.td}>{item.queryText}</td>
                    <td style={styles.td}>{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td style={styles.td}>{item.topDocumentTitle || "Multiple Sources"}</td>
                    <td style={styles.td}>
                      <button style={styles.viewBtn} onClick={() => handleViewAnswer(item)}>
                        View Answer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p style={styles.footerText}>Showing {history.length} recent queries</p>
          <button style={styles.askNewBtn} onClick={() => navigate("/officer/search")}>
            Ask New Question
          </button>
        </section>
      </main>
    </div>
  );
}

const styles = {
  dashboardWrapper: { display: "flex", height: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Inter', sans-serif" },
  sidebar: { width: "260px", backgroundColor: "#ffffff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", padding: "24px" },
  brandSection: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px", cursor: "pointer" },
  emblem: { fontSize: "24px" },
  brandTitle: { fontWeight: "700", color: "#0f172a", fontSize: "14px" },
  brandSubtitle: { fontSize: "11px", color: "#64748b" },
  navMenu: { flex: 1 },
  navItem: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "8px", color: "#475569", cursor: "pointer", fontSize: "14px", marginBottom: "4px" },
  activeNavItem: { backgroundColor: "#002d5a", color: "#ffffff", fontWeight: "600" },
  logoutBtn: { color: "#ef4444", cursor: "pointer", fontSize: "14px", fontWeight: "600", padding: "12px 16px" },
  mainContent: { flex: 1, padding: "40px", overflowY: "auto" },
  header: { marginBottom: "32px" },
  pageTitle: { fontSize: "28px", fontWeight: "800", color: "#1e293b", margin: 0 },
  pageSubtitle: { color: "#64748b", marginTop: "4px" },
  tableContainer: { backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  tableHeaderRow: { borderBottom: "2px solid #f1f5f9" },
  th: { padding: "12px", color: "#475569", fontWeight: "600", fontSize: "14px" },
  tableRow: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "16px 12px", color: "#334155", fontSize: "14px" },
  tdCenter: { padding: "40px", textAlign: "center", color: "#64748b" },
  viewBtn: { backgroundColor: "#ffffff", border: "1px solid #e2e8f0", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  footerText: { marginTop: "20px", fontSize: "13px", color: "#64748b" },
  askNewBtn: { marginTop: "20px", backgroundColor: "#1e293b", color: "#ffffff", border: "none", padding: "12px 24px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }
};