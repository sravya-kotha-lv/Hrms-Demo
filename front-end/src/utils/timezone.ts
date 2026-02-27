const ORG_TIMEZONE_KEY = "org_timezone";

export const setOrgTimeZone = (timeZone: string) => {
  if (!timeZone) return;
  localStorage.setItem(ORG_TIMEZONE_KEY, timeZone);
};

export const getOrgTimeZone = () => {
  return localStorage.getItem(ORG_TIMEZONE_KEY) || "Asia/Kolkata";
};

const toDate = (value: string | number | Date) =>
  value instanceof Date ? value : new Date(value);

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
