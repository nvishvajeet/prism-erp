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
    var doNothing = function () { };
    if (typeof DayPilot.Calendar !== 'undefined' && DayPilot.Calendar.events) {
        return;
    }
    var DayPilotCalendar = {};
    DayPilotCalendar.selectedCells = [];
    DayPilotCalendar.topSelectedCell = null;
    DayPilotCalendar.bottomSelectedCell = null;
    DayPilotCalendar.column = null;
    DayPilotCalendar.firstSelected = null;
    DayPilotCalendar.firstMousePos = null;
    DayPilotCalendar.originalMouse = null;
    DayPilotCalendar.originalHeight = null;
    DayPilotCalendar.originalTop = null;
    DayPilotCalendar.resizing = null;
    DayPilotCalendar.globalHandlers = false;
    DayPilotCalendar.moving = null;
    DayPilotCalendar.register = function (calendar) {
        if (!DayPilotCalendar.registered) {
            DayPilotCalendar.registered = [];
        }
        var r = DayPilotCalendar.registered;
        for (var i = 0; i < r.length; i++) {
            if (r[i] === calendar) {
                return;
            }
        }
        r.push(calendar);
    };
    DayPilotCalendar.unregister = function (calendar) {
        var a = DayPilotCalendar.registered;
        if (!a) {
            return;
        }
        var i = DayPilot.indexOf(a, calendar);
        if (i === -1) {
            return;
        }
        a.splice(i, 1);
    };
    DayPilotCalendar.getCellsAbove = function (cell) {
        var array = [];
        var c = DayPilotCalendar.getColumn(cell);
        var tr = cell.parentNode;
        var select = null;
        while (tr && select !== DayPilotCalendar.firstSelected) {
            select = tr.getElementsByTagName("td")[c];
            array.push(select);
            tr = tr.previousSibling;
            while (tr && tr.tagName !== "TR") {
                tr = tr.previousSibling;
            }
        }
        return array;
    };
    DayPilotCalendar.getCellsBelow = function (cell) {
        var array = [];
        var c = DayPilotCalendar.getColumn(cell);
        var tr = cell.parentNode;
        var select = null;
        while (tr && select !== DayPilotCalendar.firstSelected) {
            select = tr.getElementsByTagName("td")[c];
            array.push(select);
            tr = tr.nextSibling;
            while (tr && tr.tagName !== "TR") {
                tr = tr.nextSibling;
            }
        }
        return array;
    };
    DayPilotCalendar.getColumn = function (cell) {
        var i = 0;
        while (cell.previousSibling) {
            cell = cell.previousSibling;
            if (cell.tagName === "TD") {
                i++;
            }
        }
        return i;
    };
    DayPilotCalendar.gUnload = function () {
        if (!DayPilotCalendar.registered) {
            return;
        }
        var r = DayPilotCalendar.registered;
        for (var i = 0; i < r.length; i++) {
            var c = r[i];
            c.dispose();
            DayPilotCalendar.unregister(c);
        }
    };
    DayPilotCalendar.gMouseUp = function (ev) {
        if (DayPilotCalendar.resizing) {
            if (!DayPilotCalendar.resizingShadow) {
                DayPilotCalendar.resizing.style.cursor = 'default';
                document.body.style.cursor = 'default';
                DayPilotCalendar.resizing = null;
                DayPilot.Global.resizing = null;
                return;
            }
            var dpEvent = DayPilotCalendar.resizing.event;
            var height = DayPilotCalendar.resizingShadow.clientHeight;
            var top_1 = DayPilotCalendar.resizingShadow.offsetTop;
            var border = DayPilotCalendar.resizing.dpBorder;
            DayPilotCalendar.deleteShadow(DayPilotCalendar.resizingShadow);
            DayPilotCalendar.resizingShadow = null;
            DayPilotCalendar.resizing.style.cursor = 'default';
            dpEvent.calendar.nav.top.style.cursor = 'auto';
            DayPilotCalendar.resizing.onclick = null;
            DayPilotCalendar.resizing = null;
            DayPilot.Global.resizing = null;
            dpEvent.calendar._eventResizeDispatch(dpEvent, height, top_1, border);
        }
        else if (DayPilotCalendar.moving) {
            if (!DayPilotCalendar.movingShadow) {
                DayPilotCalendar.moving = null;
                DayPilot.Global.moving = null;
                document.body.style.cursor = 'default';
                return;
            }
            var top_2 = DayPilotCalendar.movingShadow.offsetTop;
            var dpEvent = DayPilotCalendar.moving.event;
            DayPilotCalendar.deleteShadow(DayPilotCalendar.movingShadow);
            DayPilot.Util.removeClass(DayPilotCalendar.moving, dpEvent.calendar._prefixCssClass("_event_moving_source"));
            var newColumnIndex = DayPilotCalendar.movingShadow.column;
            DayPilotCalendar.moving = null;
            DayPilot.Global.moving = null;
            DayPilotCalendar.movingShadow = null;
            dpEvent.calendar.nav.top.style.cursor = 'auto';
            dpEvent.calendar._eventMoveDispatch(dpEvent, newColumnIndex, top_2, ev);
        }
        else if (DayPilot.Global.selecting) {
            var calendar = DayPilot.Global.selecting.calendar;
            calendar._selection = DayPilot.Global.selecting;
            DayPilot.Global.selecting = null;
            var sel = calendar.getSelection();
            calendar._timeRangeSelectedDispatch(sel.start, sel.end, sel.resource);
            if (calendar.timeRangeSelectedHandling !== "Hold" && calendar.timeRangeSelectedHandling !== "HoldForever") {
                doNothing();
            }
        }
        else {
            DayPilotCalendar.selecting = false;
        }
    };
    DayPilotCalendar.deleteShadow = function (shadow) {
        if (!shadow) {
            return;
        }
        if (!shadow.parentNode) {
            return;
        }
        shadow.parentNode.removeChild(shadow);
    };
    DayPilotCalendar.moveShadow = function (column) {
        var shadow = DayPilotCalendar.movingShadow;
        var parent = shadow.parentNode;
        parent.style.display = 'none';
        shadow.parentNode.removeChild(shadow);
        column.firstChild.appendChild(shadow);
        shadow.style.left = '0px';
        parent.style.display = '';
        shadow.style.width = (DayPilotCalendar.movingShadow.parentNode.offsetWidth + 1) + 'px';
    };
    var isVueVNode = DayPilot.Util.isVueVNode;
    var overlaps = DayPilot.Util.overlaps;
    DayPilotCalendar.Calendar = function (id, options) {
        var isConstructor = false;
        if (this instanceof DayPilotCalendar.Calendar && !this.__constructor) {
            isConstructor = true;
            this.__constructor = true;
        }
        if (!isConstructor) {
            throw "DayPilot.Calendar() is a constructor and must be called as 'var c = new DayPilot.Calendar(id);'";
        }
        var calendar = this;
        this.uniqueID = null;
        this.isCalendar = true;
        this.v = '${v}';
        this.id = id;
        this.clientName = id;
        this.cache = {};
        this.cache.pixels = {};
        this.elements = {};
        this.elements.events = [];
        this.elements.selection = [];
        this.nav = {};
        this.afterRender = function () { };
        this.fasterDispose = true;
        this.angularAutoApply = false;
        this.api = 2;
        this.businessBeginsHour = 9;
        this.businessEndsHour = 18;
        this.cellDuration = 30;
        this.cellHeight = 30;
        this.columnMarginLeft = 0;
        this.columnMarginRight = 5;
        this.columnsLoadMethod = "GET";
        this.contextMenu = null;
        this.days = 1;
        this.durationBarVisible = true;
        this.eventBorderRadius = null;
        this.eventsLoadMethod = "GET";
        this.headerDateFormat = null;
        this.headerHeight = 30;
        this.headerTextWrappingEnabled = false;
        this.height = 300;
        this.heightSpec = 'BusinessHours';
        this.hideUntilInit = true;
        this.hourWidth = 60;
        this.initScrollPos = 'Auto';
        this.loadingLabelHtml = null;
        this.loadingLabelText = "Loading...";
        this.loadingLabelVisible = true;
        this.locale = "en-us";
        this.rtl = false;
        this.snapToGrid = true;
        this.showToolTip = true;
        this.startDate = new DayPilot.Date().getDatePart();
        this.cssClassPrefix = "calendar_default";
        this.theme = null;
        this.timeFormat = 'Auto';
        this.useEventBoxes = "Always";
        this.viewType = "Days";
        this.visible = true;
        this.xssProtection = "Enabled";
        this.headerClickHandling = "Enabled";
        this.eventClickHandling = 'Enabled';
        this.eventResizeHandling = 'Update';
        this.eventRightClickHandling = 'ContextMenu';
        this.eventMoveHandling = 'Update';
        this.eventDeleteHandling = "Disabled";
        this.timeRangeSelectedHandling = 'Enabled';
        this.onBeforeCellRender = null;
        this.onBeforeEventRender = null;
        this.onBeforeHeaderRender = null;
        this.onEventClick = null;
        this.onEventClicked = null;
        this.onEventDelete = null;
        this.onEventDeleted = null;
        this.onEventMove = null;
        this.onEventMoved = null;
        this.onEventResize = null;
        this.onEventResized = null;
        this.onEventRightClick = null;
        this.onEventRightClicked = null;
        this.onHeaderClick = null;
        this.onHeaderClicked = null;
        this.onTimeRangeSelect = null;
        this.onTimeRangeSelected = null;
        this._disposed = false;
        this._resolved = {};
        var resolved = this._resolved;
        this.clearSelection = function () {
            DayPilotCalendar.topSelectedCell = null;
            DayPilotCalendar.bottomSelectedCell = null;
            this._hideSelection();
        };
        this._hideSelection = function () {
            DayPilot.de(calendar.elements.selection);
            calendar.elements.selection = [];
            calendar.nav.activeSelection = null;
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
        this._callBack2 = function (action, data, parameters) {
            if (this.callbackTimeout) {
                window.clearTimeout(this.callbackTimeout);
            }
            this.callbackTimeout = window.setTimeout(function () {
                calendar.loadingStart();
            }, 100);
            var envelope = {};
            envelope.action = action;
            envelope.parameters = parameters;
            envelope.data = data;
            envelope.header = this._getCallBackHeader();
            var commandstring = "JSON" + JSON.stringify(envelope);
            if (this.backendUrl) {
                DayPilot.request(this.backendUrl, this._callBackResponse, commandstring, this.ajaxError);
            }
            else if (typeof WebForm_DoCallback === 'function') {
                WebForm_DoCallback(this.uniqueID, commandstring, this._updateView, this.clientName, this.onCallbackError, true);
            }
        };
        this.onCallbackError = function (result, context) {
            alert("Error!\r\nResult: " + result + "\r\nContext:" + context);
        };
        this.dispose = function () {
            var c = calendar;
            if (c._disposed) {
                return;
            }
            c._disposed = true;
            clearInterval(c._visibilityInterval);
            c._deleteEvents();
            c.nav.scroll.root = null;
            DayPilot.pu(c.nav.loading);
            c._disposeMain();
            c._disposeHeader();
            c.nav.select = null;
            c.nav.cornerRight = null;
            c.nav.scrollable = null;
            c.nav.zoom = null;
            c.nav.loading = null;
            c.nav.header = null;
            c.nav.hourTable = null;
            c.nav.scrolltop = null;
            c.nav.scroll.onscroll = null;
            c.nav.scroll = null;
            c.nav.main = null;
            c.nav.message = null;
            c.nav.messageClose = null;
            c.nav.top = null;
            DayPilotCalendar.unregister(c);
        };
        this.disposed = function () {
            return this._disposed;
        };
        this._registerDispose = function () {
            this.nav.top.dispose = this.dispose;
        };
        this._callBackResponse = function (response) {
            calendar._updateView(response.responseText);
        };
        this._getCallBackHeader = function () {
            var h = {};
            h.control = "dpc";
            h.id = this.id;
            h.v = this.v;
            h.days = calendar.days;
            h.startDate = calendar.startDate;
            h.heightSpec = calendar.heightSpec;
            h.businessBeginsHour = calendar.businessBeginsHour;
            h.businessEndsHour = calendar.businessEndsHour;
            h.hashes = calendar.hashes;
            h.timeFormat = calendar.timeFormat;
            h.viewType = calendar.viewType;
            h.locale = calendar.locale;
            return h;
        };
        this._createShadow = function (object) {
            var parentTd = object.parentNode;
            while (parentTd && parentTd.tagName !== "TD") {
                parentTd = parentTd.parentNode;
            }
            var eventBorderRadius = calendar.eventBorderRadius;
            if (typeof eventBorderRadius === "number") {
                eventBorderRadius += "px";
            }
            var shadow = document.createElement('div');
            shadow.setAttribute('unselectable', 'on');
            shadow.style.position = 'absolute';
            shadow.style.width = (object.offsetWidth) + 'px';
            shadow.style.height = (object.offsetHeight) + 'px';
            shadow.style.left = (object.offsetLeft) + 'px';
            shadow.style.top = (object.offsetTop) + 'px';
            shadow.style.boxSizing = "border-box";
            shadow.style.zIndex = 101;
            shadow.className = calendar._prefixCssClass("_shadow");
            var inner = document.createElement("div");
            inner.className = calendar._prefixCssClass("_shadow_inner");
            if (eventBorderRadius) {
                inner.style.borderRadius = eventBorderRadius;
                shadow.style.borderRadius = eventBorderRadius;
            }
            shadow.appendChild(inner);
            parentTd.firstChild.appendChild(shadow);
            return shadow;
        };
        this._resolved.locale = function () {
            var found = DayPilot.Locale.find(calendar.locale);
            if (!found) {
                return DayPilot.Locale.US;
            }
            return found;
        };
        this._resolved.timeFormat = function () {
            if (calendar.timeFormat !== 'Auto') {
                return calendar.timeFormat;
            }
            return this.locale().timeFormat;
        };
        this._resolved._xssProtectionEnabled = function () {
            return calendar.xssProtection !== "Disabled";
        };
        this._resolved._weekStarts = function () {
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
                return calendar.weekStarts || 0;
            }
        };
        this._resolved._cellDuration = function () {
            var cellDuration = calendar.cellDuration;
            if (cellDuration <= 1) {
                return 1;
            }
            if (cellDuration >= 60) {
                return 60;
            }
            var divisors = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60];
            var value = Math.floor(cellDuration);
            return Math.max.apply(null, divisors.filter(function (d) { return d <= value; }));
        };
        this._updateView = function (json) {
            if (json && json.indexOf("$$$") === 0) {
                if (window.console) {
                    console.log("Error received from the server side: " + json);
                }
                else {
                    throw "Error received from the server side: " + json;
                }
                return;
            }
            var result = JSON.parse(json);
            if (result.CallBackRedirect) {
                document.location.href = result.CallBackRedirect;
                return;
            }
            if (result.UpdateType === "None") {
                calendar.loadingStop();
                calendar._show();
                return;
            }
            calendar._deleteEvents();
            if (result.UpdateType === "Full") {
                calendar.columns = result.Columns;
                calendar.days = result.Days;
                calendar.startDate = new DayPilot.Date(result.StartDate);
                calendar.heightSpec = result.HeightSpec ? result.HeightSpec : calendar.heightSpec;
                calendar.businessBeginsHour = result.BusinessBeginsHour ? result.BusinessBeginsHour : calendar.businessBeginsHour;
                calendar.businessEndsHour = result.BusinessEndsHour ? result.BusinessEndsHour : calendar.businessEndsHour;
                calendar.headerDateFormat = result.HeaderDateFormat ? result.HeaderDateFormat : calendar.headerDateFormat;
                calendar.viewType = result.ViewType;
                calendar.backColor = result.BackColor ? result.BackColor : calendar.backColor;
                calendar.eventHeaderVisible = result.EventHeaderVisible ? result.EventHeaderVisible : calendar.eventHeaderVisible;
                calendar.timeFormat = result.TimeFormat ? result.TimeFormat : calendar.timeFormat;
                calendar.locale = result.Locale ? result.Locale : calendar.locale;
                calendar._prepareColumns();
            }
            if (result.Hashes) {
                for (var key in result.Hashes) {
                    calendar.hashes[key] = result.Hashes[key];
                }
            }
            calendar.events.list = result.Events;
            calendar._loadEvents();
            calendar._updateHeaderHeight();
            if (result.UpdateType === "Full") {
                calendar._drawHeader();
                calendar._drawMain();
                calendar._drawHourTable();
                calendar._updateHeight();
            }
            calendar._show();
            calendar._drawEvents();
            calendar.clearSelection();
            calendar.afterRender(result.CallBackData, true);
            calendar.loadingStop();
        };
        this._durationHours = function () {
            return this._duration() / (3600 * 1000);
        };
        this._businessHoursSpan = function () {
            if (this.businessBeginsHour > this.businessEndsHour) {
                return 24 - this.businessBeginsHour + this.businessEndsHour;
            }
            else {
                return this.businessEndsHour - this.businessBeginsHour;
            }
        };
        this._rowCount = function () {
            return this._duration() / (resolved._cellDuration() * 60 * 1000);
        };
        this._duration = function () {
            var dHours = 0;
            if (this.heightSpec === 'BusinessHoursNoScroll') {
                dHours = this._businessHoursSpan();
            }
            else {
                dHours = 24;
            }
            return dHours * 60 * 60 * 1000;
        };
        this._visibleStart = function () {
            if (this.heightSpec === 'BusinessHoursNoScroll') {
                return this.businessBeginsHour;
            }
            return 0;
        };
        this._api2 = function () {
            return calendar.api === 2;
        };
        this.eventClickCallBack = function (e, data) {
            this._callBack2('EventClick', data, e);
        };
        this.eventClickPostBack = function (e, data) {
            this._postBack2('EventClick', data, e);
        };
        this._eventClickDispatch = function (ev) {
            var thisDiv = ev.currentTarget;
            var e = thisDiv.event;
            if (!e.client.clickEnabled()) {
                return;
            }
            if (calendar._api2()) {
                var args_1 = {};
                args_1.e = e;
                args_1.originalEvent = ev;
                args_1.meta = ev.metaKey;
                args_1.ctrl = ev.ctrlKey;
                args_1.control = calendar;
                args_1.preventDefault = function () {
                    this.preventDefault.value = true;
                };
                if (typeof calendar.onEventClick === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onEventClick(args_1);
                    });
                    if (args_1.preventDefault.value) {
                        return;
                    }
                }
                switch (calendar.eventClickHandling) {
                    case 'CallBack':
                        calendar.eventClickCallBack(e);
                        break;
                    case 'PostBack':
                        calendar.eventClickPostBack(e);
                        break;
                    case 'ContextMenu': {
                        var menu = e.client.contextMenu();
                        if (menu) {
                            menu.show(e);
                        }
                        else {
                            if (calendar.contextMenu) {
                                calendar.contextMenu.show(e);
                            }
                        }
                        break;
                    }
                }
                if (typeof calendar.onEventClicked === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onEventClicked(args_1);
                    });
                }
            }
            else {
                switch (calendar.eventClickHandling) {
                    case 'PostBack':
                        calendar.eventClickPostBack(e);
                        break;
                    case 'CallBack':
                        calendar.eventClickCallBack(e);
                        break;
                    case 'JavaScript':
                        calendar.onEventClick(e);
                        break;
                }
            }
        };
        this._eventRightClickDispatch = function (ev) {
            var e = ev.currentTarget.event;
            ev.stopPropagation();
            if (!e.client.rightClickEnabled()) {
                return false;
            }
            var args = {};
            args.e = e;
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            if (typeof calendar.onEventRightClick === 'function') {
                calendar.onEventRightClick(args);
                if (args.preventDefault.value) {
                    return false;
                }
            }
            switch (calendar.eventRightClickHandling) {
                case 'ContextMenu': {
                    var menu = e.client.contextMenu();
                    if (menu) {
                        menu.show(e);
                    }
                    else {
                        if (calendar.contextMenu) {
                            calendar.contextMenu.show(e);
                        }
                    }
                    break;
                }
            }
            if (typeof calendar.onEventRightClicked === 'function') {
                calendar.onEventRightClicked(args);
            }
            if (ev.preventDefault) {
                ev.preventDefault();
            }
            return false;
        };
        this.eventDeleteCallBack = function (e, data) {
            this._callBack2('EventDelete', data, e);
        };
        this.eventDeletePostBack = function (e, data) {
            this._postBack2('EventDelete', data, e);
        };
        this._eventDeleteDispatch = function (e) {
            if (calendar._api2()) {
                var args_2 = {};
                args_2.e = e;
                args_2.control = calendar;
                args_2.preventDefault = function () {
                    this.preventDefault.value = true;
                };
                if (typeof calendar.onEventDelete === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onEventDelete(args_2);
                    });
                    if (args_2.preventDefault.value) {
                        return;
                    }
                }
                switch (calendar.eventDeleteHandling) {
                    case 'CallBack':
                        calendar.eventDeleteCallBack(e);
                        break;
                    case 'PostBack':
                        calendar.eventDeletePostBack(e);
                        break;
                    case 'Update':
                        calendar.events.remove(e);
                        break;
                }
                if (typeof calendar.onEventDeleted === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onEventDeleted(args_2);
                    });
                }
            }
            else {
                switch (calendar.eventDeleteHandling) {
                    case 'PostBack':
                        calendar.eventDeletePostBack(e);
                        break;
                    case 'CallBack':
                        calendar.eventDeleteCallBack(e);
                        break;
                    case 'JavaScript':
                        calendar.onEventDelete(e);
                        break;
                }
            }
        };
        this.eventResizeCallBack = function (e, newStart, newEnd, data) {
            if (!newStart) {
                throw 'newStart is null';
            }
            if (!newEnd) {
                throw 'newEnd is null';
            }
            var params = {};
            params.e = e;
            params.newStart = newStart;
            params.newEnd = newEnd;
            this._callBack2('EventResize', data, params);
        };
        this.eventResizePostBack = function (e, newStart, newEnd, data) {
            if (!newStart) {
                throw 'newStart is null';
            }
            if (!newEnd) {
                throw 'newEnd is null';
            }
            var params = {};
            params.e = e;
            params.newStart = newStart;
            params.newEnd = newEnd;
            this._postBack2('EventResize', data, params);
        };
        this._eventResizeDispatch = function (e, shadowHeight, shadowTop, border) {
            var _startOffset = 0;
            var newStart = new Date();
            var newEnd = new Date();
            if (border === 'top') {
                newStart = calendar._getResizingStartFromTop(e, shadowTop - _startOffset);
                newEnd = e.end();
            }
            else if (border === 'bottom') {
                newStart = e.start();
                newEnd = calendar._getResizingEndFromBottom(e, shadowTop + shadowHeight - _startOffset);
            }
            if (calendar._api2()) {
                var args_3 = {};
                args_3.e = e;
                args_3.control = calendar;
                args_3.newStart = newStart;
                args_3.newEnd = newEnd;
                args_3.preventDefault = function () {
                    this.preventDefault.value = true;
                };
                if (typeof calendar.onEventResize === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onEventResize(args_3);
                    });
                    if (args_3.preventDefault.value) {
                        return;
                    }
                }
                switch (calendar.eventResizeHandling) {
                    case 'PostBack':
                        calendar.eventResizePostBack(e, newStart, newEnd);
                        break;
                    case 'CallBack':
                        calendar.eventResizeCallBack(e, newStart, newEnd);
                        break;
                    case 'Update':
                        e.start(newStart);
                        e.end(newEnd);
                        calendar.events.update(e);
                        break;
                }
                if (typeof calendar.onEventResized === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onEventResized(args_3);
                    });
                }
            }
            else {
                switch (calendar.eventResizeHandling) {
                    case 'PostBack':
                        calendar.eventResizePostBack(e, newStart, newEnd);
                        break;
                    case 'CallBack':
                        calendar.eventResizeCallBack(e, newStart, newEnd);
                        break;
                    case 'JavaScript':
                        calendar.onEventResize(e, newStart, newEnd);
                        break;
                }
            }
        };
        this._getResizingStartFromTop = function (e, shadowTop) {
            var day = calendar._columns[e.part.dayIndex].start;
            var step = Math.floor(shadowTop / calendar.cellHeight);
            var snapToGrid = calendar.snapToGrid;
            if (!snapToGrid) {
                step = shadowTop / calendar.cellHeight;
            }
            var minutes = Math.floor(step * resolved._cellDuration());
            var ts = minutes * 60 * 1000;
            var visibleStartOffset = calendar._visibleStart() * 60 * 60 * 1000;
            return day.addTime(ts + visibleStartOffset);
        };
        this._getResizingEndFromBottom = function (e, shadowBottom) {
            var step = Math.floor(shadowBottom / calendar.cellHeight);
            var snapToGrid = calendar.snapToGrid;
            if (!snapToGrid) {
                step = shadowBottom / calendar.cellHeight;
            }
            var minutes = Math.floor(step * resolved._cellDuration());
            var ts = minutes * 60 * 1000;
            var visibleStartOffset = calendar._visibleStart() * 60 * 60 * 1000;
            var day = calendar._columns[e.part.dayIndex].start;
            return day.addTime(ts + visibleStartOffset);
        };
        this.eventMovePostBack = function (e, newStart, newEnd, newResource, data) {
            if (!newStart) {
                throw 'newStart is null';
            }
            if (!newEnd) {
                throw 'newEnd is null';
            }
            var params = {};
            params.e = e;
            params.newStart = newStart;
            params.newEnd = newEnd;
            this._postBack2('EventMove', data, params);
        };
        this.eventMoveCallBack = function (e, newStart, newEnd, newResource, data) {
            if (!newStart) {
                throw 'newStart is null';
            }
            if (!newEnd) {
                throw 'newEnd is null';
            }
            var params = {};
            params.e = e;
            params.newStart = newStart;
            params.newEnd = newEnd;
            this._callBack2('EventMove', data, params);
        };
        this._eventMoveDispatch = function (e, newColumnIndex, shadowTop, ev) {
            var _startOffset = 0;
            var step = Math.floor((shadowTop - _startOffset) / calendar.cellHeight);
            if (!calendar.snapToGrid) {
                step = (shadowTop - _startOffset) / calendar.cellHeight;
            }
            var cellDuration = resolved._cellDuration();
            var boxStart = step * cellDuration * 60 * 1000;
            var start = e.start();
            var end = e.end();
            var day = new Date();
            if (start instanceof DayPilot.Date) {
                start = start.toDate();
            }
            day.setTime(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
            var startOffset = start.getTime() - (day.getTime() + start.getUTCHours() * 3600 * 1000 + Math.floor(start.getUTCMinutes() / cellDuration) * cellDuration * 60 * 1000);
            if (calendar.useEventBoxes === "Never") {
                startOffset = 0;
            }
            var length = end.getTime() - start.getTime();
            var newColumn = this._columns[newColumnIndex];
            var newResource = newColumn.id;
            if (!calendar.snapToGrid) {
                startOffset = 0;
            }
            var date = newColumn.start.getTime();
            var newStartUTC = new Date();
            newStartUTC.setTime(date + boxStart + startOffset);
            var newStart = new DayPilot.Date(newStartUTC);
            var newEnd = newStart.addTime(length);
            if (calendar._api2()) {
                var args_4 = {};
                args_4.e = e;
                args_4.newStart = newStart;
                args_4.newEnd = newEnd;
                args_4.newResource = newResource;
                args_4.ctrl = ev.ctrlKey;
                args_4.shift = ev.shiftKey;
                args_4.control = calendar;
                args_4.preventDefault = function () {
                    this.preventDefault.value = true;
                };
                if (typeof calendar.onEventMove === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onEventMove(args_4);
                    });
                    if (args_4.preventDefault.value) {
                        return;
                    }
                }
                switch (calendar.eventMoveHandling) {
                    case 'PostBack':
                        calendar.eventMovePostBack(e, newStart, newEnd, newColumn.id);
                        break;
                    case 'CallBack':
                        calendar.eventMoveCallBack(e, newStart, newEnd, newColumn.id);
                        break;
                    case 'Update':
                        e.start(newStart);
                        e.end(newEnd);
                        e.resource(newResource);
                        calendar.events.update(e);
                        break;
                }
                if (typeof calendar.onEventMoved === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onEventMoved(args_4);
                    });
                }
            }
            else {
                switch (calendar.eventMoveHandling) {
                    case 'PostBack':
                        calendar.eventMovePostBack(e, newStart, newEnd, newColumn.id);
                        break;
                    case 'CallBack':
                        calendar.eventMoveCallBack(e, newStart, newEnd, newColumn.id);
                        break;
                    case 'JavaScript':
                        calendar.onEventMove(e, newStart, newEnd, newColumn.id, false);
                        break;
                }
            }
        };
        this.timeRangeSelectedPostBack = function (start, end, resource, data) {
            var range = {};
            range.start = start;
            range.end = end;
            this._postBack2('TimeRangeSelected', data, range);
        };
        this.timeRangeSelectedCallBack = function (start, end, resource, data) {
            var range = {};
            range.start = start;
            range.end = end;
            this._callBack2('TimeRangeSelected', data, range);
        };
        this._timeRangeSelectedDispatch = function (start, end, resource) {
            start = new DayPilot.Date(start);
            end = new DayPilot.Date(end);
            if (this._api2()) {
                var args_5 = {};
                args_5.start = start;
                args_5.end = end;
                args_5.resource = resource;
                args_5.control = calendar;
                args_5.preventDefault = function () {
                    this.preventDefault.value = true;
                };
                if (typeof calendar.onTimeRangeSelect === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onTimeRangeSelect(args_5);
                    });
                    if (args_5.preventDefault.value) {
                        return;
                    }
                }
                switch (calendar.timeRangeSelectedHandling) {
                    case 'PostBack':
                        calendar.timeRangeSelectedPostBack(start, end);
                        break;
                    case 'CallBack':
                        calendar.timeRangeSelectedCallBack(start, end);
                        break;
                }
                if (typeof calendar.onTimeRangeSelected === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onTimeRangeSelected(args_5);
                    });
                }
            }
            else {
                switch (calendar.timeRangeSelectedHandling) {
                    case 'PostBack':
                        calendar.timeRangeSelectedPostBack(start, end);
                        break;
                    case 'CallBack':
                        calendar.timeRangeSelectedCallBack(start, end);
                        break;
                    case 'JavaScript':
                        calendar.onTimeRangeSelected(start, end);
                        break;
                }
            }
        };
        this._onCellMousedown = function (ev) {
            if (DayPilot.Global.selecting) {
                return;
            }
            if (calendar.timeRangeSelectedHandling === "Disabled") {
                return;
            }
            var button = ev.which;
            if (button !== 1 && button !== 0) {
                return;
            }
            var ref = calendar.nav.scrollable;
            calendar.coords = DayPilot.mo3(ref, ev);
            DayPilot.Global.selecting = {
                calendar: calendar,
                start: calendar.coords
            };
            var selecting = DayPilot.Global.selecting;
            selecting.start.time = calendar._getTimeForPixels(calendar.coords.x, calendar.coords.y);
            selecting.start.columnIndex = calendar._getColumnForPixels(calendar.coords.x);
            selecting.start.column = calendar._columns[selecting.start.columnIndex];
            calendar._updateSelectingEnd();
            calendar._activateSelection();
            return false;
        };
        this._activateSelection = function () {
            var selecting = DayPilot.Global.selecting;
            (function activateSelectionNew() {
                var col = selecting.start.column;
                var columnIndex = selecting.start.columnIndex;
                var colStart = col.start;
                var topPixels = calendar.getPixels(selecting.startTime, colStart);
                var bottomPixels = calendar.getPixels(selecting.endTime, colStart);
                var top = topPixels.boxTop;
                var bottom = bottomPixels.boxBottom;
                if (!calendar.snapToGrid) {
                    top = topPixels.top;
                    bottom = bottomPixels.top;
                }
                var height = bottom - top;
                var eventBorderRadius = calendar.eventBorderRadius;
                if (typeof eventBorderRadius === "number") {
                    eventBorderRadius += "px";
                }
                var div = (function () {
                    if (calendar.nav.activeSelection) {
                        return calendar.nav.activeSelection;
                    }
                    var div = document.createElement("div");
                    div.setAttribute("unselectable", "on");
                    div.style.position = "absolute";
                    div.style.left = "0px";
                    div.style.width = "100%";
                    var inner = document.createElement("div");
                    inner.setAttribute("unselectable", "on");
                    inner.className = calendar._prefixCssClass("_shadow_inner");
                    if (eventBorderRadius) {
                        inner.style.borderRadius = eventBorderRadius;
                        div.style.borderRadius = eventBorderRadius;
                    }
                    div.appendChild(inner);
                    calendar.nav.events.rows[0].cells[columnIndex].selection.appendChild(div);
                    calendar.elements.selection.push(div);
                    calendar.nav.activeSelection = div;
                    return div;
                })();
                div.className = calendar._prefixCssClass("_shadow");
                div.firstChild.innerHTML = "";
                div.style.top = top + "px";
                div.style.height = height + "px";
                calendar.nav.events.rows[0].cells[columnIndex].selection.appendChild(div);
            })();
        };
        this._updateSelectingEnd = function () {
            var selecting = DayPilot.Global.selecting;
            selecting.end = calendar.coords;
            selecting.end.time = calendar._getTimeForPixels(selecting.start.x, selecting.end.y);
            selecting.end.column = calendar._columns[calendar._getColumnForPixels(selecting.end.x)];
            calendar._calculateSelectionTimes(selecting);
        };
        this._calculateSelectionTimes = function (selecting) {
            var startTime, endTime, anchor;
            var snapToGrid = calendar.snapToGrid;
            if (snapToGrid) {
                if (selecting.end.time < selecting.start.time) {
                    startTime = calendar._getCellStart(selecting.end.time, selecting.start.column.start);
                    endTime = calendar._getCellEnd(selecting.start.time, selecting.start.column.start);
                    anchor = selecting.endTime;
                }
                else {
                    startTime = calendar._getCellStart(selecting.start.time, selecting.start.column.start);
                    endTime = calendar._getCellEnd(selecting.end.time, selecting.start.column.start);
                    anchor = selecting.startTime;
                }
            }
            else {
                if (selecting.end.time < selecting.start.time) {
                    startTime = selecting.end.time;
                    endTime = selecting.start.time;
                    anchor = selecting.endTime;
                }
                else {
                    startTime = selecting.start.time;
                    endTime = selecting.end.time;
                    anchor = selecting.startTime;
                }
            }
            selecting.startTime = startTime;
            selecting.endTime = endTime;
            selecting.anchor = anchor;
        };
        this.getSelection = function () {
            if (!calendar._selection) {
                return null;
            }
            var selection = calendar._selection;
            return new DayPilot.Selection(selection.startTime, selection.endTime, selection.start.column.id, calendar);
        };
        this._getColumnForPixels = function (x) {
            if (x < 0) {
                return 0;
            }
            if (calendar.rtl) {
                x = calendar.nav.main.offsetWidth - x;
            }
            else {
                x -= calendar.hourWidth;
            }
            var i = 0;
            var cells = calendar.nav.events.rows[0].cells;
            for (var j = 0; j < cells.length; j++) {
                var cell = cells[j];
                var width = cell.offsetWidth;
                i += width;
                if (x < i) {
                    return j;
                }
            }
            return null;
        };
        this._getTimeForPixels = function (x, y) {
            x = DayPilot.Util.atLeast(x, 0);
            var colX = this._getColumnForPixels(x);
            var fractionalHours = y / (60 / resolved._cellDuration()) / calendar.cellHeight;
            var milliseconds = fractionalHours * 60 * 60 * 1000;
            var ticks = Math.floor(milliseconds / 60000) * 60000;
            var column = this._columns[colX];
            if (!column) {
                return null;
            }
            return column.start.addTime(ticks);
        };
        this._getCellStart = function (time, colStart) {
            var startTicks = time.getTime();
            if (colStart) {
                startTicks -= colStart.getTime();
            }
            var duration = resolved._cellDuration() * 60 * 1000;
            var startOffset = startTicks % duration;
            return time.addTime(-startOffset);
        };
        this._getCellEnd = function (time, colStart) {
            var cellStart = this._getCellStart(time, colStart);
            if (cellStart.getTime() === time.getTime()) {
                return cellStart;
            }
            return cellStart.addTime(resolved._cellDuration() * 60 * 1000);
        };
        this._table = {};
        this._table.getCellCoords = function () {
            var result = {};
            result.x = 0;
            result.y = 0;
            if (!calendar.coords) {
                return null;
            }
            result.x = calendar._getColumnForPixels(calendar.coords.x);
            var _startOffset = 0;
            var row = Math.floor((calendar.coords.y - _startOffset) / calendar.cellHeight);
            result.y = row;
            if (result.x < 0) {
                return null;
            }
            return result;
        };
        this.columns = {};
        this.columns.list = [];
        this.columns.load = function (url, success, error) {
            if (!url) {
                throw new DayPilot.Exception("columns.load(): 'url' parameter required");
            }
            var onError = function (args) {
                var largs = {};
                largs.exception = args.exception;
                largs.request = args.request;
                if (typeof error === 'function') {
                    error(largs);
                }
            };
            var onSuccess = function (args) {
                var r = args.request;
                var data;
                try {
                    data = JSON.parse(r.responseText);
                }
                catch (e) {
                    var fargs = {};
                    fargs.exception = e;
                    onError(fargs);
                    return;
                }
                if (DayPilot.isArray(data)) {
                    var sargs = {};
                    sargs.preventDefault = function () {
                        this.preventDefault.value = true;
                    };
                    sargs.data = data;
                    if (typeof success === "function") {
                        success(sargs);
                    }
                    if (sargs.preventDefault.value) {
                        return;
                    }
                    calendar.columns.list = data;
                    if (calendar._initialized) {
                        calendar.update();
                    }
                }
            };
            var usePost = calendar.columnsLoadMethod && calendar.columnsLoadMethod.toUpperCase() === "POST";
            if (usePost) {
                DayPilot.ajax({
                    "method": "POST",
                    "url": url,
                    "success": onSuccess,
                    "error": onError
                });
            }
            else {
                DayPilot.ajax({
                    "method": "GET",
                    "url": url,
                    "success": onSuccess,
                    "error": onError
                });
            }
        };
        this._prepareColumns = function () {
            var columns;
            if (calendar.viewType !== "Resources") {
                columns = this._createDaysViewColumns();
            }
            else {
                columns = calendar.columns.list;
            }
            this._columns = [];
            for (var i = 0; i < columns.length; i++) {
                var c = this._activateColumn(columns[i]);
                this._columns.push(c);
            }
        };
        this._activateColumn = function (column) {
            var result = {};
            result.name = column.name;
            result.html = column.html;
            result.id = column.id;
            result.toolTip = column.toolTip;
            result.data = column;
            if (column.start) {
                result.start = new DayPilot.Date(column.start);
            }
            else {
                result.start = new DayPilot.Date(calendar.startDate);
            }
            if (this.heightSpec === 'BusinessHoursNoScroll') {
                var start = result.start.getDatePart();
                result.start = start.addHours(this.businessBeginsHour);
            }
            result.putIntoBlock = function (ep) {
                for (var i = 0; i < this.blocks.length; i++) {
                    var block_1 = this.blocks[i];
                    if (block_1.overlapsWith(ep.part.top, ep.part.height)) {
                        block_1.events.push(ep);
                        block_1.min = Math.min(block_1.min, ep.part.top);
                        block_1.max = Math.max(block_1.max, ep.part.top + ep.part.height);
                        return i;
                    }
                }
                var block = [];
                block.lines = [];
                block.events = [];
                block.overlapsWith = function (start, width) {
                    var end = start + width - 1;
                    return !(end < this.min || start > this.max - 1);
                };
                block.putIntoLine = function (ep) {
                    for (var i = 0; i < this.lines.length; i++) {
                        var line_1 = this.lines[i];
                        if (line_1.isFree(ep.part.top, ep.part.height)) {
                            line_1.push(ep);
                            return i;
                        }
                    }
                    var line = [];
                    line.isFree = function (start, width) {
                        var end = start + width - 1;
                        var max = this.length;
                        for (var i = 0; i < max; i++) {
                            var e = this[i];
                            if (!(end < e.part.top || start > e.part.top + e.part.height - 1)) {
                                return false;
                            }
                        }
                        return true;
                    };
                    line.push(ep);
                    this.lines.push(line);
                    return this.lines.length - 1;
                };
                block.events.push(ep);
                block.min = ep.part.top;
                block.max = ep.part.top + ep.part.height;
                this.blocks.push(block);
                return this.blocks.length - 1;
            };
            result.putIntoLine = function (ep) {
                for (var i = 0; i < this.lines.length; i++) {
                    var line_2 = this.lines[i];
                    if (line_2.isFree(ep.part.top, ep.part.height)) {
                        line_2.push(ep);
                        return i;
                    }
                }
                var line = [];
                line.isFree = function (start, width) {
                    var end = start + width - 1;
                    var max = this.length;
                    for (var i = 0; i < max; i++) {
                        var e = this[i];
                        if (!(end < e.part.top || start > e.part.top + e.part.height - 1)) {
                            return false;
                        }
                    }
                    return true;
                };
                line.push(ep);
                this.lines.push(line);
                return this.lines.length - 1;
            };
            return result;
        };
        this._createDaysViewColumns = function () {
            var columns = [];
            var start = this.startDate.getDatePart();
            var days = this.days;
            switch (this.viewType) {
                case "Day":
                    days = 1;
                    break;
                case "Week": {
                    days = 7;
                    var weekStarts = resolved._weekStarts();
                    start = start.firstDayOfWeek(weekStarts);
                    break;
                }
                case "WorkWeek":
                    days = 5;
                    start = start.firstDayOfWeek(1);
                    break;
            }
            for (var i = 0; i < days; i++) {
                var format = calendar.headerDateFormat ? calendar.headerDateFormat : resolved.locale().datePattern;
                var column = {};
                column.start = start.addDays(i);
                column.name = column.start.toString(format, resolved.locale());
                columns.push(column);
            }
            return columns;
        };
        this.visibleStart = function () {
            if (calendar.viewType === "Resources") {
                if (calendar._columns.length === 0) {
                    return DayPilot.Date.today();
                }
                var dates = calendar._columns.map(function (column) {
                    return column.start.getTime();
                });
                var min = Math.min.apply(null, dates);
                return new DayPilot.Date(min);
            }
            return this._columns[0].start;
        };
        this.visibleEnd = function () {
            if (calendar.viewType === "Resources") {
                if (calendar._columns.length === 0) {
                    return DayPilot.Date.today().addDays(1);
                }
                var dates = calendar._columns.map(function (column) {
                    return column.start.getTime();
                });
                var max_1 = Math.max.apply(null, dates);
                return new DayPilot.Date(max_1).addDays(1);
            }
            var max = this._columns.length - 1;
            return this._columns[max].start.addDays(1);
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
        this._deleteEvents = function () {
            if (this.elements.events) {
                for (var i = 0; i < this.elements.events.length; i++) {
                    var div = this.elements.events[i];
                    calendar._deleteEvent(div);
                }
            }
            this.elements.events = [];
        };
        this._deleteEvent = function (div) {
            (function eventDomRemove() {
                var domArgs = div.domArgs;
                div.domArgs = null;
                if (domArgs && typeof calendar.onBeforeEventDomRemove === "function") {
                    calendar.onBeforeEventDomRemove(domArgs);
                }
                if (domArgs && typeof calendar.onBeforeEventDomAdd === "function") {
                    var target = domArgs && domArgs._targetElement;
                    if (target) {
                        var isVue = calendar._vue._vueImport && isVueVNode(domArgs.element);
                        if (isVue) {
                            calendar._vue._renderingEvent = true;
                            calendar._vue._unmountVueComponent(target);
                            calendar._vue._renderingEvent = false;
                        }
                    }
                }
            })();
            var object = div.event;
            if (object) {
                object.calendar = null;
            }
            div.onclick = null;
            div.onclickSave = null;
            div.onmouseover = null;
            div.onmouseout = null;
            div.onmousemove = null;
            div.onmousedown = null;
            if (div.firstChild && div.firstChild.firstChild && div.firstChild.firstChild.tagName && div.firstChild.firstChild.tagName.toUpperCase() === 'IMG') {
                var img = div.firstChild.firstChild;
                img.onmousedown = null;
                img.onmousemove = null;
                img.onclick = null;
            }
            div.helper = null;
            div.data = null;
            div.event = null;
            DayPilot.de(div);
        };
        this._drawEvent = function (e) {
            var data = e.cache || e.data;
            var main = this.nav.events;
            var eventBorderRadius = data.borderRadius || calendar.eventBorderRadius;
            if (typeof eventBorderRadius === "number") {
                eventBorderRadius += "px";
            }
            var div = document.createElement("div");
            div.style.position = 'absolute';
            div.style.left = e.part.left + '%';
            div.style.top = (e.part.top) + 'px';
            div.style.width = e.part.width + '%';
            div.style.height = Math.max(e.part.height, 2) + 'px';
            div.style.overflow = 'hidden';
            div.data = e;
            div.event = e;
            div.unselectable = 'on';
            div.style.MozUserSelect = 'none';
            div.style.KhtmlUserSelect = 'none';
            div.className = this._prefixCssClass("_event");
            if (data.cssClass) {
                DayPilot.Util.addClass(div, data.cssClass);
            }
            if (calendar.showToolTip && e.client.toolTip()) {
                div.title = e.client.toolTip();
            }
            div.isFirst = e.part.start.getTime() === e.start().getTime();
            div.isLast = e.part.end.getTime() === e.end().getTime();
            div.onclick = this._eventClickDispatch;
            DayPilot.re(div, "contextmenu", this._eventRightClickDispatch);
            div.onmouseout = function () {
                if (div.deleteIcon) {
                    div.deleteIcon.style.display = "none";
                }
            };
            div.onmousemove = function (ev) {
                var resizeMargin = 5;
                if (typeof (DayPilotCalendar) === 'undefined') {
                    return;
                }
                var offset = DayPilot.mo3(div, ev);
                if (!offset) {
                    return;
                }
                if (DayPilotCalendar.resizing || DayPilotCalendar.moving) {
                    return;
                }
                if (div.deleteIcon) {
                    div.deleteIcon.style.display = "";
                }
                var isLastPart = this.isLast;
                if (offset.y <= resizeMargin && e.client.resizeEnabled()) {
                    this.style.cursor = "n-resize";
                    this.dpBorder = 'top';
                }
                else if (this.offsetHeight - offset.y <= resizeMargin && e.client.resizeEnabled()) {
                    if (isLastPart) {
                        this.style.cursor = "s-resize";
                        this.dpBorder = 'bottom';
                    }
                    else {
                        this.style.cursor = 'not-allowed';
                    }
                }
                else if (!DayPilotCalendar.resizing && !DayPilotCalendar.moving) {
                    if (calendar.eventClickHandling !== 'Disabled') {
                        this.style.cursor = 'pointer';
                    }
                    else {
                        this.style.cursor = 'default';
                    }
                }
            };
            div.onmousedown = function (ev) {
                var button = ev.which || ev.button;
                if ((this.style.cursor === 'n-resize' || this.style.cursor === 's-resize') && button === 1) {
                    DayPilotCalendar.resizing = this;
                    DayPilot.Global.resizing = this;
                    DayPilotCalendar.originalMouse = DayPilot.mc(ev);
                    DayPilotCalendar.originalHeight = this.offsetHeight;
                    DayPilotCalendar.originalTop = this.offsetTop;
                    calendar.nav.top.style.cursor = this.style.cursor;
                }
                else if (button === 1 && e.client.moveEnabled()) {
                    DayPilotCalendar.moving = this;
                    DayPilot.Global.moving = this;
                    DayPilotCalendar.moving.event = this.event;
                    var helper = DayPilotCalendar.moving.helper = {};
                    helper.oldColumn = calendar._columns[this.data.part.dayIndex].id;
                    DayPilotCalendar.originalMouse = DayPilot.mc(ev);
                    DayPilotCalendar.originalTop = this.offsetTop;
                    var offset = DayPilot.mo3(this, ev);
                    if (offset) {
                        DayPilotCalendar.moveOffsetY = offset.y;
                    }
                    else {
                        DayPilotCalendar.moveOffsetY = 0;
                    }
                    calendar.nav.top.style.cursor = 'move';
                }
                return false;
            };
            var inner = document.createElement("div");
            inner.setAttribute("unselectable", "on");
            inner.className = calendar._prefixCssClass("_event_inner");
            if (data.borderColor === "darker" && data.backColor) {
                inner.style.borderColor = DayPilot.ColorUtil.darker(data.backColor, 2);
            }
            else {
                inner.style.borderColor = data.borderColor;
            }
            if (data.backColor) {
                inner.style.background = data.backColor;
            }
            if (data.fontColor) {
                inner.style.color = data.fontColor;
            }
            if (eventBorderRadius) {
                div.style.borderRadius = eventBorderRadius;
                inner.style.borderRadius = eventBorderRadius;
            }
            div.appendChild(inner);
            if (e.client.barVisible()) {
                var height = e.part.height - 2;
                var barTop = 100 * e.part.barTop / height;
                var barHeight = Math.ceil(100 * e.part.barHeight / height);
                var bar = document.createElement("div");
                bar.setAttribute("unselectable", "on");
                bar.className = this._prefixCssClass("_event_bar");
                bar.style.position = "absolute";
                if (data.barBackColor) {
                    bar.style.backgroundColor = data.barBackColor;
                }
                var barInner = document.createElement("div");
                barInner.setAttribute("unselectable", "on");
                barInner.className = this._prefixCssClass("_event_bar_inner");
                barInner.style.top = barTop + "%";
                if (0 < barHeight && barHeight <= 1) {
                    barInner.style.height = "1px";
                }
                else {
                    barInner.style.height = barHeight + "%";
                }
                if (data.barColor) {
                    barInner.style.backgroundColor = data.barColor;
                }
                bar.appendChild(barInner);
                div.appendChild(bar);
            }
            if (e.client.deleteEnabled()) {
                var del = document.createElement("div");
                del.style.position = "absolute";
                del.style.right = "2px";
                del.style.top = "2px";
                del.style.width = "17px";
                del.style.height = "17px";
                del.className = calendar._prefixCssClass("_event_delete");
                del.onmousedown = function (ev) {
                    ev.stopPropagation();
                };
                del.onclick = function (ev) {
                    ev.stopPropagation();
                    var e = this.parentNode.event;
                    if (e) {
                        calendar._eventDeleteDispatch(e);
                    }
                };
                del.style.display = "none";
                div.deleteIcon = del;
                div.appendChild(del);
            }
            var areas = data.areas ? DayPilot.Areas.copy(data.areas) : [];
            DayPilot.Areas.attach(div, e, { "areas": areas });
            if (typeof calendar.onAfterEventRender === 'function') {
                var args = {};
                args.e = div.event;
                args.div = div;
                calendar.onAfterEventRender(args);
            }
            (function domAdd() {
                var args = {};
                args.control = calendar;
                args.e = e;
                args.element = null;
                div.domArgs = args;
                if (typeof calendar.onBeforeEventDomAdd === "function") {
                    calendar.onBeforeEventDomAdd(args);
                }
                if (args.element) {
                    var target = inner;
                    if (target) {
                        args._targetElement = target;
                        var isVueNode = isVueVNode(args.element);
                        if (isVueNode) {
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
                else {
                    inner.innerHTML = e.client.innerHTML();
                }
            })();
            if (main.rows[0].cells[e.part.dayIndex]) {
                var wrapper = main.rows[0].cells[e.part.dayIndex].firstChild;
                wrapper.appendChild(div);
            }
            calendar.elements.events.push(div);
        };
        this._drawEvents = function () {
            for (var i = 0; i < this._columns.length; i++) {
                var col = this._columns[i];
                if (!col.blocks) {
                    continue;
                }
                for (var m = 0; m < col.blocks.length; m++) {
                    var block = col.blocks[m];
                    for (var j = 0; j < block.lines.length; j++) {
                        var line = block.lines[j];
                        for (var k = 0; k < line.length; k++) {
                            var e = line[k];
                            e.part.width = 100 / block.lines.length;
                            e.part.left = e.part.width * j;
                            var isLastBlock = (j === block.lines.length - 1);
                            if (!isLastBlock) {
                                e.part.width = e.part.width * 1.5;
                            }
                            this._drawEvent(e);
                        }
                    }
                }
            }
        };
        this._drawTop = function () {
            var top = this.nav.top;
            top.innerHTML = '';
            DayPilot.Util.addClass(top, this._prefixCssClass("_main"));
            top.style.MozUserSelect = 'none';
            top.style.KhtmlUserSelect = 'none';
            top.style.position = 'relative';
            top.style.width = this.width ? this.width : '100%';
            if (this.hideUntilInit) {
                top.style.visibility = 'hidden';
            }
            if (!this.visible) {
                top.style.display = "none";
            }
            if (this.rtl) {
                top.style.direction = "rtl";
            }
            this.nav.scroll = document.createElement("div");
            this.nav.scroll.style.height = this._getScrollableHeight() + "px";
            if (this.heightSpec === 'BusinessHours') {
                this.nav.scroll.style.overflow = "auto";
            }
            else {
                this.nav.scroll.style.overflow = "hidden";
            }
            this.nav.scroll.style.position = "relative";
            var header = this._drawTopHeaderDiv();
            this.nav.top.appendChild(header);
            this.nav.scroll.style.zoom = 1;
            var wrap = this._drawScrollable();
            this.nav.scrollable = wrap.firstChild;
            this.nav.scroll.appendChild(wrap);
            top.appendChild(this.nav.scroll);
            this.nav.scrollLayer = document.createElement("div");
            this.nav.scrollLayer.style.position = 'absolute';
            this.nav.scrollLayer.style.top = '0px';
            this.nav.scrollLayer.style.left = '0px';
            top.appendChild(this.nav.scrollLayer);
            this.nav.loading = document.createElement("div");
            this.nav.loading.style.position = 'absolute';
            this.nav.loading.style.top = '0px';
            this.nav.loading.style.left = (this.hourWidth + 5) + "px";
            this.nav.loading.innerHTML = calendar._xssTextHtml(calendar.loadingLabelText, calendar.loadingLabelHtml);
            this.nav.loading.style.display = 'none';
            top.appendChild(this.nav.loading);
        };
        this._drawHourTable = function () {
            if (!this.fasterDispose) {
                DayPilot.pu(this.nav.hourTable);
            }
            this.nav.scrollable.rows[0].cells[0].innerHTML = '';
            this.nav.hourTable = this._createHourTable();
            this.nav.scrollable.rows[0].cells[0].appendChild(this.nav.hourTable);
        };
        this._drawScrollable = function () {
            var zoom = document.createElement("div");
            zoom.style.zoom = 1;
            zoom.style.position = 'relative';
            var table = document.createElement("table");
            table.cellSpacing = "0";
            table.cellPadding = "0";
            table.border = "0";
            table.style.border = "0px none";
            table.style.width = "100%";
            table.style.position = 'absolute';
            var r = table.insertRow(-1);
            var c;
            c = r.insertCell(-1);
            c.valign = "top";
            c.style.padding = '0px';
            c.style.border = '0px none';
            this.nav.hourTable = this._createHourTable();
            c.appendChild(this.nav.hourTable);
            c = r.insertCell(-1);
            c.valign = "top";
            c.width = "100%";
            c.style.padding = '0px';
            c.style.border = '0px none';
            var wrap = document.createElement("div");
            wrap.style.position = "relative";
            c.appendChild(wrap);
            wrap.appendChild(this._createEventsAndCells());
            wrap.appendChild(this._createEventsTable());
            zoom.appendChild(table);
            this.nav.zoom = zoom;
            return zoom;
        };
        this._createEventsAndCells = function () {
            var table = document.createElement("table");
            table.cellPadding = "0";
            table.cellSpacing = "0";
            table.border = "0";
            table.style.width = "100%";
            table.style.border = "0px none";
            table.style.tableLayout = 'fixed';
            this.nav.main = table;
            this.nav.events = table;
            return table;
        };
        this._createEventsTable = function () {
            var table = document.createElement("table");
            table.style.top = "0px";
            table.cellPadding = "0";
            table.cellSpacing = "0";
            table.border = "0";
            table.style.position = "absolute";
            table.style.width = "100%";
            table.style.border = "0px none";
            table.style.tableLayout = 'fixed';
            this.nav.events = table;
            var create = true;
            var columns = this._columns;
            var cl = columns.length;
            var r = (create) ? table.insertRow(-1) : table.rows[0];
            for (var j = 0; j < cl; j++) {
                var c = (create) ? r.insertCell(-1) : r.cells[j];
                if (create) {
                    c.style.padding = '0px';
                    c.style.border = '0px none';
                    c.style.height = '0px';
                    c.style.overflow = 'visible';
                    if (!calendar.rtl) {
                        c.style.textAlign = 'left';
                    }
                    var div = document.createElement("div");
                    div.style.marginRight = calendar.columnMarginRight + "px";
                    div.style.marginLeft = calendar.columnMarginLeft + "px";
                    div.style.position = 'relative';
                    div.style.height = '1px';
                    div.style.marginTop = '-1px';
                    var selection = document.createElement("div");
                    c.selection = selection;
                    c.appendChild(div);
                    c.appendChild(selection);
                }
            }
            return table;
        };
        this._createHourTable = function () {
            var table = document.createElement("table");
            table.cellSpacing = "0";
            table.cellPadding = "0";
            table.border = "0";
            table.style.border = '0px none';
            table.style.width = this.hourWidth + "px";
            table.oncontextmenu = function () { return false; };
            var hours = calendar._durationHours();
            for (var i = 0; i < hours; i++) {
                this._createHourRow(table, i);
            }
            return table;
        };
        this._createHourRow = function (table, i) {
            var height = (calendar.cellHeight * 60 / resolved._cellDuration());
            var r = table.insertRow(-1);
            r.style.height = height + "px";
            var c = r.insertCell(-1);
            c.valign = "bottom";
            c.unselectable = "on";
            c.style.cursor = "default";
            c.style.padding = '0px';
            c.style.border = '0px none';
            var frame = document.createElement("div");
            frame.style.position = "relative";
            frame.className = this._prefixCssClass("_rowheader");
            frame.style.width = this.hourWidth + "px";
            frame.style.height = (height) + "px";
            frame.style.overflow = 'hidden';
            frame.unselectable = 'on';
            var block = document.createElement("div");
            block.className = this._prefixCssClass("_rowheader_inner");
            block.unselectable = "on";
            var text = document.createElement("div");
            text.unselectable = "on";
            var start = this.startDate.addHours(i).addHours(calendar._visibleStart());
            var hour = start.getHours();
            var am = hour < 12;
            var timeFormat = resolved.timeFormat();
            if (timeFormat === "Clock12Hours") {
                hour = hour % 12;
                if (hour === 0) {
                    hour = 12;
                }
            }
            text.innerHTML = hour;
            var span = document.createElement("span");
            span.unselectable = "on";
            span.className = this._prefixCssClass("_rowheader_minutes");
            var sup;
            if (timeFormat === "Clock12Hours") {
                if (am) {
                    sup = "AM";
                }
                else {
                    sup = "PM";
                }
            }
            else {
                sup = "00";
            }
            span.innerHTML = sup;
            text.appendChild(span);
            block.appendChild(text);
            frame.appendChild(block);
            c.appendChild(frame);
        };
        this._getScrollableHeight = function () {
            var cellDuration = resolved._cellDuration();
            var perHour = 60 / cellDuration;
            switch (this.heightSpec) {
                case "Full":
                    return (24 * perHour * this.cellHeight);
                case "BusinessHours": {
                    var dHours = this._businessHoursSpan();
                    return dHours * this.cellHeight * perHour;
                }
                case "BusinessHoursNoScroll": {
                    var dHours = this._businessHoursSpan();
                    return dHours * this.cellHeight * perHour;
                }
                default:
                    throw "DayPilot.Calendar: Unexpected 'heightSpec' value.";
            }
        };
        this._updateCorner = function () {
            var parent = calendar.nav.corner ? calendar.nav.corner.parentNode : null;
            if (!parent) {
                return;
            }
            parent.innerHTML = '';
            var corner = this._drawCorner();
            parent.appendChild(corner);
            calendar.nav.corner = corner;
        };
        this._drawTopHeaderDiv = function () {
            var header = document.createElement("div");
            header.style.overflow = "auto";
            var table = document.createElement("table");
            table.cellPadding = "0";
            table.cellSpacing = "0";
            table.border = "0";
            table.style.width = "100%";
            table.style.borderCollapse = 'separate';
            table.style.border = "0px none";
            var r = table.insertRow(-1);
            var c = r.insertCell(-1);
            c.style.padding = '0px';
            c.style.border = '0px none';
            var corner = this._drawCorner();
            c.appendChild(corner);
            this.nav.corner = corner;
            c = r.insertCell(-1);
            c.style.width = "100%";
            c.valign = "top";
            c.style.position = 'relative';
            c.style.padding = '0px';
            c.style.border = '0px none';
            this.nav.header = document.createElement("table");
            this.nav.header.cellPadding = "0";
            this.nav.header.cellSpacing = "0";
            this.nav.header.border = "0";
            this.nav.header.width = "100%";
            this.nav.header.style.tableLayout = "fixed";
            this.nav.header.oncontextmenu = function () { return false; };
            var scrollbar = this.nav.scroll.style.overflow !== 'hidden';
            c.appendChild(this.nav.header);
            if (scrollbar) {
                c = r.insertCell(-1);
                c.unselectable = "on";
                var inside = document.createElement("div");
                inside.unselectable = "on";
                inside.style.position = "relative";
                inside.style.width = "16px";
                inside.style.height = this.headerHeight + "px";
                inside.className = this._prefixCssClass("_cornerright");
                var inner = document.createElement("div");
                inner.className = this._prefixCssClass('_cornerright_inner');
                inside.appendChild(inner);
                c.appendChild(inside);
                this.nav.cornerRight = inside;
            }
            header.appendChild(table);
            return header;
        };
        this._drawCorner = function () {
            var wrap = document.createElement("div");
            wrap.style.position = 'relative';
            wrap.className = this._prefixCssClass("_corner");
            wrap.style.width = this.hourWidth + "px";
            wrap.style.height = this.headerHeight + "px";
            wrap.oncontextmenu = function () { return false; };
            var corner = document.createElement("div");
            corner.unselectable = "on";
            corner.className = this._prefixCssClass("_corner_inner");
            wrap.appendChild(corner);
            return wrap;
        };
        this._disposeMain = function () {
            var table = this.nav.main;
            table.root = null;
            table.onmouseup = null;
            for (var y = 0; y < table.rows.length; y++) {
                var r = table.rows[y];
                for (var x = 0; x < r.cells.length; x++) {
                    var c = r.cells[x];
                    calendar._deleteCell(c);
                }
            }
            if (!this.fasterDispose) {
                DayPilot.pu(table);
            }
        };
        this._deleteCell = function (c) {
            if (!c) {
                return;
            }
            (function cellDomRemove() {
                var div = c;
                var domArgs = div.domArgs;
                div.domArgs = null;
                if (domArgs && typeof calendar.onBeforeCellDomRemove === "function") {
                    calendar.onBeforeCellDomRemove(domArgs);
                }
                if (domArgs && typeof calendar.onBeforeCellDomAdd === "function") {
                    var target = domArgs && domArgs._targetElement;
                    if (target) {
                        var isVue = calendar._vue._vueImport && isVueVNode(domArgs.element);
                        if (isVue) {
                            calendar._vue._renderingEvent = true;
                            calendar._vue._unmountVueComponent(target);
                            calendar._vue._renderingEvent = false;
                        }
                    }
                }
            })();
            c.root = null;
            c.onmousedown = null;
            c.onmousemove = null;
            c.onmouseout = null;
            c.onmouseup = null;
        };
        this._drawMain = function () {
            var cellDuration = resolved._cellDuration();
            var table = this.nav.main;
            var step = cellDuration * 60 * 1000;
            var rowCount = this._rowCount();
            var columns = calendar._columns;
            var create = true;
            if (table) {
                this._disposeMain();
            }
            while (table && table.rows && table.rows.length > 0 && create) {
                if (!this.fasterDispose) {
                    DayPilot.pu(table.rows[0]);
                }
                table.deleteRow(0);
            }
            this.tableCreated = true;
            var events = this.nav.events;
            while (events && events.rows && events.rows.length > 0 && create) {
                if (!this.fasterDispose) {
                    DayPilot.pu(events.rows[0]);
                }
                events.deleteRow(0);
            }
            var cl = columns.length;
            var r = (create) ? events.insertRow(-1) : events.rows[0];
            for (var j = 0; j < cl; j++) {
                var c = (create) ? r.insertCell(-1) : r.cells[j];
                if (create) {
                    c.style.padding = '0px';
                    c.style.border = '0px none';
                    c.style.height = '0px';
                    c.style.overflow = 'visible';
                    if (!calendar.rtl) {
                        c.style.textAlign = 'left';
                    }
                    var div = document.createElement("div");
                    div.style.marginRight = calendar.columnMarginRight + "px";
                    div.style.marginLeft = calendar.columnMarginLeft + "px";
                    div.style.position = 'relative';
                    div.style.height = '1px';
                    div.style.marginTop = '-1px';
                    var selection = document.createElement("div");
                    selection.style.position = "relative";
                    c.selection = selection;
                    c.appendChild(div);
                    c.appendChild(selection);
                }
            }
            for (var i = 0; i < rowCount; i++) {
                var r_1 = (create) ? table.insertRow(-1) : table.rows[i];
                if (create) {
                    r_1.style.MozUserSelect = 'none';
                    r_1.style.KhtmlUserSelect = 'none';
                }
                var _loop_1 = function (j) {
                    var col = this_1._columns[j];
                    var c = (create) ? r_1.insertCell(-1) : r_1.cells[j];
                    c.start = col.start.addTime(i * step);
                    c.end = c.start.addTime(step);
                    c.resource = col.id;
                    c.onmousedown = this_1._onCellMousedown;
                    c.onmouseup = function () {
                        return false;
                    };
                    c.onclick = function () {
                        return false;
                    };
                    if (create) {
                        c.root = this_1;
                        c.style.padding = '0px';
                        c.style.border = '0px none';
                        c.style.verticalAlign = 'top';
                        c.style.height = calendar.cellHeight + 'px';
                        c.style.overflow = 'hidden';
                        c.unselectable = 'on';
                        var div = document.createElement("div");
                        div.unselectable = 'on';
                        div.style.height = calendar.cellHeight + "px";
                        div.style.position = "relative";
                        div.className = this_1._prefixCssClass("_cell");
                        var business = this_1._isBusinessCell(c.start, c.end);
                        var properties = {
                            "business": business,
                            "text": null,
                            "html": null,
                            "cssClass": null,
                            "backColor": null,
                            "backImage": null,
                            "backRepeat": null,
                            "fontColor": null
                        };
                        var cellInfo_1 = {
                            "start": c.start,
                            "end": c.end,
                            "resource": c.resource,
                            "properties": properties,
                            "x": j,
                            "y": i,
                        };
                        (function () {
                            if (typeof calendar.onBeforeCellRender === 'function') {
                                var args = {};
                                args.cell = cellInfo_1;
                                calendar.onBeforeCellRender(args);
                            }
                        })();
                        if (properties.business) {
                            DayPilot.Util.addClass(div, calendar._prefixCssClass("_cell_business"));
                        }
                        if (properties.cssClass) {
                            DayPilot.Util.addClass(div, properties.cssClass);
                        }
                        var inner_1 = document.createElement("div");
                        inner_1.setAttribute("unselectable", "on");
                        inner_1.className = this_1._prefixCssClass("_cell_inner");
                        var html = DayPilot.Util.escapeTextHtml(properties.text, properties.html);
                        if (html) {
                            inner_1.innerHTML = html;
                        }
                        if (properties.backColor) {
                            inner_1.style.backgroundColor = properties.backColor;
                        }
                        if (properties.backImage) {
                            inner_1.style.backgroundImage = "url(" + properties.backImage + ")";
                        }
                        if (properties.backRepeat) {
                            inner_1.style.backgroundRepeat = properties.backRepeat;
                        }
                        if (properties.fontColor) {
                            inner_1.style.color = properties.fontColor;
                        }
                        div.appendChild(inner_1);
                        (function domAdd() {
                            if (typeof calendar.onBeforeCellDomAdd !== "function" && typeof calendar.onBeforeCellDomRemove !== "function") {
                                return;
                            }
                            var args = {};
                            args.control = calendar;
                            args.cell = cellInfo_1;
                            args.element = null;
                            c.domArgs = args;
                            if (typeof calendar.onBeforeCellDomAdd === "function") {
                                calendar.onBeforeCellDomAdd(args);
                            }
                            if (args.element) {
                                var target = inner_1;
                                if (target) {
                                    args._targetElement = target;
                                    var isVueNode = isVueVNode(args.element);
                                    if (isVueNode) {
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
                        c.appendChild(div);
                    }
                };
                var this_1 = this;
                for (var j = 0; j < cl; j++) {
                    _loop_1(j);
                }
            }
            table.root = this;
            calendar.nav.scrollable.onmousemove = function (ev) {
                var ref = calendar.nav.scrollable;
                calendar.coords = DayPilot.mo3(ref, ev);
                var mousePos = DayPilot.mc(ev);
                if (DayPilotCalendar.resizing) {
                    if (!DayPilotCalendar.resizingShadow) {
                        DayPilotCalendar.resizingShadow = calendar._createShadow(DayPilotCalendar.resizing, false, calendar.shadow);
                    }
                    var _step = calendar.cellHeight;
                    var _startOffset = 0;
                    var delta = (mousePos.y - DayPilotCalendar.originalMouse.y);
                    if (DayPilotCalendar.resizing.dpBorder === 'bottom') {
                        var newHeight = DayPilotCalendar.originalHeight + delta;
                        if (calendar.snapToGrid) {
                            newHeight = Math.floor(((DayPilotCalendar.originalHeight + DayPilotCalendar.originalTop + delta) + _step / 2) / _step) * _step - DayPilotCalendar.originalTop + _startOffset;
                        }
                        if (newHeight < _step) {
                            newHeight = _step;
                        }
                        var max = calendar.nav.main.clientHeight;
                        if (DayPilotCalendar.originalTop + newHeight > max) {
                            newHeight = max - DayPilotCalendar.originalTop;
                        }
                        DayPilotCalendar.resizingShadow.style.height = (newHeight) + 'px';
                    }
                    else if (DayPilotCalendar.resizing.dpBorder === 'top') {
                        var newTop = DayPilotCalendar.originalTop + delta;
                        if (calendar.snapToGrid) {
                            newTop = Math.floor(((DayPilotCalendar.originalTop + delta - _startOffset) + _step / 2) / _step) * _step + _startOffset;
                        }
                        if (newTop < _startOffset) {
                            newTop = _startOffset;
                        }
                        if (newTop > DayPilotCalendar.originalTop + DayPilotCalendar.originalHeight - _step) {
                            newTop = DayPilotCalendar.originalTop + DayPilotCalendar.originalHeight - _step;
                        }
                        var newHeight = DayPilotCalendar.originalHeight - (newTop - DayPilotCalendar.originalTop);
                        if (newHeight < _step) {
                            newHeight = _step;
                        }
                        else {
                            DayPilotCalendar.resizingShadow.style.top = newTop + 'px';
                        }
                        DayPilotCalendar.resizingShadow.style.height = (newHeight) + 'px';
                    }
                }
                else if (DayPilotCalendar.moving) {
                    if (!calendar.coords) {
                        return;
                    }
                    if (!DayPilotCalendar.movingShadow) {
                        var minDistance = 3;
                        var mousePos_1 = DayPilot.mc(ev);
                        var distance = Math.abs(mousePos_1.x - DayPilotCalendar.originalMouse.x) + Math.abs(mousePos_1.y - DayPilotCalendar.originalMouse.y);
                        if (distance <= minDistance) {
                            return;
                        }
                        DayPilotCalendar.movingShadow = calendar._createShadow(DayPilotCalendar.moving, true, calendar.shadow);
                        DayPilotCalendar.movingShadow.style.width = (DayPilotCalendar.movingShadow.parentNode.offsetWidth + 1) + 'px';
                    }
                    var _step = calendar.cellHeight;
                    var _startOffset = 0;
                    var offset = DayPilotCalendar.moveOffsetY;
                    if (!offset) {
                        offset = _step / 2;
                    }
                    var newTop = (calendar.coords.y - offset);
                    if (calendar.snapToGrid) {
                        newTop = Math.floor(((calendar.coords.y - offset - _startOffset) + _step / 2) / _step) * _step + _startOffset;
                    }
                    if (newTop < _startOffset) {
                        newTop = _startOffset;
                    }
                    var main = calendar.nav.events;
                    var max = calendar.nav.main.clientHeight + _startOffset;
                    var height = parseInt(DayPilotCalendar.movingShadow.style.height);
                    if (newTop + height > max) {
                        newTop = max - height;
                    }
                    DayPilot.Util.addClass(DayPilotCalendar.moving, calendar._prefixCssClass("_event_moving_source"));
                    DayPilotCalendar.movingShadow.parentNode.style.display = 'none';
                    DayPilotCalendar.movingShadow.style.top = newTop + 'px';
                    DayPilotCalendar.movingShadow.parentNode.style.display = '';
                    var colWidth = main.clientWidth / main.rows[0].cells.length;
                    var column = Math.floor((calendar.coords.x - calendar.hourWidth) / colWidth);
                    if (calendar.rtl) {
                        column = calendar._columns.length - column - 1;
                    }
                    if (column < 0) {
                        column = 0;
                    }
                    if (column < main.rows[0].cells.length && column >= 0 && DayPilotCalendar.movingShadow.column !== column) {
                        DayPilotCalendar.movingShadow.column = column;
                        DayPilotCalendar.moveShadow(main.rows[0].cells[column]);
                    }
                }
                else if (DayPilot.Global.selecting) {
                    calendar._updateSelectingEnd();
                    calendar._activateSelection();
                }
            };
            calendar.nav.scrollable.style.display = '';
        };
        this._isBusinessCell = function (start) {
            if (this.businessBeginsHour < this.businessEndsHour) {
                return !(start.getHours() < this.businessBeginsHour || start.getHours() >= this.businessEndsHour || start.getDayOfWeek() === 6 || start.getDayOfWeek() === 0);
            }
            if (start.getHours() >= this.businessBeginsHour) {
                return true;
            }
            if (start.getHours() < this.businessEndsHour) {
                return true;
            }
            return false;
        };
        this._disposeHeader = function () {
            var table = this.nav.header;
            if (table && table.rows) {
                for (var y = 0; y < table.rows.length; y++) {
                    var r = table.rows[y];
                    for (var x = 0; x < r.cells.length; x++) {
                        var c = r.cells[x];
                        c.onclick = null;
                        c.onmousemove = null;
                        c.onmouseout = null;
                    }
                }
            }
            if (!this.fasterDispose) {
                DayPilot.pu(table);
            }
        };
        this._drawHeaderRow = function (create) {
            var r = (create) ? this.nav.header.insertRow(-1) : this.nav.header.rows[0];
            var columns = this._columns;
            var len = columns.length;
            function drawHeaderCell(i) {
                var data = columns[i];
                var cell = (create) ? r.insertCell(-1) : r.cells[i];
                cell.data = data;
                cell.style.overflow = 'hidden';
                cell.style.padding = '0px';
                cell.style.border = '0px none';
                cell.style.height = (calendar.headerHeight) + "px";
                cell.onclick = calendar._headerClickDispatch;
                var div = (create) ? document.createElement("div") : cell.firstChild;
                var inner;
                if (create) {
                    div.unselectable = 'on';
                    div.style.MozUserSelect = 'none';
                    div.style.cursor = 'default';
                    div.style.position = 'relative';
                    div.className = calendar._prefixCssClass('_colheader');
                    div.style.height = calendar.headerHeight + "px";
                    if (!calendar.headerTextWrappingEnabled) {
                        div.style.whiteSpace = 'nowrap';
                    }
                    inner = document.createElement("div");
                    inner.className = calendar._prefixCssClass('_colheader_inner');
                    inner.unselectable = 'on';
                    div.appendChild(inner);
                    cell.appendChild(div);
                }
                else {
                    inner = div.firstChild;
                }
                var args = {};
                args.header = {};
                args.header.cssClass = null;
                args.header.verticalAlignment = "center";
                args.header.horizontalAlignment = "center";
                args.column = calendar._createColumn(data, calendar);
                if (typeof calendar.onBeforeHeaderRender === 'function') {
                    DayPilot.Util.copyProps(data, args.header, ['id', 'start', 'name', 'html', 'backColor', 'toolTip', 'areas']);
                    calendar.onBeforeHeaderRender(args);
                    DayPilot.Util.copyProps(args.header, data, ['html', 'backColor', 'toolTip', 'areas', 'cssClass', 'verticalAlignment', 'horizontalAlignment']);
                }
                if (data.toolTip) {
                    inner.title = data.toolTip;
                }
                if (data.cssClass) {
                    DayPilot.Util.addClass(div, data.cssClass);
                }
                if (data.backColor) {
                    inner.style.background = data.backColor;
                }
                if (data.areas) {
                    DayPilot.Areas.attach(div, data);
                }
                var va = data.verticalAlignment;
                if (va) {
                    inner.style.display = "flex";
                    switch (va) {
                        case "center":
                            inner.style.alignItems = "center";
                            break;
                        case "top":
                            inner.style.alignItems = "flex-start";
                            break;
                        case "bottom":
                            inner.style.alignItems = "flex-end";
                            break;
                    }
                }
                var ha = data.horizontalAlignment;
                if (ha) {
                    switch (ha) {
                        case "center":
                            inner.style.justifyContent = "center";
                            break;
                        case "left":
                            inner.style.justifyContent = "flex-start";
                            break;
                        case "right":
                            inner.style.justifyContent = "flex-end";
                            break;
                    }
                }
                var text = div.firstChild;
                text.innerHTML = calendar._xssTextHtml(data.name, data.html);
            }
            for (var i = 0; i < len; i++) {
                drawHeaderCell(i);
            }
        };
        this._headerClickDispatch = function (ev) {
            var handling = calendar.headerClickHandling;
            if (handling === "Disabled") {
                return;
            }
            var data = this.data;
            var c = calendar._createColumn(data);
            var args = {};
            args.header = {};
            args.header.id = data.id;
            args.header.name = data.name;
            args.header.start = data.start;
            args.column = c;
            args.originalEvent = ev;
            args.shift = ev.shiftKey;
            args.ctrl = ev.ctrlKey;
            args.meta = ev.metaKey;
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            if (typeof calendar.onHeaderClick === 'function') {
                calendar.onHeaderClick(args);
                if (args.preventDefault.value) {
                    return;
                }
            }
            if (typeof calendar.onHeaderClicked === 'function') {
                calendar.onHeaderClicked(args);
            }
        };
        this._createColumn = function (data) {
            return new DayPilot.CalendarColumn(data, calendar);
        };
        this._widthUnit = function () {
            if (this.width && this.width.indexOf("px") !== -1) {
                return "Pixel";
            }
            return "Percentage";
        };
        this._drawHeader = function () {
            var header = this.nav.header;
            var create = true;
            while (this.headerCreated && header && header.rows && header.rows.length > 0 && create) {
                if (!this.fasterDispose) {
                    DayPilot.pu(header.rows[0]);
                }
                header.deleteRow(0);
            }
            this.headerCreated = true;
            if (!create) {
                var corner = calendar.nav.corner;
                if (!this.fasterDispose) {
                    DayPilot.pu(corner.firstChild);
                }
            }
            this._drawHeaderRow(create);
        };
        this.loadingStart = function () {
            if (this.loadingLabelVisible) {
                this.nav.loading.innerHTML = this.loadingLabelText;
                this.nav.loading.style.top = (this.headerHeight + 5) + "px";
                this.nav.loading.style.display = '';
            }
        };
        this.commandCallBack = function (command, data) {
            var params = {};
            params.command = command;
            this._callBack2('Command', data, params);
        };
        this.loadingStop = function () {
            if (this.callbackTimeout) {
                window.clearTimeout(this.callbackTimeout);
            }
            this.nav.loading.style.display = 'none';
        };
        this._enableScrolling = function () {
            var scrollDiv = this.nav.scroll;
            scrollDiv.root = this;
            calendar._restoreScrollHour();
            if (!scrollDiv.onscroll) {
                scrollDiv.onscroll = function () {
                    calendar._saveScrollHour();
                };
            }
        };
        this.callbackError = function (result, context) {
            alert("Error!\r\nResult: " + result + "\r\nContext:" + context);
        };
        this._fixScrollHeader = function () {
            var w = DayPilot.sw(this.nav.scroll);
            var d = this.nav.cornerRight;
            if (d) {
                d.style.width = w + 'px';
            }
        };
        this._registerGlobalHandlers = function () {
            if (!DayPilotCalendar.globalHandlers) {
                DayPilotCalendar.globalHandlers = true;
                DayPilot.re(document, 'mouseup', DayPilotCalendar.gMouseUp);
            }
        };
        this.events = {};
        this.events.add = function (e) {
            var data = null;
            if (e instanceof DayPilot.Event) {
                data = e.data;
            }
            else if (typeof e === "object") {
                data = e;
            }
            else {
                throw "DayPilot.Calendar.events.add() expects an object or DayPilot.Event instance.";
            }
            if (!calendar.events.list) {
                calendar.events.list = [];
            }
            calendar.events.list.push(data);
            calendar._update({ "eventsOnly": true });
            calendar._angular.notify();
        };
        this.events.find = function (id) {
            if (!calendar.events.list) {
                return null;
            }
            if (typeof id === "function") {
                var fn = id;
                for (var i = 0; i < calendar.events.list.length; i++) {
                    var e = new DayPilot.Event(calendar.events.list[i], calendar);
                    if (fn(e)) {
                        return e;
                    }
                }
                return null;
            }
            for (var i = 0; i < calendar.events.list.length; i++) {
                var data = calendar.events.list[i];
                if (data.id === id) {
                    return new DayPilot.Event(data, calendar);
                }
            }
            return null;
        };
        this.events.forRange = function (start, end) {
            start = new DayPilot.Date(start);
            end = new DayPilot.Date(end);
            return (calendar.events.list || []).filter(function (item) {
                var estart = new DayPilot.Date(item.start);
                var eend = new DayPilot.Date(item.end);
                return overlaps(start, end, estart, eend);
            }).map(function (item) {
                return new DayPilot.Event(item, calendar);
            });
        };
        this.events.update = function (e) {
            if (e instanceof DayPilot.Event) {
                e.commit();
            }
            else if (typeof e === "object") {
                var target = calendar.events.find(e.id);
                if (target) {
                    var index = DayPilot.indexOf(calendar.events.list, target.data);
                    calendar.events.list.splice(index, 1, e);
                }
            }
            calendar._update({ "eventsOnly": true });
            calendar._angular.notify();
        };
        this.events.remove = function (e) {
            var data;
            if (e instanceof DayPilot.Event) {
                data = e.data;
            }
            else if (typeof e === "object") {
                var target = calendar.events.find(e.id);
                if (target) {
                    data = target.data;
                }
            }
            else if (typeof e === "string" || typeof e === "number") {
                var target = calendar.events.find(e);
                if (target) {
                    data = target.data;
                }
            }
            var index = DayPilot.indexOf(calendar.events.list, data);
            calendar.events.list.splice(index, 1);
            calendar._update({ "eventsOnly": true });
            calendar._angular.notify();
        };
        this.events.load = function (url, success, error) {
            var onError = function (args) {
                var largs = {};
                largs.exception = args.exception;
                largs.request = args.request;
                if (typeof error === 'function') {
                    error(largs);
                }
            };
            var onSuccess = function (args) {
                var r = args.request;
                var data;
                try {
                    data = JSON.parse(r.responseText);
                }
                catch (e) {
                    var fargs = {};
                    fargs.exception = e;
                    onError(fargs);
                    return;
                }
                if (DayPilot.isArray(data)) {
                    var sargs = {};
                    sargs.preventDefault = function () {
                        this.preventDefault.value = true;
                    };
                    sargs.data = data;
                    if (typeof success === "function") {
                        success(sargs);
                    }
                    if (sargs.preventDefault.value) {
                        return;
                    }
                    calendar.events.list = data;
                    if (calendar._initialized) {
                        calendar._update({ "eventsOnly": true });
                    }
                }
            };
            var usePost = calendar.eventsLoadMethod && calendar.eventsLoadMethod.toUpperCase() === "POST";
            if (usePost) {
                DayPilot.Http.ajax({
                    "method": "POST",
                    "data": { "start": calendar.visibleStart().toString(), "end": calendar.visibleEnd().toString() },
                    "url": url,
                    "success": onSuccess,
                    "error": onError
                });
            }
            else {
                var fullUrl = url;
                var queryString = "start=" + calendar.visibleStart().toString() + "&end=" + calendar.visibleEnd().toString();
                if (fullUrl.indexOf("?") > -1) {
                    fullUrl += "&" + queryString;
                }
                else {
                    fullUrl += "?" + queryString;
                }
                DayPilot.Http.ajax({
                    "method": "GET",
                    "url": fullUrl,
                    "success": onSuccess,
                    "error": onError
                });
            }
        };
        this._updateTheme = function () {
            var className = calendar._prefixCssClass("_main");
            if (calendar.cssClass) {
                className += " " + calendar.cssClass;
            }
            if (calendar.rtl) {
                className += " " + calendar._prefixCssClass("_direction_rtl");
            }
            var needsUpdate = calendar.nav.top.className !== className;
            if (!needsUpdate) {
                return;
            }
            calendar.nav.top.className = className;
            var corner = calendar.nav.corner;
            corner.className = calendar._prefixCssClass("_corner");
            corner.firstChild.className = calendar._prefixCssClass("_corner_inner");
            var cr = calendar.nav.cornerRight;
            if (cr) {
                cr.className = calendar._prefixCssClass("_cornerright");
                cr.firstChild.className = calendar._prefixCssClass("_cornerright_inner");
            }
        };
        this.update = function (options) {
            if (calendar._disposed) {
                throw new DayPilot.Exception("You are trying to update a DayPilot.Calendar instance that has been disposed.");
            }
            calendar._loadOptions(options);
            calendar._update();
        };
        this._update = function (args) {
            if (!this._initialized) {
                return;
            }
            args = args || {};
            var full = !args.eventsOnly;
            calendar._prepareVariables();
            calendar._deleteEvents();
            calendar.nav.top.style.cursor = "auto";
            if (full) {
                calendar._prepareColumns();
                calendar._drawHeader();
                calendar._drawMain();
                calendar._drawHourTable();
                calendar._updateHeight();
                calendar._updateCorner();
                calendar._fixScrollHeader();
                calendar._updateTheme();
                calendar._restoreScrollHour();
            }
            calendar._loadEvents();
            calendar._updateHeaderHeight();
            calendar._drawEvents();
            calendar.clearSelection();
            if (this.visible) {
                this.show();
            }
            else {
                this.hide();
            }
        };
        this._specialHandling = null;
        this._loadOptions = function (options) {
            if (!options) {
                return;
            }
            var specialHandling = {
                "events": {
                    "preInit": function () {
                        var events = this.data || [];
                        if (DayPilot.isArray(events.list)) {
                            calendar.events.list = events.list;
                        }
                        else {
                            calendar.events.list = events;
                        }
                    }
                },
                "columns": {
                    "preInit": function () {
                        calendar.columns.list = this.data;
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
        this._loadTop = function () {
            if (this.id && this.id.tagName) {
                this.nav.top = this.id;
            }
            else if (typeof this.id === "string") {
                this.nav.top = document.getElementById(this.id);
                if (!this.nav.top) {
                    throw "DayPilot.Calendar: The placeholder element not found: '" + id + "'.";
                }
            }
            else {
                throw "DayPilot.Calendar() constructor requires the target element or its ID as a parameter";
            }
        };
        this._cache = {};
        this._cache.events = [];
        this._doBeforeEventRender = function (i) {
            var cache = this._cache.events;
            var data = this.events.list[i];
            var evc = {};
            for (var name_3 in data) {
                evc[name_3] = data[name_3];
            }
            evc.start = new DayPilot.Date(data.start);
            evc.end = new DayPilot.Date(data.end);
            if (typeof this.onBeforeEventRender === 'function') {
                var args = {};
                args.control = calendar;
                args.data = evc;
                this.onBeforeEventRender(args);
            }
            cache[i] = evc;
        };
        this._loadEvents = function () {
            var events = this.events.list;
            calendar._cache.events = [];
            if (!events) {
                return;
            }
            if (!DayPilot.isArray(events)) {
                throw new DayPilot.Exception("DayPilot.Calendar.events.list expects an array object. You supplied: " + (typeof events));
            }
            var length = events.length;
            var duration = 24 * 60 * 60 * 1000;
            this.cache.pixels = {};
            var loadCache = [];
            this.scrollLabels = [];
            this.minStart = 10000;
            this.maxEnd = 0;
            for (var i = 0; i < length; i++) {
                var e = events[i];
                var edata = e;
                if (typeof edata !== "object") {
                    throw new DayPilot.Exception("Event data item must be an object");
                }
                if (!edata.start) {
                    throw new DayPilot.Exception("Event data item must specify 'start' property");
                }
                if (!edata.end) {
                    throw new DayPilot.Exception("Event data item must specify 'end' property");
                }
                if (edata instanceof DayPilot.Event) {
                    throw new DayPilot.Exception("DayPilot.Calendar: DayPilot.Event object detected in events.list array. Use raw event data instead.");
                }
            }
            if (typeof this.onBeforeEventRender === 'function') {
                for (var i = 0; i < length; i++) {
                    this._doBeforeEventRender(i);
                }
            }
            for (var i = 0; i < this._columns.length; i++) {
                var scroll_1 = {};
                scroll_1.minEnd = 1000000;
                scroll_1.maxStart = -1;
                this.scrollLabels.push(scroll_1);
                var col = this._columns[i];
                col.events = [];
                col.lines = [];
                col.blocks = [];
                var colStart = new DayPilot.Date(col.start);
                var colStartTicks = colStart.getTime();
                var colEnd = colStart.addTime(duration);
                var colEndTicks = colEnd.getTime();
                for (var j = 0; j < length; j++) {
                    if (loadCache[j]) {
                        continue;
                    }
                    var e = events[j];
                    var start = new DayPilot.Date(e.start);
                    var end = new DayPilot.Date(e.end);
                    var startTicks = start.getTime();
                    var endTicks = end.getTime();
                    if (endTicks < startTicks) {
                        continue;
                    }
                    var belongsHere = !(endTicks <= colStartTicks || startTicks >= colEndTicks);
                    if (calendar.viewType === "Resources") {
                        belongsHere = belongsHere && col.id === e.resource;
                    }
                    if (belongsHere) {
                        var ep = new DayPilot.Event(e, calendar);
                        ep.part.dayIndex = i;
                        ep.part.start = colStartTicks < startTicks ? start : colStart;
                        ep.part.end = colEndTicks > endTicks ? end : colEnd;
                        var partStartPixels = this.getPixels(ep.part.start, col.start);
                        var partEndPixels = this.getPixels(ep.part.end, col.start);
                        var top_3 = partStartPixels.top;
                        var bottom = partEndPixels.top;
                        if (top_3 === bottom && (partStartPixels.cut || partEndPixels.cut)) {
                            continue;
                        }
                        var boxBottom = partEndPixels.boxBottom;
                        var useBox = calendar.useEventBoxes === "Always";
                        if (useBox) {
                            ep.part.top = Math.floor(top_3 / this.cellHeight) * this.cellHeight + 1;
                            ep.part.height = Math.max(Math.ceil(boxBottom / this.cellHeight) * this.cellHeight - ep.part.top, this.cellHeight - 1) + 1;
                        }
                        else {
                            ep.part.top = top_3 + 1;
                            ep.part.height = bottom - top_3;
                        }
                        ep.part.barTop = Math.max(top_3 - ep.part.top - 1, 0);
                        ep.part.barHeight = Math.max(bottom - top_3 - 2, 1);
                        var partStart = ep.part.top;
                        var partEnd = ep.part.top + ep.part.height;
                        if (partStart > scroll_1.maxStart) {
                            scroll_1.maxStart = partStart;
                        }
                        if (partEnd < scroll_1.minEnd) {
                            scroll_1.minEnd = partEnd;
                        }
                        if (partStart < this.minStart) {
                            this.minStart = partStart;
                        }
                        if (partEnd > this.maxEnd) {
                            this.maxEnd = partEnd;
                        }
                        col.events.push(ep);
                        if (typeof this.onBeforeEventRender === 'function') {
                            ep.cache = this._cache.events[j];
                        }
                        if (ep.part.start.getTime() === startTicks && ep.part.end.getTime() === endTicks) {
                            loadCache[j] = true;
                        }
                    }
                }
            }
            for (var i = 0; i < this._columns.length; i++) {
                var col = this._columns[i];
                col.events.sort(this._eventComparer);
                for (var j = 0; j < col.events.length; j++) {
                    var e = col.events[j];
                    col.putIntoBlock(e);
                }
                for (var j = 0; j < col.blocks.length; j++) {
                    var block = col.blocks[j];
                    block.events.sort(this._eventComparer);
                    for (var k = 0; k < block.events.length; k++) {
                        var e = block.events[k];
                        block.putIntoLine(e);
                    }
                }
            }
        };
        this._eventComparer = function (a, b) {
            if (!a || !b || !a.start || !b.start) {
                return 0;
            }
            var byStart = a.start().getTime() - b.start().getTime();
            if (byStart !== 0) {
                return byStart;
            }
            var byEnd = b.end().getTime() - a.end().getTime();
            return byEnd;
        };
        this.debug = function (msg) {
            if (!this.debuggingEnabled) {
                return;
            }
            if (!calendar.debugMessages) {
                calendar.debugMessages = [];
            }
            calendar.debugMessages.push(msg);
            if (typeof console !== 'undefined') {
                console.log(msg);
            }
        };
        this.getPixels = function (date, start) {
            if (!start) {
                start = this.startDate;
            }
            var startTicks = start.getTime();
            var ticks = date.getTime();
            var cellDuration = resolved._cellDuration();
            var cache = this.cache.pixels[ticks + "_" + startTicks];
            if (cache) {
                return cache;
            }
            startTicks = start.getTime();
            var boxTicks = cellDuration * 60 * 1000;
            var topTicks = ticks - startTicks;
            var boxOffsetTicks = topTicks % boxTicks;
            var boxStartTicks = topTicks - boxOffsetTicks;
            var boxEndTicks = boxStartTicks + boxTicks;
            if (boxOffsetTicks === 0) {
                boxEndTicks = boxStartTicks;
            }
            var result = {};
            result.cut = false;
            result.top = this._ticksToPixels(topTicks);
            result.boxTop = this._ticksToPixels(boxStartTicks);
            result.boxBottom = this._ticksToPixels(boxEndTicks);
            this.cache.pixels[ticks + "_" + startTicks] = result;
            return result;
        };
        this._ticksToPixels = function (ticks) {
            return Math.floor((this.cellHeight * ticks) / (1000 * 60 * resolved._cellDuration()));
        };
        this._prepareVariables = function () {
            this.startDate = new DayPilot.Date(this.startDate).getDatePart();
        };
        this._updateHeaderHeight = function () {
            if (this.nav.corner) {
                this.nav.corner.style.height = this.headerHeight + "px";
            }
        };
        this._updateHeight = function () {
            var sh = this._getScrollableHeight();
            if (this.nav.scroll && sh > 0) {
                this.nav.scroll.style.height = sh + "px";
            }
        };
        this._angular = {};
        this._angular.scope = null;
        this._angular.notify = function () {
            if (calendar._angular.scope) {
                calendar._angular.scope["$apply"]();
            }
        };
        this._angular.apply = function (f) {
            f();
        };
        this._saveScrollHour = function () {
            if (!calendar.nav.scroll) {
                return;
            }
            if (!calendar._visible()) {
                return;
            }
            var top = calendar.nav.scroll.scrollTop;
            var cellDuration = resolved._cellDuration();
            var perHour = 60 / cellDuration;
            var pos = top / (perHour * calendar.cellHeight);
            calendar._config.scrollHour = pos;
        };
        this._restoreScrollHour = function () {
            var scrollpos = 0;
            var perHour = 60 / resolved._cellDuration();
            if (typeof calendar._config.scrollHour === "number") {
                scrollpos = perHour * calendar.cellHeight * calendar._config.scrollHour;
            }
            else {
                if (calendar.initScrollPos === 'Auto') {
                    if (this.heightSpec === "BusinessHours") {
                        scrollpos = perHour * this.cellHeight * this.businessBeginsHour;
                    }
                    else {
                        scrollpos = 0;
                    }
                }
                else {
                    scrollpos = this.initScrollPos;
                }
            }
            var top = calendar.nav.top;
            if (top.style.display === 'none') {
                top.style.display = '';
                calendar.nav.scroll.scrollTop = scrollpos;
                top.style.display = 'none';
            }
            else {
                calendar.nav.scroll.scrollTop = scrollpos;
            }
        };
        this.getScrollY = function () {
            return calendar.nav.scroll.scrollTop;
        };
        this.setScrollY = function (y) {
            calendar.nav.scroll.scrollTop = y;
            calendar._saveScrollHour();
        };
        this._loadFromServer = function () {
            if (this.backendUrl || typeof WebForm_DoCallback === 'function') {
                return (typeof calendar.events.list === 'undefined') || (!calendar.events.list);
            }
            else {
                return false;
            }
        };
        this._show = function () {
            if (this.nav.top.style.visibility === 'hidden') {
                this.nav.top.style.visibility = 'visible';
            }
        };
        this.show = function () {
            calendar.visible = true;
            calendar.nav.top.style.display = '';
            this._fixScrollHeader();
        };
        this.hide = function () {
            calendar.visible = false;
            calendar.nav.top.style.display = 'none';
        };
        this._initShort = function () {
            this._prepareVariables();
            this._prepareColumns();
            this._drawTop();
            this._drawHeader();
            this._drawMain();
            this._fixScrollHeader();
            this._enableScrolling();
            this._registerGlobalHandlers();
            DayPilotCalendar.register(this);
            this._waitForVisibility();
            this._callBack2('Init');
        };
        this._config = {};
        this._saveConfig = function () {
            this._config.themes = [];
            this._config.themes.push(this.theme || this.cssClassPrefix);
        };
        this._clearThemes = function () {
            var themes = this._config.themes;
            for (var i = 0; i < themes.length; i++) {
                var theme = themes[i];
                DayPilot.Util.removeClass(this.nav.top, theme + "_main");
            }
            this._config.themes = [];
        };
        this._doAfterRender = function () {
            this.afterRender(null, false);
            if (typeof this.onAfterRender === "function") {
                var args = {};
                args.isCallBack = false;
                this.onAfterRender(args);
            }
        };
        this._doInit = function () {
            if (typeof this.onInit === "function" && !this._onInitCalled) {
                this._onInitCalled = true;
                var args = {};
                this.onInit(args);
            }
        };
        this._visible = function () {
            var el = calendar.nav.top;
            if (!el) {
                return false;
            }
            return el.offsetWidth > 0 && el.offsetHeight > 0;
        };
        this._waitForVisibility = function () {
            var visible = calendar._visible;
            if (!visible()) {
                calendar._visibilityInterval = setInterval(function () {
                    if (visible()) {
                        calendar._enableScrolling();
                        calendar._fixScrollHeader();
                        clearInterval(calendar._visibilityInterval);
                    }
                }, 100);
            }
        };
        this._xssTextHtml = function (text, html) {
            if (calendar._resolved._xssProtectionEnabled()) {
                return DayPilot.Util.escapeTextHtml(text, html);
            }
            if (!DayPilot.Util.isNullOrUndefined(html)) {
                return html;
            }
            if (DayPilot.Util.isNullOrUndefined(text)) {
                return "";
            }
            return text;
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
        this.internal.xssTextHtml = calendar._xssTextHtml;
        this.internal.upd = function (options) {
            calendar.update(options);
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
        this.init = function () {
            this._loadTop();
            var loadFromServer = this._loadFromServer();
            this._saveConfig();
            if (loadFromServer) {
                this._initShort();
                return;
            }
            this._prepareVariables();
            this._prepareColumns();
            this._loadEvents();
            this._drawTop();
            this._drawHeader();
            this._drawMain();
            this._show();
            this._fixScrollHeader();
            this._enableScrolling();
            this._registerGlobalHandlers();
            DayPilotCalendar.register(this);
            if (this.events) {
                this._updateHeaderHeight();
                this._drawEvents();
            }
            this._doAfterRender();
            this._doInit();
            this._waitForVisibility();
            this._initialized = true;
            return this;
        };
        this.Init = this.init;
        this._loadOptions(options);
    };
    DayPilot.CalendarColumn = function (col, calendar) {
        var column = this;
        column.id = col.id;
        column.name = col.name;
        column.data = col.data;
        column.start = new DayPilot.Date(col.start);
        column.calendar = calendar;
        column.toJSON = function () {
            var json = {};
            json.id = this.id;
            if (this.start) {
                json.start = this.start.toString();
            }
            json.name = this.name;
            return json;
        };
    };
    DayPilot.Calendar = DayPilotCalendar.Calendar;
    if (typeof jQuery !== 'undefined') {
        (function ($) {
            $.fn.daypilotCalendar = function (options) {
                var first = null;
                var j = this.each(function () {
                    if (this.daypilot) {
                        return;
                    }
                    ;
                    var daypilot = new DayPilot.Calendar(this.id);
                    this.daypilot = daypilot;
                    for (var name_4 in options) {
                        daypilot[name_4] = options[name_4];
                    }
                    daypilot.init();
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
        app.directive("daypilotCalendar", ['$parse', function ($parse) {
                return {
                    "restrict": "E",
                    "template": "<div></div>",
                    "replace": true,
                    "link": function (scope, element, attrs) {
                        var calendar = new DayPilot.Calendar(element[0]);
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
                                (function (name) {
                                    calendar[name] = function (args) {
                                        var f = $parse(attrs[name]);
                                        scope["$apply"](function () {
                                            f(scope, { "args": args });
                                        });
                                    };
                                })(name_5);
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
                            calendar._doInit();
                        }, true);
                        watch.call(scope, events, function (value) {
                            calendar.events.list = value;
                            calendar.update();
                        }, true);
                    }
                };
            }]);
    })();
})(DayPilot);
