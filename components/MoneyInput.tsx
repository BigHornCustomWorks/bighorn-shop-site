"use client";

import { useEffect, useState } from "react";
import { dollarsToCents } from "@/lib/money";

/**
 * A money field you can actually type in.
 *
 * Binding value straight to (cents / 100).toFixed(2) reformats on every
 * keystroke, so backspace looked broken. Hold whatever was typed while the
 * field has focus and only tidy the formatting on the way out.
 */
export function MoneyInput({ cents, onCents }: { cents: number; onCents: (cents: number) => void }) {
  const [text, setText] = useState((cents / 100).toFixed(2));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText((cents / 100).toFixed(2));
  }, [cents, editing]);

  return (
    <input
      inputMode="decimal"
      value={text}
      onFocus={() => setEditing(true)}
      onChange={(e) => {
        setText(e.target.value);
        onCents(dollarsToCents(e.target.value));
      }}
      onBlur={() => {
        setEditing(false);
        setText((dollarsToCents(text) / 100).toFixed(2));
      }}
    />
  );
}
