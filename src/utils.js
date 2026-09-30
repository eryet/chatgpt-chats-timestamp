// Shared utility functions for date formatting

const DEFAULT_LOCALE =
  typeof navigator !== "undefined" && navigator.language
    ? navigator.language
    : "en-US";

let relativeTimeFormatter;

function getRelativeTimeFormatter() {
  if (relativeTimeFormatter !== undefined) return relativeTimeFormatter;
  if (typeof Intl !== "undefined" && Intl.RelativeTimeFormat) {
    relativeTimeFormatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, {
      numeric: "auto",
      style: "short",
    });
  } else {
    relativeTimeFormatter = null;
  }
  return relativeTimeFormatter;
}

function getRelativeTime(date) {
  const now = new Date();
  const diffMs = date - now;
  const diffSec = Math.floor(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  const rtf = getRelativeTimeFormatter();
  if (!rtf) {
    const diffMin = Math.floor(absSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (absSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    if (diffWeek < 4) return `${diffWeek}w ago`;
    if (diffMonth < 12) return `${diffMonth}mo ago`;
    return `${diffYear}y ago`;
  }

  if (absSec < 60) return rtf.format(0, "second");

  const sign = diffSec < 0 ? -1 : 1;
  const absMin = Math.floor(absSec / 60);
  if (absMin < 60) return rtf.format(sign * absMin, "minute");

  const absHr = Math.floor(absMin / 60);
  if (absHr < 24) return rtf.format(sign * absHr, "hour");

  const absDay = Math.floor(absHr / 24);
  if (absDay < 7) return rtf.format(sign * absDay, "day");

  const absWeek = Math.floor(absDay / 7);
  if (absWeek < 4) return rtf.format(sign * absWeek, "week");

  const absMonth = Math.floor(absDay / 30);
  if (absMonth < 12) return rtf.format(sign * absMonth, "month");

  const absYear = Math.floor(absDay / 365);
  return rtf.format(sign * absYear, "year");
}

const DATE_FORMAT_OPTIONS = {
  us: ["en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }],
  eu: ["en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }],
  uk: ["en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }],
  short: [DEFAULT_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }],
  dateOnly: [DEFAULT_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }],
  timeOnly: [DEFAULT_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }],
};

// Date#toLocaleString with options builds a new Intl.DateTimeFormat on every
// call (~40x slower than reusing one), and every sidebar row and message is
// re-formatted on each refresh, so keep one formatter per format.
const dateFormatters = new Map();

function getDateFormatter(format) {
  let formatter = dateFormatters.get(format);
  if (!formatter) {
    const [locale, options] = DATE_FORMAT_OPTIONS[format];
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(format, formatter);
  }
  return formatter;
}

function formatDate(date, format) {
  switch (format) {
    case "iso":
      return date.toISOString().slice(0, 19).replace("T", " ");
    case "relative":
      return getRelativeTime(date);
    case "us":
    case "eu":
    case "uk":
    case "short":
    case "dateOnly":
    case "timeOnly":
      return getDateFormatter(format).format(date);
    case "locale":
    default:
      return date.toLocaleString().replace(",", "");
  }
}
