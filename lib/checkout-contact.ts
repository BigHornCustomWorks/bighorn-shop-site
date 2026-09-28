/** Phone on every checkout, plus an optional Yes/No for texts and a review request. */
export function checkoutContactParams() {
  return {
    phone_number_collection: { enabled: true },
    custom_fields: [
      {
        key: "sms_opt_in",
        label: { type: "custom" as const, custom: "Text me order updates and a review request?" },
        type: "dropdown" as const,
        optional: true,
        dropdown: {
          default_value: "no",
          options: [
            { label: "No", value: "no" },
            { label: "Yes", value: "yes" },
          ],
        },
      },
    ],
  };
}
