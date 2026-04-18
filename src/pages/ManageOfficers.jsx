import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ManageOfficers() {
    const navigate = useNavigate();
    const [officers, setOfficers] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all"); // all, pending, approved
    const adminEmail = localStorage.getItem("adminEmail") || "Admin";

    useEffect(() => {
        fetchOfficers();
    }, []);

    const fetchOfficers = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/admin/officers`);
            const data = await response.json();
            setOfficers(data);
            setPendingCount(data.filter(o => !o.approved).length);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch officers:", error);
            setLoading(false);
        }
    };

    const handleApprove = async (officerId) => {
        if (!confirm("Approve this officer's access request?")) return;

        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/admin/officers/${officerId}/approve`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ approvedBy: adminEmail })
                }
            );

            if (response.ok) {
                alert("Officer approved successfully!");
                fetchOfficers();
            } else {
                alert("Failed to approve officer");
            }
        } catch (error) {
            alert("Error approving officer");
        }
    };

    const handleReject = async (officerId) => {
        if (!confirm("Reject and delete this officer request?")) return;

        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/admin/officers/${officerId}`,
                { method: "DELETE" }
            );

            if (response.ok) {
                alert("Officer request rejected");
                fetchOfficers();
            } else {
                alert("Failed to reject officer");
            }
        } catch (error) {
            alert("Error rejecting officer");
        }
    };

    const filteredOfficers = officers.filter(officer => {
        if (filter === "pending") return !officer.approved;
        if (filter === "approved") return officer.approved;
        return true;
    });

    return (
        <div style={styles.wrapper}>
            {/* Header */}
            <header style={styles.topHeader}>
                <div style={styles.headerContent}>
                    <div style={styles.logoSection}>
                        <div style={styles.headerEmblem}>🏛️</div>
                        <div style={styles.headerText}>
                            <h1 style={styles.headerTitle}>Department of Higher Education</h1>
                            <p style={styles.headerSubtitle}>Ministry of Education | Government of India</p>
                        </div>
                    </div>
                </div>
            </header>

            <div style={styles.dashboardLayout}>
                {/* Sidebar */}
                <div style={styles.sidebar}>
                    <div style={styles.brandSection}>
                        <div style={styles.adminTitle}>ADMIN CONSOLE</div>
                        <div style={styles.profileSection}>
                            <div style={styles.profileIcon}>👤</div>
                            <div style={styles.profileInfo}>
                                <div style={styles.profileName}>Administrator</div>
                                <div style={styles.profileEmail}>{adminEmail}</div>
                            </div>
                        </div>
                    </div>

                    <div style={styles.divider}></div>

                    <div style={styles.navItem} onClick={() => navigate("/admin/dashboard")}>
                        🏠 Dashboard
                    </div>
                    <div style={styles.navItem} onClick={() => navigate("/admin/upload")}>
                        📤 Upload Document
                    </div>
                    <div style={styles.navItem} onClick={() => navigate("/admin/documents")}>
                        📁 Manage Documents
                    </div>
                    <div style={styles.navItem} onClick={() => navigate("/admin/manage-admins")}>
                        👥 Manage Admins
                    </div>
                    <div style={{...styles.navItem, ...styles.activeNavItem}}>
                        👮 Manage Officers
                        {pendingCount > 0 && (
                            <span style={styles.badge}>{pendingCount}</span>
                        )}
                    </div>

                    <div style={styles.logoutBtn} onClick={() => navigate("/")}>
                        🚪 Logout
                    </div>
                </div>

                {/* Main Content */}
                <div style={styles.main}>
                    <div style={styles.contentHeader}>
                        <div>
                            <h1 style={styles.title}>Manage Officers</h1>
                            <p style={styles.subtitle}>Review and approve officer access requests</p>
                        </div>
                    </div>

                    <div style={styles.filterBar}>
                        <button 
                            style={filter === "all" ? {...styles.filterBtn, ...styles.filterBtnActive} : styles.filterBtn}
                            onClick={() => setFilter("all")}
                        >
                            All Officers ({officers.length})
                        </button>
                    <button 
                        style={filter === "pending" ? {...styles.filterBtn, ...styles.filterBtnActive} : styles.filterBtn}
                        onClick={() => setFilter("pending")}
                    >
                        Pending Approval ({pendingCount})
                    </button>
                    <button 
                        style={filter === "approved" ? {...styles.filterBtn, ...styles.filterBtnActive} : styles.filterBtn}
                        onClick={() => setFilter("approved")}
                    >
                        Approved ({officers.filter(o => o.approved).length})
                    </button>
                </div>

                {loading ? (
                    <div style={styles.loading}>Loading officers...</div>
                ) : filteredOfficers.length === 0 ? (
                    <div style={styles.empty}>
                        <div style={styles.emptyIcon}>👮</div>
                        <p>No officers found</p>
                    </div>
                ) : (
                    <div style={styles.tableContainer}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.tableHeader}>
                                    <th style={styles.th}>Name</th>
                                    <th style={styles.th}>Designation</th>
                                    <th style={styles.th}>Email</th>
                                    <th style={styles.th}>Status</th>
                                    <th style={styles.th}>Registered</th>
                                    <th style={styles.th}>Approved By</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOfficers.map((officer) => (
                                    <tr key={officer._id} style={styles.tableRow}>
                                        <td style={styles.td}>{officer.name}</td>
                                        <td style={styles.td}>{officer.designation}</td>
                                        <td style={styles.td}>{officer.email}</td>
                                        <td style={styles.td}>
                                            {officer.approved ? (
                                                <span style={styles.statusApproved}>✓ Approved</span>
                                            ) : (
                                                <span style={styles.statusPending}>⏳ Pending</span>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            {new Date(officer.createdAt).toLocaleDateString()}
                                        </td>
                                        <td style={styles.td}>
                                            {officer.approvedBy || "-"}
                                        </td>
                                        <td style={styles.td}>
                                            {!officer.approved ? (
                                                <div style={styles.actions}>
                                                    <button
                                                        style={styles.approveBtn}
                                                        onClick={() => handleApprove(officer._id)}
                                                    >
                                                        ✓ Approve
                                                    </button>
                                                    <button
                                                        style={styles.rejectBtn}
                                                        onClick={() => handleReject(officer._id)}
                                                    >
                                                        ✗ Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    style={styles.deleteBtn}
                                                    onClick={() => handleReject(officer._id)}
                                                >
                                                    🗑 Remove
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}

const styles = {
    wrapper: {
        height: "100vh",
        width: "100vw",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8fafc",
    },
    topHeader: { backgroundColor: "#ffffff", borderBottom: "2px solid #e2e8f0", padding: "20px 40px" },
    headerContent: { maxWidth: "1400px", margin: "0 auto" },
    logoSection: { display: "flex", alignItems: "center", gap: "16px" },
    headerEmblem: { fontSize: "36px" },
    headerText: {},
    headerTitle: { fontSize: "20px", fontWeight: "700", color: "#0f172a", margin: 0, lineHeight: "1.2" },
    headerSubtitle: { fontSize: "13px", color: "#64748b", margin: "4px 0 0 0" },
    dashboardLayout: { display: "flex", flex: 1, overflow: "hidden" },
    sidebar: {
        width: "280px",
        backgroundColor: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
    },
    brandSection: { marginBottom: "24px" },
    adminTitle: {
        fontSize: "11px",
        fontWeight: "700",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: "1px",
        marginBottom: "16px",
    },
    profileSection: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px",
        backgroundColor: "#f8fafc",
        borderRadius: "8px",
    },
    profileIcon: {
        fontSize: "24px",
    },
    profileInfo: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
    },
    profileName: {
        fontSize: "14px",
        fontWeight: "600",
        color: "#0f172a",
    },
    profileEmail: {
        fontSize: "12px",
        color: "#64748b",
    },
    divider: {
        height: "1px",
        backgroundColor: "#e2e8f0",
        marginBottom: "20px",
    },
    navItem: {
        padding: "14px 18px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "600",
        color: "#475569",
        cursor: "pointer",
        marginBottom: "6px",
        transition: "all 0.2s",
    },
    activeNavItem: {
        backgroundColor: "#003d6b",
        color: "#ffffff",
        boxShadow: "0 4px 6px rgba(0,61,107,0.2)",
    },
    badge: {
        backgroundColor: "#ef4444",
        color: "white",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: "bold",
        marginLeft: "auto"
    },
    logoutBtn: {
        color: "#dc2626",
        marginTop: "auto",
        padding: "14px 18px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "600",
        cursor: "pointer",
        transition: "all 0.2s",
    },
    main: { flex: 1, padding: "40px", overflowY: "auto" },
    contentHeader: { marginBottom: "32px" },
    header: { marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: "28px", fontWeight: "700", color: "#0f172a", margin: 0 },
    subtitle: { fontSize: "14px", color: "#64748b", marginTop: "5px" },
    filterBar: { display: "flex", gap: "10px", marginBottom: "20px" },
    filterBtn: {
        padding: "10px 20px",
        border: "1px solid #cbd5e1",
        backgroundColor: "white",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "500"
    },
    filterBtnActive: {
        backgroundColor: "#003d6b",
        color: "white",
        borderColor: "#003d6b"
    },
    loading: { textAlign: "center", padding: "40px", color: "#64748b" },
    empty: { textAlign: "center", padding: "60px", color: "#94a3b8" },
    emptyIcon: { fontSize: "48px", marginBottom: "10px" },
    tableContainer: { backgroundColor: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
    table: { width: "100%", borderCollapse: "collapse" },
    tableHeader: { backgroundColor: "#f1f5f9" },
    th: { padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#475569", borderBottom: "1px solid #e2e8f0" },
    tableRow: { borderBottom: "1px solid #e2e8f0" },
    td: { padding: "16px", fontSize: "14px", color: "#334155" },
    statusApproved: {
        backgroundColor: "#dcfce7",
        color: "#166534",
        padding: "4px 12px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: "600"
    },
    statusPending: {
        backgroundColor: "#fef3c7",
        color: "#92400e",
        padding: "4px 12px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: "600"
    },
    actions: { display: "flex", gap: "8px" },
    approveBtn: {
        padding: "6px 12px",
        backgroundColor: "#10b981",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "500"
    },
    rejectBtn: {
        padding: "6px 12px",
        backgroundColor: "#ef4444",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "500"
    },
    deleteBtn: {
        padding: "6px 12px",
        backgroundColor: "#64748b",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "500"
    }
};
