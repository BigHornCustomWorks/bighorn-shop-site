import Link from "next/link";

export default function SuccessPage() {
  return (
    <div className="wrap">
      <h1>Order received</h1>
      <p>Stripe has the payment. You will get a receipt from Stripe. Clint ships from Sheridan, WY.</p>
      <Link className="btn" href="/shop">
        Back to shop
      </Link>
    </div>
  );
}
