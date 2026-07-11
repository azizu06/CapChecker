"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type ResultsTab = {
  key: string;
  label: string;
  count: number;
  panel: ReactNode;
};

export function ResultsTabs({ tabs }: { tabs: ResultsTab[] }) {
  const baseId = useId();
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    setActive(index);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = tabs.length - 1;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(active === last ? 0 : active + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(active === 0 ? last : active - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(last);
    }
  };

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Analysis results">
        {tabs.map((tab, index) => {
          const selected = index === active;
          return (
            <button
              key={tab.key}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              className="tab"
              onClick={() => setActive(index)}
              onKeyDown={onKeyDown}
            >
              {tab.label}
              <span className="n">{tab.count}</span>
            </button>
          );
        })}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${baseId}-panel-${tab.key}`}
          aria-labelledby={`${baseId}-tab-${tab.key}`}
          className="tabpanel"
          hidden={index !== active}
        >
          {tab.panel}
        </div>
      ))}
    </>
  );
}
