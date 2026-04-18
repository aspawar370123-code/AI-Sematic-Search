import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function OfficerAuthPage() {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ email: "", password: "", name: "", designation: "" });

    useEffect(() => {
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = "auto"; };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const endpoint = isLogin ? "/officer/login" : "/officer/register";

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                alert(isLogin ? "Authentication Successful" : "Registration Request Submitted");
                if (isLogin) navigate("/officer/dashboard");
            } else {
                alert(data.message || "An error occurred");
            }
        } catch (error) {
            alert("Server connection failed");
        }
    };

    return (
        <div style={styles.wrapper}>
            {/* Left Panel: Government Identity */}
            <div style={styles.leftPanel}>
                <div style={styles.leftContent}>
                    <div style={styles.govBrand}>
                        <div style={styles.emblem}>🇮🇳</div>
                        <div style={styles.brandText}>
                            <h1 style={styles.deptTitle}>Department of Higher Education</h1>
                            <p style={styles.ministrySubtitle}>Ministry of Education | Government of India</p>
                        </div>
                    </div>

                    <div style={styles.portalInfo}>
                        <div style={styles.badge}>SECURE OFFICER ACCESS</div>
                        <h2 style={styles.portalHeader}>Nodal Officer Login</h2>
                        <p style={styles.portalDescription}>
                            Welcome to the Centralized Management System. This portal is strictly
                            for verified Departmental Officers and Administrative Staff.
                        </p>
                    </div>
                </div>
                <div style={styles.nicBadge}>
                    <img src="https://upload.wikimedia.org/wikipedia/en/thumb/9/95/National_Informatics_Centre_logo.svg/1200px-National_Informatics_Centre_logo.svg.png"
                        alt="NIC Logo" style={{ height: '25px', opacity: 0.7 }} />
                    <p>Designed and Developed by NIC</p>
                </div>
            </div>

            {/* Right Panel: Auth Form */}
            <div style={styles.rightPanel}>
                <div style={styles.formContainer}>
                    <h2 style={styles.formTitle}>{isLogin ? "Officer Sign In" : "Register Officer Profile"}</h2>
                    <p style={styles.formSubTitle}>
                        {isLogin ? "Authenticate with your government credentials" : "Provide details for administrative verification"}
                    </p>

                    <form style={styles.loginForm} onSubmit={handleSubmit}>
                        {!isLogin && (
                            <>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Full Name & Rank</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Dr. Rajesh Kumar"
                                        style={styles.input}
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Designation</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Section Officer"
                                        style={styles.input}
                                        value={formData.designation}
                                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                        required
                                    />
                                </div>
                            </>
                        )}

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Official Email ID (gov.in / nic.in)</label>
                            <input
                                type="email"
                                placeholder="name@gov.in"
                                style={styles.input}
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Access Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                style={styles.input}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                            />
                        </div>

                        <button type="submit" style={styles.submitButton}>
                            {isLogin ? "Secure Login" : "Request Access"}
                        </button>
                    </form>

                    <div style={styles.toggleText}>
                        {isLogin ? "Not registered?" : "Already have access?"}{" "}
                        <span
                            style={styles.toggleLink}
                            onClick={() => setIsLogin(!isLogin)}
                        >
                            {isLogin ? "Apply for credentials" : "Return to Sign In"}
                        </span>
                    </div>

                    <div style={styles.backHome} onClick={() => navigate("/")}>
                        ← Back to Public Portal
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    wrapper: {
        height: "100vh",
        width: "100vw",
        display: "flex",
        fontFamily: "'Inter', sans-serif",
    },
    leftPanel: {
        flex: 1,
        backgroundColor: "#002d5a", // Navy Blue for a more formal Gov feel
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "80px 60px",
        color: "#ffffff",
    },
    leftContent: { maxWidth: "450px" },
    govBrand: {
        display: "flex",
        alignItems: "center",
        gap: "20px",
        marginBottom: "60px",
    },
    emblem: { fontSize: "50px" },
    deptTitle: {
        fontSize: "24px",
        fontWeight: "700",
        color: "#ffffff",
        margin: 0,
        lineHeight: "1.2",
    },
    ministrySubtitle: {
        fontSize: "13px",
        color: "#cbd5e1",
        margin: "6px 0 0 0",
        textTransform: "uppercase",
        letterSpacing: "0.5px"
    },
    badge: {
        display: "inline-block",
        padding: "4px 12px",
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: "bold",
        marginBottom: "15px",
        border: "1px solid rgba(255,255,255,0.2)"
    },
    portalHeader: {
        fontSize: "32px",
        fontWeight: "600",
        marginBottom: "15px",
    },
    portalDescription: {
        fontSize: "16px",
        color: "#94a3b8",
        lineHeight: "1.6",
    },
    nicBadge: {
        fontSize: "11px",
        color: "#94a3b8",
        textAlign: "left",
    },
    // Right Side Styles
    rightPanel: {
        flex: 1.2,
        backgroundColor: "#ffffff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
    formContainer: {
        width: "100%",
        maxWidth: "420px",
        padding: "40px",
    },
    formTitle: {
        fontSize: "26px",
        fontWeight: "700",
        color: "#0f172a",
        margin: "0 0 8px 0",
    },
    formSubTitle: {
        fontSize: "14px",
        color: "#64748b",
        marginBottom: "30px",
    },
    loginForm: {
        display: "flex",
        flexDirection: "column",
        gap: "18px",
    },
    inputGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    label: {
        fontSize: "13px",
        fontWeight: "600",
        color: "#475569",
    },
    input: {
        padding: "12px 16px",
        borderRadius: "6px",
        border: "1px solid #cbd5e1",
        fontSize: "15px",
        transition: "all 0.2s",
        outline: "none",
    },
    submitButton: {
        marginTop: "10px",
        padding: "14px",
        borderRadius: "6px",
        border: "none",
        backgroundColor: "#d97706", // Amber color for action buttons
        color: "#ffffff",
        fontSize: "16px",
        fontWeight: "600",
        cursor: "pointer",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    },
    toggleText: {
        marginTop: "25px",
        fontSize: "14px",
        color: "#64748b",
        textAlign: "center",
    },
    toggleLink: {
        color: "#002d5a",
        fontWeight: "700",
        cursor: "pointer",
        textDecoration: "underline"
    },
    backHome: {
        marginTop: "30px",
        fontSize: "13px",
        color: "#94a3b8",
        textAlign: "center",
        cursor: "pointer",
    },
};