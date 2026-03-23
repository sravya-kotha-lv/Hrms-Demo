const ORG_TIMEZONE_KEY = "org_timezone";
const DEFAULT_ORG_TIMEZONE = "Asia/Kolkata";

const isValidTimeZone = (timeZone?: string | null) => {
  try {
    if (!timeZone) return false;
    new Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const setOrgTimeZone = (timeZone: string) => {
  if (!isValidTimeZone(timeZone)) return;
  localStorage.setItem(ORG_TIMEZONE_KEY, timeZone);
};

export const getOrgTimeZone = () => {
  const storedTimeZone = localStorage.getItem(ORG_TIMEZONE_KEY);
  return isValidTimeZone(storedTimeZone) ? storedTimeZone : DEFAULT_ORG_TIMEZONE;
};

const toDate = (value: string | number | Date) =>
  value instanceof Date ? value : new Date(value);

export const toDateKeyInOrgTimeZone = (value: string | number | Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getOrgTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(toDate(value));

  const read = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value || "";

  return `${read("year")}-${read("month")}-${read("day")}`;
};

export const formatDateInOrgTimeZone = (
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {}
) => {
  return toDate(value).toLocaleDateString(undefined, {
    timeZone: getOrgTimeZone(),
    ...options
  });
};

export const formatTimeInOrgTimeZone = (
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {}
) => {
  return toDate(value).toLocaleTimeString(undefined, {
    timeZone: getOrgTimeZone(),
    ...options
  });
};

export const formatDateTimeInOrgTimeZone = (
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {}
) => {
  return toDate(value).toLocaleString(undefined, {
    timeZone: getOrgTimeZone(),
    ...options
  });
};
