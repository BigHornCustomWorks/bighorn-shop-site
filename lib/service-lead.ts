export const SERVICE_NEEDS = [
  { id: "replacement", label: "Replacement part" },
  { id: "sign", label: "Custom sign" },
  { id: "mixed", label: "Mixed materials" },
  { id: "print", label: "3D print" },
  { id: "other", label: "Other" },
] as const;

export const CONTACT_PREFERENCES = [
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "either", label: "Either" },
] as const;

export function serviceNeedLabel(id: string): string {
  return SERVICE_NEEDS.find((item) => item.id === id)?.label || "";
}

export function contactPreferenceLabel(id: string): string {
  return CONTACT_PREFERENCES.find((item) => item.id === id)?.label || "";
}

export function serviceLeadText(input: {
  name: string;
  email: string;
  phone: string;
  serviceType: string;
  description: string;
  fitNotes: string;
  approxSize: string;
  preferredContact: string;
  photoUrls: string[];
  createdAt: string;
}): string {
  const photos = input.photoUrls.filter(Boolean);
  return [
    "New service request — Big Horn Custom Works",
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone || "(none)"}`,
    `Need: ${serviceNeedLabel(input.serviceType) || input.serviceType || "(not set)"}`,
    `Preferred contact: ${contactPreferenceLabel(input.preferredContact) || "(not set)"}`,
    input.approxSize ? `Approx size: ${input.approxSize}` : "Approx size: (none)",
    "",
    "Description:",
    input.description,
    "",
    "Fit notes:",
    input.fitNotes || "(none)",
    "",
    photos.length ? `Photos attached: ${photos.length}` : "Photos attached: 0",
    ...photos.map((url, i) => `Photo ${i + 1}: ${url}`),
    "",
    `Submitted: ${input.createdAt}`,
    "",
    "Open Master Control → Quotes to read the full request.",
  ].join("\n");
}
