/*This is the login code*/
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminAuthPage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: "", password: "" });

    useEffect(() => {
        document.body.style.margin = "0";
        document.body.style.padding = "0";
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = "auto"; };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/admin/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            // Store admin email for tracking who creates new admins
            localStorage.setItem("adminEmail", formData.email);
            alert("Login successful");
            navigate("/admin/dashboard");
        } else {
            alert(data.message);
        }
    };

    return (
        <div style={styles.wrapper}>
            {/* Left Panel: Identity Block */}
            <div style={styles.leftPanel}>
                <div style={styles.leftContent}>
                    <div style={styles.govBrand}>
                        <div style={styles.emblem}>🏛️</div>
                        <div style={styles.brandText}>
                            <h1 style={styles.deptTitle}>Department of Higher Education</h1>
                            <p style={styles.ministrySubtitle}>Ministry of Education | Government of India</p>
                        </div>
                    </div>

                    <div style={styles.portalInfo}>
                        <span style={styles.portalIcon}>🔐</span>
                        <h2 style={styles.portalHeader}>Official Admin Portal</h2>
                        <p style={styles.portalDescription}>
                            Secure access for authorized department personnel only.
                            Please use your government-issued credentials.
                        </p>
                    </div>
                </div>
                <div style={styles.nicBadge}>NIC Secured Portal</div>
            </div>

            {/* Right Panel: Auth Form */}
            <div style={styles.rightPanel}>
                <div style={styles.formContainer}>
                    <h2 style={styles.formTitle}>Administrator Sign In</h2>
                    <p style={styles.formSubTitle}>
                        Enter your official admin details to continue
                    </p>

                    <form style={styles.loginForm} onSubmit={handleSubmit}>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Admin Email</label>
                            <input
                                type="email"
                                placeholder="admin@example.com"
                                style={styles.input}
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>

                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Password</label>
                            <input
                                type="password"
                                placeholder="Enter your password"
                                style={styles.input}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                            />
                        </div>

                        <button type="submit" style={styles.submitButton}>
                            Authorize & Login
                        </button>
                    </form>

                    <div style={styles.backHome} onClick={() => navigate("/")}>
                        ← Back to main website
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
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
    },
    // Left Side Styles
    leftPanel: {
        flex: 1,
        backgroundColor: "#f1f5f9",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start", // Moved content up
        padding: "80px 60px",
        position: "relative",
    },
    leftContent: {
        maxWidth: "450px",
    },
    govBrand: {
        display: "flex",
        alignItems: "center",
        gap: "20px",
        marginBottom: "60px",
    },
    emblem: { fontSize: "40px" },
    deptTitle: {
        fontSize: "22px", // Increased for better visibility
        fontWeight: "700",
        color: "#0f172a",
        margin: 0,
        lineHeight: "1.2",
    },
    ministrySubtitle: {
        fontSize: "14px",
        color: "#64748b",
        margin: "4px 0 0 0",
    },
    portalInfo: {
        marginTop: "20px",
    },
    portalIcon: { fontSize: "32px", display: "block", marginBottom: "15px" },
    portalHeader: {
        fontSize: "20px", // Slightly smaller font size
        fontWeight: "600",
        color: "#1e293b",
        marginBottom: "10px",
    },
    portalDescription: {
        fontSize: "15px",
        color: "#475569",
        lineHeight: "1.6",
    },
    nicBadge: {
        position: "absolute",
        bottom: "40px",
        fontSize: "12px",
        color: "#94a3b8",
        letterSpacing: "1px",
        textTransform: "uppercase",
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
        maxWidth: "400px",
        padding: "20px",
    },
    formTitle: {
        fontSize: "28px",
        fontWeight: "800",
        color: "#0f172a",
        margin: "0 0 8px 0",
    },
    formSubTitle: {
        fontSize: "15px",
        color: "#64748b",
        marginBottom: "30px",
    },
    loginForm: {
        display: "flex",
        flexDirection: "column",
        gap: "20px",
    },
    inputGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        position: "relative",
    },
    label: {
        fontSize: "13px",
        fontWeight: "600",
        color: "#334155",
    },
    input: {
        padding: "14px",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
        fontSize: "15px",
        backgroundColor: "#f8fafc",
        outline: "none",
        transition: "border-color 0.2s, background-color 0.2s",
    },
    submitButton: {
        marginTop: "8px",
        padding: "16px",
        borderRadius: "8px",
        border: "none",
        backgroundColor: "#1e293b",
        color: "#ffffff",
        fontSize: "16px",
        fontWeight: "600",
        cursor: "pointer",
        transition: "background 0.2s",
    },
    backHome: {
        marginTop: "40px",
        fontSize: "13px",
        color: "#94a3b8",
        textAlign: "center",
        cursor: "pointer",
    },
};