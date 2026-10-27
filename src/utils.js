import { REPORT_TYPES } from "./data.js";

export function timeAgo(value, now = Date.now()) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "Không rõ thời gian";
  }

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (seconds < 60) {
    return "Vừa xong";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} phút trước`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} giờ trước`;
  }

  const days = Math.floor(hours / 24);

  return `${days} ngày trước`;
}

export function getStatus(report, now = Date.now()) {
  if (report.resolved === true) {
    return {
      key: "resolved",
      label: "Đã giải quyết"
    };
  }

  const type = REPORT_TYPES[report.type];
  const createdAt = new Date(report.created_at).getTime();
  const ttl = (type?.ttlMinutes ?? 60) * 60_000;

  if (
    !Number.isFinite(createdAt) ||
    now >= createdAt + ttl
  ) {
    return {
      key: "expired",
      label: "Hết hạn"
    };
  }

  const upvotes = Number(report.upvotes) || 0;
  const downvotes = Number(report.downvotes) || 0;

  if (upvotes >= 3 && upvotes - downvotes >= 2) {
    return {
      key: "confirmed",
      label: "Đã xác nhận"
    };
  }

  return {
    key: "new",
    label: "Mới tạo"
  };
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) {
    return "";
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })} km`;
}

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const values = [lat1, lng1, lat2, lng2];

  if (!values.every(Number.isFinite)) {
   return Number.NaN;
  }

  const toRadians = (degrees) => degrees * Math.PI / 180;
  const radius = 6_371_000;

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) ** 2;

  return radius * 2 * Math.atan2(
    Math.sqrt(Math.min(1, Math.max(0, a))),
    Math.sqrt(Math.max(0, 1 - a))
  );
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLowerCase()
    .trim();
}

export function isValidCoordinates(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}