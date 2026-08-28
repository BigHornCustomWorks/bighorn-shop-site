import Link from "next/link";
import type { SiteCopy } from "@/lib/types";
import { safeUrl } from "@/lib/sanitize";

export function Footer({ site, uniqueVisitors = 0 }: { site: SiteCopy; uniqueVisitors?: number }) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <strong>{site.legalName}</strong>
          <p className="legal">{site.footerNote}</p>
          <p className="legal">Visitors: {uniqueVisitors.toLocaleString("en-US")}</p>
          <p className="legal">
            <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
            {site.linkedinUrl ? (
              <>
                {" · "}
                <a href={safeUrl(site.linkedinUrl)} rel="noreferrer">
                  LinkedIn
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div>
          {site.footerLinks.map((link) => {
            const href = safeUrl(link.url);
            if (!href) return null;
            const external = href.startsWith("http");
            return external ? (
              <p key={link.id}>
                <a href={href} rel="noreferrer">
                  {link.label}
                </a>
              </p>
            ) : (
              <p key={link.id}>
                <Link href={href}>{link.label}</Link>
              </p>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
