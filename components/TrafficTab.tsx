"use client";

import { useEffect, useState } from "react";
import type { ShopStats } from "@/lib/types";
import type { AnalyticsLine, VercelTraffic } from "@/lib/vercel-analytics";
import { daysAgo, shopDay, sumDays } from "@/lib/visit-stats";

export function TrafficTab({ stats }: { stats: ShopStats }) {
  const [days, setDays] = useState<7 | 30>(7);
  const [report, setReport] = useState<VercelTraffic | null>(null);
  const [problem, setProblem] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setProblem("");
    setReport(null);
    fetch(`/api/master/analytics?days=${days}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as VercelTraffic & { error?: string };
        if (!res.ok) throw new Error(json.error || "Vercel analytics did not answer.");
        return json;
      })
      .then((json) => {
        if (!cancel) setReport(json);
      })
      .catch((err: unknown) => {
        if (!cancel) {
          setReport(null);
          setProblem(err instanceof Error ? err.message : "Vercel analytics did not answer.");
        }
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [days]);

  return (
    <div>
      <div className="mc-section-head">
        <p className="section-kicker">Traffic</p>
        <h2>Who’s visiting</h2>
        <p className="note">
          These numbers come from Vercel Web Analytics, the same report as the Vercel dashboard. They count production
          visits. A person is a visitor. Each page they open is a page view. Dates are in UTC.
        </p>
      </div>
      <div className="mc-range">
        <button type="button" className={days === 7 ? "btn btn-bronze" : "btn"} onClick={() => setDays(7)}>
          Last 7 days
        </button>
        <button type="button" className={days === 30 ? "btn btn-bronze" : "btn"} onClick={() => setDays(30)}>
          Last 30 days
        </button>
      </div>
      {loading ? <p className="note">Loading Vercel analytics…</p> : null}
      {problem ? <p className="err">{problem}</p> : null}
      {report ? <VercelReport report={report} /> : null}
      <ShopCounter stats={stats} />
    </div>
  );
}

function VercelReport({ report }: { report: VercelTraffic }) {
  const empty = report.visitors === 0 && report.pageviews === 0;
  return (
    <>
      <div className="mc-stat-grid">
        <div className="mc-stat">
          <p className="mc-stat-label">Visitors</p>
          <p className="mc-stat-num">{report.visitors.toLocaleString("en-US")}</p>
          <p className="muted">last {report.days} days</p>
        </div>
        <div className="mc-stat">
          <p className="mc-stat-label">Page views</p>
          <p className="mc-stat-num">{report.pageviews.toLocaleString("en-US")}</p>
          <p className="muted">last {report.days} days</p>
        </div>
      </div>
      {empty ? (
        <p className="note">
          No Vercel visits in this range yet. New visits show up after someone loads the live site. The older shop
          counter is further down.
        </p>
      ) : null}
      <LineTable title="By day" rows={report.daily} first="Date" />
      <div className="mc-analytics-cols">
        <LineTable title="Where they came from" rows={report.referrers} first="Source" />
        <LineTable title="Country" rows={report.countries} first="Country" />
        <LineTable title="Pages" rows={report.pages} first="Page" />
        <LineTable title="Device" rows={report.devices} first="Device" />
      </div>
    </>
  );
}

function LineTable({ title, rows, first }: { title: string; rows: AnalyticsLine[]; first: string }) {
  return (
    <div>
      <h3>{title}</h3>
      {rows.length ? (
        <table className="mc-traffic-table">
          <thead>
            <tr>
              <th>{first}</th>
              <th>Visitors</th>
              <th>Page views</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${title}-${row.label}`}>
                <td>{row.label}</td>
                <td>{row.visitors.toLocaleString("en-US")}</td>
                <td>{row.pageviews.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="note">Nothing in this range.</p>
      )}
    </div>
  );
}

function ShopCounter({ stats }: { stats: ShopStats }) {
  const today = shopDay();
  const days = stats.days || [];
  const todayRow = days.find((d) => d.date === today);
  const week = sumDays(days, daysAgo(6));
  const month = sumDays(days, daysAgo(29));
  const sources = stats.sources || { facebook: 0, instagram: 0, google: 0, direct: 0, other: 0 };
  const recent = [...days].reverse().slice(0, 30);

  return (
    <div style={{ marginTop: 28 }}>
      <h3>Shop counter</h3>
      <p className="note">
        This is the shop’s own count, kept from before Vercel analytics. It skips Facebook’s preview bot. Sheridan time.
      </p>
      <div className="mc-stat-grid">
        <div className="mc-stat">
          <p className="mc-stat-label">Today</p>
          <p className="mc-stat-num">{(todayRow?.uniqueVisitors || 0).toLocaleString("en-US")}</p>
          <p className="muted">{(todayRow?.pageViews || 0).toLocaleString("en-US")} page views</p>
        </div>
        <div className="mc-stat">
          <p className="mc-stat-label">Last 7 days</p>
          <p className="mc-stat-num">{week.uniqueVisitors.toLocaleString("en-US")}</p>
          <p className="muted">{week.pageViews.toLocaleString("en-US")} page views</p>
        </div>
        <div className="mc-stat">
          <p className="mc-stat-label">Last 30 days</p>
          <p className="mc-stat-num">{month.uniqueVisitors.toLocaleString("en-US")}</p>
          <p className="muted">{month.pageViews.toLocaleString("en-US")} page views</p>
        </div>
        <div className="mc-stat">
          <p className="mc-stat-label">All time</p>
          <p className="mc-stat-num">{(stats.uniqueVisitors || 0).toLocaleString("en-US")}</p>
          <p className="muted">{(stats.pageViews || 0).toLocaleString("en-US")} page views</p>
        </div>
      </div>
      <div className="mc-stat-grid">
        {(
          [
            ["facebook", "Facebook"],
            ["instagram", "Instagram"],
            ["google", "Google / Bing"],
            ["direct", "Typed / bookmark"],
            ["other", "Other sites"],
          ] as const
        ).map(([key, label]) => (
          <div className="mc-stat" key={key}>
            <p className="mc-stat-label">{label}</p>
            <p className="mc-stat-num">{(sources[key] || 0).toLocaleString("en-US")}</p>
            <p className="muted">page views</p>
          </div>
        ))}
      </div>
      {recent.length ? (
        <table className="mc-traffic-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Unique visitors</th>
              <th>Page views</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((d) => (
              <tr key={d.date}>
                <td>{d.date === today ? `${d.date} (today)` : d.date}</td>
                <td>{d.uniqueVisitors.toLocaleString("en-US")}</td>
                <td>{d.pageViews.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
