function getState(container) {
  const state = (container.State || "").toLowerCase();
  const status = (container.Status || "").toLowerCase();
  const isRunning = state === "running" || status.startsWith("up");
  const isExited = state.startsWith("exited") || status.startsWith("exited");

  return {
    isRunning,
    isExited,
    label: container.State || "unknown",
    statusText: container.Status || "Status unavailable",
  };
}

function ServiceCard({
  container,
  selected,
  onSelect,
  pinned,
  onTogglePin,
  style,
}) {
  const name = container.Names?.[0]?.replace("/", "") || container.Id.slice(0, 12);
  const image = container.Image || "unknown";
  const { isRunning, isExited, label, statusText } = getState(container);
  const stateClass = isRunning ? "ok" : isExited ? "bad" : "warn";
  const stateLabel = label ? label.toUpperCase() : "UNKNOWN";

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(container);
    }
  };

  return (
    <article
      className={`service-card ${selected ? "selected" : ""} ${
        pinned ? "pinned" : ""
      }`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(container)}
      onKeyDown={handleKeyDown}
      style={style}
    >
      <header className="service-card__header">
        <div className="service-card__title">
          <span className={`state-dot ${stateClass}`} />
          <h3>{name}</h3>
        </div>
        <button
          type="button"
          className={`pin-button ${pinned ? "active" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin?.(container.Id);
          }}
          aria-pressed={pinned}
          aria-label={`${pinned ? "Unpin" : "Pin"} ${name}`}
        >
          {pinned ? "Pinned" : "Pin"}
        </button>
      </header>
      <p className="service-card__meta">{image}</p>
      <div className="service-card__footer">
        <span className={`pill ${stateClass}`}>{stateLabel}</span>
        <span className="service-card__status">{statusText}</span>
      </div>
    </article>
  );
}

export default ServiceCard;
