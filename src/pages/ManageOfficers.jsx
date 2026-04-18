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
        <div style={styles.container}>
            <div style={styles.sidebar}>
                <div style={styles.logo}>
                    <div style={styles.logoIcon}>🇮🇳</div>
                    <div>
                        <div style={styles.logoTitle}>Admin Portal</div>
                        <div style={styles.logoSubtitle}>Document Management</div>
                    </div>
                </div>

                <nav style={styles.nav}>
                    <div style={styles.navItem} onClick={() => navigate("/admin/dashboard")}>
                        📊 Dashboard
                    </div>
                    <div style={styles.navItem} onClick={() => navigate("/admin/upload")}>
                        📤 Upload Documents
                    </div>
                    <div style={styles.navItem} onClick={() => navigate("/admin/manage")}>
                        📁 Manage Documents
                    </div>
                    <div style={styles.navItem} onClick={() => navigate("/admin/manage-admins")}>
                        👥 Manage Admins
                    </div>
                    <div style={{...styles.navItem, ...styles.navItemActive}}>
                        👮 Manage Officers
                        {pendingCount > 0 && (
                            <span style={styles.badge}>{pendingCount}</span>
                        )}
                    </div>
                </nav>

                <div style={styles.logoutBtn} onClick={() => navigate("/admin/login")}>
                    🚪 Logout
                </div>
            </div>

            <div style={styles.main}>
                <div style={styles.header}>
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
    );
}

const styles = {
    container: { display: "flex", height: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" },
    sidebar: {
        width: "280px",
        backgroundColor: "#003d6b",
        color: "white",
        display: "flex",
        flexDirection: "column",
        padding: "30px 20px"
    },
    logo: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" },
    logoIcon: { fontSize: "32px" },
    logoTitle: { fontSize: "18px", fontWeight: "700" },
    logoSubtitle: { fontSize: "12px", opacity: 0.8 },
    nav: { flex: 1, display: "flex", flexDirection: "column", gap: "8px" },
    navItem: {
        padding: "12px 16px",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "all 0.2s",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
    },
    navItemActive: { backgroundColor: "rgba(255,255,255,0.15)", fontWeight: "600" },
    badge: {
        backgroundColor: "#ef4444",
        color: "white",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: "bold"
    },
    logoutBtn: {
        padding: "12px 16px",
        borderRadius: "8px",
        cursor: "pointer",
        backgroundColor: "rgba(255,255,255,0.1)",
        textAlign: "center",
        marginTop: "20px"
    },
    main: { flex: 1, backgroundColor: "#f8fafc", padding: "40px", overflowY: "auto" },
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
