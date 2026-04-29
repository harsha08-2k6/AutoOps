import { useEffect, useState } from "react";
import { fetchRules, updateRules } from "../services/api";

function RuleBuilder({ style }) {
  const [restartExitedEnabled, setRestartExitedEnabled] = useState(true);
  const [restartCooldownMs, setRestartCooldownMs] = useState(60000);
  const [alertEmails, setAlertEmails] = useState([]);
  const [alertEmailDraft, setAlertEmailDraft] = useState("");
  const [emailError, setEmailError] = useState("");
  const [status, setStatus] = useState("");

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  useEffect(() => {
    fetchRules()
      .then((data) => {
        setRestartExitedEnabled(Boolean(data.restartExitedEnabled));
        setRestartCooldownMs(Number(data.restartCooldownMs || 60000));
        const list = Array.isArray(data.alertEmails)
          ? data.alertEmails
          : data.alertEmailTo
            ? [data.alertEmailTo]
            : [];
        setAlertEmails(list);
      })
      .catch(() => {
        setStatus("Rule service unavailable.");
      });
  }, []);

  const addEmail = () => {
    const trimmed = alertEmailDraft.trim();
    if (!trimmed) {
      return;
    }
    if (!isValidEmail(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError("");
    setAlertEmails((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed],
    );
    setAlertEmailDraft("");
  };

  const removeEmail = (email) => {
    setAlertEmails((prev) => prev.filter((item) => item !== email));
  };

  const handleEmailKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addEmail();
    }
  };

  async function saveRules() {
    try {
      await updateRules({ restartExitedEnabled, restartCooldownMs, alertEmails });
      setStatus("Rules saved.");
    } catch {
      setStatus("Failed to save rules.");
    }
  }

  return (
    <section className="panel rule-panel" style={style}>
      <div className="panel-header">
        <div>
          <p className="panel-title">Automation Rules</p>
          <p className="panel-subtitle">Configure auto-restarts and alerts.</p>
        </div>
      </div>

      <div className="rule-grid">
        <label className="toggle">
          <input
            type="checkbox"
            checked={restartExitedEnabled}
            onChange={(event) => setRestartExitedEnabled(event.target.checked)}
          />
          <span>Auto-restart exited containers</span>
        </label>

        <label className="field">
          Restart cooldown (ms)
          <input
            type="number"
            value={restartCooldownMs}
            onChange={(event) => setRestartCooldownMs(Number(event.target.value))}
          />
        </label>

        <div className="field">
          Alert subscribers
          <div className="email-row">
            <input
              type="email"
              value={alertEmailDraft}
              onChange={(event) => setAlertEmailDraft(event.target.value)}
              onKeyDown={handleEmailKeyDown}
              placeholder="name@example.com"
            />
            <button type="button" className="ghost-button" onClick={addEmail}>
              Add
            </button>
          </div>
          {emailError && <span className="error-text">{emailError}</span>}
          <div className="email-tags">
            {alertEmails.length === 0 ? (
              <span className="caption">No subscribers yet.</span>
            ) : (
              alertEmails.map((email) => (
                <span key={email} className="email-tag">
                  {email}
                  <button
                    type="button"
                    className="tag-remove"
                    onClick={() => removeEmail(email)}
                    aria-label={`Remove ${email}`}
                  >
                    Remove
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="caption">Leave empty to use the server default.</p>
      <div className="rule-actions">
        <button type="button" className="primary-button" onClick={saveRules}>
          Save Rules
        </button>
        {status && <span className="caption">{status}</span>}
      </div>
    </section>
  );
}

export default RuleBuilder;
