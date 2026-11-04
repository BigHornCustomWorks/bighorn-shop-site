import type { Metadata } from "next";

// Master Control is private: keep it out of search results.
export const metadata: Metadata = {
  title: { absolute: "Master Control | Big Horn Custom Works" },
  robots: { index: false, follow: false },
};

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
