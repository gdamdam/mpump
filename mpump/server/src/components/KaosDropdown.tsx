import { useState, useRef, useEffect } from "react";

interface Option {
  label: string;
  value: number | string;
}

interface OptionGroup {
  group: string;
  items: Option[];
}

type Items = Option[] | OptionGroup[];

interface Props {
  options: Items;
  value: number | string;
  onChange: (value: any) => void;
  className?: string;
}

function isGrouped(items: Items): items is OptionGroup[] {
  return items.length > 0 && "group" in items[0];
}

function findLabel(options: Items, value: number | string): string {
  if (isGrouped(options)) {
    for (const g of options) {
      const found = g.items.find((o) => o.value === value);
      if (found) return found.label;
    }
    return "—";
  }
  return (options as Option[]).find((o) => o.value === value)?.label ?? "—";
}

/**
 * Custom dropdown replacing native <select> for cross-platform consistency.
 * Native <select> renders with OS-specific colors (e.g. forest green on white
 * on Windows) that clash with the dark theme.
 */
export function KaosDropdown({ options, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const renderItem = (o: Option) => (
    <button
      key={String(o.value)}
      className={`kaos-dropdown-item${o.value === value ? " active" : ""}`}
      onClick={() => { onChange(o.value); setOpen(false); }}
    >
      {o.label}
    </button>
  );

  return (
    <div className={`kaos-dropdown ${className ?? ""}`} ref={ref}>
      <button
        className="kaos-dropdown-trigger"
        onClick={() => {
          if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            const itemCount = isGrouped(options) ? options.reduce((n, g) => n + g.items.length + 1, 0) : options.length;
            const menuH = Math.min(itemCount * 28 + 16, 240);
            setFlipUp(rect.bottom + menuH > window.innerHeight);
            setAlignRight(rect.left + 140 > window.innerWidth);
          }
          setOpen(!open);
        }}
        title={findLabel(options, value)}
      >
        {findLabel(options, value)}
      </button>
      {open && (
        <div className={`kaos-dropdown-menu${flipUp ? " kaos-dropdown-menu-up" : ""}${alignRight ? " kaos-dropdown-menu-right" : ""}`}>
          {isGrouped(options)
            ? options.map((g) => (
                <div key={g.group}>
                  <div className="kaos-dropdown-group">{g.group}</div>
                  {g.items.map(renderItem)}
                </div>
              ))
            : (options as Option[]).map(renderItem)}
        </div>
      )}
    </div>
  );
}
