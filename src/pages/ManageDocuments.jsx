import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ManageDocuments = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterType, setFilterType] = useState("");
  const [filterAuthority, setFilterAuthority] = useState("");

  // Rename state
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/documents`);
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  };

 const handleDelete = async (id) => {
  if (!window.confirm("Are you sure you want to delete this document? This action cannot be undone.")) return;

  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/documents/${id}`, { 
      method: "DELETE" 
    });

    const data = await res.json();

    if (res.ok) {
      // Update state to remove the item from the UI immediately
      setDocuments(prevDocs => prevDocs.filter(doc => doc._id !== id));
      alert("Document deleted successfully");
    } else {
      // Show the specific error message from the backend
      throw new Error(data.message || "Failed to delete document");
    }
  } catch (err) {
    console.error("Delete failed:", err);
    alert("Delete failed: " + err.message);
  }
};
  const startRename = (doc) => {
    setRenamingId(doc._id);
    setRenameValue(doc.title);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

 const handleRename = async (id) => {
  const trimmed = renameValue.trim();
  if (!trimmed) return alert("Title cannot be empty");

  setRenameLoading(true);
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/documents/${id}/rename`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });

    // --- ADD THIS CHECK ---
    if (!res.ok) {
      // If server sends 404/500, catch it here before .json() fails
      const errorData = await res.json().catch(() => ({ message: "Server error (HTML returned)" }));
      throw new Error(errorData.message || `Error ${res.status}`);
    }

    const data = await res.json();
    // -----------------------

    setDocuments(documents.map(doc =>
      doc._id === id ? { ...doc, title: trimmed } : doc
    ));
    setRenamingId(null);
    setRenameValue("");
  } catch (err) {
    console.error("Rename failed:", err);
    alert("Rename failed: " + err.message);
  } finally {
    setRenameLoading(false);
  }
};
  const filtered = documents
    .filter(doc => {
      // Search filter
      const matchesSearch = doc.title?.toLowerCase().includes(search.toLowerCase()) ||
        doc.authority?.toLowerCase().includes(search.toLowerCase()) ||
        doc.docType?.toLowerCase().includes(search.toLowerCase());
      
      // Type filter
      const matchesType = !filterType || doc.docType === filterType;
      
      // Authority filter
      const matchesAuthority = !filterAuthority || doc.authority === filterAuthority;
      
      return matchesSearch && matchesType && matchesAuthority;
    })
    .sort((a, b) => {
      // Sort by year descending (most recent first)
      const yearA = a.year === "N/A" ? 0 : parseInt(a.year) || 0;
      const yearB = b.year === "N/A" ? 0 : parseInt(b.year) || 0;
      return yearB - yearA;
    });

  return (
    <div style={styles.wrapper}>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoSection}>
          <div style={styles.emblem}>🏛️</div>
          <div>
            <h1 style={styles.headerTitle}>Department of Higher Education</h1>
            <p style={styles.headerSubtitle}>Ministry of Education | Government of India</p>
          </div>
        </div>
      </header>

      <div style={styles.dashboardLayout}>

        {/* Sidebar */}
        <nav style={styles.sidebar}>
          <div style={styles.sidebarContent}>
            <div style={styles.adminTitle}>Admin Console</div>

            <div style={styles.profileSection}>
              <div style={styles.profileIcon}>👤</div>
              <div>
                <div style={styles.profileName}>Administrator</div>
                <div style={styles.profileEmail}>admin@nic.in</div>
              </div>
            </div>

            <div style={styles.divider}></div>

            {["Dashboard", "Upload Document", "Manage Documents", "Logout"].map((item) => (
              <div
                key={item}
                style={{
                  ...styles.navItem,
                  ...(item === "Manage Documents" ? styles.activeNavItem : {}),
                  ...(item === "Logout" ? styles.logoutItem : {})
                }}
                onClick={() => {
                  if (item === "Logout") navigate("/");
                  if (item === "Dashboard") navigate("/admin/dashboard");
                  if (item === "Upload Document") navigate("/admin/upload");
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </nav>

        {/* Main Content */}
        <main style={styles.mainContent}>
          <div style={styles.contentHeader}>
            <h2 style={styles.pageTitle}>Manage Documents</h2>
            <p style={styles.pageSubtitle}>View, search, rename, and manage policy documents</p>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search documents by title, authority, or type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />

          {/* Filters */}
          <div style={styles.filtersRow}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Filter by Type:</label>
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">All Types</option>
                <option value="Policy">Policy</option>
                <option value="Regulation">Regulation</option>
                <option value="Report">Report</option>
                <option value="Scheme">Scheme</option>
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Filter by Authority:</label>
              <select 
                value={filterAuthority} 
                onChange={e => setFilterAuthority(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="">All Authorities</option>
                <option value="UGC">UGC</option>
                <option value="AICTE">AICTE</option>
                <option value="Ministry of Education">Ministry of Education</option>
                <option value="MoE">MoE</option>
              </select>
            </div>

            {(filterType || filterAuthority) && (
              <button 
                style={styles.clearFiltersBtn}
                onClick={() => {
                  setFilterType("");
                  setFilterAuthority("");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Table */}
          <div style={styles.tableWrapper}>
            {loading ? (
              <div style={styles.emptyState}>Loading documents...</div>
            ) : filtered.length === 0 ? (
              <div style={styles.emptyState}>No documents found.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeadRow}>
                    <th style={styles.th}>Document Title</th>
                    <th style={styles.th}>Authority</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Year</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc, index) => (
                    <tr
                      key={doc._id}
                      style={{
                        ...styles.tableRow,
                        backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8fafc"
                      }}
                    >
                      {/* Title cell — inline rename input when editing */}
                      <td style={styles.td}>
                        {renamingId === doc._id ? (
                          <div style={styles.renameInputWrapper}>
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") handleRename(doc._id);
                                if (e.key === "Escape") cancelRename();
                              }}
                              style={styles.renameInput}
                              disabled={renameLoading}
                            />
                            <button
                              style={styles.saveButton}
                              onClick={() => handleRename(doc._id)}
                              disabled={renameLoading}
                            >
                              {renameLoading ? "Saving..." : "Save"}
                            </button>
                            <button
                              style={styles.cancelButton}
                              onClick={cancelRename}
                              disabled={renameLoading}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          doc.title
                        )}
                      </td>

                      <td style={styles.td}>{doc.authority}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          backgroundColor:
                            doc.docType === "Policy" ? "#dbeafe" :
                            doc.docType === "Regulation" ? "#fef3c7" : "#dcfce7",
                          color:
                            doc.docType === "Policy" ? "#1d4ed8" :
                            doc.docType === "Regulation" ? "#92400e" : "#166534",
                        }}>
                          {doc.docType}
                        </span>
                      </td>
                      <td style={styles.td}>{doc.year}</td>
                      <td style={styles.td}>
                        <span style={styles.statusBadge}>Active</span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionButtons}>
                          <button
                            style={styles.viewButton}
                            onClick={() => window.open(doc.fileUrl, "_blank")}
                          >
                            View
                          </button>
                          <button
                            style={styles.renameButton}
                            onClick={() => startRename(doc)}
                            disabled={renamingId !== null}
                          >
                            Rename
                          </button>
                          <button
                            style={styles.deleteButton}
                            onClick={() => handleDelete(doc._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const styles = {
  wrapper: {
    height: "100vh", width: "100vw",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    display: "flex", flexDirection: "column",
    backgroundColor: "#f0f4f8",
  },
  header: {
    width: "100%", backgroundColor: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    padding: "16px 40px", boxSizing: "border-box",
    boxShadow: "0 2px 4px rgba(0,0,0,0.03)", zIndex: 10,
  },
  logoSection: { display: "flex", alignItems: "center", gap: "16px" },
  emblem: { fontSize: "32px" },
  headerTitle: { fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 },
  headerSubtitle: { fontSize: "12px", color: "#64748b", margin: 0 },
  dashboardLayout: { flex: 1, display: "flex", overflow: "hidden" },
  sidebar: {
    width: "260px", backgroundColor: "#ffffff",
    borderRight: "1px solid #e2e8f0",
    padding: "40px 20px", flexShrink: 0,
  },
  sidebarContent: { display: "flex", flexDirection: "column", gap: "12px" },
  adminTitle: {
    fontSize: "13px", color: "#475569", fontWeight: "700",
    textTransform: "uppercase", letterSpacing: "1.5px",
    marginBottom: "20px", padding: "0 10px",
  },
  profileSection: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "16px", backgroundColor: "#f8fafc",
    borderRadius: "10px", marginBottom: "20px",
  },
  profileIcon: {
    fontSize: "32px", width: "48px", height: "48px",
    display: "flex", alignItems: "center", justifyContent: "center",
    backgroundColor: "#e0e7ff", borderRadius: "50%",
  },
  profileName: { fontSize: "14px", fontWeight: "700", color: "#1e293b" },
  profileEmail: { fontSize: "12px", color: "#64748b" },
  divider: { height: "1px", backgroundColor: "#e2e8f0", marginBottom: "20px" },
  navItem: {
    padding: "14px 18px", borderRadius: "8px",
    fontSize: "14px", fontWeight: "600", color: "#475569",
    cursor: "pointer", backgroundColor: "transparent",
  },
  activeNavItem: {
    backgroundColor: "#003d6b", color: "#ffffff",
    boxShadow: "0 4px 6px rgba(0,61,107,0.2)",
  },
  logoutItem: { color: "#dc2626" },
  mainContent: { flex: 1, padding: "60px", overflowY: "auto" },
  contentHeader: { marginBottom: "32px" },
  pageTitle: { fontSize: "30px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" },
  pageSubtitle: { fontSize: "16px", color: "#64748b", margin: 0 },
  searchInput: {
    width: "100%", padding: "14px 20px",
    fontSize: "14px", borderRadius: "10px",
    border: "1px solid #e2e8f0", outline: "none",
    marginBottom: "20px", boxSizing: "border-box",
    backgroundColor: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  filtersRow: {
    display: "flex", gap: "16px", alignItems: "flex-end",
    marginBottom: "24px", flexWrap: "wrap",
  },
  filterGroup: {
    display: "flex", flexDirection: "column", gap: "6px",
  },
  filterLabel: {
    fontSize: "12px", fontWeight: "600", color: "#475569",
    textTransform: "uppercase", letterSpacing: "0.5px",
  },
  filterSelect: {
    padding: "10px 14px", fontSize: "14px",
    borderRadius: "8px", border: "1px solid #e2e8f0",
    backgroundColor: "#ffffff", color: "#1e293b",
    outline: "none", cursor: "pointer",
    minWidth: "180px",
  },
  clearFiltersBtn: {
    padding: "10px 20px", fontSize: "13px", fontWeight: "600",
    borderRadius: "8px", border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc", color: "#475569",
    cursor: "pointer",
  },
  tableWrapper: {
    backgroundColor: "#ffffff", borderRadius: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  tableHeadRow: { backgroundColor: "#f1f5f9" },
  th: {
    padding: "16px 20px", textAlign: "left",
    fontSize: "13px", fontWeight: "700", color: "#475569",
    textTransform: "uppercase", letterSpacing: "0.5px",
    borderBottom: "1px solid #e2e8f0",
  },
  tableRow: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "16px 20px", fontSize: "14px", color: "#1e293b" },
  badge: {
    padding: "4px 10px", borderRadius: "20px",
    fontSize: "12px", fontWeight: "600",
  },
  statusBadge: {
    padding: "4px 10px", borderRadius: "20px",
    fontSize: "12px", fontWeight: "600",
    backgroundColor: "#dcfce7", color: "#166534",
  },
  actionButtons: { display: "flex", gap: "8px", flexWrap: "wrap" },
  viewButton: {
    padding: "8px 16px", borderRadius: "6px",
    border: "1px solid #003d6b", backgroundColor: "#ffffff",
    color: "#003d6b", fontSize: "13px", fontWeight: "600",
    cursor: "pointer",
  },
  renameButton: {
    padding: "8px 16px", borderRadius: "6px",
    border: "1px solid #7c3aed", backgroundColor: "#ffffff",
    color: "#7c3aed", fontSize: "13px", fontWeight: "600",
    cursor: "pointer",
  },
  deleteButton: {
    padding: "8px 16px", borderRadius: "6px",
    border: "1px solid #dc2626", backgroundColor: "#ffffff",
    color: "#dc2626", fontSize: "13px", fontWeight: "600",
    cursor: "pointer",
  },
  renameInputWrapper: {
    display: "flex", gap: "8px", alignItems: "center",
  },
  renameInput: {
    padding: "6px 10px", borderRadius: "6px",
    border: "2px solid #7c3aed", fontSize: "14px",
    outline: "none", minWidth: "180px",
  },
  saveButton: {
    padding: "6px 14px", borderRadius: "6px",
    backgroundColor: "#7c3aed", color: "#ffffff",
    border: "none", fontSize: "13px", fontWeight: "600",
    cursor: "pointer",
  },
  cancelButton: {
    padding: "6px 14px", borderRadius: "6px",
    backgroundColor: "#f1f5f9", color: "#475569",
    border: "1px solid #e2e8f0", fontSize: "13px", fontWeight: "600",
    cursor: "pointer",
  },
  emptyState: {
    padding: "60px", textAlign: "center",
    color: "#64748b", fontSize: "16px",
  },
};

export default ManageDocuments;