import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

const themes = {
  dark: {
    bg: "#0f1115",
    text: "#e6e8ee",
    muted: "#9aa1ac",
    cardBg: "#171a21",
    border: "#2b313b",
    buttonBg: "#2a2f3a",
    buttonText: "#e6e8ee",
    inputBg: "#11141a",
    accent: "#7aa2f7",
    shadow: "0 6px 18px rgba(0, 0, 0, 0.2)",
  },
  light: {
    bg: "#f7f5f0",
    text: "#1f242c",
    muted: "#5f6b7a",
    cardBg: "#ffffff",
    border: "#d8dfe7",
    buttonBg: "#eef1f5",
    buttonText: "#1f242c",
    inputBg: "#ffffff",
    accent: "#2b6cb0",
    shadow: "0 6px 18px rgba(0, 0, 0, 0.08)",
  },
};

function getRoute() {
  const path = window.location.pathname || "/comments";
  if (path === "/login") return "/login";
  if (path === "/topics") return "/topics";
  return "/comments";
}

function navigateTo(path, setRoute) {
  const next = path === "/login" ? "/login" : path === "/topics" ? "/topics" : "/comments";
  if (window.location.pathname !== next) {
    window.history.pushState({}, "", next);
  }
  setRoute(next);
}

async function api(path, options = {}) {
  const opts = {
    credentials: "include",
    ...options,
  };

  if (opts.body && !opts.headers?.["Content-Type"]) {
    opts.headers = { ...(opts.headers || {}), "Content-Type": "application/json" };
  }

  const res = await fetch(`${API_BASE}${path}`, opts);
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let message = "Request failed";
    if (contentType.includes("application/json")) {
      try {
        const body = await res.json();
        message = body.error || message;
      } catch {
        // ignore
      }
    } else {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

function PublicRating({ score, onLike, onDislike, disabled, theme }) {
  const buttonStyle = {
    background: theme.buttonBg,
    color: theme.buttonText,
    border: `1px solid ${theme.border}`,
    borderRadius: 999,
    padding: "4px 10px",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  const iconStyle = { width: 14, height: 14, display: "block" };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
      <button onClick={onLike} disabled={disabled} style={buttonStyle} aria-label="Upvote">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={iconStyle}>
          <path fill="currentColor" d="M12 5l7 8H5z" />
        </svg>
      </button>
      <button onClick={onDislike} disabled={disabled} style={buttonStyle} aria-label="Downvote">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={iconStyle}>
          <path fill="currentColor" d="M12 19l-7-8h14z" />
        </svg>
      </button>
      <span style={{ color: theme.muted }}>{score}</span>
    </div>
  );
}

function Comments({ comments, text, onTextChange, onAdd, onRate, user, theme, selectedTopic }) {
  const inputStyle = {
    padding: "6px 10px",
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    background: theme.inputBg,
    color: theme.text,
    width: "min(90ch, 90%)",
  };

  const canPost = Boolean(user) && selectedTopic && selectedTopic !== "all";

  const buttonStyle = {
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    background: theme.buttonBg,
    color: theme.buttonText,
    cursor: canPost ? "pointer" : "not-allowed",
  };

  const helperText = !user
    ? "Login to comment or rate"
    : selectedTopic === "all"
      ? "Choose a topic to post"
      : `Posting in ${selectedTopic}`;

  return (
    <div style={{ textAlign: "center", width: 500, maxWidth: "90vw", margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={canPost ? "Write a comment" : "Select a topic to post"}
          style={inputStyle}
          disabled={!canPost}
        />
        <button onClick={onAdd} disabled={!canPost} style={buttonStyle}>
          Add
        </button>
      </div>
      <div style={{ fontSize: 12, color: theme.muted, marginTop: 6 }}>{helperText}</div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "12px 0 0 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        {comments.map((c) => (
          <li
            key={c.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "10px 14px",
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              width: "min(90ch, 90%)",
              background: theme.cardBg,
              boxShadow: theme.shadow,
            }}
          >
            <div style={{ wordBreak: "break-word", maxWidth: "90ch", color: theme.text }}>{c.text}</div>
            <div style={{ fontSize: 12, color: theme.muted }}>By {c.author}</div>
            {c.topic?.name ? (
              <div style={{ fontSize: 12, color: theme.muted }}>Topic: {c.topic.name}</div>
            ) : null}
            <PublicRating
              score={c.score}
              onLike={() => onRate(c.id, 1)}
              onDislike={() => onRate(c.id, -1)}
              disabled={!user}
              theme={theme}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LoginPage({ authMode, loginForm, onChange, onSubmit, onToggleMode, onBack, loginError, theme }) {
  const inputStyle = {
    padding: "6px 10px",
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    background: theme.inputBg,
    color: theme.text,
  };
  const buttonStyle = {
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    background: theme.buttonBg,
    color: theme.buttonText,
    cursor: "pointer",
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h1 style={{ letterSpacing: 0.5, marginBottom: 18 }}>Commment!</h1>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={loginForm.username}
          onChange={(e) => onChange({ ...loginForm, username: e.target.value })}
          placeholder="Username"
          style={inputStyle}
        />
        <input
          value={loginForm.password}
          onChange={(e) => onChange({ ...loginForm, password: e.target.value })}
          placeholder="Password"
          type="password"
          style={inputStyle}
        />
        {authMode === "signup" ? (
          <input
            value={loginForm.displayName}
            onChange={(e) => onChange({ ...loginForm, displayName: e.target.value })}
            placeholder="Display name"
            style={inputStyle}
          />
        ) : null}
        <button onClick={onSubmit} style={buttonStyle}>
          {authMode === "signup" ? "Sign up" : "Login"}
        </button>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={onToggleMode} style={buttonStyle}>
          {authMode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
        <button onClick={onBack} style={buttonStyle}>
          Back to comments
        </button>
      </div>
      {loginError ? <div style={{ marginTop: 12, color: "#d44" }}>{loginError}</div> : null}
    </div>
  );
}

function TopicsPage({ topics, selectedTopic, onSelectTopic, theme, onBack }) {
  const safeTopics = Array.isArray(topics) ? topics : [];

  const buttonStyle = {
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${theme.border}`,
    background: theme.buttonBg,
    color: theme.buttonText,
    cursor: "pointer",
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h1 style={{ letterSpacing: 0.5, marginBottom: 12 }}>Topics</h1>
      <div style={{ color: theme.muted, fontSize: 13, marginBottom: 16 }}>Pick a topic to browse or post.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => onSelectTopic("all")}
          style={{
            ...buttonStyle,
            background: selectedTopic === "all" ? theme.accent : theme.buttonBg,
            color: selectedTopic === "all" ? theme.bg : theme.buttonText,
          }}
        >
          All topics
        </button>
        {safeTopics.map((topic) => (
          <button
            key={topic.slug}
            onClick={() => onSelectTopic(topic.slug)}
            style={{
              ...buttonStyle,
              background: selectedTopic === topic.slug ? theme.accent : theme.buttonBg,
              color: selectedTopic === topic.slug ? theme.bg : theme.buttonText,
            }}
          >
            {topic.name}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <button onClick={onBack} style={buttonStyle}>
          Back to comments
        </button>
      </div>
    </div>
  );
}

function CommentsPage({ user, comments, text, onTextChange, onAdd, onRate, theme, topics, selectedTopic, onFilterChange, onChooseTopic }) {
  const safeTopics = Array.isArray(topics) ? topics : [];

  const selectStyle = {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${theme.border}`,
    background: theme.cardBg,
    color: theme.text,
  };

  const currentTopic = safeTopics.find((t) => t.slug === selectedTopic);

  return (
    <div style={{ textAlign: "center" }}>
      <h1 style={{ letterSpacing: 0.5, marginBottom: 8 }}>Comments</h1>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ color: theme.muted, fontSize: 13, alignSelf: "center" }}>Filter:</label>
        <select value={selectedTopic} onChange={(e) => onFilterChange(e.target.value)} style={selectStyle}>
          <option value="all">All topics</option>
          {safeTopics.map((topic) => (
            <option key={topic.slug} value={topic.slug}>
              {topic.name}
            </option>
          ))}
        </select>
        <button onClick={onChooseTopic} style={selectStyle}>
          Topics
        </button>
      </div>
      {currentTopic ? (
        <div style={{ marginBottom: 12, color: theme.muted }}>Viewing: {currentTopic.name}</div>
      ) : null}

      <Comments
        comments={comments}
        text={text}
        onTextChange={onTextChange}
        onAdd={onAdd}
        onRate={onRate}
        user={user}
        theme={theme}
        selectedTopic={selectedTopic}
      />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "", displayName: "" });
  const [authMode, setAuthMode] = useState("login");
  const [loginError, setLoginError] = useState("");
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [themeMode, setThemeMode] = useState("dark");
  const [route, setRoute] = useState(getRoute());
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState("all");

  const theme = themes[themeMode];

  useEffect(() => {
    const onPop = () => setRoute(getRoute());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    fetchComments();
  }, [selectedTopic]);

  async function load() {
    await fetchTopics();
    await fetchMe();
    await fetchComments();
  }

  async function fetchTopics() {
    try {
      const data = await api("/topics");
      const nextTopics = Array.isArray(data) ? data : [];
      if (!Array.isArray(data)) {
        console.warn("Expected topics array from /api/topics, got:", data);
      }
      setTopics(nextTopics);
      if (selectedTopic !== "all" && !nextTopics.some((topic) => topic.slug === selectedTopic)) {
        setSelectedTopic("all");
      }
    } catch (err) {
      console.error(err);
      setTopics([]);
    }
  }

  async function fetchMe() {
    try {
      const data = await api("/me");
      setUser(data);
    } catch (err) {
      setUser(null);
    }
  }

  async function fetchComments() {
    try {
      const query = selectedTopic && selectedTopic !== "all" ? `?topic=${selectedTopic}` : "";
      const data = await api(`/comments${query}`);
      if (!Array.isArray(data)) {
        console.warn("Expected comments array from /api/comments, got:", data);
        setComments([]);
        return;
      }
      setComments(data);
    } catch (err) {
      console.error(err);
      setComments([]);
    }
  }

  async function submitAuth() {
    setLoginError("");
    const isSignup = authMode === "signup";
    try {
      const payload = {
        username: loginForm.username,
        password: loginForm.password,
      };
      if (isSignup) {
        payload.displayName = loginForm.displayName || loginForm.username;
      }
      const data = await api(isSignup ? "/signup" : "/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUser(data);
      await fetchComments();
      navigateTo("/comments", setRoute);
    } catch (err) {
      setLoginError(err.message || "Authentication failed");
      setUser(null);
    }
  }

  async function logout() {
    try {
      await api("/logout", { method: "POST" });
    } catch (err) {
      console.error(err);
    } finally {
      setUser(null);
      navigateTo("/comments", setRoute);
    }
  }

  async function addComment() {
    const t = text.trim();
    if (!t || !user || !selectedTopic || selectedTopic === "all") return;
    try {
      const comment = await api("/comments", {
        method: "POST",
        body: JSON.stringify({ text: t, topic: selectedTopic }),
      });
      setComments((prev) => [comment, ...prev]);
      setText("");
    } catch (err) {
      console.error(err);
    }
  }

  async function rateComment(id, delta) {
    if (!user) return;
    try {
      const updated = await api(`/comments/${id}/rate`, {
        method: "POST",
        body: JSON.stringify({ delta }),
      });
      setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      console.error(err);
    }
  }

  const topBar = user ? (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: theme.muted,
      }}
    >
      <span>{user.displayName}</span>
      <button
        onClick={logout}
        style={{
          background: "transparent",
          color: theme.text,
          border: `1px solid ${theme.border}`,
          borderRadius: 999,
          padding: "4px 10px",
          cursor: "pointer",
        }}
      >
        Logout
      </button>
    </div>
  ) : null;

  const themeToggle = (
    <button
      onClick={() => setThemeMode((m) => (m === "dark" ? "light" : "dark"))}
      style={{
        background: theme.buttonBg,
        color: theme.buttonText,
        border: `1px solid ${theme.border}`,
        borderRadius: 999,
        padding: "4px 10px",
        cursor: "pointer",
      }}
    >
      {themeMode === "dark" ? "Light" : "Night"}
    </button>
  );

  const loginButton = !user ? (
    <button
      onClick={() => navigateTo("/login", setRoute)}
      style={{
        background: theme.buttonBg,
        color: theme.buttonText,
        border: `1px solid ${theme.border}`,
        borderRadius: 999,
        padding: "4px 10px",
        cursor: "pointer",
      }}
    >
      Login
    </button>
  ) : null;

  const topicsButton = (
    <button
      onClick={() => navigateTo("/topics", setRoute)}
      style={{
        background: theme.buttonBg,
        color: theme.buttonText,
        border: `1px solid ${theme.border}`,
        borderRadius: 999,
        padding: "4px 10px",
        cursor: "pointer",
      }}
    >
      Topics
    </button>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.text,
        padding: "24px 16px",
        position: "relative",
      }}
    >
      {topBar}
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
        {topicsButton}
        {loginButton}
        {themeToggle}
      </div>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {route === "/login" ? (
          <LoginPage
            authMode={authMode}
            loginForm={loginForm}
            onChange={setLoginForm}
            onSubmit={submitAuth}
            onToggleMode={() => {
              setAuthMode((m) => (m === "login" ? "signup" : "login"));
              setLoginError("");
            }}
            onBack={() => navigateTo("/comments", setRoute)}
            loginError={loginError}
            theme={theme}
          />
        ) : route === "/topics" ? (
          <TopicsPage
            topics={topics}
            selectedTopic={selectedTopic}
            onSelectTopic={(slug) => {
              setSelectedTopic(slug);
              navigateTo("/comments", setRoute);
            }}
            theme={theme}
            onBack={() => navigateTo("/comments", setRoute)}
          />
        ) : (
          <CommentsPage
            user={user}
            comments={comments}
            text={text}
            onTextChange={setText}
            onAdd={addComment}
            onRate={rateComment}
            theme={theme}
            topics={topics}
            selectedTopic={selectedTopic}
            onFilterChange={setSelectedTopic}
            onChooseTopic={() => navigateTo("/topics", setRoute)}
          />
        )}
      </div>
    </div>
  );
}
