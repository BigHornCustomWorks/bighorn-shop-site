import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap">
      <h1>Not found</h1>
      <p>That page is not on this shop.</p>
      <Link className="btn" href="/shop">
        Shop parts
      </Link>
    </div>
  );
}
