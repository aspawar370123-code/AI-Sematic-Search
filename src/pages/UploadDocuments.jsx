import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./UploadDocuments.css";

const UploadDocuments = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    authority: "",
    docType: "",
    year: 2024,
    file: null,
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Handle N/A or integer conversion for years
    const processedValue = name === 'year' ? (value === "N/A" ? "N/A" : parseInt(value) || 2024) : value;
    setFormData({ ...formData, [name]: processedValue });
  };

  const handleFileChange = (e) => {
    setFormData({ ...formData, file: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) { alert("Please enter a document title"); return; }
    if (!formData.authority) { alert("Please select an authority"); return; }
    if (!formData.docType) { alert("Please select a document type"); return; }
    if (!formData.year) { alert("Please enter a publication year"); return; }
    if (!formData.file) { alert("Please select a PDF file"); return; }
    if (formData.file.type !== 'application/pdf') { alert("Please select a valid PDF file"); return; }
    if (formData.file.size > 10 * 1024 * 1024) { alert("File size must be less than 10MB"); return; }

    const uploadData = new FormData();
    uploadData.append("title", formData.title.trim());
    uploadData.append("authority", formData.authority);
    uploadData.append("docType", formData.docType);
    uploadData.append("year", formData.year.toString());
    uploadData.append("file", formData.file);

    try {
      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: uploadData
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      alert(`Document uploaded successfully!`);

      setFormData({ title: "", authority: "", docType: "", year: 2024, file: null });
      if (document.getElementById("file-input")) {
        document.getElementById("file-input").value = "";
      }

    } catch (error) {
      alert(`Upload failed: ${error.message}`);
    }
  };

  // --- FIX: GENERATE YEAR OPTIONS ---
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = currentYear; i >= 1990; i--) {
    yearOptions.push(i);
  }
  // ----------------------------------

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
                  ...(item === "Upload Document" ? styles.activeNavItem : {}),
                  ...(item === "Logout" ? styles.logoutItem : {})
                }}
                onClick={() => {
                  if (item === "Logout") navigate("/");
                  if (item === "Dashboard") navigate("/admin/dashboard");
                  if (item === "Manage Documents") navigate("/admin/documents");
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </nav>

        {/* Main Content */}
        <main style={styles.mainContent}>
          <div className="upload-page-container">
            <header className="content-header">
              <div className="header-text">
                <h1>Upload Document</h1>
                <p>Add a new policy document to the system</p>
              </div>
            </header>

            <div className="form-wrapper">
              <div className="upload-card">
                <form onSubmit={handleSubmit}>
                  <div className="form-section">
                    <label className="input-label">Upload PDF *</label>
                    <div className="file-drop-area" onClick={() => document.getElementById("file-input").click()}>
                      <div className="upload-icon">📄</div>
                      <p>{formData.file ? formData.file.name : "Click to select PDF file"}</p>
                      <span>Supported format: PDF</span>
                      <input type="file" id="file-input" accept=".pdf" onChange={handleFileChange} hidden />
                    </div>
                  </div>

                  <div className="form-section">
                    <label className="input-label">Document Title *</label>
                    <input
                      type="text" name="title" className="text-input"
                      placeholder="Enter document title"
                      value={formData.title} onChange={handleInputChange} required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-section">
                      <label className="input-label">Authority *</label>
                      <select name="authority" className="select-input" value={formData.authority} onChange={handleInputChange} required>
                        <option value="">Select Authority</option>
                        <option value="UGC">UGC</option>
                        <option value="AICTE">AICTE</option>
                        <option value="MoE">Ministry of Education</option>
                      </select>
                    </div>

                    <div className="form-section">
                      <label className="input-label">Document Type *</label>
                      <select name="docType" className="select-input" value={formData.docType} onChange={handleInputChange} required>
                        <option value="">Select Document Type</option>
                        <option value="Policy">Policy</option>
                        <option value="Regulation">Regulation</option>
                        <option value="Scheme">Scheme</option>
                        <option value="Report">Report</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-section">
                    <label className="input-label">Publication Year *</label>
                    <select name="year" className="select-input" value={formData.year} onChange={handleInputChange} required>
                      <option value="">Select Year</option>
                      <option value="N/A">Unknown / N/A</option>
                      {yearOptions.map(y => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="submit-button">Upload Document</button>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// ... (keep your styles object exactly as it was)
const styles = {
  wrapper: { height: "100vh", width: "100vw", fontFamily: "'Inter', 'Segoe UI', sans-serif", display: "flex", flexDirection: "column", backgroundColor: "#f0f4f8" },
  header: { width: "100%", backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "16px 40px", boxShadow: "0 2px 4px rgba(0,0,0,0.03)", boxSizing: "border-box" },
  logoSection: { display: "flex", alignItems: "center", gap: "16px" },
  emblem: { fontSize: "32px" },
  headerTitle: { fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 },
  headerSubtitle: { fontSize: "12px", color: "#64748b", margin: 0 },
  dashboardLayout: { flex: 1, display: "flex", overflow: "hidden" },
  sidebar: { width: "260px", backgroundColor: "#ffffff", borderRight: "1px solid #e2e8f0", padding: "40px 20px", flexShrink: 0 },
  sidebarContent: { display: "flex", flexDirection: "column", gap: "12px" },
  adminTitle: { fontSize: "13px", color: "#475569", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "20px", padding: "0 10px" },
  profileSection: { display: "flex", alignItems: "center", gap: "12px", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "10px", marginBottom: "20px" },
  profileIcon: { fontSize: "32px", width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#e0e7ff", borderRadius: "50%" },
  profileName: { fontSize: "14px", fontWeight: "700", color: "#1e293b" },
  profileEmail: { fontSize: "12px", color: "#64748b" },
  divider: { height: "1px", backgroundColor: "#e2e8f0", marginBottom: "20px" },
  navItem: { padding: "14px 18px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", color: "#475569", cursor: "pointer", backgroundColor: "transparent" },
  activeNavItem: { backgroundColor: "#003d6b", color: "#ffffff", boxShadow: "0 4px 6px rgba(0,61,107,0.2)" },
  logoutItem: { color: "#dc2626" },
  mainContent: { flex: 1, overflowY: "auto" },
};

export default UploadDocuments;