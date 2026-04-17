export default function LoadingScreen({ message = "Loading…" }: { message?: string }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 16,
      background: "var(--bg-base)"
    }}>
      <div style={{
        width: 36, height: 36,
        borderRadius: "50%",
        border: "3px solid rgba(79,142,247,0.15)",
        borderTopColor: "var(--accent-primary)",
        animation: "spin 0.7s linear infinite"
      }} />
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
