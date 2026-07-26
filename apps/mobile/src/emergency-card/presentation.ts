import { ageInYears, type ConfirmedList, type ConfirmedScalar, dialerUrl } from "@littlearc/domain";

export function emergencyAgeLabel(dateOfBirth: string, today = new Date()): string {
  const years = ageInYears(dateOfBirth, today);
  return `${years} ${years === 1 ? "year" : "years"} old`;
}

export function scalarStateLabel(value: ConfirmedScalar): string {
  return value.state === "confirmed" ? value.value : "Not provided";
}

export function listStateLabel(value: ConfirmedList): string {
  if (value.state === "notProvided") {
    return "Not provided";
  }
  if (value.state === "noneConfirmed") {
    return "None confirmed";
  }
  return value.values.join(", ");
}

export function emergencyDialerUrl(phone: string): string {
  return dialerUrl(phone);
}
