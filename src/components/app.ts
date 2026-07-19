import { Clock } from "$src/components/clock";
import { El } from "$src/components/element";

import { equal, now } from "$src/utilities/time";

import type { Time } from "$src/types/time";

type ThemeMode = "system" | "light" | "dark";
type DateDisplayStyle = "full" | "summary";

type DateFormat =
  | "DD-MM-YYYY"
  | "DD.MM.YYYY"
  | "DD/MM/YYYY"
  | "MM-DD-YYYY"
  | "MM.DD.YYYY"
  | "MM/DD/YYYY";

type PopupType = "settings" | "timer" | "messages" | null;

type TimerSticker = "meeting" | "sleep" | "exercise" | "work" | "presentation" | "timer" | null;

type LocationPermission = "unknown" | "granted" | "denied";

type SettingsState = {
  theme: ThemeMode;
  dimAnimationSeconds: number;
  dateDisplayStyle: DateDisplayStyle;
  dateFormat: DateFormat;
  locationPermission: LocationPermission;
  customBackgroundColor: string | null;
  customTextColor: string | null;
};

type TimerState = {
  durationMs: number;
  remainingMs: number;
  running: boolean;
  title: string;
  sticker: TimerSticker;
  targetTimestamp: number | null;
};

type UiState = {
  popup: PopupType;
  mode: "normal" | "dim";
};

class App {
  time: Time = now();

  settings: SettingsState = {
    theme: "system",
    dimAnimationSeconds: 0.4,
    dateDisplayStyle: "full",
    dateFormat: "DD-MM-YYYY",
    locationPermission: "unknown",
    customBackgroundColor: null,
    customTextColor: null
  };

  timer: TimerState = {
    durationMs: 0,
    remainingMs: 0,
    running: false,
    title: "",
    sticker: null,
    targetTimestamp: null
  };

  ui: UiState = {
    popup: null,
    mode: "normal"
  };

  init() {
    this.applyInitialTheme();
    this.buildLayout();
    this.attachIconHandlers();
    this.attachGlobalListeners();
    this.startClock();
    this.initLocation();
  }

  /* Layout */

  buildLayout() {
    const dashboard = El.create({
      type: "div",
      classes: "dashboard",
      children: [
        this.createTopBar(),
        this.createMainContent(),
        this.createPopupOverlay()
      ]
    });

    El.append("app", dashboard);

    // mount clock-of-clocks into its container
    const timeClockHost = document.getElementById("clock-of-clocks");
    if (timeClockHost) {
      timeClockHost.appendChild(Clock.create());
    }
  }

  createTopBar() {
    const settingsIcon = this.iconButton("settings-icon", "⚙");
    const timerIcon = this.iconButton("timer-icon", "⏱");
    const messageIcon = this.iconButton("message-icon", "💬");

    const left = El.create({
      type: "div",
      classes: "top-bar-left",
      children: [settingsIcon, timerIcon, messageIcon]
    });

    return El.create({
      type: "div",
      classes: "top-bar",
      children: [left]
    });
  }

  iconButton(id: string, label: string) {
    const span = document.createElement("span");
    span.textContent = label;

    return El.create({
      type: "button",
      id,
      classes: "icon-button",
      children: [span]
    });
  }

  createMainContent() {
    const greeting = El.create({
      type: "div",
      id: "greeting",
      classes: "greeting",
      children: []
    });

    const timeDisplay = El.create({
      type: "div",
      id: "time-display",
      classes: "time-display",
      children: []
    });

    const dateDisplay = El.create({
      type: "div",
      id: "date-display",
      classes: "date-display",
      children: []
    });

    const clockHost = El.create({
      type: "div",
      id: "clock-of-clocks",
      children: []
    });

    const timeStack = El.create({
      type: "div",
      classes: "time-stack",
      children: [greeting, clockHost, timeDisplay, dateDisplay]
    });

    const locationGrid = this.createLocationGrid();

    const main = El.create({
      type: "div",
      classes: "main-content",
      children: [timeStack, locationGrid]
    });

    (main as HTMLDivElement).dataset.mode = this.ui.mode;

    return main;
  }

  createLocationGrid() {
    const labels = [
      ["coordinates", "Coordinates"],
      ["city", "City"],
      ["region", "State / County"],
      ["country", "Country"],
      ["continent", "Continent"],
      ["timezone", "Timezone"]
    ] as const;

    const items = labels.map(([key, label]) => {
      const labelEl = El.create({
        type: "span",
        classes: "location-label",
        children: []
      });
      labelEl.textContent = label;

      const valueEl = El.create({
        type: "span",
        id: `location-${key}`,
        classes: "location-value",
        children: []
      });
      valueEl.textContent = "—";

      const wrapper = El.create({
        type: "div",
        classes: "location-item",
        children: [labelEl, valueEl]
      });

      return wrapper;
    });

    return El.create({
      type: "div",
      classes: "location-grid",
      children: items
    });
  }

  createPopupOverlay() {
    const overlay = El.create({
      type: "div",
      id: "popup-overlay",
      classes: "popup-overlay",
      children: []
    });

    overlay.dataset.open = "false";
    return overlay;
  }

  /* Time / greeting / date */

  startClock() {
    this.updateTimeUi(this.time);
    Clock.tick(this.time);

    setInterval(() => {
      const t = now();
      if (!equal(t, this.time)) {
        this.time = t;
        this.updateTimeUi(this.time);
        Clock.tick(this.time);
        this.updateTimer();
      }
    }, 250);
  }

  updateTimeUi(time: Time) {
    const greeting = document.getElementById("greeting");
    const timeDisplay = document.getElementById("time-display");
    const dateDisplay = document.getElementById("date-display");

    if (greeting) greeting.textContent = this.getGreeting();

    const timerActive = this.timer.running || this.timer.remainingMs > 0;
    const isDim = this.ui.mode === "dim";

    if (timeDisplay) {
      if (isDim && timerActive) {
        timeDisplay.textContent = this.formatMillis(this.timer.remainingMs || this.timer.durationMs);
      } else {
        timeDisplay.textContent = `${time.hours}:${time.minutes}:${time.seconds}`;
      }
    }

    if (dateDisplay && !(isDim && timerActive)) {
      const date = new Date();
      dateDisplay.textContent = this.formatDate(date);
    }
  }

  getGreeting() {
    const nowDate = new Date();
    const hour = nowDate.getHours();

    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17 && hour < 21) return "Good evening";
    return "Good night";
  }

  formatDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const yFull = date.getFullYear().toString();
    const yShort = yFull.slice(-2);

    const yearPart = this.settings.dateDisplayStyle === "full" ? yFull : yShort;

    switch (this.settings.dateFormat) {
      case "DD-MM-YYYY":
        return `${d}-${m}-${yearPart}`;
      case "DD.MM.YYYY":
        return `${d}.${m}.${yearPart}`;
      case "DD/MM/YYYY":
        return `${d}/${m}/${yearPart}`;
      case "MM-DD-YYYY":
        return `${m}-${d}-${yearPart}`;
      case "MM.DD.YYYY":
        return `${m}.${d}.${yearPart}`;
      case "MM/DD/YYYY":
        return `${m}/${d}/${yearPart}`;
      default:
        return `${d}-${m}-${yearPart}`;
    }
  }

  /* Theme / styling */

  applyInitialTheme() {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = prefersDark ? "dark" : "light";
    this.applyTheme(theme);

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
      if (this.settings.theme === "system") {
        this.applyTheme(event.matches ? "dark" : "light");
      }
    });
  }

  applyTheme(mode: "light" | "dark") {
    document.body.dataset.theme = mode;

    if (this.settings.customBackgroundColor) {
      document.body.style.backgroundColor = this.settings.customBackgroundColor;
    }

    if (this.settings.customTextColor) {
      document.body.style.color = this.settings.customTextColor;
    }
  }

  /* Icons / popup handling */

  attachIconHandlers() {
    const settingsIcon = document.getElementById("settings-icon");
    const timerIcon = document.getElementById("timer-icon");
    const messageIcon = document.getElementById("message-icon");

    settingsIcon?.addEventListener("click", () => this.openPopup("settings"));
    timerIcon?.addEventListener("click", () => this.openPopup("timer"));
    messageIcon?.addEventListener("click", () => this.openPopup("messages"));
  }

  attachGlobalListeners() {
    // simple dim mode toggle by double click on clock stack
    const timeStack = document.querySelector(".time-stack");
    timeStack?.addEventListener("dblclick", () => {
      this.toggleDimMode();
    });
  }

  toggleDimMode() {
    this.ui.mode = this.ui.mode === "normal" ? "dim" : "normal";
    const dashboard = document.querySelector(".dashboard") as HTMLDivElement | null;
    if (dashboard) {
      dashboard.dataset.mode = this.ui.mode;
    }
  }

  openPopup(type: PopupType) {
    this.ui.popup = type;

    const overlay = document.getElementById("popup-overlay");
    if (!overlay) return;

    overlay.dataset.open = "true";
    overlay.innerHTML = "";

    const popup = this.buildPopup(type);
    overlay.appendChild(popup);
  }

  closePopup() {
    this.ui.popup = null;
    const overlay = document.getElementById("popup-overlay");
    if (overlay) {
      overlay.dataset.open = "false";
      overlay.innerHTML = "";
    }
  }

  navigatePopup(direction: "prev" | "next") {
    const order: PopupType[] = ["settings", "timer", "messages"];
    const currentIndex = order.indexOf(this.ui.popup ?? "settings");
    const delta = direction === "next" ? 1 : -1;
    const nextIndex = (currentIndex + delta + order.length) % order.length;
    this.openPopup(order[nextIndex]);
  }

  buildPopup(type: PopupType) {
    const container = El.create({
      type: "div",
      classes: "popup",
      children: []
    });

    const titleMap: Record<Exclude<PopupType, null>, string> = {
      settings: "Settings",
      timer: "Timer",
      messages: "Messages"
    };

    const headerTitle = El.create({
      type: "div",
      classes: "popup-title",
      children: []
    });
    headerTitle.textContent = type ? titleMap[type] : "";

    const closeBtn = El.create({
      type: "button",
      classes: "popup-close",
      children: []
    });
    closeBtn.innerHTML = "✕";
    closeBtn.addEventListener("click", () => this.closePopup());

    const header = El.create({
      type: "div",
      classes: "popup-header",
      children: [headerTitle, closeBtn]
    });

    const body = El.create({
      type: "div",
      classes: "popup-body",
      children: []
    });

    if (type === "settings") {
      this.buildSettingsBody(body);
    } else if (type === "timer") {
      this.buildTimerBody(body);
    } else if (type === "messages") {
      this.buildMessagesBody(body);
    }

    const footer = this.buildPopupFooter();

    container.appendChild(header);
    container.appendChild(body);
    container.appendChild(footer);

    return container;
  }

  buildPopupFooter() {
    const footer = El.create({
      type: "div",
      classes: "popup-footer",
      children: []
    });

    const nav = El.create({
      type: "div",
      classes: "popup-nav",
      children: []
    });

    const prev = El.create({
      type: "button",
      classes: "nav-arrow",
      children: []
    });
    prev.innerHTML = "←";
    prev.addEventListener("click", () => this.navigatePopup("prev"));

    const next = El.create({
      type: "button",
      classes: "nav-arrow",
      children: []
    });
    next.innerHTML = "→";
    next.addEventListener("click", () => this.navigatePopup("next"));

    nav.appendChild(prev);
    nav.appendChild(next);

    footer.appendChild(nav);

    return footer;
  }

  /* Settings popup */

  buildSettingsBody(body: HTMLElement) {
    // Location permission
    const locationSection = this.section("Location");
    const locationRow = El.create({
      type: "div",
      classes: "popup-row",
      children: []
    });
    const locationLabel = document.createElement("div");
    locationLabel.textContent = "Location permission";
    const locationControls = El.create({
      type: "div",
      classes: "popup-controls",
      children: []
    });

    const allowChip = this.chip(
      "Allow",
      this.settings.locationPermission === "granted",
      () => this.requestLocationPermission()
    );

    const statusText = document.createElement("div");
    statusText.className = "subtle-text";
    statusText.textContent =
      this.settings.locationPermission === "granted"
        ? "Location is enabled."
        : this.settings.locationPermission === "denied"
        ? "Location denied or unavailable."
        : "Location not requested yet.";

    locationControls.appendChild(allowChip);
    locationRow.appendChild(locationLabel);
    locationRow.appendChild(locationControls);

    locationSection.appendChild(locationRow);
    locationSection.appendChild(statusText);

    // Dimming animation
    const dimSection = this.section("Dimming");
    const dimRow = El.create({
      type: "div",
      classes: "popup-row",
      children: []
    });

    const dimLabel = document.createElement("div");
    dimLabel.textContent = "Animation length (seconds)";

    const dimInput = document.createElement("input");
    dimInput.type = "number";
    dimInput.min = "0.1";
    dimInput.max = "5";
    dimInput.step = "0.1";
    dimInput.value = this.settings.dimAnimationSeconds.toString();
    dimInput.className = "popup-input";
    dimInput.addEventListener("change", () => {
      const value = parseFloat(dimInput.value);
      if (!isNaN(value) && value > 0) {
        this.settings.dimAnimationSeconds = value;
      }
    });

    dimRow.appendChild(dimLabel);
    dimRow.appendChild(dimInput);

    const dimHelp = document.createElement("div");
    dimHelp.className = "subtle-text";
    dimHelp.textContent =
      "Controls how smooth and long the dim/undim animations feel.";

    dimSection.appendChild(dimRow);
    dimSection.appendChild(dimHelp);

    // Date configuration
    const dateSection = this.section("Date");

    const styleRow = El.create({
      type: "div",
      classes: "popup-row",
      children: []
    });
    const styleLabel = document.createElement("div");
    styleLabel.textContent = "Display";

    const styleControls = El.create({
      type: "div",
      classes: "popup-controls",
      children: []
    });

    const fullChip = this.chip(
      "Full (YYYY)",
      this.settings.dateDisplayStyle === "full",
      () => {
        this.settings.dateDisplayStyle = "full";
      }
    );
    const summaryChip = this.chip(
      "Summary (YY)",
      this.settings.dateDisplayStyle === "summary",
      () => {
        this.settings.dateDisplayStyle = "summary";
      }
    );

    styleControls.appendChild(fullChip);
    styleControls.appendChild(summaryChip);
    styleRow.appendChild(styleLabel);
    styleRow.appendChild(styleControls);

    const formatRow = El.create({
      type: "div",
      classes: "popup-row",
      children: []
    });
    const formatLabel = document.createElement("div");
    formatLabel.textContent = "Format";

    const formatSelect = document.createElement("select");
    formatSelect.className = "popup-input";
    const formats: DateFormat[] = [
      "DD-MM-YYYY",
      "DD.MM.YYYY",
      "DD/MM/YYYY",
      "MM-DD-YYYY",
      "MM.DD.YYYY",
      "MM/DD/YYYY"
    ];
    formats.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      if (f === this.settings.dateFormat) opt.selected = true;
      formatSelect.appendChild(opt);
    });
    formatSelect.addEventListener("change", () => {
      this.settings.dateFormat = formatSelect.value as DateFormat;
    });

    formatRow.appendChild(formatLabel);
    formatRow.appendChild(formatSelect);

    const datePreview = document.createElement("div");
    datePreview.className = "subtle-text";
    const updatePreview = () => {
      datePreview.textContent = `Preview: ${this.formatDate(new Date())}`;
    };
    updatePreview();

    formatSelect.addEventListener("change", updatePreview);

    dateSection.appendChild(styleRow);
    dateSection.appendChild(formatRow);
    dateSection.appendChild(datePreview);

    // Theme
    const themeSection = this.section("Theme");

    const themeRow = El.create({
      type: "div",
      classes: "popup-row",
      children: []
    });
    const themeLabel = document.createElement("div");
    themeLabel.textContent = "Mode";
    const themeControls = El.create({
      type: "div",
      classes: "popup-controls",
      children: []
    });

    const systemChip = this.chip(
      "System",
      this.settings.theme === "system",
      () => {
        this.settings.theme = "system";
        const prefersDark =
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
        this.applyTheme(prefersDark ? "dark" : "light");
      }
    );

    const lightChip = this.chip(
      "Light",
      this.settings.theme === "light",
      () => {
        this.settings.theme = "light";
        this.applyTheme("light");
      }
    );

    const darkChip = this.chip(
      "Dark",
      this.settings.theme === "dark",
      () => {
        this.settings.theme = "dark";
        this.applyTheme("dark");
      }
    );

    themeControls.appendChild(systemChip);
    themeControls.appendChild(lightChip);
    themeControls.appendChild(darkChip);

    themeRow.appendChild(themeLabel);
    themeRow.appendChild(themeControls);

    const colorRow = El.create({
      type: "div",
      classes: "popup-row",
      children: []
    });

    const colorLabel = document.createElement("div");
    colorLabel.textContent = "Styling";

    const colorControls = El.create({
      type: "div",
      classes: "popup-controls",
      children: []
    });

    const bgInput = document.createElement("input");
    bgInput.type = "color";
    bgInput.value = this.settings.customBackgroundColor ?? "#000000";
    bgInput.addEventListener("input", () => {
      this.settings.customBackgroundColor = bgInput.value;
      document.body.style.backgroundColor = bgInput.value;
    });

    const textInput = document.createElement("input");
    textInput.type = "color";
    textInput.value = this.settings.customTextColor ?? "#ffffff";
    textInput.addEventListener("input", () => {
      this.settings.customTextColor = textInput.value;
      document.body.style.color = textInput.value;
    });

    colorControls.appendChild(bgInput);
    colorControls.appendChild(textInput);

    colorRow.appendChild(colorLabel);
    colorRow.appendChild(colorControls);

    const colorHelp = document.createElement("div");
    colorHelp.className = "subtle-text";
    colorHelp.textContent =
      "Choose custom background and text colors. Make sure they stay readable.";

    themeSection.appendChild(themeRow);
    themeSection.appendChild(colorRow);
    themeSection.appendChild(colorHelp);

    body.appendChild(locationSection);
    body.appendChild(dimSection);
    body.appendChild(dateSection);
    body.appendChild(themeSection);
  }

  section(title: string) {
    const wrapper = document.createElement("section");
    const heading = El.create({
      type: "div",
      classes: "popup-section-title",
      children: []
    });
    heading.textContent = title;
    wrapper.appendChild(heading);
    return wrapper;
  }

  chip(label: string, active: boolean, onClick: () => void) {
    const chip = El.create({
      type: "button",
      classes: "chip",
      children: []
    });
    chip.textContent = label;
    chip.dataset.active = active ? "true" : "false";
    chip.addEventListener("click", () => {
      onClick();
      chip.dataset.active = "true";
    });
    return chip;
  }

  /* Location */

  initLocation() {
    if (!("geolocation" in navigator)) {
      this.settings.locationPermission = "denied";
      return;
    }
  }

  requestLocationPermission() {
    if (!("geolocation" in navigator)) {
      this.settings.locationPermission = "denied";
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.settings.locationPermission = "granted";

        const { latitude, longitude } = pos.coords;
        const coordsEl = document.getElementById("location-coordinates");
        if (coordsEl) {
          coordsEl.textContent = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        }

        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const tzEl = document.getElementById("location-timezone");
        if (tzEl) tzEl.textContent = timeZone;

        const continentEl = document.getElementById("location-continent");
        if (continentEl) {
          const continent = timeZone.split("/")[0] ?? "—";
          continentEl.textContent = continent;
        }

        // Approximate city from timezone string second segment if present.
        const cityEl = document.getElementById("location-city");
        if (cityEl) {
          const [, city] = timeZone.split("/");
          cityEl.textContent = city ? city.replace("_", " ") : "—";
        }
      },
      () => {
        this.settings.locationPermission = "denied";
      }
    );
  }

  /* Timer popup */

  buildTimerBody(body: HTMLElement) {
    const section = this.section("Timer");

    const durationLabel = document.createElement("div");
    durationLabel.textContent = "Set duration";

    const columns = El.create({
      type: "div",
      classes: "timer-columns",
      children: []
    });

    const [hoursCol, hoursState] = this.timerColumn("Hours", 0, 23);
    const [minutesCol, minutesState] = this.timerColumn("Minutes", 0, 59);
    const [secondsCol, secondsState] = this.timerColumn("Seconds", 0, 59);

    columns.appendChild(hoursCol);
    columns.appendChild(minutesCol);
    columns.appendChild(secondsCol);

    const titleInput = document.createElement("input");
    titleInput.placeholder = "Timer title";
    titleInput.className = "popup-input";
    titleInput.value = this.timer.title;
    titleInput.addEventListener("input", () => {
      this.timer.title = titleInput.value;
    });

    const stickerLabel = document.createElement("div");
    stickerLabel.textContent = "Sticker";

    const stickers = [
      ["meeting", "📅", "Meeting"],
      ["sleep", "😴", "Sleep"],
      ["exercise", "🏃", "Exercise"],
      ["work", "💼", "Work"],
      ["presentation", "🎤", "Presentation"],
      ["timer", "⏲", "Timer"]
    ] as const;

    const stickerGrid = El.create({
      type: "div",
      classes: "sticker-grid",
      children: []
    });

    stickers.forEach(([key, icon, label]) => {
      const chip = El.create({
        type: "button",
        classes: "sticker-chip",
        children: []
      });
      chip.dataset.sticker = key;
      chip.dataset.active = this.timer.sticker === key ? "true" : "false";

      const iconSpan = document.createElement("span");
      iconSpan.textContent = icon;
      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;

      chip.appendChild(iconSpan);
      chip.appendChild(labelSpan);

      chip.addEventListener("click", () => {
        this.timer.sticker = key;
        Array.from(stickerGrid.querySelectorAll<HTMLButtonElement>(".sticker-chip")).forEach(
          (btn) => {
            btn.dataset.active = btn.dataset.sticker === key ? "true" : "false";
          }
        );
      });

      stickerGrid.appendChild(chip);
    });

    const startButton = El.create({
      type: "button",
      classes: "primary-button",
      children: []
    }) as HTMLButtonElement;
    startButton.textContent = "Start timer";

    const updateStartDisabled = () => {
      const hours = hoursState.value;
      const minutes = minutesState.value;
      const seconds = secondsState.value;
      const duration = (hours * 3600 + minutes * 60 + seconds) * 1000;
      startButton.disabled = duration <= 0;
    };
    updateStartDisabled();

    startButton.addEventListener("click", () => {
      const hours = hoursState.value;
      const minutes = minutesState.value;
      const seconds = secondsState.value;
      const duration = (hours * 3600 + minutes * 60 + seconds) * 1000;

      this.timer.durationMs = duration;
      this.timer.remainingMs = duration;
      this.timer.running = true;
      this.timer.targetTimestamp = Date.now() + duration;
      this.toggleDimModeIfNot();
      this.closePopup();
    });

    section.appendChild(durationLabel);
    section.appendChild(columns);
    section.appendChild(titleInput);
    section.appendChild(stickerLabel);
    section.appendChild(stickerGrid);

    body.appendChild(section);

    const footer = document.querySelector(".popup-footer");
    if (footer) {
      const actionSlot = El.create({
        type: "div",
        children: []
      });
      actionSlot.appendChild(startButton);
      footer.appendChild(actionSlot);
    }
  }

  timerColumn(label: string, min: number, max: number): [HTMLElement, { value: number }] {
    const state = { value: 0 };

    const column = El.create({
      type: "div",
      classes: "timer-column",
      children: []
    });

    const title = document.createElement("div");
    title.className = "subtle-text";
    title.textContent = label;

    const scroll = El.create({
      type: "div",
      classes: "timer-scroll",
      children: []
    });

    for (let i = min; i <= max; i++) {
      const val = El.create({
        type: "div",
        classes: "timer-value",
        children: []
      });
      val.textContent = i.toString().padStart(2, "0");
      val.dataset.value = i.toString();
      val.dataset.active = i === 0 ? "true" : "false";
      val.addEventListener("click", () => {
        state.value = i;
        Array.from(scroll.querySelectorAll<HTMLDivElement>(".timer-value")).forEach((el) => {
          el.dataset.active = el.dataset.value === i.toString() ? "true" : "false";
        });
      });
      scroll.appendChild(val);
    }

    column.appendChild(title);
    column.appendChild(scroll);

    return [column, state];
  }

  updateTimer() {
    if (!this.timer.running || this.timer.targetTimestamp === null) return;

    const remaining = this.timer.targetTimestamp - Date.now();
    this.timer.remainingMs = Math.max(remaining, 0);

    if (this.timer.remainingMs <= 0) {
      this.timer.running = false;
    }
  }

  toggleDimModeIfNot() {
    if (this.ui.mode !== "dim") {
      this.toggleDimMode();
    }
  }

  formatMillis(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  /* Messages popup */

  buildMessagesBody(body: HTMLElement) {
    const section = this.section("Messages");
    const text = document.createElement("p");
    text.textContent = "Coming soon.";
    section.appendChild(text);
    body.appendChild(section);
  }
}

export const app = new App();