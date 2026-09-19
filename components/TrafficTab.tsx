"use client";

import type { ShopStats } from "@/lib/types";
import { daysAgo, shopDay, sumDays } from "@/lib/visit-stats";

export function TrafficTab({ stats }: { stats: ShopStats }) {
  const today = shopDay();
  const days = stats.days || [];
  const todayRow = days.find((d) => d.date === today);
  const week = sumDays(days, daysAgo(6));
  const month = sumDays(days, daysAgo(29));
  const sources = stats.sources || { facebook: 0, instagram: 0, google: 0, direct: 0, other: 0 };
  const recent = [...days].reverse().slice(0, 30);

  return (
    <div>
      <div className="mc-section-head">
        <p className="section-kicker">Traffic</p>
        <h2>Who’s hitting the shop</h2>
        <p className="note">
          Counts people, not Facebook’s own preview bot. Daily unique starts from when this tracker was added — all-time
          totals go back further. Time zone is Sheridan (America/Denver).
        </p>
      </div>

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

      <h3>Where they came from</h3>
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

      <h3>By day</h3>
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
      ) : (
        <p className="note">No daily rows yet. Open the public site once, then refresh Master Control.</p>
      )}
    </div>
  );
}
