import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function LandingPage() {
    const navigate = useNavigate();
    const [hoveredButton, setHoveredButton] = useState(null);
    const [hoveredNav, setHoveredNav] = useState(null);

    return (
        <div style={styles.wrapper}>
            {/* Header + Navbar Group (Fixed Height) */}
            <div style={styles.topSection}>
                <header style={styles.header}>
                    <div style={styles.headerContent}>
                        <div style={styles.logoSection}>
                            <div style={styles.emblem}>🏛️</div>
                            <div style={styles.headerText}>
                                <span style={styles.headerTitle}>Department of Higher Education</span>
                                <span style={styles.headerDivider}>|</span>
                                <span style={styles.headerSubtitle}>Ministry of Education</span>
                                <span style={styles.headerDivider}>|</span>
                                <span style={styles.headerSubtitle}>Government of India</span>
                            </div>
                        </div>
                    </div>
                </header>

                <nav style={styles.navbar}>
                    <div style={styles.navContent}>
                        {["HOME", "ABOUT", "DOCUMENTS", "STATISTICS"].map((item) => (
                            <span
                                key={item}
                                style={{
                                    ...styles.navItem,
                                    ...(hoveredNav === item ? styles.navItemHover : {}),
                                }}
                                onMouseEnter={() => setHoveredNav(item)}
                                onMouseLeave={() => setHoveredNav(null)}
                            >
                                {item}
                            </span>
                        ))}
                    </div>
                </nav>
            </div>

            {/* Hero Section - Optimized to fit the remaining laptop screen */}
            <main style={styles.hero}>
                <div style={styles.heroContent}>
                    <div style={styles.badge}>NEXT-GEN GOVERNANCE</div>
                    <h1 style={styles.heroTitle}>
                        AI-Powered Policy Intelligence
                        <br />
                        <span style={styles.heroTitleAccent}>for Higher Education</span>
                    </h1>

                    <p style={styles.heroSubtitle}>
                        Leveraging semantic search and generative intelligence to 
                        streamline higher education regulations and compliance.
                    </p>

                    <div style={styles.buttonContainer}>
                        <button
                            style={{
                                ...styles.adminButton,
                                ...(hoveredButton === "admin" ? styles.adminButtonHover : {}),
                            }}
                            onClick={() => navigate("/admin/login")}
                            onMouseEnter={() => setHoveredButton("admin")}
                            onMouseLeave={() => setHoveredButton(null)}
                        >
                            <span style={styles.buttonIcon}>👤</span>
                            Admin Login
                        </button>

                        <button
                            style={{
                                ...styles.officerButton,
                                ...(hoveredButton === "officer" ? styles.officerButtonHover : {}),
                            }}
                            onClick={() => navigate("/officer/login")}
                            onMouseEnter={() => setHoveredButton("officer")}
                            onMouseLeave={() => setHoveredButton(null)}
                        >
                            <span style={styles.buttonIcon}>👔</span>
                            Officer Login
                        </button>
                    </div>
                </div>

                {/* Decorative Elements */}
                <div style={styles.decorativeCircle1}></div>
                <div style={styles.decorativeCircle2}></div>
            </main>
        </div>
    );
}

const styles = {
    wrapper: {
    height: "100vh",
    width: "100%",
    fontFamily: "'Inter', sans-serif",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
},

    topSection: {
        flexShrink: 0, // Prevents the header from squishing
    },

    header: {
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #f1f5f9",
        padding: "6px 32px",
    },

    headerContent: {
        maxWidth: "1400px",
        margin: "0 auto",
    },

    logoSection: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },

    emblem: { fontSize: "24px" },

    headerText: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },

    headerTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#0f172a",
},
    headerDivider: { color: "#cbd5e1", fontSize: "12px" },

    headerSubtitle: {
        fontSize: "12px",
        color: "#64748b",
        fontWeight: "500",
    },

    navbar: {
        backgroundColor: "#003d6b",
        padding: "0 32px",
    },

    navContent: {
        maxWidth: "1400px",
        margin: "0 auto",
        display: "flex",
        gap: "32px",
        padding: "8px 0",
    },

    navItem: {
        color: "#e2e8f0",
        fontSize: "12px",
        fontWeight: "600",
        cursor: "pointer",
        letterSpacing: "0.5px",
        transition: "color 0.2s",
    },

    navItemHover: { color: "#ffffff" },

    hero: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    background: "radial-gradient(circle at center, #f0f9ff 0%, #ffffff 100%)",
    position: "relative",
    padding: "20px",
},

    heroContent: {
    maxWidth: "780px",
    zIndex: 2,
},
    badge: {
    backgroundColor: "#eef2ff",
    color: "#4f46e5",
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px",
    display: "inline-block",
    marginBottom: "22px"
},
    heroTitle: {
    fontSize: "clamp(36px, 4vw, 48px)",
    fontWeight: "800",
    color: "#111827",
    margin: "0 0 24px 0",
    lineHeight: "1.25",
},
    heroTitleAccent: {
        color: "#3b82f6", // Clean, lighter blue for accent
    },

    heroSubtitle: {
    fontSize: "17px",
    color: "#475569",
    lineHeight: "1.7",
    fontWeight: "400",
    letterSpacing: "0.2px",
    maxWidth: "640px",
    margin: "0 auto 32px auto",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
},
    buttonContainer: {
    display: "flex",
    gap: "14px",
    marginTop: "26px",
    justifyContent: "center",
},
    adminButton: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 34px",
    fontSize: "15px",
    fontWeight: "600",
    backgroundColor: "#f3f4f6",
    color: "#1e293b",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 4px 12px rgba(29,78,216,0.25)",
},

    adminButtonHover: {
    backgroundColor: "#e5e7eb",
    borderColor: "#cbd5e1",
    transform: "translateY(-2px)",
},

    officerButton: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "14px 32px",
        fontSize: "15px",
        fontWeight: "600",
        backgroundColor: "#ffffff",
        color: "#1e293b",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "all 0.2s ease",
    },

    officerButtonHover: {
        backgroundColor: "#f8fafc",
        borderColor: "#cbd5e1",
        transform: "translateY(-2px)",
    },

    buttonIcon: { fontSize: "16px" },

    decorativeCircle1: {
    position: "absolute",
    width: "320px",
    height: "320px",
    background: "rgba(59,130,246,0.04)",
    borderRadius: "50%",
    top: "15%",
    right: "8%",
},

decorativeCircle2: {
    position: "absolute",
    width: "240px",
    height: "240px",
    background: "rgba(0,61,107,0.03)",
    borderRadius: "50%",
    bottom: "10%",
    left: "8%",
},
};