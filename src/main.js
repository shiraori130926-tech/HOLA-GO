import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";

import {
  MAP_CENTER,
  REPORT_TYPES,
  SAMPLE_REPORTS,
  PLACES
} from "./data.js";

import {
  timeAgo,
  getStatus,
  formatDistance,
  distanceMeters,
  normalizeText,
  isValidCoordinates
} from "./utils.js";

import {
  supabase,
  isDemoMode,
  supabaseConfigError
} from "./supabase.js";

function requiredElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Không tìm thấy phần tử giao diện: ${id}`);
  }

  return element;
}

const dom = {
  connection: requiredElement("connection-status"),
  create: requiredElement("create-report-button"),
  authButton: requiredElement("auth-button"),
  search: requiredElement("search-input"),
  searchResults: requiredElement("search-results"),
  typeFilters: requiredElement("type-filters"),
  timeFilter: requiredElement("time-filter"),
  resetFilters: requiredElement("reset-filters-button"),
  refresh: requiredElement("refresh-button"),
  count: requiredElement("report-count"),
  listMessage: requiredElement("list-message"),
  list: requiredElement("report-list"),
  mapError: requiredElement("map-error"),
  pickBanner: requiredElement("pick-banner"),
  cancelPick: requiredElement("cancel-pick-button"),
  reportModal: requiredElement("report-modal"),
  reportForm: requiredElement("report-form"),
  reportType: requiredElement("report-type"),
  reportTitle: requiredElement("report-title"),
  reportDescription: requiredElement("report-description"),
  pickLocation: requiredElement("pick-location-button"),
  locationText: requiredElement("selected-location"),
  closeReport: requiredElement("close-report-button"),
  submitReport: requiredElement("submit-report-button"),
  authModal: requiredElement("auth-modal"),
  authForm: requiredElement("auth-form"),
  email: requiredElement("auth-email"),
  password: requiredElement("auth-password"),
  authMessage: requiredElement("auth-message"),
  closeAuth: requiredElement("close-auth-button"),
  loginSubmit: requiredElement("login-submit-button"),
  signup: requiredElement("signup-button"),
  toasts: requiredElement("toast-container")
};

const state = {
  map: null,
  reports: [],
  user: null,
  myVotes: new Map(),
  markers: new Map(),
  activeTypes: new Set(),
  selectedId: null,
  popup: null,
  popupReportId: null,
  picking: false,
  pickedLocation: null,
  pickedMarker: null,
  placeMarker: null,
  userLocation: null,
  loading: false,
  saving: false,
  authBusy: false,
  loadFailed: false,
  voteBusy: new Set(),
  resolveBusy: new Set(),
  authGeneration: 0
};

let refreshTimer = null;
let statusTimer = null;
let authSubscription = null;
let lastMapErrorAt = 0;

function node(tag, className = "", text = "") {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== "") {
    element.textContent = text;
  }

  return element;
}

function toast(message, kind = "info") {
  const element = node(
    "div",
    `toast toast-${kind}`,
    message
  );

  dom.toasts.append(element);

  while (dom.toasts.children.length > 4) {
    dom.toasts.firstElementChild?.remove();
  }

  window.setTimeout(() => {
    element.remove();
  }, 6000);
}

function errorMessage(error) {
  const code = error?.code;
  const message = String(error?.message ?? "");

  if (!navigator.onLine) {
    return "Bạn đang mất kết nối mạng.";
  }

  if (code === "23505") {
    return "Dữ liệu đã tồn tại. Hãy tải lại và thử lại.";
  }

  if (code === "42501") {
    return "Bạn không có quyền thực hiện thao tác này.";
  }

  if (code === "23514") {
    return "Dữ liệu không đáp ứng điều kiện của hệ thống.";
  }

  if (code === "PGRST116") {
    return "Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập.";
  }

  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Email hoặc mật khẩu không đúng.";
  }

  if (message.toLowerCase().includes("email not confirmed")) {
    return "Bạn cần xác nhận email trước khi đăng nhập.";
  }

  if (message.toLowerCase().includes("failed to fetch")) {
    return "Không kết nối được máy chủ. Hãy kiểm tra mạng và cấu hình.";
  }

  return message || "Có lỗi xảy ra. Vui lòng thử lại.";
}

function showError(error, prefix = "") {
  console.error(error);

  toast(
    `${prefix}${errorMessage(error)}`,
    "error"
  );
}

function openDialog(dialog) {
  if (!dialog.open) {
    dialog.showModal();
  }
}

function requireLogin() {
  if (state.user && supabase) {
    return true;
  }

  if (isDemoMode) {
    toast(
      "Đang xem dữ liệu mẫu. Hãy cấu hình Supabase để đăng nhập, tạo báo cáo và vote."
    );

    return false;
  }

  if (!supabase) {
    toast(
      supabaseConfigError || "Supabase chưa được cấu hình đúng.",
      "error"
    );

    return false;
  }

  toast("Bro cần đăng nhập để thực hiện thao tác này.");
  openDialog(dom.authModal);

  return false;
}

function updateAuthUI() {
  if (state.user) {
    dom.authButton.textContent = "Đăng xuất";
    dom.authButton.title = state.user.email ?? "Tài khoản đã đăng nhập";
  } else {
    dom.authButton.textContent = "Đăng nhập";
    dom.authButton.title = "Đăng nhập vào HoLa-Go";
  }
}

function initializeTypes() {
  for (const [key, type] of Object.entries(REPORT_TYPES)) {
    const filter = node(
      "button",
      "filter-chip",
      `${type.icon} ${type.label}`
    );

    filter.type = "button";
    filter.setAttribute("aria-pressed", "false");
    filter.dataset.type = key;

    filter.addEventListener("click", () => {
      if (state.activeTypes.has(key)) {
        state.activeTypes.delete(key);
      } else {
        state.activeTypes.add(key);
      }

      syncFilterButtons();
      render();
    });

    dom.typeFilters.append(filter);

    const option = node(
      "option",
      "",
      `${type.icon} ${type.label}`
    );

    option.value = key;
    dom.reportType.append(option);
  }
}

function syncFilterButtons() {
  for (const button of dom.typeFilters.querySelectorAll("button")) {
    button.setAttribute(
      "aria-pressed",
      String(state.activeTypes.has(button.dataset.type))
    );
  }
}

function resetFilters() {
  state.activeTypes.clear();
  dom.timeFilter.value = "all";

  syncFilterButtons();
}

function initializeMap() {
  try {
    state.map = new maplibregl.Map({
      container: "map",
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: MAP_CENTER,
      zoom: 14,
      attributionControl: true
    });

    state.map.addControl(
      new maplibregl.NavigationControl({
        showCompass: true
      }),
      "top-right"
    );

    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 10000
      },
      trackUserLocation: true,
      showUserLocation: true
    });

    state.map.addControl(geolocate, "top-right");

    geolocate.on("geolocate", (event) => {
      const latitude = Number(event.coords?.latitude);
      const longitude = Number(event.coords?.longitude);

      if (!isValidCoordinates(latitude, longitude)) {
        return;
      }

      state.userLocation = {
        latitude,
        longitude
      };

      render();
    });

    geolocate.on("error", () => {
      toast(
        "Không lấy được vị trí. Hãy cấp quyền định vị và dùng HTTPS hoặc localhost.",
        "error"
      );
    });

    state.map.on("click", handleMapClick);

    state.map.on("load", () => {
      dom.mapError.hidden = true;
      render();
    });

    state.map.on("error", (event) => {
      console.error("MapLibre:", event.error);

      if (Date.now() - lastMapErrorAt > 15000) {
        lastMapErrorAt = Date.now();

        toast(
          "Một phần dữ liệu bản đồ chưa tải được. Hãy kiểm tra kết nối mạng.",
          "error"
        );
      }
    });
  } catch (error) {
    dom.mapError.hidden = false;
    showError(error, "Không mở được bản đồ: ");
  }
}

function filteredReports() {
  const now = Date.now();
  const timeLimit = Number(dom.timeFilter.value);
  const hasTimeFilter = dom.timeFilter.value !== "all";

  return state.reports.filter((report) => {
    const status = getStatus(report, now);

    if (
      status.key === "expired" ||
      status.key === "resolved"
    ) {
      return false;
    }

    const matchesType =
      state.activeTypes.size === 0 ||
      state.activeTypes.has(report.type);

    const age = now - new Date(report.created_at).getTime();

    const matchesTime =
      !hasTimeFilter ||
      age <= timeLimit * 60_000;

    return matchesType && matchesTime;
  });
}

function reportMeta(report) {
  const type = REPORT_TYPES[report.type];

  let text = `${type.label} · ${timeAgo(report.created_at)}`;

  if (state.userLocation) {
    const meters = distanceMeters(
      state.userLocation.latitude,
      state.userLocation.longitude,
      report.latitude,
      report.longitude
    );

    const distance = formatDistance(meters);

    if (distance) {
      text += ` · Cách bạn ${distance}`;
    }
  }

  return text;
}

function statusElement(report) {
  const status = getStatus(report);

  return node(
    "span",
    `status status-${status.key}`,
    status.label
  );
}

function voteActions(report) {
  const wrapper = node("div", "vote-actions");
  const currentVote = state.myVotes.get(report.id);
  const status = getStatus(report);

  const inactive =
    status.key === "expired" ||
    status.key === "resolved";

  for (const value of [1, -1]) {
    const count =
      value === 1 ? report.upvotes : report.downvotes;

    const label =
      value === 1
        ? `👍 Chuẩn (${count})`
        : `👎 Sai (${count})`;

    const button = node("button", "vote-button", label);

    button.type = "button";
    button.disabled =
      state.voteBusy.has(report.id) ||
      inactive;

    button.setAttribute(
      "aria-pressed",
      String(currentVote === value)
    );

    if (inactive) {
      button.title = "Báo cáo đã hết hạn hoặc đã giải quyết.";
    }

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void submitVote(report.id, value);
    });

    wrapper.append(button);
  }

  return wrapper;
}

function resolveButton(report) {
  if (
    !state.user ||
    state.user.id !== report.user_id ||
    report.resolved
  ) {
    return null;
  }

  const button = node(
    "button",
    "button button-secondary resolve-button",
    "✓ Đánh dấu đã giải quyết"
  );

  button.type = "button";
  button.disabled = state.resolveBusy.has(report.id);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void resolveReport(report.id);
  });

  return button;
}

function buildReportCard(report) {
  const type = REPORT_TYPES[report.type];

  const card = node(
    "article",
    `report-card${state.selectedId === report.id ? " selected" : ""}`
  );

  card.dataset.reportId = report.id;

  const focus = node("button", "report-focus");
  focus.type = "button";

  const icon = node("span", "report-icon", type.icon);
  icon.style.setProperty("--type-color", type.color);

  const heading = node("span");
  heading.append(
    node("strong", "report-title", report.title),
    node("span", "report-meta", reportMeta(report))
  );

  focus.append(icon, heading);

  focus.addEventListener("click", () => {
    focusReport(report.id);
  });

  card.append(focus);

  if (report.description) {
    card.append(
      node("p", "report-description", report.description)
    );
  }

  card.append(
    statusElement(report),
    voteActions(report)
  );

  const resolve = resolveButton(report);

  if (resolve) {
    card.append(resolve);
  }

  return card;
}

function buildPopup(report) {
  const type = REPORT_TYPES[report.type];
  const wrapper = node("div", "popup-content");

  wrapper.append(
    node("h3", "", `${type.icon} ${report.title}`),
    node("div", "report-meta", reportMeta(report))
  );

  if (report.description) {
    wrapper.append(
      node("p", "report-description", report.description)
    );
  }

  wrapper.append(
    statusElement(report),
    voteActions(report)
  );

  const resolve = resolveButton(report);

  if (resolve) {
    wrapper.append(resolve);
  }

  return wrapper;
}

function closePopup() {
  if (state.popup) {
    state.popup.remove();
  }

  state.popup = null;
  state.popupReportId = null;
}

function showPopup(report) {
  if (!state.map) {
    return;
  }

  closePopup();

  const popup = new maplibregl.Popup({
    offset: 26,
    maxWidth: "320px",
    closeOnClick: false
  });

  popup
    .setLngLat([report.longitude, report.latitude])
    .setDOMContent(buildPopup(report))
    .addTo(state.map);

  state.popup = popup;
  state.popupReportId = report.id;

  popup.on("close", () => {
    if (state.popup === popup) {
      state.popup = null;
      state.popupReportId = null;
    }
  });
}

function syncMarkers(reports) {
  if (!state.map) {
    return;
  }

  const visibleIds = new Set(reports.map((report) => report.id));

  for (const [id, item] of state.markers) {
    if (!visibleIds.has(id)) {
      item.marker.remove();
      state.markers.delete(id);
    }
  }

  for (const report of reports) {
    const type = REPORT_TYPES[report.type];
    let item = state.markers.get(report.id);

    if (!item) {
      const shell = node("div", "marker-shell");
      const button = node("button", "marker-button", type.icon);

      button.type = "button";
      button.style.setProperty("--type-color", type.color);

      button.addEventListener("click", (event) => {
        if (state.picking) {
          return;
        }

        event.stopPropagation();
        focusReport(report.id);
      });

      shell.append(button);

      const marker = new maplibregl.Marker({
        element: shell,
        anchor: "bottom"
      })
        .setLngLat([report.longitude, report.latitude])
        .addTo(state.map);

      item = {
        marker,
        button
      };

      state.markers.set(report.id, item);
    }

    const status = getStatus(report);

    item.marker.setLngLat([
      report.longitude,
      report.latitude
    ]);

    item.button.title = report.title;

    item.button.setAttribute(
      "aria-label",
      `${type.label}: ${report.title}`
    );

    item.button.classList.toggle(
      "selected",
      state.selectedId === report.id
    );

    item.button.classList.toggle(
      "inactive",
      status.key === "expired" ||
        status.key === "resolved"
    );
  }

  if (state.popupReportId) {
    const report = reports.find(
      (item) => item.id === state.popupReportId
    );

    if (report && state.popup) {
      state.popup.setDOMContent(buildPopup(report));
    } else {
      closePopup();
    }
  }
}

function render() {
  const reports = filteredReports();

  dom.count.textContent = String(reports.length);

  if (state.loading && state.reports.length === 0) {
    dom.listMessage.hidden = false;
    dom.listMessage.textContent = "Đang tải báo cáo.";
  } else if (state.loadFailed) {
    dom.listMessage.hidden = false;
    dom.listMessage.textContent =
      "Không tải được dữ liệu mới. Dữ liệu đang có được giữ lại; bấm Tải lại để thử.";
  } else if (reports.length === 0) {
    dom.listMessage.hidden = false;
    dom.listMessage.textContent =
      "Chưa có báo cáo phù hợp với bộ lọc.";
  } else {
    dom.listMessage.hidden = true;
  }

  const fragment = document.createDocumentFragment();

  for (const report of reports) {
    fragment.append(buildReportCard(report));
  }

  dom.list.replaceChildren(fragment);

    syncMarkers(reports);

  if (!dom.searchResults.hidden) {
    updateSearchSuggestions();
  }
}

function focusReport(id, reveal = false) {
  const report = state.reports.find((item) => item.id === id);

  if (!report) {
    toast("Báo cáo không còn trong danh sách.", "error");
    return;
  }

  if (reveal) {
    resetFilters();
  }

  state.selectedId = report.id;
  render();

  if (state.map) {
    state.map.flyTo({
      center: [report.longitude, report.latitude],
      zoom: Math.max(state.map.getZoom(), 16)
    });

    showPopup(report);
  }

  const card = Array.from(dom.list.children).find(
    (element) => element.dataset.reportId === id
  );

  card?.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

function normalizeReport(row) {
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);

  if (
    !REPORT_TYPES[row.type] ||
    !isValidCoordinates(latitude, longitude) ||
    !Number.isFinite(new Date(row.created_at).getTime())
  ) {
    return null;
  }

  return {
    id: String(row.id),
    user_id: row.user_id,
    type: row.type,
    title: String(row.title),
    description: String(row.description ?? ""),
    latitude,
    longitude,
    created_at: row.created_at,
    resolved: row.resolved === true,
    upvotes: Number(row.upvotes) || 0,
    downvotes: Number(row.downvotes) || 0
  };
}

async function fetchAllReports() {
  const rows = [];
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("report_feed")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      const report = normalizeReport(row);

      if (report) {
        rows.push(report);
      }
    }

    if (!data || data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  const unique = new Map();

  for (const report of rows) {
    unique.set(report.id, report);
  }

  return Array.from(unique.values());
}

async function fetchMyVotes(userId) {
  const votes = new Map();

  if (!userId) {
    return votes;
  }

  const pageSize = 500;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("votes")
      .select("report_id,value")
      .eq("user_id", userId)
      .order("report_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    for (const vote of data ?? []) {
      votes.set(vote.report_id, vote.value);
    }

    if (!data || data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return votes;
}

async function loadReports(silent = false) {
  if (state.loading) {
    return;
  }

  if (isDemoMode) {
   state.reports = SAMPLE_REPORTS.map((report) => ({ ...report }));
    state.loadFailed = false;
    dom.connection.textContent = "Chế độ dữ liệu mẫu";
    render();
    return;
  }

  if (!supabase) {
    state.loadFailed = true;
    dom.connection.textContent = "Lỗi cấu hình";
    render();

    if (!silent) {
      toast(supabaseConfigError || "Chưa kết nối được Supabase.", "error");
    }

    return;
  }

  state.loading = true;
  dom.refresh.disabled = true;

  if (!silent) {
    render();
  }

  try {
    const reports = await fetchAllReports();

    state.reports = reports;
    state.loadFailed = false;
    dom.connection.textContent = "Đã kết nối Supabase";
  } catch (error) {
    state.loadFailed = true;
    dom.connection.textContent = "Lỗi tải dữ liệu";

    if (!silent) {
      showError(error, "Tải báo cáo thất bại: ");
    } else {
      console.error(error);
    }
  } finally {
    state.loading = false;
    dom.refresh.disabled = false;
    render();
    updateSearchSuggestions();
  }
}

function applyAuthSession(session) {
  state.user = session?.user ?? null;
  state.myVotes = new Map();
  state.authGeneration += 1;

  const generation = state.authGeneration;
  const userId = state.user?.id ?? null;

  updateAuthUI();
  render();

  if (!userId || !supabase) {
    return;
  }

  window.setTimeout(async () => {
    try {
      const votes = await fetchMyVotes(userId);

      if (
        state.authGeneration === generation &&
        state.user?.id === userId
      ) {
        state.myVotes = votes;
        render();
      }
    } catch (error) {
      console.error("Không tải được lựa chọn vote:", error);
    }
  }, 0);
}

async function initializeAuth() {
  if (!supabase) {
    updateAuthUI();
    return;
  }

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    applyAuthSession(data.session);
  } catch (error) {
    showError(error, "Không khôi phục được đăng nhập: ");
  }

  const { data } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      applyAuthSession(session);
    }
  );

  authSubscription = data.subscription;
}

function setAuthBusy(busy) {
  state.authBusy = busy;
  dom.loginSubmit.disabled = busy;
  dom.signup.disabled = busy;
  dom.closeAuth.disabled = busy;
  dom.authButton.disabled = busy;
}

async function authenticate(mode) {
  if (!supabase || state.authBusy) {
    if (!supabase) {
      requireLogin();
    }

    return;
  }

  if (!dom.authForm.reportValidity()) {
    return;
  }

  const email = dom.email.value.trim();
  const password = dom.password.value;

  setAuthBusy(true);
  dom.authMessage.textContent = "Đang xử lý yêu cầu.";

  try {
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) {
        throw error;
      }

      dom.password.value = "";

      if (data.session) {
        applyAuthSession(data.session);
        dom.authModal.close();
        toast("Tạo tài khoản thành công.", "success");
      } else {
        dom.authMessage.textContent =
          "Nếu email đủ điều kiện đăng ký, bạn sẽ nhận được thư xác nhận. Hãy kiểm tra hộp thư và thư rác.";

        toast("Hãy kiểm tra email để xác nhận tài khoản.");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      applyAuthSession(data.session);
      dom.password.value = "";
      dom.authModal.close();
      toast("Đăng nhập thành công.", "success");
    }
  } catch (error) {
    dom.authMessage.textContent = errorMessage(error);
    showError(error);
  } finally {
    setAuthBusy(false);
  }
}

async function handleAuthButton() {
  if (!state.user) {
    if (!supabase) {
      requireLogin();
      return;
    }

    dom.authMessage.textContent = "";
    openDialog(dom.authModal);
    return;
  }

  if (!supabase || state.authBusy) {
    return;
  }

  setAuthBusy(true);

  try {
    const { error } = await supabase.auth.signOut({
      scope: "local"
    });

    if (error) {
      throw error;
    }

    applyAuthSession(null);
    toast("Đã đăng xuất.", "success");
  } catch (error) {
    showError(error, "Đăng xuất thất bại: ");
  } finally {
    setAuthBusy(false);
  }
}

function clearPickedLocation() {
  state.pickedLocation = null;

  state.pickedMarker?.remove();
  state.pickedMarker = null;

  dom.locationText.textContent = "Chưa chọn vị trí.";
}

function openReportForm() {
  if (!requireLogin()) {
    return;
  }

  if (!state.map) {
    toast("Bản đồ chưa sẵn sàng để chọn vị trí.", "error");
    return;
  }

  dom.reportForm.reset();
  clearPickedLocation();
  openDialog(dom.reportModal);
}

function beginLocationPick() {
  if (!state.map || state.saving) {
    return;
  }

  state.picking = true;

  closePopup();
  dom.reportModal.close();
  dom.pickBanner.hidden = false;
  state.map.getCanvas().style.cursor = "crosshair";

  for (const item of state.markers.values()) {
    item.button.style.pointerEvents = "none";
  }
}

function stopLocationPick(reopen = true) {
  state.picking = false;
  dom.pickBanner.hidden = true;

  if (state.map) {
    state.map.getCanvas().style.cursor = "";
  }

  for (const item of state.markers.values()) {
    item.button.style.pointerEvents = "";
  }

  if (reopen) {
    openDialog(dom.reportModal);
  }
}

function handleMapClick(event) {
  if (!state.picking || !state.map) {
    return;
  }

  const latitude = Number(event.lngLat.lat);
  const longitude = Number(event.lngLat.wrap().lng);

  if (!isValidCoordinates(latitude, longitude)) {
    toast("Tọa độ không hợp lệ, hãy chọn lại.", "error");
    return;
  }

  state.pickedLocation = {
    latitude,
    longitude
  };

  state.pickedMarker?.remove();

  state.pickedMarker = new maplibregl.Marker({
    color: "#18794e"
  })
    .setLngLat([longitude, latitude])
    .addTo(state.map);

  dom.locationText.textContent =
    `Đã chọn: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  stopLocationPick(true);
}

function setReportBusy(busy) {
  state.saving = busy;

  dom.submitReport.disabled = busy;
  dom.closeReport.disabled = busy;
  dom.pickLocation.disabled = busy;

  dom.submitReport.textContent =
    busy ? "Đang đăng báo cáo" : "Đăng báo cáo";
}

async function createReport(event) {
  event.preventDefault();

  if (state.saving || !requireLogin()) {
    return;
  }

  if (!dom.reportForm.reportValidity()) {
    return;
  }

  const type = dom.reportType.value;
  const title = dom.reportTitle.value.trim();
  const description = dom.reportDescription.value.trim();
  const location = state.pickedLocation;

  if (!REPORT_TYPES[type]) {
    toast("Loại báo cáo không hợp lệ.", "error");
    return;
  }

  if (title.length < 5 || title.length > 120) {
    toast("Tiêu đề phải có từ 5 đến 120 ký tự.", "error");
    return;
  }

  if (description.length > 2000) {
    toast("Mô tả không được quá 2000 ký tự.", "error");
    return;
  }

  if (
    !location ||
    !isValidCoordinates(location.latitude, location.longitude)
  ) {
    toast("Hãy chọn vị trí trên bản đồ trước khi đăng.", "error");
    return;
  }

  const userId = state.user.id;

  setReportBusy(true);

  try {
    const { data, error } = await supabase
      .from("reports")
      .insert({
        user_id: userId,
        type,
        title,
        description,
        latitude: location.latitude,
        longitude: location.longitude
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const report = normalizeReport(data);

    if (!report) {
      throw new Error("Máy chủ trả về báo cáo không hợp lệ.");
    }

    state.reports.unshift(report);

    dom.reportModal.close();
    dom.reportForm.reset();
    clearPickedLocation();

    focusReport(report.id, true);
    updateSearchSuggestions();

    toast("Đăng báo cáo thành công.", "success");
  } catch (error) {
    showError(error, "Không đăng được báo cáo: ");
  } finally {
    setReportBusy(false);
  }
}

async function refreshOneReport(id) {
  const { data, error } = await supabase
    .from("report_feed")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  const report = normalizeReport(data);

  if (!report) {
    throw new Error("Dữ liệu báo cáo không hợp lệ.");
  }

  const index = state.reports.findIndex((item) => item.id === id);

  if (index >= 0) {
    state.reports[index] = report;
  } else {
    state.reports.unshift(report);
  }
}
function updateLocalVoteCounts(reportId, oldVote, newVote) {
  const report = state.reports.find(
    (item) => item.id === reportId
  );

  if (!report) {
    return;
  }

  if (oldVote === 1) {
    report.upvotes = Math.max(0, report.upvotes - 1);
  }

  if (oldVote === -1) {
    report.downvotes = Math.max(0, report.downvotes - 1);
  }

  if (newVote === 1) {
    report.upvotes += 1;
  } else {
    report.downvotes += 1;
  }
}
async function submitVote(reportId, value) {
  if (!requireLogin() || state.voteBusy.has(reportId)) {
    return;
  }

  const report = state.reports.find((item) => item.id === reportId);

  if (!report || ![1, -1].includes(value)) {
    return;
  }

  const status = getStatus(report);

  if (status.key === "expired" || status.key === "resolved") {
    toast("Báo cáo đã hết hạn hoặc đã giải quyết.");
    return;
  }

  const oldVote = state.myVotes.get(reportId);

  if (oldVote === value) {
    toast("Bro đã chọn phương án này rồi.");
    return;
  }

  const userId = state.user.id;

  state.voteBusy.add(reportId);
  render();

  try {
    const { error } = await supabase
      .from("votes")
      .upsert(
        {
          report_id: reportId,
          user_id: userId,
          value
        },
        {
          onConflict: "report_id,user_id"
        }
      );

    if (error) {
      throw error;
    }

       updateLocalVoteCounts(reportId, oldVote, value);

    if (state.user?.id === userId) {
      state.myVotes.set(reportId, value);
    }

    render();
    toast("Đã lưu bình chọn.", "success");

    try {
      await refreshOneReport(reportId);
    } catch (error) {
      console.error(error);
      toast(
        "Vote đã lưu. Chưa đồng bộ được tổng vote mới nhất; hãy tải lại khi mạng ổn định."
      );
    }
  } catch (error) {
    showError(error, "Không lưu được bình chọn: ");
  } finally {
    state.voteBusy.delete(reportId);
    render();
  }
}

async function resolveReport(reportId) {
  if (!requireLogin() || state.resolveBusy.has(reportId)) {
    return;
  }

  const report = state.reports.find((item) => item.id === reportId);

  if (!report || report.user_id !== state.user.id) {
    toast("Chỉ người tạo được đánh dấu đã giải quyết.", "error");
    return;
  }

  state.resolveBusy.add(reportId);
  render();

  try {
    const { data, error } = await supabase
      .from("reports")
      .update({
        resolved: true
      })
      .eq("id", reportId)
      .eq("user_id", state.user.id)
      .select("id,resolved")
      .single();

    if (error) {
      throw error;
    }

    const currentReport = state.reports.find(
      (item) => item.id === data.id
    );

    if (currentReport) {
      currentReport.resolved = data.resolved;
    }

    toast("Đã đánh dấu báo cáo được giải quyết.", "success");
  } catch (error) {
    showError(error, "Không cập nhật được báo cáo: ");
  } finally {
    state.resolveBusy.delete(reportId);
    render();
  }
}

function searchResultButton(title, subtitle, onClick) {
  const button = node("button", "search-result");
  button.type = "button";

  button.append(
    node("strong", "", title),
    node("small", "", subtitle)
  );

  button.addEventListener("click", () => {
    dom.searchResults.hidden = true;
    onClick();
  });

  return button;
}

function updateSearchSuggestions() {
  const query = normalizeText(dom.search.value);

  dom.searchResults.replaceChildren();

  if (!query) {
    dom.searchResults.hidden = true;
    return;
  }

  const places = PLACES.filter((place) => {
    return normalizeText(
      `${place.name} ${place.description}`
    ).includes(query);
  }).slice(0, 5);

    const now = Date.now();

  const reports = state.reports.filter((report) => {
    const status = getStatus(report, now);

    if (
      status.key === "expired" ||
      status.key === "resolved"
    ) {
      return false;
    }

    return normalizeText(
      `${report.title} ${report.description} ${REPORT_TYPES[report.type].label}`
    ).includes(query);
  }).slice(0, 8);

  for (const place of places) {
    dom.searchResults.append(
      searchResultButton(
        `📍 ${place.name}`,
        place.description,
        () => {
          if (!state.map) {
            toast("Bản đồ chưa sẵn sàng.", "error");
            return;
          }

          closePopup();

          state.placeMarker?.remove();

          state.placeMarker = new maplibregl.Marker({
            color: "#2563eb"
          })
            .setLngLat([place.longitude, place.latitude])
            .addTo(state.map);

          state.map.flyTo({
            center: [place.longitude, place.latitude],
            zoom: 15
          });

          dom.search.value = place.name;
        }
      )
    );
  }

  for (const report of reports) {
    dom.searchResults.append(
      searchResultButton(
        `${REPORT_TYPES[report.type].icon} ${report.title}`,
        `Báo cáo · ${timeAgo(report.created_at)}`,
        () => {
          dom.search.value = report.title;
          focusReport(report.id, true);
        }
      )
    );
  }

  if (places.length === 0 && reports.length === 0) {
    dom.searchResults.append(
      node(
        "div",
        "search-empty",
        "Không có kết quả trong địa điểm Hòa Lạc và báo cáo đã tải."
      )
    );
  }

  dom.searchResults.hidden = false;
}

function bindEvents() {
  dom.create.addEventListener("click", openReportForm);

  dom.authButton.addEventListener("click", () => {
    void handleAuthButton();
  });

  dom.refresh.addEventListener("click", () => {
    void loadReports();
  });

  dom.resetFilters.addEventListener("click", () => {
    resetFilters();
    render();
  });

  dom.timeFilter.addEventListener("change", render);

  dom.search.addEventListener("input", updateSearchSuggestions);
  dom.search.addEventListener("focus", updateSearchSuggestions);

  dom.search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      dom.searchResults.hidden = true;
    }

    if (event.key === "ArrowDown") {
      const button = dom.searchResults.querySelector("button");

      if (button) {
        event.preventDefault();
        button.focus();
      }
    }
  });

  dom.searchResults.addEventListener("keydown", (event) => {
    const buttons = Array.from(
      dom.searchResults.querySelectorAll("button")
    );

    const index = buttons.indexOf(document.activeElement);

    if (event.key === "ArrowDown" && buttons.length > 0) {
      event.preventDefault();
      buttons[(index + 1) % buttons.length].focus();
    }

    if (event.key === "ArrowUp" && buttons.length > 0) {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length].focus();
    }

    if (event.key === "Escape") {
      dom.searchResults.hidden = true;
      dom.search.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) {
      return;
    }

    if (
      event.target !== dom.search &&
      !dom.searchResults.contains(event.target)
    ) {
      dom.searchResults.hidden = true;
    }
  });

  dom.closeReport.addEventListener("click", () => {
    if (!state.saving) {
      dom.reportModal.close();
    }
  });

  dom.reportModal.addEventListener("cancel", (event) => {
    if (state.saving) {
      event.preventDefault();
    }
  });

  dom.reportModal.addEventListener("close", () => {
    if (!state.picking) {
      clearPickedLocation();
    }
  });

  dom.pickLocation.addEventListener("click", beginLocationPick);

  dom.cancelPick.addEventListener("click", () => {
    stopLocationPick(true);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.picking) {
      stopLocationPick(true);
    }
  });

  dom.reportForm.addEventListener("submit", (event) => {
    void createReport(event);
  });

  dom.closeAuth.addEventListener("click", () => {
    if (!state.authBusy) {
      dom.authModal.close();
    }
  });

  dom.authModal.addEventListener("cancel", (event) => {
    if (state.authBusy) {
      event.preventDefault();
    }
  });

  dom.authModal.addEventListener("close", () => {
    dom.password.value = "";
  });

  dom.authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void authenticate("login");
  });

  dom.signup.addEventListener("click", () => {
    void authenticate("signup");
  });

  window.addEventListener("offline", () => {
    dom.connection.textContent = "Mất kết nối mạng";
    toast("Bạn đang mất kết nối mạng.", "error");
  });

  window.addEventListener("online", () => {
    toast("Đã kết nối mạng trở lại.", "success");
    void loadReports(true);
  });

  window.addEventListener("beforeunload", () => {
    window.clearInterval(refreshTimer);
    window.clearInterval(statusTimer);
    authSubscription?.unsubscribe();
  });
}

async function bootstrap() {
  initializeTypes();
  bindEvents();
  initializeMap();

  await initializeAuth();
  await loadReports();

  statusTimer = window.setInterval(() => {
    if (
      !document.hidden &&
      !state.picking &&
      !state.saving &&
      !dom.reportModal.open &&
!dom.authModal.open
    ) {
      render();
    }
  }, 30_000);

  refreshTimer = window.setInterval(() => {
    if (
      !isDemoMode &&
      !document.hidden &&
      !state.picking &&
      !state.saving &&
      state.voteBusy.size === 0 &&
      state.resolveBusy.size === 0
    ) {
      void loadReports(true);
    }
  }, 60_000);
}

void bootstrap().catch((error) => {
  showError(error, "Không khởi động được ứng dụng: ");
});