import { useRef, useState, useEffect, useCallback } from "react";

const ITEM_H = 44;
const VISIBLE = 5;
const CENTER = 2;

interface WheelPickerProps<T extends number | string> {
  values: T[];
  value: T;
  onChange: (val: T) => void;
  disabled?: boolean;
}

export default function WheelPicker<T extends number | string>({
  values,
  value,
  onChange,
  disabled = false,
}: WheelPickerProps<T>) {
  const currIdx = Math.max(0, values.indexOf(value));
  const [st, setSt] = useState(currIdx * ITEM_H);
  const drag = useRef({ active: false, startY: 0, startSt: 0, vel: 0, lastY: 0, lastT: 0 });
  const raf = useRef<number | null>(null);
  const stRef = useRef(st);
  const containerRef = useRef<HTMLDivElement>(null);

  stRef.current = st;

  useEffect(() => {
    const idx = Math.max(0, values.indexOf(value));
    setSt(idx * ITEM_H);
  }, [value, values]);

  const maxSt = (values.length - 1) * ITEM_H;
  const clamp = (v: number) => Math.max(0, Math.min(maxSt, v));

  const snapTo = useCallback(
    (rawSt: number) => {
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(rawSt / ITEM_H)));
      setSt(idx * ITEM_H);
      onChange(values[idx]);
    },
    [values, onChange]
  );

  const down = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    drag.current = { active: true, startY: y, startSt: stRef.current, vel: 0, lastY: y, lastT: Date.now() };
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drag.current.active) return;
    if (e.cancelable) e.preventDefault();
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    const newSt = clamp(drag.current.startSt - (y - drag.current.startY));
    setSt(newSt);
    const dt = Date.now() - drag.current.lastT;
    if (dt > 0) drag.current.vel = -(y - drag.current.lastY) / dt;
    drag.current.lastY = y;
    drag.current.lastT = Date.now();
  };

  const up = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    let vel = drag.current.vel * 160;
    let cur = stRef.current;
    const step = () => {
      vel *= 0.91;
      cur = clamp(cur + vel);
      setSt(cur);
      if (Math.abs(vel) > 0.5) {
        raf.current = requestAnimationFrame(step);
      } else {
        snapTo(cur);
      }
    };
    raf.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (disabled) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(stRef.current / ITEM_H) + dir));
      setSt(idx * ITEM_H);
      onChange(values[idx]);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [disabled, values, onChange]);

  const selIdx = Math.max(0, Math.min(values.length - 1, Math.round(st / ITEM_H)));
  const translateY = CENTER * ITEM_H - st;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
      style={{ height: ITEM_H * VISIBLE }}
      onMouseDown={down}
      onMouseMove={move}
      onMouseUp={up}
      onMouseLeave={up}
      onTouchStart={down}
      onTouchMove={move}
      onTouchEnd={up}
    >
      <div className="absolute inset-x-0 top-0 z-10 pointer-events-none"
        style={{ height: ITEM_H * CENTER, background: disabled ? "linear-gradient(to bottom, #f7f7f6 20%, transparent)" : "linear-gradient(to bottom, #ffffff 20%, transparent)" }} />
      <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
        style={{ height: ITEM_H * CENTER, background: disabled ? "linear-gradient(to top, #f7f7f6 20%, transparent)" : "linear-gradient(to top, #ffffff 20%, transparent)" }} />
      <div className="absolute inset-x-2 pointer-events-none rounded-xl transition-colors duration-300"
        style={{ top: ITEM_H * CENTER, height: ITEM_H, background: disabled ? "hsl(120 3% 90%)" : "hsl(151 22% 31% / 0.07)", border: disabled ? "none" : "1px solid hsl(151 22% 31% / 0.18)" }} />
      <div style={{ transform: `translateY(${translateY}px)`, willChange: "transform" }}>
        {values.map((v, i) => {
          const dist = Math.abs(i - selIdx);
          let cls = "";
          let scale = 1;
          if (disabled) {
            cls = i === selIdx ? "text-muted-foreground font-medium text-xl" : dist === 1 ? "text-muted-foreground/40 text-lg" : "opacity-0 text-base";
          } else {
            if (i === selIdx) { cls = "text-primary font-semibold text-2xl"; scale = 1; }
            else if (dist === 1) { cls = "text-foreground/45 text-lg"; scale = 0.9; }
            else if (dist === 2) { cls = "text-foreground/20 text-base"; scale = 0.78; }
            else { cls = "opacity-0 text-sm"; scale = 0.65; }
          }
          return (
            <div key={i} style={{ height: ITEM_H, transform: `scale(${scale})`, fontFamily: "Outfit, sans-serif", transition: "transform 0.08s ease" }}
              className={`flex items-center justify-center ${cls}`}>
              {v}
            </div>
          );
        })}
      </div>
    </div>
  );
}
