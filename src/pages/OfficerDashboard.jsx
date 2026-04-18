import React from "react";
import { useNavigate } from "react-router-dom";

export default function OfficerDashboard() {
  const navigate = useNavigate();

  return (
    <div style={styles.dashboardWrapper}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brandSection}>
          <div style={styles.emblem}>🏛️</div>
          <div>
            <div style={styles.brandTitle}>Dept. of Higher Ed</div>
            <div style={styles.brandSubtitle}>Officer Portal</div>
          </div>
        </div>

        <nav style={styles.navMenu}>
          <div style={{ ...styles.navItem, ...styles.activeNavItem }}>
            <span>🏠</span> Dashboard
          </div>
          <div style={styles.navItem} onClick={() => navigate("/officer/search")}>
            <span>🔍</span> Search Policies
          </div>
          <div style={styles.navItem} onClick={() => navigate("/officer/history")}>
            <span>📜</span> Query History
          </div>
        </nav>

        <div style={styles.logoutBtn} onClick={() => navigate("/")}>
          Logout
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={styles.mainContent}>
        <header style={styles.header}>
          <h1 style={styles.welcomeText}>Welcome, Officer</h1>
          <p style={styles.subHeaderText}>
            This system provides AI-powered policy retrieval for higher education
            policies, regulations, and schemes. Ask questions in natural language
            and get accurate answers with source references from official documents.
          </p>
        </header>

        {/* System Purpose Block */}
        <section style={styles.infoSection}>
          <h3 style={styles.sectionTitle}>System Purpose</h3>
          <div style={styles.instructionList}>
            <div style={styles.instructionItem}>
              <span style={styles.stepNumber}>1</span>
              <div>
                <strong>Search Policies:</strong> Enter policy-related questions in
                natural language
              </div>
            </div>
            <div style={styles.instructionItem}>
              <span style={styles.stepNumber}>2</span>
              <div>
                <strong>Get AI Answers:</strong> Receive detailed explanations
                backed by official sources
              </div>
            </div>
            <div style={styles.instructionItem}>
              <span style={styles.stepNumber}>3</span>
              <div>
                <strong>View References:</strong> Access original PDF documents
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <h3 style={styles.sectionTitle}>Quick Actions</h3>
        <div style={styles.actionGrid}>
          <div
            style={styles.secondaryActionCard}
            onClick={() => navigate("/officer/search")}
          >
            <h3 style={styles.cardHeading}>Search Policies</h3>
            <p style={styles.cardSubtext}>Browse official department documents</p>
          </div>
          <div
            style={styles.secondaryActionCard}
            onClick={() => navigate("/officer/history")}
          >
            <h3 style={styles.cardHeading}>View History</h3>
            <p style={styles.cardSubtext}>Review your previous policy queries</p>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles = {
  dashboardWrapper: {
    display: "flex",
    height: "100vh",
    backgroundColor: "#f8fafc",
    fontFamily: "'Inter', sans-serif",
  },
  sidebar: {
    width: "260px",
    backgroundColor: "#ffffff",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    padding: "24px",
  },
  brandSection: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "40px",
  },
  emblem: { fontSize: "24px" },
  brandTitle: { fontWeight: "700", color: "#0f172a", fontSize: "14px" },
  brandSubtitle: { fontSize: "11px", color: "#64748b" },
  navMenu: { flex: 1 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "8px",
    color: "#475569",
    cursor: "pointer",
    fontSize: "14px",
    marginBottom: "4px",
    transition: "0.2s",
  },
  activeNavItem: {
    backgroundColor: "#002d5a",
    color: "#ffffff",
    fontWeight: "600",
  },
  logoutBtn: {
    marginTop: "auto",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    padding: "12px 16px",
  },
  mainContent: {
    flex: 1,
    overflowY: "auto",
    padding: "40px",
  },
  header: { marginBottom: "32px" },
  welcomeText: { fontSize: "28px", fontWeight: "700", color: "#0f172a", margin: 0 },
  subHeaderText: { color: "#64748b", marginTop: "8px", fontSize: "15px", lineHeight: "1.6" },
  infoSection: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "32px",
    marginBottom: "32px",
  },
  sectionTitle: { fontSize: "18px", fontWeight: "600", color: "#0f172a", marginBottom: "20px" },
  instructionList: { display: "flex", flexDirection: "column", gap: "16px" },
  instructionItem: { display: "flex", alignItems: "center", gap: "16px", fontSize: "15px", color: "#334155" },
  stepNumber: {
    width: "28px",
    height: "28px",
    border: "1px solid #0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "600",
    borderRadius: "4px",
  },
  actionGrid: { display: "flex", gap: "20px" },
  secondaryActionCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    padding: "32px",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "0.2s ease-in-out",
  },
  cardHeading: { margin: "0 0 8px 0", fontSize: "18px", color: "#0f172a" },
  cardSubtext: { margin: 0, color: "#64748b", fontSize: "14px" },
};