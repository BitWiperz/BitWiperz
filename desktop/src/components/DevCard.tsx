import "./DevCard.css";

interface DevCardProps {
  name: string;
  specs: string;
  selected?: boolean;
  onSelect?: () => void;
}

export default function DevCard({
  name,
  specs,
  selected = false,
  onSelect,
}: DevCardProps) {
  return (
    <div className={`dev-card ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="dev-card-content">
        <div className="dev-card-icon">
          <div className="icon-placeholder"></div>
        </div>
        <div className="dev-card-info">
          <h3 className="dev-card-name">{name}</h3>
          <p className="dev-card-specs">{specs}</p>
        </div>
        <div className="dev-card-selector">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
}
