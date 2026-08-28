import Link from "next/link";

export default function CancelPage() {
  return (
    <div className="wrap">
      <h1>Checkout canceled</h1>
      <p>No charge. Your cart is still on this device if you want to try again.</p>
      <Link className="btn" href="/cart">
        Return to cart
      </Link>
    </div>
  );
}
