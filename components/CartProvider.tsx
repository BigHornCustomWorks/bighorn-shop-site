"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  photo: string;
  variant: string;
  quantity: number;
};

type CartCtx = {
  lines: CartLine[];
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  remove: (productId: string, variant: string) => void;
  setQty: (productId: string, variant: string, quantity: number) => void;
  clear: () => void;
  count: number;
  totalCents: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "bhcw-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLines(parsed);
      }
    } catch {
      /* keep empty */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines]);

  const api = useMemo<CartCtx>(() => {
    const add: CartCtx["add"] = (line, quantity = 1) => {
      setLines((prev) => {
        const i = prev.findIndex(
          (l) => l.productId === line.productId && l.variant === line.variant,
        );
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], quantity: Math.min(20, next[i].quantity + quantity) };
          return next;
        }
        return [...prev, { ...line, quantity: Math.max(1, quantity) }];
      });
    };
    const remove = (productId: string, variant: string) => {
      setLines((prev) => prev.filter((l) => !(l.productId === productId && l.variant === variant)));
    };
    const setQty = (productId: string, variant: string, quantity: number) => {
      setLines((prev) =>
        prev
          .map((l) =>
            l.productId === productId && l.variant === variant
              ? { ...l, quantity: Math.max(1, Math.min(20, quantity)) }
              : l,
          )
          .filter((l) => l.quantity > 0),
      );
    };
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const totalCents = lines.reduce((n, l) => n + l.priceCents * l.quantity, 0);
    return { lines, add, remove, setQty, clear: () => setLines([]), count, totalCents };
  }, [lines]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart");
  return ctx;
}
