/**
 * JamReactions — floating emoji reactions for Jam / Live Set sessions.
 * Listeners (and jam peers) can send reactions visible to everyone.
 * Includes: reaction buttons, floating emoji burst, energy meter, border flash.
 */

import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  onSend: (emoji: string) => void;
  onRegisterAddFloat: (fn: (emoji: string) => void) => void;
  previewColor?: string;
}

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number; // 0-100 percentage
  startTime: number;
}

const REACTIONS = ["🔥", "❤️", "🔊", "🤟"];
const FLOAT_DURATION = 2000;
const THROTTLE_MS = 300; // prevent spam

export function JamReactions({ onSend, onRegisterAddFloat, previewColor = "#66ff99" }: Props) {
  const [floats, setFloats] = useState<FloatingEmoji[]>([]);
  const [energy, setEnergy] = useState(0);
  const [flash, setFlash] = useState(false);
  const nextId = useRef(0);
  const lastSend = useRef(0);
  const energyDecay = useRef<number>(0);

  // Decay energy over time
  useEffect(() => {
    energyDecay.current = window.setInterval(() => {
      setEnergy(e => Math.max(0, e - 2));
    }, 200);
    return () => clearInterval(energyDecay.current);
  }, []);

  // Clean up old floats
  useEffect(() => {
    const tid = window.setInterval(() => {
      setFloats(f => f.filter(e => Date.now() - e.startTime < FLOAT_DURATION));
    }, 500);
    return () => clearInterval(tid);
  }, []);

  const addFloat = useCallback((emoji: string) => {
    const id = nextId.current++;
    const x = 20 + Math.random() * 60;
    setFloats(f => [...f.slice(-20), { id, emoji, x, startTime: Date.now() }]);
    setEnergy(e => Math.min(100, e + 15));
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  }, []);

  // Register addFloat so remote reactions trigger the animation
  useEffect(() => {
    onRegisterAddFloat(addFloat);
  }, [onRegisterAddFloat, addFloat]);

  const handleSend = useCallback((emoji: string) => {
    const now = Date.now();
    if (now - lastSend.current < THROTTLE_MS) return;
    lastSend.current = now;
    onSend(emoji);
    addFloat(emoji); // also show locally
  }, [onSend, addFloat]);

  return (
    <>
      {/* Border flash */}
      {flash && <div className="jam-reaction-flash" style={{ boxShadow: `inset 0 0 30px ${previewColor}40` }} />}

      {/* Floating emojis */}
      <div className="jam-reaction-floats">
        {floats.map(f => {
          const age = (Date.now() - f.startTime) / FLOAT_DURATION;
          return (
            <span
              key={f.id}
              className="jam-reaction-float"
              style={{
                left: `${f.x}%`,
                bottom: `${10 + age * 70}%`,
                opacity: 1 - age,
                fontSize: 28,
              }}
            >
              {f.emoji}
            </span>
          );
        })}
      </div>

      {/* Energy meter */}
      {energy > 0 && (
        <div className="jam-reaction-energy">
          <div className="jam-reaction-energy-fill" style={{ width: `${energy}%`, background: previewColor }} />
        </div>
      )}

      {/* Reaction buttons */}
      <div className="jam-reaction-bar">
        {REACTIONS.map(emoji => (
          <button
            key={emoji}
            className="jam-reaction-btn"
            onClick={() => handleSend(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}

/** Hook to receive reactions from peers and trigger the float animation */
export function useJamReactions() {
  const addFloatRef = useRef<((emoji: string) => void) | null>(null);

  const registerAddFloat = useCallback((fn: (emoji: string) => void) => {
    addFloatRef.current = fn;
  }, []);

  const handleRemoteReaction = useCallback((emoji: string) => {
    addFloatRef.current?.(emoji);
  }, []);

  return { registerAddFloat, handleRemoteReaction };
}
