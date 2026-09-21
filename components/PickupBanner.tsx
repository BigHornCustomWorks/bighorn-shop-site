export function PickupBanner({
  enabled,
  label,
}: {
  enabled: boolean;
  label?: string;
}) {
  if (!enabled) return null;
  return (
    <div className="pickup-banner">
      <strong>{label || "Local pickup — Sheridan, WY"}</strong>
      <p>No shipping charge if you pick up at the shop. Shipping is only added if you choose to have it mailed.</p>
    </div>
  );
}
