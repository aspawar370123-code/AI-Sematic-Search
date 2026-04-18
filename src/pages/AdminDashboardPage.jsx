import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";

export default function AdminDashboardPage() {
    const navigate = useNavigate();

    useEffect(() => {
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = "auto"; };
    }, []);

    const [statsData, setStatsData] = useState([
        { label: "Total Documents Uploaded", value: "0" },
        { label: "Policies", value: "0" },
        { label: "Regulations", value: "0" },
        { label: "Schemes", value: "0" },
        { label: "Reports", value: "0" },
        { label: "Total Queries", value: "0" },
        { label: "Active Users", value: "0" },
    ]);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/stats`)
            .then(res => res.json())
            .then(data => {
                setStatsData([
                    { label: "Total Documents Uploaded", value: data.total },
                    { label: "Policies", value: data.policies },
                    { label: "Regulations", value: data.regulations },
                    { label: "Schemes", value: data.schemes },
                    { label: "Reports", value: data.reports ?? 0 },
                    { label: "Total Queries", value: data.totalQueries ?? 0 },
                    { label: "Active Users", value: data.activeUsers ?? 0 },
                ]);
            })
            .catch(err => console.error("Failed to fetch stats:", err));
    }, []);

    return (
        <div style={styles.wrapper}>
            <header style={styles.header}>
                <div style={styles.headerContent}>
                    <div style={styles.logoSection}>
                        <div style={styles.emblem}>🏛️</div>
                        <div style={styles.headerText}>
                            <h1 style={styles.headerTitle}>Department of Higher Education</h1>
                            <p style={styles.headerSubtitle}>Ministry of Education | Government of India</p>
                        </div>
                    </div>
                </div>
            </header>

            <div style={styles.dashboardLayout}>
                <nav style={styles.sidebar}>
                    <div style={styles.sidebarContent}>
                        <div style={styles.adminTitle}>Admin Console</div>

                        <div style={styles.profileSection}>
                            <div style={styles.profileIcon}>👤</div>
                            <div style={styles.profileInfo}>
                                <div style={styles.profileName}>Administrator</div>
                                <div style={styles.profileEmail}>admin@nic.in</div>
                            </div>
                        </div>

                        <div style={styles.divider}></div>

                        {["Dashboard", "Upload Document", "Manage Documents", "Manage Admins", "Manage Officers", "Logout"].map((item, index) => (
                            <div
                                key={item}
                                style={{
                                    ...styles.navItem,
                                    ...(index === 0 ? styles.activeNavItem : {}),
                                    ...(item === "Logout" ? styles.logoutItem : {})
                                }}
                                onClick={() => {
                                    if (item === "Dashboard") navigate("/admin/dashboard");
                                    if (item === "Logout") navigate("/");
                                    if (item === "Upload Document") navigate("/admin/upload");
                                    if (item === "Manage Documents") navigate("/admin/documents");
                                    if (item === "Manage Admins") navigate("/admin/manage-admins");
                                    if (item === "Manage Officers") navigate("/admin/manage-officers");
                                }}
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                </nav>

                <main style={styles.mainContent}>
                    <div style={styles.contentHeader}>
                        <h2 style={styles.welcomeTitle}>Admin Dashboard</h2>
                        <p style={styles.welcomeSubtitle}>Welcome to the Higher Education Policy Retrieval System</p>
                    </div>

                    <div style={styles.statsGrid}>
                        {statsData.map((stat, index) => (
                            <div key={index} style={styles.statCard}>
                                <div style={styles.statLabel}>{stat.label}</div>
                                <div style={styles.statValue}>{stat.value}</div>
                                <div style={styles.cardAccent}></div>
                            </div>
                        ))}
                    </div>

                    <div style={styles.actionRow}>
                        <button
                            style={styles.uploadButton}
                            onClick={() => navigate("/admin/upload")}
                        >
                            Upload New Document
                        </button>
                    </div>
                </main>
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
        backgroundColor: "#f0f4f8",
    },
    header: {
        width: "100%",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        padding: "16px 40px",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.03)",
        zIndex: 10,
    },
    headerContent: {
        maxWidth: "1400px",
        margin: "0 auto",
    },
    logoSection: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
    },
    emblem: { fontSize: "32px" },
    headerText: { display: "flex", flexDirection: "column", gap: "2px" },
    headerTitle: { fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 },
    headerSubtitle: { fontSize: "12px", color: "#64748b", margin: 0 },
    dashboardLayout: {
        flex: 1,
        display: "flex",
        overflow: "hidden",
    },
    sidebar: {
        width: "260px",
        backgroundColor: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        padding: "40px 20px",
    },
    sidebarContent: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
    },
    adminTitle: {
        fontSize: "13px",
        color: "#475569",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        marginBottom: "20px",
        padding: "0 10px",
    },
    profileSection: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "16px",
        backgroundColor: "#f8fafc",
        borderRadius: "10px",
        marginBottom: "20px",
    },
    profileIcon: {
        fontSize: "32px",
        width: "48px",
        height: "48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#e0e7ff",
        borderRadius: "50%",
    },
    profileInfo: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
    },
    profileName: {
        fontSize: "14px",
        fontWeight: "700",
        color: "#1e293b",
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
        transition: "all 0.2s ease",
        backgroundColor: "transparent",
    },
    activeNavItem: {
        backgroundColor: "#003d6b",
        color: "#ffffff",
        boxShadow: "0 4px 6px rgba(0, 61, 107, 0.2)",
    },
    logoutItem: {
        marginTop: "auto",
        color: "#dc2626",
    },
    mainContent: {
        flex: 1,
        padding: "60px",
        overflowY: "auto",
    },
    contentHeader: {
        marginBottom: "40px",
    },
    welcomeTitle: {
        fontSize: "30px",
        fontWeight: "800",
        color: "#0f172a",
        margin: "0 0 8px 0",
    },
    welcomeSubtitle: {
        fontSize: "16px",
        color: "#64748b",
        margin: 0,
    },
    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "24px",
        marginBottom: "40px",
    },
    statCard: {
        backgroundColor: "#ffffff",
        padding: "32px",
        borderRadius: "16px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
    },
    statLabel: {
        fontSize: "14px",
        fontWeight: "600",
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: "1px",
    },
    statValue: {
        fontSize: "32px", // Reduced from 36px to 32px
        fontWeight: "800",
        color: "#0f172a",
        lineHeight: "1.1",
    },
    cardAccent: {
        position: "absolute",
        left: "0",
        top: "30%",
        height: "40%",
        width: "4px",
        backgroundColor: "#003d6b",
        borderRadius: "0 4px 4px 0",
    },
    actionRow: {
        display: "flex",
        justifyContent: "flex-end",
    },
    uploadButton: {
        backgroundColor: "#1e293b",
        color: "#ffffff",
        border: "none",
        padding: "16px 36px",
        borderRadius: "10px",
        fontSize: "16px",
        fontWeight: "700",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        transition: "background-color 0.2s",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    },
};