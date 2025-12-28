import { useState } from "react";
import "./ErasureMethod.css";

export interface ErasureOption {
  id: string;
  label: string;
  description: string;
}

interface ErasureMethodProps {
  options?: ErasureOption[];
  selectedOption?: string;
  onSelect?: (option: string) => void;
}

const DEFAULT_OPTIONS: ErasureOption[] = [
  {
    id: "erase",
    label: "ERASE",
    description: "US DEPT OF DEFENCE, DOD (3PASSES)",
  },
  {
    id: "secure",
    label: "SECURE ERASE",
    description: "ATA SECURE ERASE COMMAND",
  },
  {
    id: "wipe",
    label: "FULL WIPE",
    description: "MULTIPLE PASS OVERWRITE",
  },
];

export default function ErasureMethod({
  options = DEFAULT_OPTIONS,
  selectedOption = "erase",
  onSelect,
}: ErasureMethodProps) {
  const [selected, setSelected] = useState(selectedOption);

  const handleSelect = (optionId: string) => {
    setSelected(optionId);
    onSelect?.(optionId);
  };

  const selectedOpt = options.find((opt) => opt.id === selected);

  return (
    <div className="erasure-method">
      <label className="erasure-label">ERASURE METHOD :</label>
      <div className="erasure-controls">
        <div className="erasure-dropdown">
          <div className="dropdown-content">
            <span className="dropdown-label">{selectedOpt?.description}</span>
            <button className="dropdown-toggle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 10L12 15L17 10"
                  stroke="#222"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <button className="erasure-button">
          {selectedOpt?.label || "ERASE"}
        </button>
      </div>
    </div>
  );
}
