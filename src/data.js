export const MAP_CENTER = [105.5255, 21.015];

export const REPORT_TYPES = Object.freeze({
  traffic: {
    label: "Ùn tắc",
    icon: "🚗",
    color: "#e05252",
    ttlMinutes: 60
  },
  accident: {
    label: "Tai nạn",
    icon: "🚨",
    color: "#dc2626",
    ttlMinutes: 180
  },
  flood: {
    label: "Ngập nước",
    icon: "🌊",
    color: "#2563eb",
    ttlMinutes: 360
  },
  roadwork: {
    label: "Thi công",
    icon: "🚧",
    color: "#d97706",
    ttlMinutes: 1440
  },
  pothole: {
    label: "Ổ gà",
    icon: "🕳️",
    color: "#795548",
    ttlMinutes: 10080
  },
  obstacle: {
    label: "Vật cản",
    icon: "🪵",
    color: "#b45309",
    ttlMinutes: 360
  },
  lighting: {
    label: "Hỏng đèn",
    icon: "💡",
    color: "#7c3aed",
    ttlMinutes: 4320
  },
  danger: {
    label: "Nguy hiểm",
    icon: "⚠️",
    color: "#be123c",
    ttlMinutes: 720
  },
  support: {
    label: "Hỗ trợ",
    icon: "🛟",
    color: "#059669",
    ttlMinutes: 120
  }
});

export const PLACES = Object.freeze([
  {
    id: "hola-center",
    name: "Khu vực trung tâm Hòa Lạc",
    description: "Hòa Lạc, Hà Nội",
    latitude: 21.015,
    longitude: 105.5255
  },
  {
    id: "fpt-hola",
    name: "Đại học FPT Hòa Lạc",
    description: "Khu vực campus FPT — vị trí tham khảo",
    latitude: 21.0131,
    longitude: 105.5252
  },
  {
    id: "high-tech-park",
    name: "Khu Công nghệ cao Hòa Lạc",
    description: "Khu vực Công nghệ cao — vị trí tham khảo",
    latitude: 21.0007,
    longitude: 105.5324
  },
  {
    id: "vnu-hola",
    name: "Đại học Quốc gia Hà Nội tại Hòa Lạc",
    description: "Khu vực đô thị đại học — vị trí tham khảo",
    latitude: 21.025,
    longitude: 105.512
  },
  {
    id: "thach-hoa",
    name: "Khu vực Thạch Hòa",
    description: "Khu dân cư Thạch Hòa — vị trí tham khảo",
    latitude: 21.029,
    longitude: 105.529
  },
  {
    id: "binh-yen",
    name: "Khu vực Bình Yên",
    description: "Khu dân cư Bình Yên — vị trí tham khảo",
    latitude: 21.043,
    longitude: 105.528
  }
]);

const now = Date.now();

function minutesAgo(minutes) {
  return new Date(now - minutes * 60_000).toISOString();
}

export const SAMPLE_REPORTS = [
  {
    id: "demo-traffic",
    user_id: "demo-user",
    type: "traffic",
    title: "Ùn tắc nhẹ tại đường vào campus",
    description:
      "Dữ liệu minh họa: xe di chuyển chậm, chú ý giữ khoảng cách.",
    latitude: 21.0142,
    longitude: 105.5265,
    created_at: minutesAgo(7),
    resolved: false,
    upvotes: 5,
    downvotes: 1
  },
  {
    id: "demo-accident",
    user_id: "demo-user",
    type: "accident",
    title: "Va chạm giao thông gần ngã rẽ",
    description:
      "Dữ liệu minh họa: một phần làn đường đang bị chiếm dụng.",
    latitude: 21.0175,
    longitude: 105.529,
    created_at: minutesAgo(12),
    resolved: false,
    upvotes: 2,
    downvotes: 0
  },
  {
    id: "demo-flood",
    user_id: "demo-user",
    type: "flood",
    title: "Đoạn đường trũng bị đọng nước",
    description:
      "Dữ liệu minh họa: nên giảm tốc độ khi qua đoạn đường này.",
    latitude: 21.012,
    longitude: 105.521,
    created_at: minutesAgo(35),
    resolved: false,
    upvotes: 7,
    downvotes: 1
  },
  {
    id: "demo-roadwork",
    user_id: "demo-user",
    type: "roadwork",
    title: "Thi công sửa mặt đường",
    description:
      "Dữ liệu minh họa: khu vực có rào chắn và vật liệu xây dựng.",
    latitude: 21.02,
    longitude: 105.523,
    created_at: minutesAgo(240),
    resolved: false,
    upvotes: 4,
    downvotes: 0
  },
  {
    id: "demo-pothole",
    user_id: "demo-user",
    type: "pothole",
    title: "Ổ gà ở mép làn xe",
    description:
      "Dữ liệu minh họa: khó quan sát vào buổi tối, tránh đánh lái đột ngột.",
    latitude: 21.009,
    longitude: 105.526,
    created_at: minutesAgo(420),
    resolved: false,
    upvotes: 6,
    downvotes: 1
  },
  {
    id: "demo-obstacle",
    user_id: "demo-user",
    type: "obstacle",
    title: "Cành cây rơi sát mép đường",
    description:
      "Dữ liệu minh họa: người đăng đã xác nhận vật cản được dọn.",
    latitude: 21.018,
    longitude: 105.519,
    created_at: minutesAgo(90),
    resolved: true,
    upvotes: 3,
    downvotes: 0
  },
  {
    id: "demo-lighting",
    user_id: "demo-user",
    type: "lighting",
    title: "Một đoạn đường thiếu ánh sáng",
    description:
      "Dữ liệu minh họa: đèn đường không hoạt động.",
    latitude: 21.022,
    longitude: 105.527,
    created_at: minutesAgo(600),
    resolved: false,
    upvotes: 2,
    downvotes: 1
  },
  {
    id: "demo-danger",
    user_id: "demo-user",
    type: "danger",
    title: "Khúc cua có tầm nhìn hạn chế",
    description:
      "Dữ liệu minh họa: chú ý xe đi ngược chiều khi vào cua.",
    latitude: 21.011,
    longitude: 105.531,
    created_at: minutesAgo(50),
    resolved: false,
    upvotes: 4,
    downvotes: 0
  },
  {
    id: "demo-support",
    user_id: "demo-user",
    type: "support",
    title: "Cần hỗ trợ xe bị thủng lốp",
    description:
      "Dữ liệu minh họa: báo cáo này đã quá thời hạn hiển thị hiệu lực.",
    latitude: 21.016,
    longitude: 105.522,
    created_at: minutesAgo(150),
    resolved: false,
    upvotes: 1,
    downvotes: 0
  }
];