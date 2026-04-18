import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ManageAdmins() {
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: "", password: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [currentAdminEmail, setCurrentAdminEmail] = useState("");

  useEffect(() => {
    // Get current admin email from login (you might want to store this in context/state)
    const email = localStorage.getItem("adminEmail") || "arpitasp9@gmail.com";
    setCurrentAdminEmail(email);
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/admin/list`);
      const data = await res.json();
      setAdmins(data);
    } catch (err) {
      console.error("Failed to fetch admins", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!newAdmin.email || !newAdmin.password) {
      alert("Please fill all fields");
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/admin/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newAdmin.email,
          password: newAdmin.password,
          createdBy: currentAdminEmail
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        alert("Admin created successfully!");
        setShowCreateModal(false);
        setNewAdmin({ email: "", password: "" });
        fetchAdmins();
      } else {
        alert(data.message || "Failed to create admin");
      }
    } catch (err) {
      alert("Error creating admin");
    }
  };

  const handleDeleteAdmin = async (id) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/admin/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        alert("Admin deleted successfully");
        setDeleteConfirm(null);
        fetchAdmins();
      } else {
        alert("Failed to delete admin");
      }
    } catch (err) {
      alert("Error deleting admin");
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brandSection}>
          <div style={styles.emblem}>🏛️</div>
          <div>
            <div style={styles.brandTitle}>Admin Portal</div>
            <div style={styles.brandSubtitle}>Document Management</div>
          </div>
        </div>

        <div style={styles.divider}></div>

        {["Dashboard", "Upload Document", "Manage Documents", "Manage Admins", "Manage Officers", "Logout"].map((item) => (
          <div
            key={item}
            style={{
              ...styles.navItem,
              ...(item === "Manage Admins" ? styles.activeNavItem : {}),
              ...(item === "Logout" ? styles.logoutItem : {})
            }}
            onClick={() => {
              if (item === "Logout") navigate("/");
              if (item === "Dashboard") navigate("/admin/dashboard");
              if (item === "Upload Document") navigate("/admin/upload");
              if (item === "Manage Documents") navigate("/admin/documents");
              if (item === "Manage Officers") navigate("/admin/manage-officers");
            }}
          >
            {item === "Dashboard" && "🏠"}
            {item === "Upload Document" && "📤"}
            {item === "Manage Documents" && "📁"}
            {item === "Manage Admins" && "👥"}
            {item === "Manage Officers" && "👮"}
            {item === "Logout" && "🚪"}
            <span style={{ marginLeft: "10px" }}>{item}</span>
          </div>
        ))}
      </aside>

      {/* Main Content */}
      <main style={styles.mainContent}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Manage Administrators</h1>
            <p style={styles.subtitle}>View and manage admin accounts</p>
          </div>
          <button style={styles.createBtn} onClick={() => setShowCreateModal(true)}>
            + Create New Admin
          </button>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading admins...</div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Created By</th>
                  <th style={styles.th}>Created At</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin._id} style={styles.tableRow}>
                    <td style={styles.td}>{admin.email}</td>
                    <td style={styles.td}>{admin.createdBy || "system"}</td>
                    <td style={styles.td}>
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </td>
                    <td style={styles.td}>
                      {admin.email !== currentAdminEmail && (
                        <button
                          style={styles.deleteBtn}
                          onClick={() => setDeleteConfirm(admin)}
                        >
                          Delete
                        </button>
                      )}
                      {admin.email === currentAdminEmail && (
                        <span style={styles.currentBadge}>Current User</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Create New Administrator</h2>
            <form onSubmit={handleCreateAdmin}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  style={styles.input}
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  placeholder="admin@example.com"
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  style={styles.input}
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  placeholder="Enter password"
                  required
                />
              </div>
              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelBtn} onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn}>
                  Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={styles.modalOverlay} onClick={() => setDeleteConfirm(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Confirm Delete</h2>
            <p style={styles.confirmText}>
              Are you sure you want to delete admin <strong>{deleteConfirm.email}</strong>?
              This action cannot be undone.
            </p>
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                style={styles.deleteConfirmBtn}
                onClick={() => handleDeleteAdmin(deleteConfirm._id)}
              >
                Delete Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", height: "100vh", backgroundColor: "#f8fafc", fontFamily: "'Inter', sans-serif" },
  sidebar: { width: "280px", backgroundColor: "#ffffff", borderRight: "1px solid #e2e8f0", padding: "24px", display: "flex", flexDirection: "column" },
  brandSection: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" },
  emblem: { fontSize: "28px" },
  brandTitle: { fontSize: "16px", fontWeight: "700", color: "#0f172a" },
  brandSubtitle: { fontSize: "12px", color: "#64748b" },
  divider: { height: "1px", backgroundColor: "#e2e8f0", marginBottom: "20px" },
  navItem: { padding: "14px 18px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", color: "#475569", cursor: "pointer", marginBottom: "6px", display: "flex", alignItems: "center" },
  activeNavItem: { backgroundColor: "#003d6b", color: "#ffffff", boxShadow: "0 4px 6px rgba(0,61,107,0.2)" },
  logoutItem: { color: "#dc2626", marginTop: "auto" },
  mainContent: { flex: 1, padding: "40px", overflowY: "auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" },
  title: { fontSize: "28px", fontWeight: "800", color: "#1e293b", margin: 0 },
  subtitle: { fontSize: "14px", color: "#64748b", marginTop: "4px" },
  createBtn: { backgroundColor: "#003d6b", color: "#ffffff", border: "none", padding: "12px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer" },
  loading: { textAlign: "center", padding: "40px", color: "#64748b" },
  tableContainer: { backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  tableHeader: { backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" },
  th: { padding: "16px", textAlign: "left", fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" },
  tableRow: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "16px", fontSize: "14px", color: "#334155" },
  deleteBtn: { backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  currentBadge: { backgroundColor: "#dbeafe", color: "#1e40af", padding: "4px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: "700" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { backgroundColor: "#ffffff", borderRadius: "12px", padding: "32px", width: "90%", maxWidth: "500px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" },
  modalTitle: { fontSize: "20px", fontWeight: "700", color: "#1e293b", marginBottom: "20px" },
  formGroup: { marginBottom: "20px" },
  label: { display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" },
  input: { width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" },
  modalActions: { display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" },
  cancelBtn: { backgroundColor: "#f1f5f9", color: "#475569", border: "none", padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer" },
  submitBtn: { backgroundColor: "#003d6b", color: "#ffffff", border: "none", padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer" },
  deleteConfirmBtn: { backgroundColor: "#dc2626", color: "#ffffff", border: "none", padding: "10px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer" },
  confirmText: { fontSize: "14px", color: "#475569", lineHeight: "1.6", marginBottom: "20px" }
};
