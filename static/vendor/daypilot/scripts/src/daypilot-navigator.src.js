/*
DayPilot Lite
Copyright (c) 2005 - 2026 Annpoint s.r.o.
https://www.daypilot.org/
Licensed under Apache Software License 2.0
Version: 2026.2.813-lite
*/
"use strict";
(function (DayPilot) {
    'use strict';
    if (typeof DayPilot.Navigator !== 'undefined' && DayPilot.Navigator.def) {
        return;
    }
    var isReactCmp = DayPilot.Util.isReactComponent;
    var isVueCmp = DayPilot.Util.isVueComponent;
    var isVueVNode = DayPilot.Util.isVueVNode;
    DayPilot.Navigator = function (id, options) {
        this.v = '${v}';
        var calendar = this;
        this.id = id;
        this.api = 2;
        this.isNavigator = true;
        this.autoFocusOnClick = true;
        this.weekStarts = 'Auto';
        this.selectMode = 'Day';
        this.titleHeight = 30;
        this.dayHeaderHeight = 30;
        this.bound = null;
        this.cellWidth = 30;
        this.cellHeight = 30;
        this.cssClassPrefix = "navigator_default";
        this.eventEndSpec = "DateTime";
        this.freeHandSelectionEnabled = false;
        this.selectionStart = new DayPilot.Date().getDatePart();
        this.selectionEnd = null;
        this.selectionDay = null;
        this.showMonths = 1;
        this.skipMonths = 1;
        this.command = "navigate";
        this.year = new DayPilot.Date().getYear();
        this.month = new DayPilot.Date().getMonth() + 1;
        this.showToday = false;
        this.showWeekNumbers = false;
        this.todayHtml = null;
        this.todayHeight = 40;
        this.todayPosition = "Bottom";
        this.todayText = "Today";
        this.weekNumberAlgorithm = 'Auto';
        this.rowsPerMonth = 'Six';
        this.orientation = "Vertical";
        this.locale = "en-us";
        this.rtl = false;
        this.visible = true;
        this.timeRangeSelectedHandling = "Bind";
        this.visibleRangeChangedHandling = "Enabled";
        this.onVisibleRangeChange = null;
        this.onVisibleRangeChanged = null;
        this.onTimeRangeSelect = null;
        this.onTimeRangeSelected = null;
        this.onTodayClick = null;
        this._resolved = {};
        var resolved = this._resolved;
        this._preselection = {};
        var ps = this._preselection;
        this.nav = {};
        this._cache = {};
        this._prepare = function () {
            this.root.dp = this;
            this.root.className = this._prefixCssClass('_main');
            if (this.orientation === "Horizontal") {
                if (!resolved._responsive()) {
                    this.root.style.width = this.showMonths * (resolved.cellWidth() * 7 + this._weekNumberWidth()) + 'px';
                }
                this.root.style.height = (this.cellHeight * 6 + this.titleHeight + this.dayHeaderHeight) + 'px';
            }
            else {
                if (!resolved._responsive()) {
                    this.root.style.width = (resolved.cellWidth() * 7 + this._weekNumberWidth()) + 'px';
                }
            }
            if (this.rtl) {
                this.root.style.direction = "rtl";
            }
            this.root.style.position = "relative";
            if (!this.visible) {
                this.root.style.display = "none";
            }
            var vsph = document.createElement("input");
            vsph.type = 'hidden';
            vsph.name = calendar.id + "_state";
            vsph.id = vsph.name;
            this.root.appendChild(vsph);
            this.state = vsph;
            if (!this.startDate) {
                if (this.selectionDay) {
                    this.startDate = new DayPilot.Date(this.selectionDay).firstDayOfMonth();
                }
                else {
                    this.startDate = DayPilot.Date.fromYearMonthDay(this.year, this.month);
                }
            }
            else {
                this.startDate = new DayPilot.Date(this.startDate).firstDayOfMonth();
            }
            this.calendars = [];
            this.selected = [];
            this.months = [];
        };
        this._api2 = function () {
            return calendar.api === 2;
        };
        this._clearTable = function () {
            this.root.innerHTML = '';
        };
        this._prefixCssClass = function (part) {
            var prefix = this.theme || this.cssClassPrefix;
            if (prefix) {
                return prefix + part;
            }
            else {
                return "";
            }
        };
        this._addClass = function (object, name) {
            var fullName = this._prefixCssClass("_" + name);
            DayPilot.Util.addClass(object, fullName);
        };
        this._removeClass = function (object, name) {
            var fullName = this._prefixCssClass("_" + name);
            DayPilot.Util.removeClass(object, fullName);
        };
        this._cellWidthPct = function () {
            if (!resolved._responsive()) {
                return null;
            }
            var columns = 7;
            if (this.showWeekNumbers) {
                columns++;
            }
            return (100 / columns);
        };
        this._cellWidthPx = function () {
            if (resolved._responsive()) {
                return null;
            }
            return resolved.cellWidth();
        };
        this._cellWidth = function (times) {
            if (typeof times !== 'number') {
                times = 1;
            }
            if (resolved._responsive()) {
                return this._cellWidthPct() * times;
            }
            return this._cellWidthPx() * times;
        };
        this._cellWidthStr = function (times) {
            var unit = resolved._responsive() ? "%" : "px";
            return this._cellWidth(times) + unit;
        };
        this._drawTable = function (j, showLinks) {
            var month = {};
            month.cells = [];
            month.days = [];
            month.weeks = [];
            var startDate = this.startDate.addMonths(j);
            var showBefore = showLinks.before;
            var showAfter = showLinks.after;
            var firstOfMonth = startDate.firstDayOfMonth();
            var first = firstOfMonth.firstDayOfWeek(resolved.weekStarts());
            var last = firstOfMonth.addMonths(1);
            var days = DayPilot.DateUtil.daysDiff(first, last);
            var rowCount = (this.rowsPerMonth === "Auto") ? Math.ceil(days / 7) : 6;
            month.rowCount = rowCount;
            var today = (new DayPilot.Date()).getDatePart();
            var width = resolved.cellWidth() * 7 + this._weekNumberWidth();
            month.width = width;
            var height = this.cellHeight * rowCount + this.titleHeight + this.dayHeaderHeight;
            month.height = height;
            var main = document.createElement("div");
            if (resolved._responsive()) {
                if (this.orientation === "Horizontal") {
                    main.style.width = (100 / calendar.showMonths) + '%';
                }
            }
            else {
                main.style.width = (width) + 'px';
            }
            main.style.height = (height) + 'px';
            if (this.orientation === "Horizontal") {
                main.style.position = "absolute";
                if (resolved._responsive()) {
                    main.style.left = (100 / calendar.showMonths * j) + '%';
                    month.leftPct = (100 / calendar.showMonths * j);
                }
                else {
                    main.style.left = (width * j) + "px";
                }
                main.style.top = "0px";
                month.top = 0;
                month.left = width * j;
            }
            else {
                main.style.position = 'relative';
                var above = j > 0 ? calendar.months[j - 1].top + calendar.months[j - 1].height : 0;
                month.top = above;
                month.left = 0;
                month.leftPct = 0;
            }
            main.className = this._prefixCssClass('_month');
            main.style.cursor = 'default';
            main.style.userSelect = 'none';
            main.style.webkitUserSelect = 'none';
            main.month = month;
            month.div = main;
            this.root.appendChild(main);
            var totalHeaderHeight = this.titleHeight + this.dayHeaderHeight;
            var tl = document.createElement("div");
            tl.style.position = 'absolute';
            tl.style.left = '0px';
            tl.style.right = '0px';
            tl.style.top = '0px';
            tl.style.width = calendar._cellWidthStr();
            tl.style.height = this.titleHeight + 'px';
            tl.style.lineHeight = this.titleHeight + 'px';
            tl.className = this._prefixCssClass('_titleleft');
            if (showLinks.left) {
                tl.style.cursor = 'pointer';
                tl.innerHTML = "<span>&lt;</span>";
                tl.onclick = this._clickLeft;
            }
            main.appendChild(tl);
            var ti = document.createElement("div");
            ti.style.position = 'absolute';
            ti.style.left = calendar._cellWidthStr();
            ti.style.top = '0px';
            ti.style.width = calendar._cellWidthStr(calendar.showWeekNumbers ? 6 : 5);
            ti.style.height = this.titleHeight + 'px';
            ti.style.lineHeight = this.titleHeight + 'px';
            ti.className = this._prefixCssClass('_title');
            ti.innerHTML = resolved.locale().monthNames[startDate.getMonth()] + ' ' + startDate.getYear();
            main.appendChild(ti);
            this.ti = ti;
            var tr = document.createElement("div");
            tr.style.position = 'absolute';
            tr.style.left = calendar._cellWidthStr(calendar.showWeekNumbers ? 7 : 6);
            tr.style.right = calendar._cellWidthStr(calendar.showWeekNumbers ? 7 : 6);
            tr.style.top = '0px';
            tr.style.width = calendar._cellWidthStr();
            tr.style.height = this.titleHeight + 'px';
            tr.style.lineHeight = this.titleHeight + 'px';
            tr.className = this._prefixCssClass('_titleright');
            if (showLinks.right) {
                tr.style.cursor = 'pointer';
                tr.innerHTML = "<span>&gt;</span>";
                tr.onclick = this._clickRight;
            }
            main.appendChild(tr);
            this.tr = tr;
            var xOffsetIndex = calendar.showWeekNumbers ? 1 : 0;
            if (this.showWeekNumbers) {
                for (var y = 0; y < rowCount; y++) {
                    var day = first.addDays(y * 7);
                    var weekNumber = null;
                    switch (this.weekNumberAlgorithm) {
                        case "Auto":
                            weekNumber = (resolved.weekStarts() === 1) ? day.weekNumberISO() : day.weekNumber();
                            break;
                        case "US":
                            weekNumber = day.weekNumber();
                            break;
                        case "ISO8601":
                            weekNumber = day.weekNumberISO();
                            break;
                        default:
                            throw "Unknown weekNumberAlgorithm value.";
                    }
                    var dh = document.createElement("div");
                    dh.style.position = 'absolute';
                    dh.style.left = (0) + 'px';
                    dh.style.right = (0) + 'px';
                    dh.style.top = (y * this.cellHeight + totalHeaderHeight) + 'px';
                    dh.style.width = calendar._cellWidthStr();
                    dh.style.height = this.cellHeight + 'px';
                    dh.style.lineHeight = this.cellHeight + 'px';
                    dh.className = this._prefixCssClass('_weeknumber');
                    dh.innerHTML = "<span>" + weekNumber + "</span>";
                    main.appendChild(dh);
                    month.weeks.push(dh);
                }
            }
            if (calendar.showWeekNumbers) {
                var dh = document.createElement("div");
                dh.style.position = 'absolute';
                dh.style.left = (0) + 'px';
                dh.style.right = (0) + 'px';
                dh.style.top = this.titleHeight + "px";
                dh.style.width = calendar._cellWidthStr();
                dh.style.height = this.dayHeaderHeight + "px";
                dh.className = this._prefixCssClass('_dayheader');
                main.appendChild(dh);
            }
            for (var x = 0; x < 7; x++) {
                month.cells[x] = [];
                var dh = document.createElement("div");
                dh.style.position = 'absolute';
                dh.style.left = calendar._cellWidthStr(x + xOffsetIndex);
                dh.style.right = calendar._cellWidthStr(x + xOffsetIndex);
                dh.style.top = this.titleHeight + 'px';
                dh.style.width = calendar._cellWidthStr();
                dh.style.height = this.dayHeaderHeight + 'px';
                dh.style.lineHeight = this.dayHeaderHeight + 'px';
                dh.className = this._prefixCssClass('_dayheader');
                dh.innerHTML = "<span>" + this._getDayName(x) + "</span>";
                main.appendChild(dh);
                month.days.push(dh);
                var _loop_1 = function (y) {
                    var day = first.addDays(y * 7 + x);
                    var isSelected = this_1._isSelected(day) && this_1._selectModeLowerCase() !== 'none';
                    var isCurrentMonth = day.firstDayOfMonth() === startDate;
                    var isPrevMonth = day < startDate;
                    var isNextMonth = day >= startDate.addMonths(1);
                    if (this_1._selectModeLowerCase() === "month") {
                        isSelected = isSelected && isCurrentMonth;
                    }
                    else if (this_1._selectModeLowerCase() === "day") {
                        isSelected = isSelected && (isCurrentMonth || (showBefore && isPrevMonth) || (showAfter && isNextMonth));
                    }
                    else if (this_1._selectModeLowerCase() === "week") {
                        var isSelectionCurrentMonth = day.firstDayOfMonth() === startDate;
                        isSelected = isSelected && (isSelectionCurrentMonth || (showBefore && isPrevMonth) || (showAfter && isNextMonth));
                    }
                    var dc = document.createElement("div");
                    month.cells[x][y] = dc;
                    var cellPos = calendar._cellRelativeCoords(x, y);
                    var left = cellPos.x;
                    var top_1 = cellPos.y;
                    var widthUnit = resolved._responsive() ? "%" : "px";
                    dc.day = day;
                    dc.x = x;
                    dc.y = y;
                    dc.left = left;
                    dc.top = top_1;
                    dc.isCurrentMonth = isCurrentMonth;
                    dc.isNextMonth = isNextMonth;
                    dc.isPrevMonth = isPrevMonth;
                    dc.showBefore = showBefore;
                    dc.showAfter = showAfter;
                    dc.className = this_1._prefixCssClass((isCurrentMonth ? '_day' : '_dayother'));
                    calendar._addClass(dc, "cell");
                    if (day.getTime() === today.getTime() && isCurrentMonth) {
                        this_1._addClass(dc, 'today');
                    }
                    if (day.dayOfWeek() === 0 || day.dayOfWeek() === 6) {
                        this_1._addClass(dc, 'weekend');
                    }
                    dc.style.position = 'absolute';
                    dc.style.left = (left) + widthUnit;
                    dc.style.right = (left) + widthUnit;
                    dc.style.top = (top_1) + 'px';
                    dc.style.width = calendar._cellWidthStr();
                    dc.style.height = this_1.cellHeight + 'px';
                    dc.style.lineHeight = this_1.cellHeight + 'px';
                    var inner = document.createElement("div");
                    inner.style.position = 'absolute';
                    inner.className = (day.getTime() === today.getTime() && isCurrentMonth) ? this_1._prefixCssClass('_todaybox') : this_1._prefixCssClass('_daybox');
                    calendar._addClass(inner, "cell_box");
                    inner.style.left = '0px';
                    inner.style.top = '0px';
                    inner.style.right = '0px';
                    inner.style.bottom = '0px';
                    dc.appendChild(inner);
                    var cell = null;
                    if (this_1.cells && this_1.cells[day.toStringSortable()]) {
                        cell = this_1.cells[day.toStringSortable()];
                    }
                    var cellInfo = cell || {};
                    cellInfo.day = day;
                    cellInfo.isCurrentMonth = isCurrentMonth;
                    cellInfo.isToday = day.getTime() === today.getTime() && isCurrentMonth;
                    cellInfo.isWeekend = day.dayOfWeek() === 0 || day.dayOfWeek() === 6;
                    if (cell) {
                        cellInfo.html = cell.html || day.getDay();
                        cellInfo.cssClass = cell.css;
                    }
                    else {
                        cellInfo.html = day.getDay();
                        cellInfo.cssClass = null;
                    }
                    cellInfo.events = {
                        all: function () {
                            var _a;
                            return ((_a = calendar.items) === null || _a === void 0 ? void 0 : _a[day.toStringSortable()]) || [];
                        },
                    };
                    if (typeof calendar.onBeforeCellRender === "function") {
                        var args = {};
                        args.cell = cellInfo;
                        calendar.onBeforeCellRender(args);
                        cell = args.cell;
                    }
                    if (cell) {
                        DayPilot.Util.addClass(dc, cell.cssClass || cell.css);
                    }
                    if (isCurrentMonth || (showBefore && isPrevMonth) || (showAfter && isNextMonth)) {
                        var text = document.createElement("div");
                        text.innerHTML = day.getDay();
                        text.style.position = "absolute";
                        text.style.left = '0px';
                        text.style.top = '0px';
                        text.style.right = '0px';
                        text.style.bottom = '0px';
                        calendar._addClass(text, "cell_text");
                        dc.isClickable = true;
                        if (cell && cell.html) {
                            text.innerHTML = cell.html;
                        }
                        dc.appendChild(text);
                    }
                    dc.onclick = this_1._cellClick;
                    (function domAdd() {
                        if (typeof calendar.onBeforeCellDomAdd !== "function" && typeof calendar.onBeforeCellDomRemove !== "function") {
                            return;
                        }
                        var args = {};
                        args.control = calendar;
                        args.cell = cellInfo;
                        args.element = null;
                        dc.domArgs = args;
                        if (typeof calendar.onBeforeCellDomAdd === "function") {
                            calendar.onBeforeCellDomAdd(args);
                        }
                        if (args.element) {
                            var target = inner;
                            if (target) {
                                args._targetElement = target;
                                var isReactComponent = isReactCmp(args.element);
                                var isVueComponent = isVueCmp(args.element);
                                var isVueNode = isVueVNode(args.element);
                                if (isReactComponent) {
                                    if (!calendar._react.reactDOM) {
                                        throw new DayPilot.Exception("Can't reach ReactDOM");
                                    }
                                    calendar._react._render(args.element, target);
                                }
                                else if (isVueComponent) {
                                    if (!calendar._vue._vueImport) {
                                        throw new DayPilot.Exception("Can't reach Vue");
                                    }
                                    calendar._vue._renderingEvent = true;
                                    calendar._vue._renderVueComponent(args.element, target, args.props);
                                    calendar._vue._renderingEvent = false;
                                }
                                else if (isVueNode) {
                                    if (!calendar._vue._vueImport) {
                                        throw new DayPilot.Exception("Can't reach Vue");
                                    }
                                    calendar._vue._renderingEvent = true;
                                    calendar._vue._renderVueNode(args.element, target);
                                    calendar._vue._renderingEvent = false;
                                }
                                else {
                                    target.appendChild(args.element);
                                }
                            }
                        }
                    })();
                    main.appendChild(dc);
                    if (isSelected) {
                        calendar._cellSelect(main, x, y);
                        this_1.selected.push(dc);
                    }
                };
                var this_1 = this;
                for (var y = 0; y < rowCount; y++) {
                    _loop_1(y);
                }
            }
            var line = document.createElement("div");
            line.style.position = 'absolute';
            line.style.left = '0px';
            line.style.top = (totalHeaderHeight - 2) + 'px';
            line.style.width = calendar._cellWidthStr(7 + xOffsetIndex);
            line.style.height = '1px';
            line.style.fontSize = '1px';
            line.style.lineHeight = '1px';
            line.className = this._prefixCssClass("_line");
            main.appendChild(line);
            this.months.push(month);
        };
        this._cellRelativeCoords = function (x, y) {
            var totalHeaderHeight = this.titleHeight + this.dayHeaderHeight;
            var xOffsetIndex = this.showWeekNumbers ? 1 : 0;
            var left = calendar._cellWidth(x + xOffsetIndex);
            var top = y * this.cellHeight + totalHeaderHeight;
            return {
                "x": left,
                "y": top
            };
        };
        this._cellSelect = function (main, x, y) {
            var div = main.month.cells[x][y];
            calendar._addClass(div, 'select');
        };
        this._cellUnselect = function (main, x, y) {
            var div = main.month.cells[x][y];
            calendar._removeClass(div, 'select');
        };
        this._weekNumberWidth = function () {
            if (this.showWeekNumbers) {
                return resolved.cellWidth();
            }
            return 0;
        };
        this._updateFreeBusy = function () {
            var _a;
            if (!this.items) {
                return;
            }
            for (var j = 0; j < this.showMonths; j++) {
                for (var x = 0; x < 7; x++) {
                    for (var y = 0; y < 6; y++) {
                        var cell = this.months[j].cells[x][y];
                        if (!cell) {
                            continue;
                        }
                        if (((_a = this.items[cell.day.toStringSortable()]) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                            this._addClass(cell, 'busy');
                            this._removeClass(cell, 'free');
                        }
                        else {
                            this._removeClass(cell, 'busy');
                            this._addClass(cell, 'free');
                        }
                    }
                }
            }
        };
        this._saveState = function () {
            var s = {};
            s.startDate = calendar.startDate;
            s.selectionStart = calendar.selectionStart;
            s.selectionEnd = calendar.selectionEnd.addDays(1);
            calendar.state.value = JSON.stringify(s);
        };
        this._selectModeLowerCase = function () {
            var selectMode = this.selectMode || "";
            return selectMode.toLowerCase();
        };
        this._adjustSelection = function () {
            var input = this.selectionDay || this.selectionStart;
            if (!input) {
                input = DayPilot.Date.today();
            }
            input = new DayPilot.Date(input);
            switch (this._selectModeLowerCase()) {
                case 'day':
                    this.selectionStart = input;
                    this.selectionDay = input;
                    this.selectionEnd = input;
                    break;
                case 'week':
                    this.selectionDay = input;
                    this.selectionStart = input.firstDayOfWeek(resolved.weekStarts());
                    this.selectionEnd = this.selectionStart.addDays(6);
                    break;
                case 'month':
                    this.selectionDay = input;
                    this.selectionStart = input.firstDayOfMonth();
                    this.selectionEnd = this.selectionStart.lastDayOfMonth();
                    break;
                case 'none':
                    this.selectionEnd = input;
                    break;
                default:
                    throw "Unknown selectMode value.";
            }
        };
        this._postponedSelect = null;
        this.select = function (a1, a2, a3) {
            if (!a1) {
                return;
            }
            if (this._disposed) {
                return;
            }
            var a2IsDate = a2 && (a2 instanceof DayPilot.Date || typeof a2 === "string");
            var a2IsOptions = (a2 && typeof a2 === "object" && !a2IsDate) || (typeof a2 === "boolean");
            var date1 = a1;
            var date2 = a2IsDate ? a2 : null;
            var options = a2IsOptions ? a2 : a3;
            if (!this._initialized) {
                this._postponedSelect = {
                    "date1": date1,
                    "date2": date2,
                    "options": options
                };
                return;
            }
            var focus = true;
            var notify = true;
            if (options && typeof options === "object") {
                if (options.dontFocus) {
                    focus = false;
                }
                if (options.dontNotify) {
                    notify = false;
                }
            }
            else if (typeof options === "boolean") {
                focus = !options;
            }
            var originalStart = this.selectionStart;
            var originalEnd = this.selectionEnd;
            this.selectionStart = new DayPilot.Date(date1).getDatePart();
            this.selectionDay = this.selectionStart;
            var startChanged = false;
            if (focus) {
                var newStart = this.startDate;
                if (this.selectionStart < this._activeStart() || this.selectionStart >= this._activeEnd()) {
                    newStart = this.selectionStart.firstDayOfMonth();
                }
                if (newStart.toStringSortable() !== this.startDate.toStringSortable()) {
                    startChanged = true;
                }
                this.startDate = newStart;
            }
            if (date2 && calendar.freeHandSelectionEnabled) {
                calendar.selectionEnd = new DayPilot.Date(date2);
            }
            else {
                this._adjustSelection();
            }
            this._clearTable();
            this._prepare();
            this._drawMonths();
            this._updateFreeBusy();
            this._saveState();
            if (notify && (!originalStart.equals(this.selectionStart) || !originalEnd.equals(this.selectionEnd))) {
                this._timeRangeSelectedDispatch();
            }
            if (startChanged) {
                this._visibleRangeChangedDispatch();
            }
        };
        this.update = function (options) {
            calendar._updateWithOptions(options);
        };
        this._updateWithOptions = function (options) {
            calendar._loadOptions(options);
            if (!this._initialized) {
                return;
            }
            if (calendar._disposed) {
                throw new DayPilot.Exception("You are trying to update a DayPilot.Navigator instance that has been disposed.");
            }
            calendar._clearCache();
            var os = {
                "day": calendar.selectionDay,
                "start": calendar.selectionStart,
                "end": calendar.selectionEnd
            };
            calendar._update();
            if (os.start !== calendar.selectionStart || os.end !== calendar.selectionEnd || os.day !== calendar.selectionDay) {
                calendar._timeRangeSelectedDispatch();
            }
        };
        this._update = function () {
            this._clearTable();
            this._prepare();
            this._loadEvents();
            this._adjustSelection();
            this._drawMonths();
            this._updateFreeBusy();
            this._saveState();
            if (this.visible) {
                this.show();
            }
            else {
                this.hide();
            }
        };
        this._clearCache = function () {
            calendar._cache = {};
        };
        this._specialHandling = null;
        this._loadOptions = function (options) {
            if (!options) {
                return;
            }
            var specialHandling = {
                "events": {
                    "preInit": function () {
                        var events = this.data;
                        if (!events) {
                            return;
                        }
                        if (DayPilot.isArray(events.list)) {
                            calendar.events.list = events.list;
                        }
                        else {
                            calendar.events.list = events;
                        }
                    }
                }
            };
            this._specialHandling = specialHandling;
            for (var name_1 in options) {
                if (specialHandling[name_1]) {
                    var item = specialHandling[name_1];
                    item.data = options[name_1];
                    if (item.preInit) {
                        item.preInit();
                    }
                }
                else {
                    calendar[name_1] = options[name_1];
                }
            }
        };
        this._postInit = function () {
            var specialHandling = this._specialHandling;
            for (var name_2 in specialHandling) {
                var item = specialHandling[name_2];
                if (item.postInit) {
                    item.postInit();
                }
            }
        };
        this._callBack2 = function (action, data, parameters) {
            var envelope = {};
            envelope.action = action;
            envelope.parameters = parameters;
            envelope.data = data;
            envelope.header = this._getCallBackHeader();
            var commandstring = "JSON" + JSON.stringify(envelope);
            var context = null;
            if (this.backendUrl) {
                DayPilot.request(this.backendUrl, this._callBackResponse, commandstring, this._ajaxError);
            }
            else {
                WebForm_DoCallback(this.uniqueID, commandstring, this._updateView, context, this.callbackError, true);
            }
        };
        this._ajaxError = function (req) {
            if (typeof calendar.onAjaxError === 'function') {
                var args = {};
                args.request = req;
                calendar.onAjaxError(args);
            }
            else if (typeof calendar.ajaxError === 'function') {
                calendar.ajaxError(req);
            }
        };
        this._callBackResponse = function (response) {
            calendar._updateView(response.responseText);
        };
        this._postBack2 = function (action, data, parameters) {
            var envelope = {};
            envelope.action = action;
            envelope.parameters = parameters;
            envelope.data = data;
            envelope.header = this._getCallBackHeader();
            var commandstring = "JSON" + JSON.stringify(envelope);
            __doPostBack(calendar.uniqueID, commandstring);
        };
        this._getCallBackHeader = function () {
            var h = {};
            h.v = this.v;
            h.startDate = this.startDate;
            h.selectionStart = this.selectionStart;
            h.showMonths = this.showMonths;
            return h;
        };
        this._getDayName = function (i) {
            var x = i + resolved.weekStarts();
            if (x > 6) {
                x -= 7;
            }
            return resolved.locale().dayNamesShort[x];
        };
        this._isSelected = function (date) {
            if (this.selectionStart === null || this.selectionEnd === null) {
                return false;
            }
            if (this.selectionStart.getTime() <= date.getTime() && date.getTime() <= this.selectionEnd.getTime()) {
                return true;
            }
            return false;
        };
        this._getMonthFromCoords = function (coords) {
            for (var i = 0; i < calendar.months.length; i++) {
                var m = calendar.months[i];
                if (!m) {
                    return null;
                }
                if (coords.x < m.left) {
                    return null;
                }
                if (m.left + m.width < coords.x) {
                    continue;
                }
                if (m.top <= coords.y && coords.y < m.top + m.height) {
                    return i;
                }
            }
            return null;
        };
        this._recalcWidths = function () {
            if (!resolved._responsive()) {
                calendar._dynamicCellWidth = calendar.cellWidth;
                return;
            }
            var firstCell = calendar.months[0].cells[0][0];
            var cellWidth = firstCell.clientWidth;
            calendar._dynamicCellWidth = cellWidth;
            var months = calendar.months;
            months.forEach(function (m) {
                m.width = m.div.clientWidth;
                if (calendar.orientation === "Horizontal") {
                    m.left = m.div.offsetLeft;
                }
                m.cells.forEach(function (column, x) {
                    column.forEach(function (cell) {
                        cell.width = cellWidth;
                        cell.left = x * cellWidth;
                    });
                });
            });
        };
        this._getPosition = function (ev) {
            calendar._recalcWidths();
            var coords = DayPilot.mo3(calendar.nav.top, ev);
            var monthIndex = calendar._getMonthFromCoords(coords);
            if (monthIndex === null) {
                return null;
            }
            var month = calendar.months[monthIndex];
            var totalHeaderHeight = this.titleHeight + this.dayHeaderHeight;
            if (month.top <= coords.y && coords.y < month.top + totalHeaderHeight) {
                return {
                    "month": monthIndex,
                    "x": 0,
                    "y": 0,
                    "coords": coords,
                    "header": true
                };
            }
            for (var x = 0; x < month.cells.length; x++) {
                for (var y = 0; y < month.cells[x].length; y++) {
                    var cell = month.cells[x][y];
                    var top_2 = cell.top + month.top;
                    var left = cell.left + month.left;
                    if (left <= coords.x && coords.x < left + calendar._dynamicCellWidth) {
                        if (top_2 <= coords.y && coords.y < top_2 + calendar.cellHeight) {
                            return {
                                "month": monthIndex,
                                "x": x,
                                "y": y,
                                "coords": coords
                            };
                        }
                    }
                }
            }
            return null;
        };
        this._onTopMouseDown = function (ev) {
            var freeHandSelection = calendar.freeHandSelectionEnabled;
            if (!freeHandSelection) {
                return;
            }
            var start = calendar._getPosition(ev);
            if (start && !start.header) {
                ps.start = start;
            }
            ev.preventDefault();
        };
        this._onTopMouseMove = function (ev) {
            if (!ps.start) {
                return;
            }
            var end = calendar._getPosition(ev);
            if (ps.end) {
                ps.end = end;
            }
            else if (end) {
                var requiredDistance = 3;
                var distance = DayPilot.distance(ps.start.coords, end.coords);
                if (distance > requiredDistance) {
                    ps.end = end;
                }
            }
            if (ps.end) {
                ps.clear();
                ps.draw();
            }
        };
        ps.start = null;
        ps.drawCell = function (pos) {
            var month = calendar.months[pos.month];
            var cellPos = calendar._cellRelativeCoords(pos.x, pos.y);
            var top = month.top + cellPos.y;
            var left = month.left + cellPos.x;
            var wUnit = "px";
            var width = calendar._cellWidthStr();
            if (resolved._responsive()) {
                var horizontally = calendar.orientation === "Horizontal" ? calendar.showMonths : 1;
                left = month.leftPct + cellPos.x / horizontally;
                wUnit = "%";
                width = calendar._cellWidthStr(1 / horizontally);
            }
            var div = document.createElement("div");
            div.style.position = "absolute";
            div.style.left = left + wUnit;
            div.style.top = top + "px";
            div.style.height = calendar.cellHeight + "px";
            div.style.width = width;
            div.style.backgroundColor = "#ccc";
            div.style.opacity = 0.5;
            div.style.cursor = "default";
            calendar.nav.preselection.appendChild(div);
            ps.cells.push(div);
        };
        ps.clear = function () {
            if (!ps.cells) {
                return;
            }
            for (var i = 0; i < ps.cells.length; i++) {
                calendar.nav.preselection.removeChild(ps.cells[i]);
            }
            ps.cells = [];
        };
        ps.draw = function () {
            var ordered = ps.ordered();
            var position = new Position(ordered.start);
            var end = ordered.end;
            if (!end) {
                return;
            }
            if (end === ps.end && end.header) {
                if (end.month > 0) {
                    end.month -= 1;
                    var month = calendar.months[end.month];
                    end.x = 6;
                    end.y = month.rowCount - 1;
                }
            }
            ps.cells = [];
            while (!position.is(end)) {
                if (position.visible()) {
                    ps.drawCell(position);
                }
                var next = new Position(position).next();
                if (!next) {
                    return;
                }
                position.month = next.month;
                position.x = next.x;
                position.y = next.y;
            }
            if (position.visible()) {
                ps.drawCell(position);
            }
        };
        ps.ordered = function () {
            var start = ps.start;
            var end = ps.end;
            var result = {};
            if (!end || new Position(start).before(end)) {
                result.start = start;
                result.end = end;
            }
            else {
                result.start = end;
                result.end = start;
            }
            return result;
        };
        function Position(month, x, y) {
            var self = this;
            if (month instanceof Position) {
                return month;
            }
            if (typeof month === "object") {
                var ref = month;
                this.month = ref.month;
                this.x = ref.x;
                this.y = ref.y;
            }
            else {
                this.month = month;
                this.x = x;
                this.y = y;
            }
            this.is = function (ref) {
                return this.month === ref.month && this.x === ref.x && this.y === ref.y;
            };
            this.next = function () {
                var start = self;
                if (start.x < 6) {
                    return {
                        "month": start.month,
                        "x": start.x + 1,
                        "y": start.y
                    };
                }
                var month = calendar.months[start.month];
                if (start.y < month.rowCount - 1) {
                    return {
                        "month": start.month,
                        "x": 0,
                        "y": start.y + 1
                    };
                }
                if (start.month < calendar.months.length - 1) {
                    return {
                        "month": start.month + 1,
                        "x": 0,
                        "y": 0
                    };
                }
                return null;
            };
            this.visible = function () {
                var cell = this.cell();
                if (cell.isCurrentMonth) {
                    return true;
                }
                if (cell.isPrevMonth && cell.showBefore) {
                    return true;
                }
                if (cell.isNextMonth && cell.showAfter) {
                    return true;
                }
                return false;
            };
            this.nextVisible = function () {
                var pos = self;
                while (!pos.visible()) {
                    var next = pos.next();
                    if (!next) {
                        return null;
                    }
                    pos = new Position(next);
                }
                return pos;
            };
            this.previous = function () {
                var start = self;
                if (start.x > 0) {
                    return {
                        "month": start.month,
                        "x": start.x - 1,
                        "y": start.y
                    };
                }
                if (start.y > 0) {
                    return {
                        "month": start.month,
                        "x": 6,
                        "y": start.y - 1
                    };
                }
                if (start.month > 0) {
                    var m = calendar.months[start.month - 1];
                    return {
                        "month": start.month - 1,
                        "x": 6,
                        "y": m.rowCount - 1
                    };
                }
                return null;
            };
            this.previousVisible = function () {
                var pos = self;
                while (!pos.visible()) {
                    var previous = pos.previous();
                    if (!previous) {
                        return null;
                    }
                    pos = new Position(previous);
                }
                return pos;
            };
            this.cell = function () {
                return calendar.months[this.month].cells[this.x][this.y];
            };
            this.date = function () {
                return this.cell().day;
            };
            this.before = function (ref) {
                var thisDate = this.date();
                var refDate = new Position(ref).date();
                return thisDate < refDate;
            };
        }
        this._cellClick = function (ev) {
            var div = ev.currentTarget;
            var main = div.parentNode;
            var month = div.parentNode.month;
            var x = div.x;
            var y = div.y;
            var day = month.cells[x][y].day;
            if (!month.cells[x][y].isClickable) {
                return;
            }
            calendar.clearSelection();
            calendar.selectionDay = day;
            switch (calendar._selectModeLowerCase()) {
                case 'none':
                    calendar.selectionStart = day;
                    calendar.selectionEnd = day;
                    break;
                case 'day': {
                    if (calendar.autoFocusOnClick) {
                        if (day < calendar._activeStart() ||
                            day >= calendar._activeEnd()) {
                            calendar.select(day);
                            return;
                        }
                    }
                    var s = month.cells[x][y];
                    calendar._cellSelect(main, x, y);
                    calendar.selected.push(s);
                    calendar.selectionStart = s.day;
                    calendar.selectionEnd = s.day;
                    break;
                }
                case 'week':
                    if (calendar.autoFocusOnClick) {
                        var start = month.cells[0][y].day;
                        var end = month.cells[6][y].day;
                        if (start.firstDayOfMonth() === end.firstDayOfMonth()) {
                            if (start < calendar._activeStart() ||
                                end >= calendar._activeEnd()) {
                                calendar.select(day);
                                return;
                            }
                        }
                    }
                    for (var j = 0; j < 7; j++) {
                        calendar._cellSelect(main, j, y);
                        calendar.selected.push(month.cells[j][y]);
                    }
                    calendar.selectionStart = month.cells[0][y].day;
                    calendar.selectionEnd = month.cells[6][y].day;
                    break;
                case 'month': {
                    if (calendar.autoFocusOnClick) {
                        if (day < calendar._activeStart() ||
                            day >= calendar._activeEnd()) {
                            calendar.select(day);
                            return;
                        }
                    }
                    var start = null;
                    var end = null;
                    for (var y_1 = 0; y_1 < 6; y_1++) {
                        for (var x_1 = 0; x_1 < 7; x_1++) {
                            var s = month.cells[x_1][y_1];
                            if (!s) {
                                continue;
                            }
                            if (s.day.getYear() === day.getYear() && s.day.getMonth() === day.getMonth()) {
                                calendar._cellSelect(main, x_1, y_1);
                                calendar.selected.push(s);
                                if (start === null) {
                                    start = s.day;
                                }
                                end = s.day;
                            }
                        }
                    }
                    calendar.selectionStart = start;
                    calendar.selectionEnd = end;
                    break;
                }
                default:
                    throw 'unknown selectMode';
            }
            calendar._saveState();
            calendar._timeRangeSelectedDispatch();
        };
        this._timeRangeSelectedDispatch = function (options) {
            var start = calendar.selectionStart;
            var end = calendar.selectionEnd.addDays(1);
            var days = DayPilot.DateUtil.daysDiff(start, end);
            var day = calendar.selectionDay;
            options = options || {};
            if (calendar._api2()) {
                var args = {};
                args.start = start;
                args.end = end;
                args.day = day;
                args.days = days;
                args.mode = options.mode || calendar.selectMode;
                args.preventDefault = function () {
                    this.preventDefault.value = true;
                };
                if (typeof calendar.onTimeRangeSelect === 'function') {
                    calendar.onTimeRangeSelect(args);
                    if (args.preventDefault.value) {
                        return;
                    }
                }
                switch (calendar.timeRangeSelectedHandling) {
                    case 'Bind': {
                        var bound = calendar.bound;
                        if (bound && typeof bound === "object") {
                            var selection = {};
                            selection.start = start;
                            selection.end = end;
                            selection.days = days;
                            selection.day = day;
                            bound.commandCallBack(calendar.command, selection);
                        }
                        break;
                    }
                    case 'None':
                        break;
                    case 'PostBack':
                        calendar.timeRangeSelectedPostBack(start, end, day);
                        break;
                }
                if (typeof calendar.onTimeRangeSelected === 'function') {
                    calendar.onTimeRangeSelected(args);
                }
            }
            else {
                switch (calendar.timeRangeSelectedHandling) {
                    case 'Bind': {
                        var bound = calendar.bound;
                        if (bound && typeof bound === "object") {
                            var selection = {};
                            selection.start = start;
                            selection.end = end;
                            selection.days = days;
                            selection.day = day;
                            bound.commandCallBack(calendar.command, selection);
                        }
                        break;
                    }
                    case 'JavaScript':
                        calendar.onTimeRangeSelected(start, end, day);
                        break;
                    case 'None':
                        break;
                    case 'PostBack':
                        calendar.timeRangeSelectedPostBack(start, end, day);
                        break;
                }
            }
        };
        this.timeRangeSelectedPostBack = function (start, end, data, day) {
            var params = {};
            params.start = start;
            params.end = end;
            params.day = day;
            this._postBack2('TimeRangeSelected', data, params);
        };
        this._clickRight = function () {
            calendar._moveMonth(calendar.skipMonths);
        };
        this._clickLeft = function () {
            calendar._moveMonth(-calendar.skipMonths);
        };
        this._moveMonth = function (i) {
            this.startDate = this.startDate.addMonths(i);
            this._clearTable();
            this._prepare();
            this._drawMonths();
            this._saveState();
            this._visibleRangeChangedDispatch();
            this._updateFreeBusy();
        };
        this._activeStart = function () {
            return calendar.startDate.firstDayOfMonth();
        };
        this._activeEnd = function () {
            return calendar.startDate.firstDayOfMonth().addMonths(this.showMonths);
        };
        this.visibleStart = function () {
            return calendar.startDate.firstDayOfMonth().firstDayOfWeek(resolved.weekStarts());
        };
        this.visibleEnd = function () {
            return calendar.startDate.firstDayOfMonth().addMonths(this.showMonths - 1).firstDayOfWeek(resolved.weekStarts()).addDays(42);
        };
        this._visibleRangeChangedDispatch = function () {
            var start = this.visibleStart();
            var end = this.visibleEnd();
            if (calendar._api2()) {
                var args = {};
                args.start = start;
                args.end = end;
                args.preventDefault = function () {
                    this.preventDefault.value = true;
                };
                if (typeof calendar.onVisibleRangeChange === 'function') {
                    calendar.onVisibleRangeChange(args);
                    if (args.preventDefault.value) {
                        return;
                    }
                }
                switch (this.visibleRangeChangedHandling) {
                    case "CallBack":
                        this.visibleRangeChangedCallBack(null);
                        break;
                    case "PostBack":
                        this.visibleRangeChangedPostBack(null);
                        break;
                    case "Disabled":
                        break;
                }
                if (typeof calendar.onVisibleRangeChanged === 'function') {
                    calendar.onVisibleRangeChanged(args);
                }
            }
            else {
                switch (this.visibleRangeChangedHandling) {
                    case "CallBack":
                        this.visibleRangeChangedCallBack(null);
                        break;
                    case "PostBack":
                        this.visibleRangeChangedPostBack(null);
                        break;
                    case "JavaScript":
                        this.onVisibleRangeChanged(start, end);
                        break;
                    case "Disabled":
                        break;
                }
            }
        };
        this.visibleRangeChangedCallBack = function (data) {
            var parameters = {};
            this._callBack2("Visible", data, parameters);
        };
        this.visibleRangeChangedPostBack = function (data) {
            var parameters = {};
            this._postBack2("Visible", data, parameters);
        };
        this._updateView = function (json) {
            var result = JSON.parse(json);
            calendar.items = result.Items;
            calendar.cells = result.Cells;
            if (calendar.cells) {
                calendar.update();
            }
            else {
                calendar._updateFreeBusy();
            }
        };
        this._drawMonths = function () {
            if (this.showToday && this.todayPosition === "Top") {
                this._drawToday();
            }
            for (var j = 0; j < this.showMonths; j++) {
                var showLinks = this._getShowLinks(j);
                this._drawTable(j, showLinks);
            }
            if (this.showToday && this.todayPosition === "Bottom") {
                this._drawToday();
            }
            this.root.style.height = this._getHeight() + "px";
            this.nav.preselection = document.createElement("div");
            this.nav.preselection.style.position = "absolute";
            this.nav.preselection.style.left = "0px";
            this.nav.preselection.style.right = "0px";
            this.nav.preselection.style.top = "0px";
            this.root.appendChild(this.nav.preselection);
        };
        this._drawToday = function () {
            if (this.showToday) {
                var todaySpan = document.createElement("span");
                todaySpan.className = this._prefixCssClass("_todaysection_button");
                if (this.todayHtml) {
                    todaySpan.innerHTML = this.todayHtml;
                }
                else {
                    todaySpan.innerText = this.todayText;
                }
                todaySpan.onclick = function () {
                    if (typeof calendar.onTodayClick === "function") {
                        var args = {};
                        args.preventDefault = function () {
                            this.preventDefault.value = true;
                        };
                        calendar.onTodayClick(args);
                        if (args.preventDefault.value) {
                            return;
                        }
                    }
                    calendar.select(DayPilot.Date.today());
                };
                var todayDiv = document.createElement("div");
                todayDiv.style.height = this.todayHeight + "px";
                todayDiv.className = this._prefixCssClass("_todaysection");
                todayDiv.appendChild(todaySpan);
                this.root.appendChild(todayDiv);
            }
        };
        this._getHeight = function () {
            var total = 0;
            if (this.showToday) {
                total += this.todayHeight;
            }
            if (this.orientation === "Horizontal") {
                for (var i = 0; i < this.months.length; i++) {
                    var month = this.months[i];
                    if (month.height > total) {
                        total = month.height;
                    }
                }
                return total;
            }
            else {
                for (var i = 0; i < this.months.length; i++) {
                    var month = this.months[i];
                    total += month.height;
                }
                return total;
            }
        };
        this._getShowLinks = function (j) {
            if (this.internal.showLinks) {
                return this.internal.showLinks;
            }
            var showLinks = {};
            showLinks.left = (j === 0);
            showLinks.right = (j === 0);
            showLinks.before = j === 0;
            showLinks.after = j === this.showMonths - 1;
            if (this.orientation === "Horizontal") {
                showLinks.right = (j === this.showMonths - 1);
            }
            return showLinks;
        };
        this._angular = {};
        this._angular.scope = null;
        this._angular.notify = function () {
            if (calendar._angular.scope) {
                calendar._angular.scope["$apply"]();
            }
        };
        this._react = {};
        this._react.reactDOM = null;
        this._react.react = null;
        this._react._render = function (component, target) {
            var rd = calendar._react.reactDOM;
            if (typeof rd.createRoot === "function") {
                var root = target._root;
                if (!root) {
                    root = rd.createRoot(target);
                    target._root = root;
                }
                root.render(component);
            }
            else {
                rd.render(component, target);
            }
        };
        this._react._unmount = function (target) {
            var rd = calendar._react.reactDOM;
            if (typeof rd.createRoot === "function") {
                var root_1 = target._root;
                setTimeout(function () {
                    root_1.unmount();
                }, 0);
            }
            else {
                rd.unmountComponentAtNode(target);
            }
        };
        this._vue = {};
        this._vue._vueImport = null;
        this._vue._renderVueComponent = function (component, target, props) {
            var vue = calendar._vue._vueImport;
            if (typeof vue.createVNode === "function" && typeof vue.render === "function") {
                var vnode = vue.createVNode(component, props);
                vue.render(vnode, target);
            }
        };
        this._vue._renderVueNode = function (vnode, target) {
            var vue = calendar._vue._vueImport;
            if (typeof vue.render === "function") {
                var toRender = vnode;
                if (DayPilot.isArray(vnode)) {
                    toRender = vue.h("div", null, vnode);
                }
                vue.render(toRender, target);
            }
        };
        this._vue._unmountVueComponent = function (target) {
            var vue = calendar._vue._vueImport;
            if (typeof vue.render === "function") {
                vue.render(null, target);
            }
        };
        this.internal = {};
        this.internal.loadOptions = calendar._loadOptions;
        this.internal.initialized = function () {
            return calendar._initialized;
        };
        this.internal.enableVue = function (vue) {
            calendar._vue._vueImport = vue;
        };
        this.internal.vueRef = function () {
            return calendar._vue._vueImport;
        };
        this.internal.vueRendering = function () {
            return calendar._vue._renderingEvent;
        };
        this.internal.upd = function (options) {
            calendar._updateWithOptions(options);
        };
        resolved.locale = function () {
            return DayPilot.Locale.find(calendar.locale);
        };
        resolved.weekStarts = function () {
            if (calendar.weekStarts === 'Auto') {
                var locale = resolved.locale();
                if (locale) {
                    return locale.weekStarts;
                }
                else {
                    return 0;
                }
            }
            else {
                return calendar.weekStarts;
            }
        };
        resolved.cellWidth = function () {
            if (calendar._cache.cellWidth) {
                return calendar._cache.cellWidth;
            }
            var width = calendar._getDimensionsFromCss("_cell_dimensions").width;
            if (!width) {
                width = calendar.cellWidth;
            }
            calendar._cache.cellWidth = width;
            return width;
        };
        resolved._responsive = function () {
            return calendar._resolved.cellWidth() === "Auto";
        };
        this.clearSelection = function () {
            for (var j = 0; j < this.selected.length; j++) {
                var div = this.selected[j];
                calendar._cellUnselect(div.parentNode, div.x, div.y);
            }
            this.selected = [];
        };
        this._isShortInit = function () {
            if (this.backendUrl) {
                return (typeof calendar.items === 'undefined') || (!calendar.items);
            }
            else {
                return false;
            }
        };
        this.events = {};
        this._loadEvents = function () {
            if (!DayPilot.isArray(this.events.list)) {
                return;
            }
            this.items = {};
            for (var i = 0; i < this.events.list.length; i++) {
                var data = this.events.list[i];
                if (data.hidden) {
                    continue;
                }
                var e = new DayPilot.Event(data);
                var days = this._eventDays(data);
                for (var name_3 in days) {
                    if (!this.items[name_3]) {
                        this.items[name_3] = [];
                    }
                    this.items[name_3].push(e);
                }
            }
        };
        this._getDimensionsFromCss = function (className) {
            var div = document.createElement("div");
            div.style.position = "absolute";
            div.style.top = "-2000px";
            div.style.left = "-2000px";
            div.className = this._prefixCssClass(className);
            var container = calendar.root || document.body;
            container.appendChild(div);
            var height = div.offsetHeight;
            var width = div.offsetWidth;
            container.removeChild(div);
            var result = {};
            result.height = height;
            result.width = width;
            return result;
        };
        this._eventDays = function (e) {
            var start = new DayPilot.Date(e.start);
            var end = new DayPilot.Date(e.end);
            var days = {};
            var d = start.getDatePart();
            var endTimeBelongsToDay = function () {
                if (calendar.eventEndSpec === "Date") {
                    return d.getTime() <= end.getTime();
                }
                else {
                    return d.getTime() < end.getTime();
                }
            };
            while (endTimeBelongsToDay()) {
                days[d.toStringSortable()] = 1;
                d = d.addDays(1);
            }
            return days;
        };
        this.show = function () {
            calendar.visible = true;
            calendar.root.style.display = '';
        };
        this.hide = function () {
            calendar.visible = false;
            calendar.root.style.display = 'none';
        };
        this._loadTop = function () {
            if (this.id && this.id.tagName) {
                this.nav.top = this.id;
            }
            else if (typeof this.id === "string") {
                this.nav.top = document.getElementById(this.id);
                if (!this.nav.top) {
                    throw "DayPilot.Navigator: The placeholder element not found: '" + id + "'.";
                }
            }
            else {
                throw "DayPilot.Navigator() constructor requires the target element or its ID as a parameter";
            }
            this.root = this.nav.top;
        };
        this.init = function () {
            this._loadTop();
            if (this.root.dp) {
                return;
            }
            this._adjustSelection();
            this._prepare();
            this._drawMonths();
            this._loadEvents();
            this._updateFreeBusy();
            this._registerDispose();
            this._registerTopHandlers();
            this._registerGlobalHandlers();
            var loadFromServer = this._isShortInit();
            if (loadFromServer) {
                this._visibleRangeChangedDispatch();
            }
            this._initialized = true;
            this._postInit();
            if (this._postponedSelect) {
                var params = this._postponedSelect;
                this.select(params.date1, params.date2, params.options);
                this._postponedSelect = null;
            }
            return this;
        };
        this._registerTopHandlers = function () {
            calendar.nav.top.onmousedown = this._onTopMouseDown;
            calendar.nav.top.onmousemove = this._onTopMouseMove;
        };
        this._registerGlobalHandlers = function () {
            DayPilot.re(document, 'mouseup', calendar._gMouseUp);
        };
        this._gMouseUp = function (ev) {
            if (ps.start && ps.end) {
                var coords = DayPilot.mo3(calendar.nav.top, ev);
                if (coords.x === ps.start.coords.x && coords.y === ps.start.coords.y) {
                    ps.start = null;
                    ps.clear();
                    return;
                }
                ps.clear();
                var ordered = ps.ordered();
                ordered.start = new Position(ordered.start).nextVisible();
                ordered.end = new Position(ordered.end).previousVisible();
                calendar.selectionDay = new Position(ordered.start).date();
                calendar.selectionStart = calendar.selectionDay;
                calendar.selectionEnd = new Position(ordered.end).date();
                ps.start = null;
                ps.end = null;
                calendar._clearTable();
                calendar._prepare();
                calendar._drawMonths();
                calendar._updateFreeBusy();
                calendar._saveState();
                var notify = true;
                if (notify) {
                    calendar._timeRangeSelectedDispatch({ "mode": "FreeHand" });
                }
            }
            ps.start = null;
            ps.end = null;
        };
        this.dispose = function () {
            var c = calendar;
            if (!c.root) {
                return;
            }
            c.root.removeAttribute("style");
            c.root.removeAttribute("class");
            c.root.dp = null;
            c.root.innerHTML = null;
            c.root = null;
            c._disposed = true;
        };
        this.disposed = function () {
            return this._disposed;
        };
        this._registerDispose = function () {
            this.root.dispose = this.dispose;
        };
        this.Init = this.init;
        this._loadOptions(options);
    };
    if (typeof jQuery !== 'undefined') {
        (function ($) {
            $.fn.daypilotNavigator = function (options) {
                var first = null;
                var j = this.each(function () {
                    if (this.daypilot) {
                        return;
                    }
                    var daypilot = new DayPilot.Navigator(this.id);
                    this.daypilot = daypilot;
                    for (var name_4 in options) {
                        daypilot[name_4] = options[name_4];
                    }
                    daypilot.Init();
                    if (!first) {
                        first = daypilot;
                    }
                });
                if (this.length === 1) {
                    return first;
                }
                else {
                    return j;
                }
            };
        })(jQuery);
    }
    (function registerAngularModule() {
        var app = DayPilot.am();
        if (!app) {
            return;
        }
        app.directive("daypilotNavigator", ['$parse', function ($parse) {
                return {
                    "restrict": "E",
                    "template": "<div id='{{id}}'></div>",
                    "compile": function compile(element, attrs) {
                        element.replaceWith(this["template"].replace("{{id}}", attrs["id"]));
                        return function link(scope, element, attrs) {
                            var calendar = new DayPilot.Navigator(element[0]);
                            calendar._angular.scope = scope;
                            calendar.init();
                            var oattr = attrs["id"];
                            if (oattr) {
                                scope[oattr] = calendar;
                            }
                            var pas = attrs["publishAs"];
                            if (pas) {
                                var getter = $parse(pas);
                                var setter = getter.assign;
                                setter(scope, calendar);
                            }
                            for (var name_5 in attrs) {
                                if (name_5.indexOf("on") === 0) {
                                    var apply = DayPilot.Util.shouldApply(name_5);
                                    if (apply) {
                                        (function (name) {
                                            calendar[name] = function (args) {
                                                var f = $parse(attrs[name]);
                                                scope["$apply"](function () {
                                                    f(scope, { "args": args });
                                                });
                                            };
                                        })(name_5);
                                    }
                                    else {
                                        (function (name) {
                                            calendar[name] = function (args) {
                                                var f = $parse(attrs[name]);
                                                f(scope, { "args": args });
                                            };
                                        })(name_5);
                                    }
                                }
                            }
                            var watch = scope["$watch"];
                            var config = attrs["config"] || attrs["daypilotConfig"];
                            var events = attrs["events"] || attrs["daypilotEvents"];
                            watch.call(scope, config, function (value) {
                                for (var name_6 in value) {
                                    calendar[name_6] = value[name_6];
                                }
                                calendar.update();
                            }, true);
                            watch.call(scope, events, function (value) {
                                calendar.events.list = value;
                                calendar._loadEvents();
                                calendar._updateFreeBusy();
                            }, true);
                        };
                    }
                };
            }]);
    })();
    DayPilot.Navigator.def = {};
    if (typeof Sys !== 'undefined' && Sys.Application && Sys.Application.notifyScriptLoaded) {
        Sys.Application.notifyScriptLoaded();
    }
})(DayPilot);
