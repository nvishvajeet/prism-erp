/*
DayPilot Lite
Copyright (c) 2005 - 2026 Annpoint s.r.o.
https://www.daypilot.org/
Licensed under Apache Software License 2.0
Version: 2026.2.813-lite
*/
"use strict";
var DayPilot = {
    Global: {}
};
(function (DayPilot) {
    'use strict';
    if (typeof DayPilot.$ !== 'undefined') {
        return;
    }
    if (typeof DayPilot.Global === "undefined") {
        DayPilot.Global = {};
    }
    DayPilot.$ = function (id) {
        return document.getElementById(id);
    };
    DayPilot.touch = {};
    DayPilot.touch.start = "touchstart";
    DayPilot.touch.move = "touchmove";
    DayPilot.touch.end = "touchend";
    DayPilot.mo3 = function (target, ev) {
        var e = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
        if (!target) {
            var px = (e.pageX !== undefined) ? e.pageX : (e.clientX + window.pageXOffset);
            var py = (e.pageY !== undefined) ? e.pageY : (e.clientY + window.pageYOffset);
            return { x: px, y: py, shift: !!ev.shiftKey, meta: !!ev.metaKey, ctrl: !!ev.ctrlKey, alt: !!ev.altKey };
        }
        var rect = target.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        x = Math.round(x);
        y = Math.round(y);
        return { x: x, y: y, shift: !!ev.shiftKey, meta: !!ev.metaKey, ctrl: !!ev.ctrlKey, alt: !!ev.altKey };
    };
    DayPilot.browser = {
        get ios() {
            var _a, _b;
            return typeof navigator !== "undefined" &&
                (((_a = navigator.userAgent) === null || _a === void 0 ? void 0 : _a.includes("iPad")) ||
                    ((_b = navigator.userAgent) === null || _b === void 0 ? void 0 : _b.includes("iPhone")));
        },
        get hover() {
            return !window.matchMedia("(any-hover: none)").matches;
        }
    };
    DayPilot.debounce = function (func, wait) {
        var timeout;
        return function () {
            var context = this;
            var args = arguments;
            var later = function () {
                timeout = null;
                func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };
    DayPilot.page = function (ev) {
        var target = ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0] : ev;
        if (typeof target.pageX !== 'undefined') {
            return { x: target.pageX, y: target.pageY };
        }
        if (typeof ev.clientX !== 'undefined' && document.body && document.documentElement) {
            return {
                x: ev.clientX + document.body.scrollLeft + document.documentElement.scrollLeft,
                y: ev.clientY + document.body.scrollTop + document.documentElement.scrollTop
            };
        }
        return null;
    };
    DayPilot.abs = function (element, visible) {
        if (!element) {
            return null;
        }
        if (element.getBoundingClientRect) {
            var r = DayPilot.absBoundingClientBased(element);
            if (visible) {
                var full = DayPilot.absOffsetBased(element, false);
                var visible_1 = DayPilot.absOffsetBased(element, true);
                r.x += visible_1.x - full.x;
                r.y += visible_1.y - full.y;
                r.w = visible_1.w;
                r.h = visible_1.h;
            }
            return r;
        }
        else {
            return DayPilot.absOffsetBased(element, visible);
        }
    };
    DayPilot.absBoundingClientBased = function (element) {
        var elemRect = element.getBoundingClientRect();
        return {
            x: elemRect.left + window.pageXOffset,
            y: elemRect.top + window.pageYOffset,
            w: element.clientWidth,
            h: element.clientHeight,
            toString: function () {
                return "x:" + this.x + " y:" + this.y + " w:" + this.w + " h:" + this.h;
            }
        };
    };
    DayPilot.absOffsetBased = function (element, visible) {
        var r = {
            x: element.offsetLeft,
            y: element.offsetTop,
            w: element.clientWidth,
            h: element.clientHeight,
            toString: function () {
                return "x:" + this.x + " y:" + this.y + " w:" + this.w + " h:" + this.h;
            }
        };
        while (element.offsetParent) {
            element = element.offsetParent;
            r.x -= element.scrollLeft;
            r.y -= element.scrollTop;
            if (visible) {
                if (r.x < 0) {
                    r.w += r.x;
                    r.x = 0;
                }
                if (r.y < 0) {
                    r.h += r.y;
                    r.y = 0;
                }
                if (element.scrollLeft > 0 && r.x + r.w > element.clientWidth) {
                    r.w -= r.x + r.w - element.clientWidth;
                }
                if (element.scrollTop && r.y + r.h > element.clientHeight) {
                    r.h -= r.y + r.h - element.clientHeight;
                }
            }
            r.x += element.offsetLeft;
            r.y += element.offsetTop;
        }
        var pageOffset = DayPilot.pageOffset();
        r.x += pageOffset.x;
        r.y += pageOffset.y;
        return r;
    };
    DayPilot.isArray = function (o) {
        return Object.prototype.toString.call(o) === '[object Array]';
    };
    DayPilot.distance = function (point1, point2) {
        return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
    };
    DayPilot.sheet = function () {
        var _a, _b;
        var blank = {
            add: function () { },
            commit: function () { },
            print: function () { return ""; }
        };
        if (typeof globalThis !== "undefined" && globalThis.__DayPilotDisableCssInjection) {
            return blank;
        }
        if (typeof window === "undefined") {
            return blank;
        }
        var doc = window.document;
        var disableUsingMeta = ((_b = (_a = doc.querySelector('meta[name="daypilot:css"]')) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === "disable";
        if (disableUsingMeta) {
            return blank;
        }
        function getStyleNonce() {
            var styleNodes = document.querySelectorAll('style[nonce]');
            for (var i = 0; i < styleNodes.length; i++) {
                var styleEl = styleNodes[i];
                if (styleEl.nonce) {
                    return styleEl.nonce;
                }
            }
            if (document.currentScript && document.currentScript.nonce) {
                return document.currentScript.nonce;
            }
            var scriptNodes = document.querySelectorAll('script[nonce]');
            for (var j = 0; j < scriptNodes.length; j++) {
                var scriptEl = scriptNodes[j];
                if (scriptEl.nonce) {
                    return scriptEl.nonce;
                }
            }
            return '';
        }
        var style = document.createElement("style");
        style.nonce = getStyleNonce();
        if (!style.styleSheet) {
            style.appendChild(document.createTextNode(""));
        }
        var h = document.head || document.getElementsByTagName('head')[0];
        h.appendChild(style);
        var oldStyle = !!style.styleSheet;
        var sheet = {};
        sheet.rules = [];
        sheet.commit = function () {
            if (oldStyle) {
                style.styleSheet.cssText = this.rules.join("\n");
            }
        };
        sheet.add = function (selector, rules, index) {
            if (oldStyle) {
                this.rules.push(selector + "{" + rules + "\u007d");
                return;
            }
            if (style.sheet.insertRule) {
                if (typeof index === "undefined") {
                    index = style.sheet.cssRules.length;
                }
                style.sheet.insertRule(selector + "{" + rules + "\u007d", index);
            }
            else if (style.sheet.addRule) {
                style.sheet.addRule(selector, rules, index);
            }
        };
        return sheet;
    };
    DayPilot.gs = function (el, styleProp) {
        return window.getComputedStyle(el, null).getPropertyValue(styleProp) || "";
    };
    DayPilot.StyleReader = function (element) {
        this.get = function (property) {
            if (!element) {
                return null;
            }
            return DayPilot.gs(element, property);
        };
        this.getPx = function (property) {
            var val = this.get(property);
            if (val.indexOf("px") === -1) {
                return undefined;
            }
            else {
                return parseInt(val, 10);
            }
        };
    };
    (function () {
        if (DayPilot.Global.defaultCss) {
            return;
        }
        var sheet = DayPilot.sheet();
        sheet.add(".menu_default_main", "position: relative;border-radius: 4px;box-shadow: 0 0px 10px 0px #00000022;user-select:none;font-family: -apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size: 13px;border: 1px solid #cccccc;background-color: white;padding: 0px;cursor: default;");
        sheet.add(".menu_default_main:before", "content: '';position: absolute;top: 0;bottom: 0;left: 28px;border-left: 1px solid #d9d9d9;pointer-events: none;");
        sheet.add(".menu_default_main.menu_default_direction_rtl:before", "left: auto;right: 28px;border-left: none;border-right: 1px solid #d9d9d9;");
        sheet.add(".menu_default_main, .menu_default_main *, .menu_default_main *:before, .menu_default_main *:after", "box-sizing: content-box;");
        sheet.add(".menu_default_title", "background-color: #f2f2f2;border-bottom: 1px solid gray;padding: 4px 4px 4px 37px;");
        sheet.add(".menu_default_main.menu_default_direction_rtl .menu_default_title", "padding: 4px 37px 4px 4px;");
        sheet.add(".menu_default_main a", "padding: 2px 2px 2px 35px;color: black;text-decoration: none;cursor: default;");
        sheet.add(".menu_default_main.menu_default_direction_rtl a", "padding: 2px 35px 2px 2px;");
        sheet.add(".menu_default_main.menu_default_withchildren a", "padding: 2px 35px 2px 35px;");
        sheet.add(".menu_default_main a img", "margin-left: 6px;margin-top: 2px;");
        sheet.add(".menu_default_main.menu_default_direction_rtl a img", "margin-left: 0px;margin-right: 6px;");
        sheet.add(".menu_default_item_text", "display: block;height: 20px;line-height: 20px;overflow:hidden;padding-left: 2px;padding-right: 20px;white-space: nowrap;");
        sheet.add(".menu_default_main.menu_default_direction_rtl .menu_default_item_text", "padding-left: 20px;padding-right: 2px;");
        sheet.add(".menu_default_main a:hover", "background-color: #f3f3f3;");
        sheet.add(".menu_default_main div div", "border-top: 1px solid #dddddd;margin-top: 2px;margin-bottom: 2px;margin-left: 28px;");
        sheet.add(".menu_default_main.menu_default_direction_rtl div div", "margin-left: 0px;margin-right: 28px;");
        sheet.add(".menu_default_main a.menu_default_item_disabled", "color: #ccc");
        sheet.add(".menu_default_item_haschildren.menu_default_item_haschildren_active", "background-color: #f3f3f3;");
        sheet.add(".menu_default_item_haschildren a:before", "content: '';border-width: 5px;border-color: transparent transparent transparent #666;border-style: solid;width: 0px;height: 0px;position: absolute;right: 5px;margin-top: 5px;");
        sheet.add(".menu_default_main.menu_default_direction_rtl .menu_default_item_haschildren a:before", "border-color: transparent #666 transparent transparent;right: auto;left: 5px;");
        sheet.add(".menu_default_item_icon", "position: absolute;top: 0px;left: 0px;padding: 2px 2px 2px 8px;");
        sheet.add(".menu_default_main.menu_default_direction_rtl .menu_default_item_icon", "left: auto;right: 0px;padding: 2px 8px 2px 2px;");
        sheet.add(".menu_default_item a i", "height: 20px;line-height: 20px;");
        sheet.add(".menu_default_item .menu_default_item_symbol", "width: 18px;height: 18px;color: #999;margin-left: 6px;margin-top: 2px;");
        sheet.add(".menu_default_main.menu_default_direction_rtl .menu_default_item_symbol", "margin-left: 0px;margin-right: 6px;");
        sheet.add(".menubar_default_main", "border-bottom: 1px solid #ccc; font-family: -apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; font-size: 13px; user-select:none;");
        sheet.add(".menubar_default_item", "display: inline-block;  padding: 6px 10px; cursor: default;");
        sheet.add(".menubar_default_item:hover", "background-color: #f2f2f2;");
        sheet.add(".menubar_default_item_active", "background-color: #f2f2f2;");
        sheet.add(".calendar_default_main", "--dp-calendar-border-color: #c0c0c0;" +
            "--dp-calendar-font-family: -apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;" +
            "--dp-calendar-font-size: 13px;" +
            "--dp-calendar-header-bg-color: #f3f3f3;" +
            "--dp-calendar-header-color: #333;" +
            "--dp-calendar-colheader-padding: 0px;" +
            "--dp-calendar-rowheader-font-size: 16pt;" +
            "--dp-calendar-rowheader-padding: 3px;" +
            "--dp-calendar-cell-bg-color: #f9f9f9;" +
            "--dp-calendar-cell-business-bg-color: #ffffff;" +
            "--dp-calendar-cell-border-color: #ddd;" +
            "--dp-calendar-colheader-horizontal-align: center;" +
            "--dp-calendar-colheader-vertical-align: center;" +
            "--dp-calendar-allday-event-color: #333;" +
            "--dp-calendar-allday-event-border-color: #999;" +
            "--dp-calendar-allday-event-border: 1px solid var(--dp-calendar-allday-event-border-color);" +
            "--dp-calendar-allday-event-border-radius: 4px;" +
            "--dp-calendar-allday-event-background: linear-gradient(to bottom, var(--dp-calendar-allday-event-bg-top-color) 0%, var(--dp-calendar-allday-event-bg-bottom-color) 100%);" +
            "--dp-calendar-allday-event-bg-top-color: #ffffff;" +
            "--dp-calendar-allday-event-bg-bottom-color: #eeeeee;" +
            "--dp-calendar-allday-event-background-hover: linear-gradient(to bottom, var(--dp-calendar-allday-event-bg-top-color-hover) 0%, var(--dp-calendar-allday-event-bg-bottom-color-hover) 100%);" +
            "--dp-calendar-allday-event-bg-top-color-hover: #f8f8f8;" +
            "--dp-calendar-allday-event-bg-bottom-color-hover: #e8e8e8;" +
            "--dp-calendar-allday-event-box-shadow: none;" +
            "--dp-calendar-allday-event-padding: 4px;" +
            "--dp-calendar-allday-event-horizontal-align: flex-start;" +
            "--dp-calendar-event-color: #333;" +
            "--dp-calendar-event-border-color: #999;" +
            "--dp-calendar-event-border: 1px solid var(--dp-calendar-event-border-color);" +
            "--dp-calendar-event-border-radius: 4px;" +
            "--dp-calendar-event-box-shadow: none;" +
            "--dp-calendar-event-background: linear-gradient(to bottom, var(--dp-calendar-event-bg-top-color) 0%, var(--dp-calendar-event-bg-bottom-color) 100%);" +
            "--dp-calendar-event-bg-top-color: #ffffff;" +
            "--dp-calendar-event-bg-bottom-color: #eeeeee;" +
            "--dp-calendar-event-background-hover: linear-gradient(to bottom, var(--dp-calendar-event-bg-top-color-hover) 0%, var(--dp-calendar-event-bg-bottom-color-hover) 100%);" +
            "--dp-calendar-event-bg-top-color-hover: #f8f8f8;" +
            "--dp-calendar-event-bg-bottom-color-hover: #f1f1f1;" +
            "--dp-calendar-event-bar-bg-color: #9dc8e8;" +
            "--dp-calendar-event-bar-color: #208fe3;" +
            "--dp-calendar-event-bar-width: 6px;" +
            "--dp-calendar-event-bar-left: 0px;" +
            "--dp-calendar-event-bar-bottom: 0px;" +
            "--dp-calendar-event-bar-top: 0px;" +
            "--dp-calendar-event-bar-display: block;" +
            "--dp-calendar-event-padding: 2px;" +
            "--dp-calendar-event-padding-left: 8px;" +
            "--dp-calendar-message-bg-color: #ffa216;" +
            "--dp-calendar-message-color: #ffffff;" +
            "--dp-calendar-message-padding: 10px;" +
            "--dp-calendar-message-opacity: 0.9;" +
            "--dp-calendar-selected-event-bg-color: #ddd;" +
            "--dp-calendar-shadow-color: #bbbbbb;" +
            "--dp-calendar-shadow-border-color: #888888;" +
            "--dp-calendar-forbidden-shadow-border-color: #cc0000;" +
            "--dp-calendar-forbidden-shadow-bg-color: #cc4125;" +
            "--dp-calendar-now-indicator-color: red;" +
            "--dp-calendar-scroll-bg-color: #f3f3f3;");
        sheet.add(".calendar_default_main *, .calendar_default_main *:before, .calendar_default_main *:after", "box-sizing: content-box;");
        sheet.add(".calendar_default_main", "border:1px solid var(--dp-calendar-border-color); font-family:var(--dp-calendar-font-family); font-size:var(--dp-calendar-font-size);");
        sheet.add(".calendar_default_rowheader_inner, .calendar_default_cornerright_inner, .calendar_default_corner_inner, .calendar_default_colheader_inner, .calendar_default_alldayheader_inner", "color: var(--dp-calendar-header-color); background: var(--dp-calendar-header-bg-color);");
        sheet.add(".calendar_default_colheader_back", "background: var(--dp-calendar-header-bg-color); border-bottom: 1px solid red;");
        sheet.add(".calendar_default_colheader_back_inner", "position: absolute; inset: 0; border-bottom: 1px solid var(--dp-calendar-border-color);");
        sheet.add(".calendar_default_cornerright_inner", "position: absolute; top: 0px; left: 0px; bottom: 0px; right: 0px; border-bottom: 1px solid var(--dp-calendar-border-color);");
        sheet.add(".calendar_default_direction_rtl .calendar_default_cornerright_inner", "border-right: 1px solid var(--dp-calendar-border-color);");
        sheet.add(".calendar_default_rowheader_inner", "font-size: var(--dp-calendar-rowheader-font-size); text-align: right; position: absolute; top: 0px; left: 0px; bottom: 0px; right: 0px; border-right: 1px solid var(--dp-calendar-border-color); border-bottom: 1px solid var(--dp-calendar-border-color); padding: var(--dp-calendar-rowheader-padding);");
        sheet.add(".calendar_default_rowheader_simple .calendar_default_rowheader_inner", "font-size: inherit; display: flex; align-items: center; justify-content: center; white-space: nowrap;");
        sheet.add(".calendar_default_direction_rtl .calendar_default_rowheader_inner", "border-right: none;");
        sheet.add(".calendar_default_corner_inner", "position: absolute; top: 0px; left: 0px; bottom: 0px; right: 0px; border-right: 1px solid var(--dp-calendar-border-color); border-bottom: 1px solid var(--dp-calendar-border-color);");
        sheet.add(".calendar_default_direction_rtl .calendar_default_corner_inner", "border-right: none;");
        sheet.add(".calendar_default_rowheader_minutes", "font-size: 10px; vertical-align: super; padding-left: 2px; padding-right: 2px;");
        sheet.add(".calendar_default_colheader_inner", "position: absolute; top: 0px; left: 0px; bottom: 0px; right: 0px; padding: var(--dp-calendar-colheader-padding);border-right: 1px solid var(--dp-calendar-border-color); border-bottom: 1px solid var(--dp-calendar-border-color); display: flex; align-items: var(--dp-calendar-colheader-vertical-align); justify-content: var(--dp-calendar-colheader-horizontal-align);");
        sheet.add(".calendar_default_cell_inner", "position: absolute; top: 0px; left: 0px; bottom: 0px; right: 0px; border-right: 1px solid var(--dp-calendar-cell-border-color); border-bottom: 1px solid var(--dp-calendar-cell-border-color); background: var(--dp-calendar-cell-bg-color);");
        sheet.add(".calendar_default_cell_business .calendar_default_cell_inner", "background: var(--dp-calendar-cell-business-bg-color);");
        sheet.add(".calendar_default_alldayheader_inner", "text-align: center; position: absolute; top: 0px; left: 0px; bottom: 0px; right: 0px; border-right: 1px solid var(--dp-calendar-border-color); border-bottom: 1px solid var(--dp-calendar-border-color);");
        sheet.add(".calendar_default_message", "opacity: var(--dp-calendar-message-opacity); padding: var(--dp-calendar-message-padding); color: var(--dp-calendar-message-color); background: var(--dp-calendar-message-bg-color);");
        sheet.add(".calendar_default_event_inner", "border: var(--dp-calendar-event-border); border-radius: var(--dp-calendar-event-border-radius); background: var(--dp-calendar-event-background);");
        sheet.add(".calendar_default_event:hover .calendar_default_event_inner", "background: var(--dp-calendar-event-background-hover);");
        sheet.add(".calendar_default_alldayevent", "color: var(--dp-calendar-allday-event-color);box-shadow: var(--dp-calendar-allday-event-box-shadow); border-radius: var(--dp-calendar-allday-event-border-radius);");
        sheet.add(".calendar_default_alldayevent_inner", "border: var(--dp-calendar-allday-event-border); border-radius: var(--dp-calendar-allday-event-border-radius); background: var(--dp-calendar-allday-event-background);");
        sheet.add(".calendar_default_alldayevent:hover .calendar_default_alldayevent_inner", "background: var(--dp-calendar-allday-event-background-hover);");
        sheet.add(".calendar_default_event_bar", "display: var(--dp-calendar-event-bar-display); top: var(--dp-calendar-event-bar-top); bottom: var(--dp-calendar-event-bar-bottom); left: var(--dp-calendar-event-bar-left); width: var(--dp-calendar-event-bar-width); background-color: var(--dp-calendar-event-bar-bg-color);");
        sheet.add(".calendar_default_direction_rtl .calendar_default_event_bar", "top: 0px; bottom: 0px; right: 0px; width: var(--dp-calendar-event-bar-width); background-color: var(--dp-calendar-event-bar-bg-color);");
        sheet.add(".calendar_default_event_bar_inner", "position: absolute; width: var(--dp-calendar-event-bar-width); background-color: var(--dp-calendar-event-bar-color);");
        sheet.add(".calendar_default_selected .calendar_default_event_inner, .calendar_default_event:hover.calendar_default_selected .calendar_default_event_inner", "background: var(--dp-calendar-selected-event-bg-color);");
        sheet.add(".calendar_default_alldayevent_inner", "position: absolute; top: 0px; bottom: 0px; left: 0px; right: 0px; overflow: hidden; padding: var(--dp-calendar-allday-event-padding); margin-right: 0px; display: flex; align-items: center; justify-content: var(--dp-calendar-allday-event-horizontal-align);");
        sheet.add(".calendar_default_event_withheader .calendar_default_event_inner", "padding-top: 15px;");
        sheet.add(".calendar_default_event", "color: var(--dp-calendar-event-color); box-shadow: var(--dp-calendar-event-box-shadow); border-radius: var(--dp-calendar-event-border-radius); cursor: default;");
        sheet.add(".calendar_default_event_inner", "position: absolute; overflow: hidden; top: 0px; bottom: 0px; left: 0px; right: 0px; padding: var(--dp-calendar-event-padding) var(--dp-calendar-event-padding) var(--dp-calendar-event-padding) var(--dp-calendar-event-padding-left);");
        sheet.add(".calendar_default_direction_rtl .calendar_default_event_inner", "padding: 2px 8px 2px 2px;");
        sheet.add(".calendar_default_shadow_inner", "box-sizing: border-box; background-color: var(--dp-calendar-shadow-color); border: 1px solid var(--dp-calendar-shadow-border-color); border-radius: var(--dp-calendar-event-border-radius); opacity: 0.5; height: 100%;");
        sheet.add(".calendar_default_shadow", "box-shadow: 0 2px 5px rgba(0,0,0,0.2); border-radius: var(--dp-calendar-event-border-radius);");
        sheet.add(".calendar_default_shadow_forbidden:after", "content: ''; position: absolute; top: 5px; left: calc(50% - 10px); border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2720%27 height=%2720%27 viewBox=%270 0 20 20%27%3E%3Ccircle cx=%2710%27 cy=%2710%27 r=%279%27 fill=%27%23cc0000aa%27 /%3E%3Cline x1=%275%27 y1=%275%27 x2=%2715%27 y2=%2715%27 stroke=%27white%27 stroke-width=%271.5%27/%3E%3Cline x1=%2715%27 y1=%275%27 x2=%275%27 y2=%2715%27 stroke=%27white%27 stroke-width=%271.5%27/%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: center; background-size: contain;");
        sheet.add(".calendar_default_shadow_forbidden .calendar_default_shadow_inner", "border: 1px solid var(--dp-calendar-forbidden-shadow-border-color); background: var(--dp-calendar-forbidden-shadow-bg-color);");
        sheet.add(".calendar_default_event_delete", "opacity:0.4;cursor:pointer;background-color:currentColor;-webkit-mask-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTInIGhlaWdodD0nMTInIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTSAwLjUgMC41IEwgMTEuNSAxMS41IE0gMC41IDExLjUgTCAxMS41IDAuNScgc3R5bGU9J2ZpbGw6bm9uZTtzdHJva2U6Y3VycmVudENvbG9yO3N0cm9rZS13aWR0aDozO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbGluZWNhcDpidXR0JyAvPjwvc3ZnPg==);-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:12px 12px;mask-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTInIGhlaWdodD0nMTInIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTSAwLjUgMC41IEwgMTEuNSAxMS41IE0gMC41IDExLjUgTCAxMS41IDAuNScgc3R5bGU9J2ZpbGw6bm9uZTtzdHJva2U6Y3VycmVudENvbG9yO3N0cm9rZS13aWR0aDozO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbGluZWNhcDpidXR0JyAvPjwvc3ZnPg==);mask-repeat:no-repeat;mask-position:center;mask-size:12px 12px;background-image:none;");
        sheet.add(".calendar_default_event_delete:hover", "opacity: 0.7;");
        sheet.add(".calendar_default_scroll_up", "background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAB3RJTUUH2wESDiYcrhwCiQAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAARnQU1BAACxjwv8YQUAAACcSURBVHjaY2AgF9wWsTW6yGMlhi7OhC7AyMDQzMnBXIpFHAFuCtuaMTP+P8nA8P/b1x//FfW/HHuF1UQmxv+NUP1c3OxMVVhNvCVi683E8H8LXOY/w9+fTH81tF8fv4NiIpBRj+YoZtZ/LDUoJmKYhsVUpv0MDiyMDP96sIYV0FS2/8z9ICaLlOhvS4b/jC//MzC8xBG0vJeF7GQBlK0xdiUzCtsAAAAASUVORK5CYII=);");
        sheet.add(".calendar_default_scroll_down", "background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAALiMAAC4jAXilP3YAAACqSURBVChTY7wpam3L9J+xmQEP+PGPKZZxP4MDi4zI78uMDIwa2NT+Z2DYovrmiC+TI8OBP/8ZmEqwGvif4e8vxr+FIDkmEKH25vBWBgbG0+iK/zEwLtF+ffwOXCGI8Y+BoRFFIdC030x/WmBiYBNhpgLdswNJ8RSYaSgmgk39z1gPUfj/29ef/9rwhQTDHRHbrbdEbLvRFcGthkkAra/9/uMvhkK8piNLAgCRpTnNn4AEmAAAAABJRU5ErkJggg==);");
        sheet.add(".calendar_default_now", "background-color: var(--dp-calendar-now-indicator-color);");
        sheet.add(".calendar_default_now:before", "content: ''; top: -5px; border-width: 5px; border-color: transparent transparent transparent var(--dp-calendar-now-indicator-color); border-style: solid; width: 0px; height: 0px; position: absolute; -moz-transform: scale(.9999);");
        sheet.add(".calendar_default_shadow_top", "box-sizing: border-box; padding: 2px; border: 1px solid var(--dp-calendar-border-color); background: linear-gradient(to bottom, #ffffff 0%, #eeeeee); pointer-events: none;");
        sheet.add(".calendar_default_shadow_bottom", "box-sizing: border-box; padding: 2px; border: 1px solid var(--dp-calendar-border-color); background: linear-gradient(to bottom, #ffffff 0%, #eeeeee); pointer-events: none;");
        sheet.add(".calendar_default_crosshair_vertical, .calendar_default_crosshair_horizontal, .calendar_default_crosshair_left, .calendar_default_crosshair_top", "background-color: gray; opacity: 0.2;");
        sheet.add(".calendar_default_loading", "background-color: orange; color: white; padding: 2px;");
        sheet.add(".calendar_default_scroll", "background-color: var(--dp-calendar-header-bg-color);");
        sheet.add(".calendar_default_event_moving_source", "opacity: 0.5;");
        sheet.add(".calendar_default_colmove_handle", "background-repeat: no-repeat; background-position: center center; background-color: #ccc; background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAKCAYAAACT+/8OAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAadEVYdFNvZnR3YXJlAFBhaW50Lk5FVCB2My41LjExR/NCNwAAAClJREFUGFdj+P//P4O9vX2Bg4NDP4gNFgBytgPxebgAMsYuQGMz/jMAAFsTZDPYJlDHAAAAAElFTkSuQmCC); cursor: move;");
        sheet.add(".calendar_default_colheader:hover .calendar_default_colheader_splitter", "background-color: #c0c0c0;");
        sheet.add(".calendar_default_colmove_source", "background-color: black; opacity: 0.5;");
        sheet.add(".calendar_default_colmove_position_before", "box-sizing: border-box; border-left: 2px solid #999999;");
        sheet.add(".calendar_default_colmove_position_before:before", "content: ''; border-width: 6px; border-color: transparent #999999 transparent transparent; border-style: solid; width: 0px; height: 0px; position: absolute;");
        sheet.add(".calendar_default_colmove_position_after", "box-sizing: border-box; border-right: 2px solid #999999;");
        sheet.add(".calendar_default_colmove_position_after:before", "content: ''; border-width: 6px; border-color: transparent transparent transparent #999999; border-style: solid; width: 0px; height: 0px; position: absolute;");
        sheet.add(".calendar_default_colmove_position_child", "box-sizing: border-box; border-bottom: 2px solid #999999;");
        sheet.add(".calendar_default_colmove_position_child:before", "content: ''; border-width: 6px; border-color: #999999 transparent transparent transparent; border-style: solid; width: 0px; height: 0px; position: absolute;");
        sheet.add(".calendar_default_colmove_position_forbidden", "border-top: 2px solid red;");
        sheet.add(".calendar_default_colheader .calendar_default_colheader_splitter:hover", "background-color: #999999;");
        sheet.add(".calendar_default_block", "background-color: #808080; opacity: 0.5;");
        sheet.add(".month_default_main", "--dp-month-border-color: #c0c0c0;" +
            "--dp-month-font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;" +
            "--dp-month-font-size: 13px;" +
            "--dp-month-cell-border-color: #ddd;" +
            "--dp-month-cell-bg-color: #f9f9f9;" +
            "--dp-month-cell-business-bg-color: #ffffff;" +
            "--dp-month-event-color: #333;" +
            "--dp-month-event-border-color: #999;" +
            "--dp-month-event-border: 1px solid var(--dp-month-event-border-color);" +
            "--dp-month-event-background: linear-gradient(to bottom, var(--dp-month-event-bg-top-color) 0%, var(--dp-month-event-bg-bottom-color) 100%);" +
            "--dp-month-event-bg-top-color: #ffffff;" +
            "--dp-month-event-bg-bottom-color: #eeeeee;" +
            "--dp-month-event-background-hover: linear-gradient(to bottom, var(--dp-month-event-bg-top-color-hover) 0%, var(--dp-month-event-bg-bottom-color-hover) 100%);" +
            "--dp-month-event-bg-top-color-hover: #f8f8f8;" +
            "--dp-month-event-bg-bottom-color-hover: #f1f1f1;" +
            "--dp-month-event-horizontal-align: flex-start;" +
            "--dp-month-event-vertical-align: center;" +
            "--dp-month-event-padding: 2px;" +
            "--dp-month-event-padding-left: 10px;" +
            "--dp-month-event-padding-rtl: 2px 10px 2px 1px;" +
            "--dp-month-event-border-radius: 4px;" +
            "--dp-month-event-box-shadow: none;" +
            "--dp-month-event-bar-top: 1px;" +
            "--dp-month-event-bar-left: 2px;" +
            "--dp-month-event-bar-bottom: 1px;" +
            "--dp-month-event-bar-width: 6px;" +
            "--dp-month-event-bar-color: #208fe3;" +
            "--dp-month-event-bar-display: block;" +
            "--dp-month-header-bg-color: #f3f3f3;" +
            "--dp-month-header-color: #333;" +
            "--dp-month-header-horizontal-align: center;" +
            "--dp-month-header-vertical-align: center;" +
            "--dp-month-header-padding: 0px;" +
            "--dp-month-message-bg-color: #ffa216;" +
            "--dp-month-message-color: #ffffff;" +
            "--dp-month-message-padding: 10px;" +
            "--dp-month-selected-event-bg-color: #ddd;" +
            "--dp-month-shadow-color: #bbbbbb;" +
            "--dp-month-shadow-border-color: #888888;");
        sheet.add(".month_default_main *, .month_default_main *:before, .month_default_main *:after", "box-sizing: content-box; ");
        sheet.add(".month_default_main", "border: 1px solid var(--dp-month-border-color); font-family: var(--dp-month-font-family); font-size: var(--dp-month-font-size); color: #333; ");
        sheet.add(".month_default_cell_inner", "border-right: 1px solid var(--dp-month-cell-border-color); border-bottom: 1px solid var(--dp-month-cell-border-color); position: absolute; top: 0; left: 0; bottom: 0; right: 0; background-color: var(--dp-month-cell-bg-color); ");
        sheet.add(".month_default_cell_business .month_default_cell_inner", "background-color: var(--dp-month-cell-business-bg-color); ");
        sheet.add(".month_default_cell_header", "text-align: right; padding: 4px; box-sizing: border-box; ");
        sheet.add(".month_default_header_inner", "position: absolute; inset: 0; border-right: 1px solid var(--dp-month-border-color); border-bottom: 1px solid var(--dp-month-border-color); cursor: default; color: var(--dp-month-header-color); background: var(--dp-month-header-bg-color); overflow: hidden; display: flex; align-items: var(--dp-month-header-vertical-align); justify-content: var(--dp-month-header-horizontal-align); padding: var(--dp-month-header-padding);");
        sheet.add(".month_default_message", "opacity: 0.9; color: var(--dp-month-message-color); background: var(--dp-month-message-bg-color); padding: var(--dp-month-message-padding); ");
        sheet.add(".month_default_event", "color: var(--dp-month-event-color);border-radius: var(--dp-month-event-border-radius); box-shadow: var(--dp-month-event-box-shadow); ");
        sheet.add(".month_default_event_inner", "position: absolute; top: 0; bottom: 0; left: 1px; right: 1px; overflow: hidden; padding: var(--dp-month-event-padding) var(--dp-month-event-padding) var(--dp-month-event-padding) var(--dp-month-event-padding-left); background: var(--dp-month-event-background); border: var(--dp-month-event-border); border-radius: var(--dp-month-event-border-radius); display: flex; align-items: var(--dp-month-event-vertical-align); justify-content: var(--dp-month-event-horizontal-align); ");
        sheet.add(".month_default_event:hover .month_default_event_inner", "background: var(--dp-month-event-background-hover);");
        sheet.add(".month_default_direction_rtl .month_default_event_inner", "right: 2px; padding: var(--dp-month-event-padding-rtl); ");
        sheet.add(".month_default_event_continueright .month_default_event_inner", "border-top-right-radius: 0; border-bottom-right-radius: 0; border-right-style: dotted; ");
        sheet.add(".month_default_event_continueleft .month_default_event_inner", "border-top-left-radius: 0; border-bottom-left-radius: 0; border-left-style: dotted; ");
        sheet.add(".month_default_event_bar", "display: var(--dp-month-event-bar-display); top: var(--dp-month-event-bar-top); bottom: var(--dp-month-event-bar-bottom); left: var(--dp-month-event-bar-left); width: var(--dp-month-event-bar-width); ");
        sheet.add(".month_default_direction_rtl .month_default_event_bar", "top: 1px; bottom: 1px; right: 3px; width: var(--dp-month-event-bar-width); ");
        sheet.add(".month_default_event_bar_inner", "position: absolute; width: var(--dp-month-event-bar-width); background-color: var(--dp-month-event-bar-color); ");
        sheet.add(".month_default_event_continueleft .month_default_event_bar", "display: none; ");
        sheet.add(".month_default_selected .month_default_event_inner, .month_default_event:hover.month_default_selected .month_default_event_inner", "background: var(--dp-month-selected-event-bg-color); ");
        sheet.add(".month_default_shadow_inner", "box-sizing: border-box; background-color: var(--dp-month-shadow-color); border: 1px solid var(--dp-month-shadow-border-color); border-radius: var(--dp-month-event-border-radius); opacity: 0.5; height: 100%; ");
        sheet.add(".month_default_shadow", "box-shadow: 0 2px 5px rgba(0, 0, 0, .2); border-radius: var(--dp-month-event-border-radius);");
        sheet.add(".month_default_event_delete", "opacity:0.4;cursor:pointer;background-color:currentColor;-webkit-mask-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTInIGhlaWdodD0nMTInIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTSAwLjUgMC41IEwgMTEuNSAxMS41IE0gMC41IDExLjUgTCAxMS41IDAuNScgc3R5bGU9J2ZpbGw6bm9uZTtzdHJva2U6Y3VycmVudENvbG9yO3N0cm9rZS13aWR0aDozO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbGluZWNhcDpidXR0JyAvPjwvc3ZnPg==);-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:12px 12px;mask-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTInIGhlaWdodD0nMTInIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTSAwLjUgMC41IEwgMTEuNSAxMS41IE0gMC41IDExLjUgTCAxMS41IDAuNScgc3R5bGU9J2ZpbGw6bm9uZTtzdHJva2U6Y3VycmVudENvbG9yO3N0cm9rZS13aWR0aDozO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbGluZWNhcDpidXR0JyAvPjwvc3ZnPg==);mask-repeat:no-repeat;mask-position:center;mask-size:12px 12px;background-image:none;");
        sheet.add(".month_default_event_delete:hover", "opacity: 0.7;");
        sheet.add(".month_default_event_timeleft", "color: #ccc; font-size: 11px; display: flex; align-items: center; ");
        sheet.add(".month_default_event_timeright", "color: #ccc; font-size: 11px; display: flex; align-items: center; justify-content: end; ");
        sheet.add(".month_default_loading", "background-color: orange; color: white; padding: 2px; ");
        sheet.add(".month_default_shadow_forbidden:after", "content: ''; position: absolute; top: calc(50% - 10px); left: 10px; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2720%27 height=%2720%27 viewBox=%270 0 20 20%27%3E%3Ccircle cx=%2710%27 cy=%2710%27 r=%279%27 fill=%27%23cc0000aa%27 /%3E%3Cline x1=%275%27 y1=%275%27 x2=%2715%27 y2=%2715%27 stroke=%27white%27 stroke-width=%271.5%27/%3E%3Cline x1=%2715%27 y1=%275%27 x2=%275%27 y2=%2715%27 stroke=%27white%27 stroke-width=%271.5%27/%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: center; background-size: contain; ");
        sheet.add(".month_default_shadow_forbidden .month_default_shadow_inner", "border: 1px solid #cc0000; background: #cc4125; ");
        sheet.add(".navigator_default_main", "--dp-nav-border-color: #c0c0c0;" +
            "--dp-nav-font-family: -apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;" +
            "--dp-nav-font-size: 12px;" +
            "--dp-nav-title-color: #333;" +
            "--dp-nav-title-bg-color: #f3f3f3;" +
            "--dp-nav-dayheader-color: #333;" +
            "--dp-nav-dayheader-bg-color: #ffffff;" +
            "--dp-nav-weeknumber-color: #999;" +
            "--dp-nav-weeknumber-bg-color: #ffffff;" +
            "--dp-nav-day-color: #000;" +
            "--dp-nav-day-bg-color: #ffffff;" +
            "--dp-nav-dayother-color: gray;" +
            "--dp-nav-dayother-bg-color: #ffffff;" +
            "--dp-nav-weekend-bg-color: #f0f0f0;" +
            "--dp-nav-select-bg-color: #FFE794;" +
            "--dp-nav-text-align: center;");
        sheet.add(".navigator_default_main *, .navigator_default_main *:before, .navigator_default_main *:after", "box-sizing: content-box;");
        sheet.add(".navigator_default_main", "border-left: 1px solid var(--dp-nav-border-color);border-right: 1px solid var(--dp-nav-border-color);border-bottom: 1px solid var(--dp-nav-border-color);background-color: white;color: var(--dp-nav-day-color);box-sizing: content-box;");
        sheet.add(".navigator_default_month", "font-family: var(--dp-nav-font-family);font-size: var(--dp-nav-font-size);");
        sheet.add(".navigator_default_day", "color: var(--dp-nav-day-color); background-color: var(--dp-nav-day-bg-color);");
        sheet.add(".navigator_default_weekend", "background-color: var(--dp-nav-weekend-bg-color);");
        sheet.add(".navigator_default_dayheader", "color: var(--dp-nav-dayheader-color);background-color: var(--dp-nav-dayheader-bg-color);text-align: var(--dp-nav-text-align);padding: 0px;");
        sheet.add(".navigator_default_line", "border-bottom: 1px solid var(--dp-nav-border-color);");
        sheet.add(".navigator_default_dayother", "color: var(--dp-nav-dayother-color); background-color: var(--dp-nav-dayother-bg-color);");
        sheet.add(".navigator_default_todaybox", "border: 1px solid red;");
        sheet.add(".navigator_default_title, .navigator_default_titleleft, .navigator_default_titleright", "box-sizing: border-box; border-top: 1px solid var(--dp-nav-border-color);border-bottom: 1px solid var(--dp-nav-border-color);color: var(--dp-nav-title-color);background: var(--dp-nav-title-bg-color);text-align: var(--dp-nav-text-align);");
        sheet.add(".navigator_default_busy", "font-weight: bold;");
        sheet.add(".navigator_default_cell", "text-align: var(--dp-nav-text-align);");
        sheet.add(".navigator_default_select .navigator_default_cell_box", "background-color: var(--dp-nav-select-bg-color);opacity: 0.5;");
        sheet.add(".navigator_default_weeknumber", "text-align: var(--dp-nav-text-align);color: var(--dp-nav-weeknumber-color);background: var(--dp-nav-weeknumber-bg-color);");
        sheet.add(".navigator_default_cell_text", "cursor: pointer;");
        sheet.add(".navigator_default_todaysection", "box-sizing: border-box; display: flex; align-items: center; justify-content: center; border-top: 1px solid var(--dp-nav-border-color);");
        sheet.add(".navigator_default_todaysection_button", "cursor: pointer; color: #333; background-color: #f0f0f0; border: 1px solid var(--dp-nav-border-color); padding: 5px 10px; border-radius: 0px; ");
        sheet.add(".scheduler_default_main", "--dp-scheduler-border-color: #c0c0c0;" +
            "--dp-scheduler-border-inner-color: #e0e0e0;" +
            "--dp-scheduler-cell-bg-color: #f9f9f9;" +
            "--dp-scheduler-cell-business-bg-color: #ffffff;" +
            "--dp-scheduler-event-background: linear-gradient(to bottom, var(--dp-scheduler-event-bg-top-color) 0%, var(--dp-scheduler-event-bg-bottom-color) 100%);" +
            "--dp-scheduler-event-background-hover: linear-gradient(to bottom, var(--dp-scheduler-event-bg-top-color-hover) 0%, var(--dp-scheduler-event-bg-bottom-color-hover) 100%);" +
            "--dp-scheduler-event-bg-bottom-color: #eeeeee;" +
            "--dp-scheduler-event-bg-top-color: #ffffff;" +
            "--dp-scheduler-event-bg-bottom-color-hover: #e8e8e8;" +
            "--dp-scheduler-event-bg-top-color-hover: #f8f8f8;" +
            "--dp-scheduler-event-bar-bg-color: #9dc8e8;" +
            "--dp-scheduler-event-bar-color: #208fe3;" +
            "--dp-scheduler-event-bar-display: block;" +
            "--dp-scheduler-event-bar-height: 4px;" +
            "--dp-scheduler-event-bar-left: 0px;" +
            "--dp-scheduler-event-bar-right: 0px;" +
            "--dp-scheduler-event-bar-top: 0px;" +
            "--dp-scheduler-event-border: 1px solid var(--dp-scheduler-event-border-color);" +
            "--dp-scheduler-event-border-color: #ccc;" +
            "--dp-scheduler-event-border-radius: 4px;" +
            "--dp-scheduler-event-box-shadow: none;" +
            "--dp-scheduler-event-color: #333;" +
            "--dp-scheduler-event-horizontal-align: flex-start;" +
            "--dp-scheduler-event-milestone-color: #38761d;" +
            "--dp-scheduler-event-padding: 2px;" +
            "--dp-scheduler-event-selected-bg-color: #ddd;" +
            "--dp-scheduler-event-vertical-align: center;" +
            "--dp-scheduler-focus-outline-color: red;" +
            "--dp-scheduler-font-family: -apple-system, system-ui, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif;" +
            "--dp-scheduler-font-size: 13px;" +
            "--dp-scheduler-grid-line-break-color: #999;" +
            "--dp-scheduler-grid-line-color: #eee;" +
            "--dp-scheduler-header-bg-color: #f3f3f3;" +
            "--dp-scheduler-header-color: #333;" +
            "--dp-scheduler-link-color: #cc0000;" +
            "--dp-scheduler-message-bg-color: #ffa216;" +
            "--dp-scheduler-message-color: #ffffff;" +
            "--dp-scheduler-message-padding: 10px;" +
            "--dp-scheduler-rowheader-padding: 7px;" +
            "--dp-scheduler-rowheader-vertical-align: center;" +
            "--dp-scheduler-selectionrectangle-color: #1066a8;" +
            "--dp-scheduler-shadow-border-color: #888888;" +
            "--dp-scheduler-shadow-color: #bbbbbb;" +
            "--dp-scheduler-timeheader-horizontal-align: center;" +
            "--dp-scheduler-timeheader-padding: 0px;" +
            "--dp-scheduler-timeheader-vertical-align: center;");
        sheet.add(".scheduler_default_main *, .scheduler_default_main *:before, .scheduler_default_main *:after", "box-sizing: content-box;");
        sheet.add(".scheduler_default_main, .scheduler_default_main svg text", "box-sizing: content-box; border: 1px solid var(--dp-scheduler-border-color); font-family: var(--dp-scheduler-font-family); font-size: var(--dp-scheduler-font-size);");
        sheet.add(".scheduler_default_selected .scheduler_default_event_inner, .scheduler_default_event:hover.scheduler_default_selected .scheduler_default_event_inner", "background: var(--dp-scheduler-event-selected-bg-color);");
        sheet.add(".scheduler_default_timeheader_scroll", "background: var(--dp-scheduler-header-bg-color);");
        sheet.add(".scheduler_default_message", "opacity: 0.9; padding: var(--dp-scheduler-message-padding); color: var(--dp-scheduler-message-color); background: var(--dp-scheduler-message-bg-color);");
        sheet.add(".scheduler_default_timeheadergroup,.scheduler_default_timeheadercol", "color: var(--dp-scheduler-header-color); background: var(--dp-scheduler-header-bg-color);");
        sheet.add(".scheduler_default_rowheader,.scheduler_default_corner", "color: var(--dp-scheduler-header-color); background: var(--dp-scheduler-header-bg-color);");
        sheet.add(".scheduler_default_rowheader.scheduler_default_rowheader_selected", "background-color: #aaa; background-image: linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent); background-size: 20px 20px;");
        sheet.add(".scheduler_default_rowheader_inner", "position: absolute; left: 0px; right: 0px; top: 0px; bottom: 0px; border-right: 1px solid var(--dp-scheduler-border-inner-color); padding: var(--dp-scheduler-rowheader-padding); display: flex; align-items: var(--dp-scheduler-rowheader-vertical-align);");
        sheet.add(".scheduler_default_timeheadergroup_inner, .scheduler_default_timeheadercol_inner", "position: absolute; left: 0; right: 0; top: 0; bottom: 0;  border-right: 1px solid var(--dp-scheduler-border-color);");
        sheet.add(".scheduler_default_timeheadergroup_inner", "border-bottom: 1px solid var(--dp-scheduler-border-color);");
        sheet.add(".scheduler_default_timeheadergroup_inner, .scheduler_default_timeheadercol_inner, .scheduler_default_timeheader_float", "display: flex; align-items: var(--dp-scheduler-timeheader-vertical-align); justify-content: var(--dp-scheduler-timeheader-horizontal-align); padding: var(--dp-scheduler-timeheader-padding);");
        sheet.add(".scheduler_default_divider, .scheduler_default_splitter", "background-color: var(--dp-scheduler-border-color);");
        sheet.add(".scheduler_default_divider_horizontal", "background-color: var(--dp-scheduler-border-color);");
        sheet.add(".scheduler_default_matrix_vertical_line", "background-color: var(--dp-scheduler-grid-line-color);");
        sheet.add(".scheduler_default_matrix_vertical_break", "background-color: var(--dp-scheduler-grid-line-break-color);");
        sheet.add(".scheduler_default_matrix_horizontal_line", "background-color: var(--dp-scheduler-grid-line-color);");
        sheet.add(".scheduler_default_resourcedivider", "background-color: var(--dp-scheduler-border-color);");
        sheet.add(".scheduler_default_shadow_inner", "box-sizing: border-box; background-color: var(--dp-scheduler-shadow-color); border: 1px solid var(--dp-scheduler-shadow-border-color); border-radius: var(--dp-scheduler-event-border-radius); opacity: 0.5; height: 100%;");
        sheet.add(".scheduler_default_shadow", "box-shadow: 0 2px 5px rgba(0,0,0,.2); border-radius: var(--dp-scheduler-event-border-radius);");
        sheet.add(".scheduler_default_event", "font-size: var(--dp-scheduler-font-size); color: var(--dp-scheduler-event-color); border-radius: var(--dp-scheduler-event-border-radius); box-shadow: var(--dp-scheduler-event-box-shadow);");
        sheet.add(".scheduler_default_event_inner", "position: absolute; top: 0px; left: 0px; right: 0px; bottom: 0px; border-radius: var(--dp-scheduler-event-border-radius); padding: var(--dp-scheduler-event-padding); overflow: hidden; border: var(--dp-scheduler-event-border); display: flex; align-items: var(--dp-scheduler-event-vertical-align); justify-content: var(--dp-scheduler-event-horizontal-align); background: var(--dp-scheduler-event-background);");
        sheet.add(".scheduler_default_event:hover .scheduler_default_event_inner", "background: var(--dp-scheduler-event-background-hover);");
        sheet.add(".scheduler_default_event_bar", "display: var(--dp-scheduler-event-bar-display);top: var(--dp-scheduler-event-bar-top); left: var(--dp-scheduler-event-bar-left); right: var(--dp-scheduler-event-bar-right); height: var(--dp-scheduler-event-bar-height); background-color: var(--dp-scheduler-event-bar-bg-color);");
        sheet.add(".scheduler_default_event_bar_inner", "position:absolute; height: var(--dp-scheduler-event-bar-height); background-color: var(--dp-scheduler-event-bar-color);");
        sheet.add(".scheduler_default_event_float", "display: flex; align-items: center;");
        sheet.add(".scheduler_default_event_float_inner", "padding: var(--dp-scheduler-event-padding) var(--dp-scheduler-event-padding) var(--dp-scheduler-event-padding) 8px; position: relative;");
        sheet.add(".scheduler_default_event_float_inner:after", "content:\"\";position:absolute;top:calc(50% - 5px);left:1px;width:5px;height:10px;opacity:0.5;background-color:currentColor;-webkit-mask-image:url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA1IDEwJz48cGF0aCBkPSdNNSAwIEwwIDUgTDUgMTAgWicvPjwvc3ZnPg==);-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:100% 100%;mask-image:url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA1IDEwJz48cGF0aCBkPSdNNSAwIEwwIDUgTDUgMTAgWicvPjwvc3ZnPg==);mask-repeat:no-repeat;mask-position:center;mask-size:100% 100%;background-image:none;");
        sheet.add(".scheduler_default_event_focus", "outline: var(--dp-scheduler-focus-outline-color) 2px solid; z-index: 100; opacity: 0.5;");
        sheet.add(".scheduler_default_columnheader_inner", "font-weight: bold;");
        sheet.add(".scheduler_default_columnheader_splitter", "box-sizing: border-box; border-right: 1px solid var(--dp-scheduler-border-color);");
        sheet.add(".scheduler_default_columnheader_splitter:hover", "background-color: var(--dp-scheduler-border-color);");
        sheet.add(".scheduler_default_columnheader_cell_inner", "position: absolute; left: 0px; right: 0px; top: 0px; bottom: 0px; padding: 2px; display: flex; align-items: center;");
        sheet.add(".scheduler_default_cell", "background-color: var(--dp-scheduler-cell-bg-color);");
        sheet.add(".scheduler_default_cell.scheduler_default_cell_business", "background-color: var(--dp-scheduler-cell-business-bg-color);");
        sheet.add(".scheduler_default_cell.scheduler_default_cell_business.scheduler_default_cell_selected, .scheduler_default_cell.scheduler_default_cell_selected", "background-color: #ccc; background-image: linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent); background-size: 20px 20px;");
        sheet.add(".scheduler_default_tree_image_no_children", "");
        sheet.add(".scheduler_default_tree_image_expand", "opacity:0.5;background-color:currentColor;-webkit-mask-image:url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA4IDEwJz48cGF0aCBkPSdNIDEuNSAwLjUgTCA2LjUgNSBMIDEuNSA5LjUnIHN0eWxlPSdmaWxsOm5vbmU7c3Ryb2tlOmN1cnJlbnRDb2xvcjtzdHJva2Utd2lkdGg6MjtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLWxpbmVjYXA6YnV0dCcgLz48L3N2Zz4=);-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:100% 100%;mask-image:url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA4IDEwJz48cGF0aCBkPSdNIDEuNSAwLjUgTCA2LjUgNSBMIDEuNSA5LjUnIHN0eWxlPSdmaWxsOm5vbmU7c3Ryb2tlOmN1cnJlbnRDb2xvcjtzdHJva2Utd2lkdGg6MjtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLWxpbmVjYXA6YnV0dCcgLz48L3N2Zz4=);mask-repeat:no-repeat;mask-position:center;mask-size:100% 100%;background-image:none;");
        sheet.add(".scheduler_default_tree_image_collapse", "opacity:0.5;background-color:currentColor;-webkit-mask-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTSAwLjUgMS41IEwgNSA2LjUgTCA5LjUgMS41JyBzdHlsZT0nZmlsbDpub25lO3N0cm9rZTpjdXJyZW50Q29sb3I7c3Ryb2tlLXdpZHRoOjI7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO3N0cm9rZS1saW5lY2FwOmJ1dHQnIC8+PC9zdmc+);-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:100% 100%;mask-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTSAwLjUgMS41IEwgNSA2LjUgTCA5LjUgMS41JyBzdHlsZT0nZmlsbDpub25lO3N0cm9rZTpjdXJyZW50Q29sb3I7c3Ryb2tlLXdpZHRoOjI7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO3N0cm9rZS1saW5lY2FwOmJ1dHQnIC8+PC9zdmc+);mask-repeat:no-repeat;mask-position:center;mask-size:100% 100%;background-image:none;");
        sheet.add(".scheduler_default_event_delete", "opacity:0.4;cursor:pointer;background-color:currentColor;-webkit-mask-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTInIGhlaWdodD0nMTInIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTSAwLjUgMC41IEwgMTEuNSAxMS41IE0gMC41IDExLjUgTCAxMS41IDAuNScgc3R5bGU9J2ZpbGw6bm9uZTtzdHJva2U6Y3VycmVudENvbG9yO3N0cm9rZS13aWR0aDozO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbGluZWNhcDpidXR0JyAvPjwvc3ZnPg==);-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:12px 12px;mask-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTInIGhlaWdodD0nMTInIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTSAwLjUgMC41IEwgMTEuNSAxMS41IE0gMC41IDExLjUgTCAxMS41IDAuNScgc3R5bGU9J2ZpbGw6bm9uZTtzdHJva2U6Y3VycmVudENvbG9yO3N0cm9rZS13aWR0aDozO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbGluZWNhcDpidXR0JyAvPjwvc3ZnPg==);mask-repeat:no-repeat;mask-position:center;mask-size:12px 12px;background-image:none;");
        sheet.add(".scheduler_default_event_delete:hover", "opacity: 0.7;");
        sheet.add(".scheduler_default_rowmove_handle", "background-repeat: no-repeat; background-position: center center; background-color: #ccc; background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAKCAYAAACT+/8OAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAadEVYdFNvZnR3YXJlAFBhaW50Lk5FVCB2My41LjExR/NCNwAAAClJREFUGFdj+P//P4O9vX2Bg4NDP4gNFgBytgPxebgAMsYuQGMz/jMAAFsTZDPYJlDHAAAAAElFTkSuQmCC); cursor: move;");
        sheet.add(".scheduler_default_rowmove_source", "background-color: black; opacity: 0.2;");
        sheet.add(".scheduler_default_rowmove_position_before, .scheduler_default_rowmove_position_after", "background-color: #999; height: 2px;");
        sheet.add(".scheduler_default_rowmove_position_child", "margin-left: 20px; background-color: #999; height: 2px;");
        sheet.add(".scheduler_default_rowmove_position_forbidden", "background-color: #cc0000; height: 2px; margin-left: 20px;");
        sheet.add(".scheduler_default_link_horizontal", "border-bottom-style: solid; border-bottom-color: var(--dp-scheduler-link-color);");
        sheet.add(".scheduler_default_link_vertical", "border-right-style: solid; border-right-color: var(--dp-scheduler-link-color);");
        sheet.add(".scheduler_default_link_arrow_right:before", "content: ''; border-width: 6px; border-color: transparent transparent transparent var(--dp-scheduler-link-color); border-style: solid; width: 0; height:0; position: absolute;");
        sheet.add(".scheduler_default_link_arrow_left:before", "content: ''; border-width: 6px; border-color: transparent var(--dp-scheduler-link-color) transparent transparent; border-style: solid; width: 0; height:0; position: absolute;");
        sheet.add(".scheduler_default_link_arrow_down:before", "content: ''; border-width: 6px; border-color: var(--dp-scheduler-link-color) transparent transparent transparent; border-style: solid; width: 0; height:0; position: absolute;");
        sheet.add(".scheduler_default_link_arrow_up:before", "content: ''; border-width: 6px; border-color: transparent transparent var(--dp-scheduler-link-color) transparent; border-style: solid; width: 0; height:0; position: absolute;");
        sheet.add(".scheduler_default_link_mshadow.scheduler_default_link_horizontal", "border-bottom-color: #aaaaaa;");
        sheet.add(".scheduler_default_link_mshadow.scheduler_default_link_vertical", "border-right-color: #aaaaaa;");
        sheet.add(".scheduler_default_link_mshadow.scheduler_default_link_arrow_right:before", "border-color: transparent transparent transparent #aaaaaa;");
        sheet.add(".scheduler_default_link_mshadow.scheduler_default_link_arrow_left:before", "border-color: transparent #aaaaaa transparent transparent;");
        sheet.add(".scheduler_default_link_mshadow.scheduler_default_link_arrow_down:before", "border-color: #aaaaaa transparent transparent transparent;");
        sheet.add(".scheduler_default_link_mshadow.scheduler_default_link_arrow_up:before", "border-color: transparent transparent #aaaaaa transparent;");
        sheet.add(".scheduler_default_block", "background-color: #808080; opacity: 0.5;");
        sheet.add(".scheduler_default_main .scheduler_default_event_group", "box-sizing: border-box; font-size: 13px; color: #666; padding: 2px; overflow:hidden; border:1px solid var(--dp-scheduler-event-border-color); background-color: #fff; display: flex; align-items: center; white-space: nowrap;");
        sheet.add(".scheduler_default_main .scheduler_default_header_icon", "box-sizing: border-box; border: 1px solid var(--dp-scheduler-border-color); background-color: var(--dp-scheduler-header-bg-color); color: var(--dp-scheduler-header-color);");
        sheet.add(".scheduler_default_header_icon:hover", "background-color: #ccc;");
        sheet.add(".scheduler_default_header_icon_hide:before", "content: '\\00AB';");
        sheet.add(".scheduler_default_header_icon_show:before", "content: '\\00BB';");
        sheet.add(".scheduler_default_row_new .scheduler_default_rowheader_inner", "padding-left: 10px; color: #666; cursor: text; background-position: 0px 50%; background-repeat: no-repeat; background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABUSURBVChTY0ACslAaK2CC0iCQDMSlECYmQFYIAl1AjFUxukIQwKoYm0IQwFCMSyEIaEJpMMClcD4Qp0CYEIBNIUzRPzAPCtAVYlWEDgyAGIdTGBgAbqEJYyjqa3oAAAAASUVORK5CYII=);");
        sheet.add(".scheduler_default_row_new .scheduler_default_rowheader_inner:hover", "background: white; color: white;");
        sheet.add(".scheduler_default_rowheader textarea", "padding: 3px;");
        sheet.add(".scheduler_default_rowheader_scroll", "cursor: default; background: var(--dp-scheduler-header-bg-color);");
        sheet.add(".scheduler_default_shadow_forbidden .scheduler_default_shadow_inner, .scheduler_default_shadow_overlap .scheduler_default_shadow_inner", "border: 1px solid #cc0000; background: #cc4125;");
        sheet.add(".scheduler_default_event_moving_source", "opacity: 0.5;");
        sheet.add(".scheduler_default_linkpoint", "background-color: white; border: 1px solid gray; border-radius: 5px;");
        sheet.add(".scheduler_default_linkpoint.scheduler_default_linkpoint_hover", "background-color: black;");
        sheet.add(".scheduler_default_event.scheduler_default_event_version .scheduler_default_event_inner", "overflow:hidden; background-color: #cfdde8; background-image: linear-gradient(45deg, rgba(255, 255, 255, .2) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, .2) 50%, rgba(255, 255, 255, .2) 75%, transparent 75%, transparent); background-size: 20px 20px;");
        sheet.add(".scheduler_default_crosshair_vertical, .scheduler_default_crosshair_horizontal, .scheduler_default_crosshair_left, .scheduler_default_crosshair_top", "background-color: gray; opacity: 0.2;");
        sheet.add(".scheduler_default_link_dot", "border-radius: 10px; background-color: var(--dp-scheduler-link-color);");
        sheet.add(".scheduler_default_task_milestone .scheduler_default_event_inner", "position:absolute; top:16%; left:16%; right:16%; bottom:16%; background: var(--dp-scheduler-event-milestone-color); border: 0px none; transform: rotate(45deg); filter: none;");
        sheet.add(".scheduler_default_event_left, .scheduler_default_event_right", "white-space: nowrap; color: #666; cursor: default; display: flex; align-items: center;");
        sheet.add(".scheduler_default_main:focus", "outline: none;");
        sheet.add(".scheduler_default_cell_focus", "outline: var(--dp-scheduler-focus-outline-color) 2px solid; outline-offset: -2px; z-index: 100; opacity: 0.5;");
        sheet.add(".scheduler_default_cell_focus.scheduler_default_cell_focus_top", "border-top: 4px solid var(--dp-scheduler-focus-outline-color);");
        sheet.add(".scheduler_default_cell_focus.scheduler_default_cell_focus_bottom", "border-bottom: 4px solid var(--dp-scheduler-focus-outline-color);");
        sheet.add(".scheduler_default_selectionrectangle", "background-color: var(--dp-scheduler-selectionrectangle-color); border: 1px solid #000033; opacity: 0.4;");
        sheet.add(".scheduler_default_link_shadow", "border:1px solid black;");
        sheet.add(".scheduler_default_link_shadow_circle", "background-color:black;");
        sheet.add(".scheduler_default_event_move_left", 'box-sizing: border-box; padding: 2px; border: 1px solid #ccc; background: #fff; background: linear-gradient(to bottom, #ffffff 0%, #eeeeee); display: flex; align-items: center;');
        sheet.add(".scheduler_default_event_move_right", 'box-sizing: border-box; padding: 2px; border: 1px solid #ccc; background: #fff; background: linear-gradient(to bottom, #ffffff 0%, #eeeeee); display: flex; align-items: center;');
        sheet.add(".scheduler_default_link_hover", "box-shadow: 0px 0px 2px 2px rgba(255, 0, 0, 0.3)");
        sheet.add(".scheduler_default_sorticon", "opacity: 0.2;background-position: center center; background-repeat: no-repeat; cursor: pointer;");
        sheet.add(".scheduler_default_sorticon.scheduler_default_sorticon_asc", "background-color:currentColor;-webkit-mask-image:url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBvbHlnb24gcG9pbnRzPSI1IDEuNSwgMTAgMTAsIDAgMTAiLz48L3N2Zz4=');-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:10px 10px;mask-image:url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBvbHlnb24gcG9pbnRzPSI1IDEuNSwgMTAgMTAsIDAgMTAiLz48L3N2Zz4=');mask-repeat:no-repeat;mask-position:center;mask-size:10px 10px;background-image:none;");
        sheet.add(".scheduler_default_sorticon.scheduler_default_sorticon_desc", "background-color:currentColor;-webkit-mask-image:url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBvbHlnb24gcG9pbnRzPSI1IDguNSwgMCAwLCAxMCAwIi8+PC9zdmc+');-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:10px 10px;mask-image:url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBvbHlnb24gcG9pbnRzPSI1IDguNSwgMCAwLCAxMCAwIi8+PC9zdmc+');mask-repeat:no-repeat;mask-position:center;mask-size:10px 10px;background-image:none;");
        sheet.add(".scheduler_default_sorticon.scheduler_default_sorticon_active", "opacity: 0.7;");
        sheet.add(".scheduler_default_loading", "background-color: orange; color: white; padding: 2px;");
        sheet.add(".scheduler_default_link_curve", "stroke: var(--dp-scheduler-link-color); fill: none; stroke-width: 2;");
        sheet.add(".scheduler_default_link_curve:hover", "stroke-opacity: 0.5;");
        sheet.add(".scheduler_default_link_curve_dot", "fill: var(--dp-scheduler-link-color);");
        sheet.add(".scheduler_default_link_curve_marker", "fill: var(--dp-scheduler-link-color);");
        sheet.add(".scheduler_default_link_curve_text", "fill: var(--dp-scheduler-link-color);");
        sheet.add(".scheduler_default_link_curve_mshadow.scheduler_default_link_curve", "stroke: #aaaaaa;");
        sheet.add(".scheduler_default_link_curve_mshadow.scheduler_default_link_curve_dot", "fill: #aaaaaa;");
        sheet.add(".scheduler_default_link_curve_mshadow.scheduler_default_link_curve_marker", "fill: #aaaaaa;");
        sheet.add(".scheduler_default_link_curve_mshadow.scheduler_default_link_curve_text", "fill: #aaaaaa;");
        sheet.commit();
        DayPilot.Global.defaultCss = true;
    })();
    DayPilot.doc = function () {
        var de = document.documentElement;
        return (de && de.clientHeight) ? de : document.body;
    };
    DayPilot.sh = function (element) {
        if (!element) {
            return 0;
        }
        return element.offsetHeight - element.clientHeight;
    };
    DayPilot.guid = function () {
        var S4 = function () {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        };
        return ("" + S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
    };
    DayPilot.ua = function (array) {
        if (!DayPilot.isArray(array)) {
            throw new DayPilot.Exception("DayPilot.ua() - array required");
        }
        var copy = [];
        array.forEach(function (item) {
            if (DayPilot.contains(copy, item)) {
                return;
            }
            copy.push(item);
        });
        return copy;
    };
    DayPilot.pageOffset = function () {
        if (typeof pageXOffset !== 'undefined') {
            return { x: pageXOffset, y: pageYOffset };
        }
        var d = DayPilot.doc();
        return { x: d.scrollLeft, y: d.scrollTop };
    };
    DayPilot.indexOf = function (array, object) {
        if (!array || !array.length) {
            return -1;
        }
        for (var i = 0; i < array.length; i++) {
            if (array[i] === object) {
                return i;
            }
        }
        return -1;
    };
    DayPilot.contains = function (array, object) {
        if (arguments.length !== 2) {
            throw new DayPilot.Exception("DayPilot.contains() requires two arguments.");
        }
        if (!array) {
            return false;
        }
        if (array === object && !DayPilot.isArray(array)) {
            return true;
        }
        return DayPilot.indexOf(array, object) !== -1;
    };
    DayPilot.ac = function (e, children) {
        if (!children) {
            children = [];
        }
        for (var i = 0; e.children && i < e.children.length; i++) {
            children.push(e.children[i]);
            DayPilot.ac(e.children[i], children);
        }
        return children;
    };
    DayPilot.rfa = function (array, object) {
        var i = DayPilot.indexOf(array, object);
        if (i === -1) {
            return;
        }
        array.splice(i, 1);
    };
    DayPilot.mc = function (ev) {
        if (ev.pageX || ev.pageY) {
            return { x: ev.pageX, y: ev.pageY };
        }
        return {
            x: ev.clientX + document.documentElement.scrollLeft,
            y: ev.clientY + document.documentElement.scrollTop
        };
    };
    DayPilot.Stats = {};
    DayPilot.Stats.eventObjects = 0;
    DayPilot.Stats.dateObjects = 0;
    DayPilot.Stats.cacheHitsCtor = 0;
    DayPilot.Stats.cacheHitsParsing = 0;
    DayPilot.Stats.cacheHitsTicks = 0;
    DayPilot.re = function (el, ev, func) {
        if (!func) {
            return;
        }
        if (!ev) {
            return;
        }
        if (!el) {
            return;
        }
        el.addEventListener(ev, func, false);
    };
    DayPilot.rePassive = function (el, ev, func) {
        if (!func) {
            return;
        }
        if (!ev) {
            return;
        }
        if (!el) {
            return;
        }
        el.addEventListener(ev, func, { "passive": true });
    };
    DayPilot.reNonPassive = function (el, ev, func) {
        if (!func) {
            return;
        }
        if (!ev) {
            return;
        }
        if (!el) {
            return;
        }
        el.addEventListener(ev, func, { "passive": false });
    };
    DayPilot.ue = function (el, ev, func) {
        el.removeEventListener(ev, func, false);
    };
    DayPilot.pu = function (d) {
        var a = d.attributes, i, l, n;
        if (a) {
            l = a.length;
            for (i = 0; i < l; i += 1) {
                if (!a[i]) {
                    continue;
                }
                n = a[i].name;
                if (typeof d[n] === 'function') {
                    d[n] = null;
                }
            }
        }
        a = d.childNodes;
        if (a) {
            l = a.length;
            for (i = 0; i < l; i += 1) {
                DayPilot.pu(d.childNodes[i]);
            }
        }
    };
    DayPilot.de = function (e) {
        if (!e) {
            return;
        }
        if (DayPilot.isArray(e)) {
            for (var i = 0; i < e.length; i++) {
                DayPilot.de(e[i]);
            }
            return;
        }
        e.remove();
    };
    DayPilot.sw = function (element) {
        if (!element) {
            return 0;
        }
        return element.offsetWidth - element.clientWidth;
    };
    DayPilot.am = function () {
        if (typeof angular === "undefined") {
            return null;
        }
        if (!DayPilot.am.cached) {
            DayPilot.am.cached = angular.module("daypilot", []);
        }
        return DayPilot.am.cached;
    };
    DayPilot.Selection = function (start, end, resource, root) {
        this.type = 'selection';
        this.start = start.isDayPilotDate ? start : new DayPilot.Date(start);
        this.end = end.isDayPilotDate ? end : new DayPilot.Date(end);
        this.resource = resource;
        this.root = root;
        this.toJSON = function () {
            var json = {};
            json.start = this.start;
            json.end = this.end;
            json.resource = this.resource;
            return json;
        };
    };
    DayPilot.request = function (url, callback, postData, errorCallback) {
        var req = DayPilot.createXmlHttp();
        if (!req) {
            return;
        }
        req.open("POST", url, true);
        req.setRequestHeader('Content-type', 'text/plain');
        req.onreadystatechange = function () {
            if (req.readyState !== 4) {
                return;
            }
            if (req.status !== 200 && req.status !== 304) {
                if (errorCallback) {
                    errorCallback(req);
                }
                else {
                    if (window.console) {
                        console.log('HTTP error ' + req.status);
                    }
                }
                return;
            }
            callback(req);
        };
        if (req.readyState === 4) {
            return;
        }
        if (typeof postData === 'object') {
            postData = JSON.stringify(postData);
        }
        req.send(postData);
    };
    DayPilot.ajax = function (params) {
        if (!params) {
            throw new DayPilot.Exception("Parameter object required.");
        }
        if (typeof params.url !== "string") {
            throw new DayPilot.Exception("The parameter object must have 'url' property.");
        }
        var req = DayPilot.createXmlHttp();
        if (!req) {
            throw new DayPilot.Exception("Unable to create XMLHttpRequest object");
        }
        var dataIsObject = typeof params.data === "object";
        var data = params.data;
        var method = params.method || (params.data ? "POST" : "GET");
        var success = params.success || function () { };
        var error = params.error || function () { };
        var url = params.url;
        var contentType = params.contentType || (dataIsObject ? "application/json" : "text/plain");
        var headers = params.headers || {};
        req.open(method, url, true);
        req.setRequestHeader('Content-type', contentType);
        DayPilot.Util.ownPropsAsArray(headers).forEach(function (item) {
            req.setRequestHeader(item.key, item.val);
        });
        req.onreadystatechange = function () {
            if (req.readyState !== 4) {
                return;
            }
            if (req.status !== 200 && req.status !== 201 && req.status !== 204 && req.status !== 304) {
                if (error) {
                    var args_1 = {};
                    args_1.request = req;
                    error(args_1);
                }
                else {
                    if (window.console) {
                        console.log('HTTP error ' + req.status);
                    }
                }
                return;
            }
            var args = {};
            args.request = req;
            if (req.responseText) {
                args.data = JSON.parse(req.responseText);
            }
            success(args);
        };
        if (req.readyState === 4) {
            return;
        }
        if (dataIsObject) {
            data = JSON.stringify(data);
        }
        req.send(data);
    };
    DayPilot.createXmlHttp = function () {
        return new XMLHttpRequest();
    };
    DayPilot.Http = {};
    DayPilot.Http.ajax = function (params) {
        DayPilot.ajax(params);
    };
    DayPilot.Http.get = function (url, params) {
        params = params || {};
        return new Promise(function (resolve, reject) {
            var aparams = {};
            aparams.url = url;
            aparams.method = "GET";
            aparams.success = function (args) {
                resolve(args);
            };
            aparams.error = function (args) {
                reject(args);
            };
            aparams.contentType = params.contentType;
            aparams.headers = params.headers;
            DayPilot.ajax(aparams);
        });
    };
    DayPilot.Http.post = function (url, data, params) {
        params = params || {};
        return new Promise(function (resolve, reject) {
            var aparams = {};
            aparams.url = url;
            aparams.method = "POST";
            aparams.data = data;
            aparams.success = function (args) {
                resolve(args);
            };
            aparams.error = function (args) {
                reject(args);
            };
            aparams.contentType = params.contentType;
            aparams.headers = params.headers;
            DayPilot.ajax(aparams);
        });
    };
    DayPilot.Http.put = function (url, data, params) {
        params = params || {};
        return new Promise(function (resolve, reject) {
            var aparams = {};
            aparams.url = url;
            aparams.method = "PUT";
            aparams.data = data;
            aparams.success = function (args) {
                resolve(args);
            };
            aparams.error = function (args) {
                reject(args);
            };
            aparams.contentType = params.contentType;
            aparams.headers = params.headers;
            DayPilot.ajax(aparams);
        });
    };
    DayPilot.Http.delete = function (url, params) {
        params = params || {};
        return new Promise(function (resolve, reject) {
            var aparams = {};
            aparams.url = url;
            aparams.method = "DELETE";
            aparams.success = function (args) {
                resolve(args);
            };
            aparams.error = function (args) {
                reject(args);
            };
            aparams.contentType = params.contentType;
            aparams.headers = params.headers;
            DayPilot.ajax(aparams);
        });
    };
    DayPilot.Util = {};
    DayPilot.Util.addClass = function (object, name) {
        if (!object) {
            return;
        }
        if (!object.className) {
            object.className = name;
            return;
        }
        var already = new RegExp("(^|\\s)" + name + "($|\\s)");
        if (!already.test(object.className)) {
            object.className = object.className + ' ' + name;
        }
    };
    DayPilot.Util.removeClass = function (object, name) {
        if (!object) {
            return;
        }
        var already = new RegExp("(^|\\s)" + name + "($|\\s)");
        object.className = object.className.replace(already, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    };
    DayPilot.Util.copyProps = function copyProps(source, target, props) {
        if (target === void 0) { target = {}; }
        if (!source) {
            return target;
        }
        if (typeof props === 'undefined') {
            for (var _i = 0, _a = Object.entries(source); _i < _a.length; _i++) {
                var _b = _a[_i], name_1 = _b[0], val = _b[1];
                if (typeof val !== 'undefined') {
                    target[name_1] = val;
                }
            }
        }
        else {
            for (var _c = 0, props_1 = props; _c < props_1.length; _c++) {
                var name_2 = props_1[_c];
                var val = source[name_2];
                if (typeof val !== 'undefined') {
                    target[name_2] = val;
                }
            }
        }
        return target;
    };
    DayPilot.Util.ownPropsAsArray = function (object) {
        if (!object) {
            return [];
        }
        return Object.entries(object).map(function (_a) {
            var key = _a[0], val = _a[1];
            return ({ key: key, val: val });
        });
    };
    DayPilot.Util.atLeast = function (a, b) {
        return Math.max(a, b);
    };
    DayPilot.Util.mouseButton = function (ev) {
        var result = {};
        switch (ev.button) {
            case 0:
                result.left = true;
                break;
            case 1:
                result.middle = true;
                break;
            case 2:
                result.right = true;
                break;
        }
        return result;
    };
    DayPilot.Util.replaceCharAt = function (str, index, character) {
        return str.substr(0, index) + character + str.substr(index + character.length);
    };
    DayPilot.Util.isNullOrUndefined = function (val) {
        return val === null || typeof val === "undefined";
    };
    DayPilot.Util.escapeHtml = function (html) {
        var div = document.createElement("div");
        div.innerText = html;
        return div.innerHTML;
    };
    DayPilot.Util.escapeTextHtml = function (text, html) {
        if (!DayPilot.Util.isNullOrUndefined(html)) {
            return html;
        }
        if (DayPilot.Util.isNullOrUndefined(text)) {
            return "";
        }
        return DayPilot.Util.escapeHtml(text);
    };
    DayPilot.Util.isSameEvent = function (data1, data2) {
        if (!data1 || !data2) {
            return false;
        }
        data1 = data1 instanceof DayPilot.Event ? data1.data : data1;
        data2 = data2 instanceof DayPilot.Event ? data2.data : data2;
        if (data1 === data2) {
            return true;
        }
        if (!DayPilot.Util.isNullOrUndefined(data1.id) && data1.id === data2.id) {
            return true;
        }
        return false;
    };
    DayPilot.Util.overlaps = function (start1, end1, start2, end2) {
        return !(end1 <= start2 || start1 >= end2);
    };
    DayPilot.Util.isVueVNode = function (obj) {
        if (!obj) {
            return false;
        }
        if (DayPilot.isArray(obj)) {
            return DayPilot.Util.isVueVNode(obj[0]);
        }
        return obj["__v_isVNode"];
    };
    DayPilot.Util.isVueComponent = function () {
        return false;
    };
    DayPilot.Util.isReactComponent = function (obj) {
        if (!obj) {
            return false;
        }
        var symbolFor = typeof Symbol === "function" && Symbol.for;
        var reactElementSymbol = (symbolFor && Symbol.for("react.element")) || 60103;
        var reactTransitionalElementSymbol = (symbolFor && Symbol.for("react.transitional.element")) || null;
        var to = obj.$$typeof;
        return (to === reactElementSymbol ||
            to === reactTransitionalElementSymbol ||
            to === 60103);
    };
    DayPilot.Util.isMouseEvent = function (ev) {
        return !!ev && (ev.pointerType === 'mouse' || ev instanceof MouseEvent);
    };
    DayPilot.Areas = {};
    DayPilot.Areas.attach = function (div, e, options) {
        options = options || {};
        var areas = options.areas;
        var allowed = options.allowed || function () { return true; };
        var offsetX = options.offsetX || 0;
        areas = areasExtract(e, areas);
        if (!areas) {
            return;
        }
        if (!DayPilot.isArray(areas)) {
            return;
        }
        if (areas.length === 0) {
            return;
        }
        DayPilot.re(div, "mousemove", function (ev) {
            if (!div.active && !div.areasDisabled && allowed()) {
                DayPilot.Areas.showAreas(div, e, ev, areas, { "offsetX": offsetX, "eventDiv": options.eventDiv });
            }
        });
        DayPilot.re(div, "mouseleave", function (ev) {
            DayPilot.Areas.hideAreas(div, ev);
        });
        areas.forEach(function (area) {
            if (!DayPilot.Areas.isVisible(area)) {
                return;
            }
            var a = DayPilot.Areas.createArea(div, e, area, { "offsetX": offsetX, "eventDiv": options.eventDiv });
            div.appendChild(a);
        });
    };
    DayPilot.Areas.disable = function (div) {
        div.areasDisabled = true;
        Array.from(div.childNodes).filter(function (item) { return item.isActiveArea && !item.area.start; }).forEach(function (item) {
            item._originalDisplay = item.style.display;
            item.style.display = "none";
        });
    };
    DayPilot.Areas.enable = function (div) {
        div.areasDisabled = false;
        Array.from(div.childNodes).filter(function (item) { return item.isActiveArea && !item.area.start; }).forEach(function (item) {
            if (item._originalDisplay) {
                item.style.display = item._originalDisplay;
            }
            else {
                item.style.display = "";
            }
        });
    };
    DayPilot.Areas.remove = function (div) {
        var divs = Array.from(div.childNodes).filter(function (item) { return item.isActiveArea; });
        DayPilot.de(divs);
    };
    DayPilot.Areas.isVisible = function (area) {
        var v = area.visibility || area.v || "Visible";
        if (v === "Visible") {
            return true;
        }
        if (v === "TouchVisible") {
            if (!DayPilot.browser.hover) {
                return true;
            }
        }
        return false;
    };
    DayPilot.Areas.copy = function (areas) {
        if (!DayPilot.isArray(areas)) {
            return [];
        }
        return areas.map(function (area) {
            return DayPilot.Util.copyProps(area, {});
        });
    };
    function areasExtract(e, areas) {
        if (!DayPilot.isArray(areas)) {
            areas = e.areas;
            if (!areas) {
                if (e.cache) {
                    areas = e.cache.areas;
                }
                else if (e.data) {
                    areas = e.data.areas;
                }
            }
        }
        return areas;
    }
    DayPilot.Areas.showAreas = function (div, e, ev, areas, options) {
        if (DayPilot.Global.resizing) {
            return;
        }
        if (DayPilot.Global.moving) {
            return;
        }
        if (DayPilot.Global.selecting) {
            return;
        }
        if (div.active) {
            return;
        }
        if (!DayPilot.browser.hover) {
            return;
        }
        if (DayPilot.Areas.all && DayPilot.Areas.all.length > 0) {
            for (var i = 0; i < DayPilot.Areas.all.length; i++) {
                var d = DayPilot.Areas.all[i];
                if (d !== div) {
                    DayPilot.Areas.hideAreas(d, ev);
                }
            }
        }
        div.active = {};
        if (!DayPilot.isArray(areas)) {
            areas = e.areas;
            if (!areas) {
                if (e.cache) {
                    areas = e.cache.areas;
                }
                else if (e.data) {
                    areas = e.data.areas;
                }
            }
        }
        if (!areas || areas.length === 0) {
            return;
        }
        if (div.areas && div.areas.length > 0) {
            return;
        }
        div.areas = [];
        for (var i = 0; i < areas.length; i++) {
            var area = areas[i];
            if (DayPilot.Areas.isVisible(area)) {
                continue;
            }
            var a = DayPilot.Areas.createArea(div, e, area, options);
            div.areas.push(a);
            div.appendChild(a);
            DayPilot.Areas.all.push(div);
        }
        div.active.children = DayPilot.ac(div);
    };
    DayPilot.Areas.createArea = function (div, e, area, options) {
        options = options || {};
        var ediv = options.eventDiv || div;
        var a = document.createElement("div");
        a.isActiveArea = true;
        a.area = area;
        a.setAttribute("unselectable", "on");
        var w = area.w || area.width;
        var h = area.h || area.height;
        var css = area.cssClass || area.css || area.className;
        if (typeof area.style !== "undefined") {
            a.setAttribute("style", area.style);
        }
        a.style.position = "absolute";
        a.style.width = resolvePosVal(w);
        a.style.height = resolvePosVal(h);
        a.style.right = resolvePosVal(area.right);
        a.style.top = resolvePosVal(area.top);
        a.style.left = resolvePosVal(area.left);
        a.style.bottom = resolvePosVal(area.bottom);
        a.style.borderRadius = resolvePosVal(area.borderRadius);
        if (typeof area.html !== 'undefined' || typeof area.text !== "undefined") {
            a.innerHTML = DayPilot.Util.escapeTextHtml(area.text, area.html);
        }
        else if (area.icon) {
            var iel = document.createElement("i");
            iel.className = area.icon;
            a.appendChild(iel);
        }
        else if (area.image) {
            var img = document.createElement("img");
            img.src = area.image;
            a.appendChild(img);
        }
        else if (area.symbol) {
            var ns = "http://www.w3.org/2000/svg";
            var svg = document.createElementNS(ns, "svg");
            svg.setAttribute("width", "100%");
            svg.setAttribute("height", "100%");
            var use = document.createElementNS(ns, "use");
            use.setAttribute("href", area.symbol);
            svg.appendChild(use);
            a.appendChild(svg);
            a.style.display = "flex";
            a.style.alignItems = "center";
            a.style.justifyContent = "center";
        }
        if (css) {
            a.className = css;
        }
        if (area.toolTip) {
            a.setAttribute("title", area.toolTip);
        }
        if (area.backColor) {
            a.style.background = area.backColor;
        }
        if (area.background) {
            a.style.background = area.background;
        }
        if (area.fontColor) {
            a.style.color = area.fontColor;
        }
        if (area.padding) {
            a.style.padding = area.padding + "px";
            a.style.boxSizing = "border-box";
        }
        if (area.borderColor) {
            var borders = area.borders;
            if (borders) {
                if (borders.top) {
                    a.style.borderTop = "1px solid " + area.borderColor;
                }
                if (borders.right) {
                    a.style.borderRight = "1px solid " + area.borderColor;
                }
                if (borders.bottom) {
                    a.style.borderBottom = "1px solid " + area.borderColor;
                }
                if (borders.left) {
                    a.style.borderLeft = "1px solid " + area.borderColor;
                }
            }
            else {
                a.style.border = "1px solid " + area.borderColor;
            }
            a.style.boxSizing = "border-box";
        }
        if (area.verticalAlignment) {
            a.style.display = "flex";
            switch (area.verticalAlignment) {
                case "center":
                    a.style.alignItems = "center";
                    break;
                case "top":
                    a.style.alignItems = "flex-start";
                    break;
                case "bottom":
                    a.style.alignItems = "flex-end";
                    break;
            }
        }
        if (area.horizontalAlignment) {
            a.style.display = "flex";
            switch (area.horizontalAlignment) {
                case "right":
                    a.style.justifyContent = "flex-end";
                    break;
                case "left":
                    a.style.justifyContent = "flex-start";
                    break;
                case "center":
                    a.style.justifyContent = "center";
                    break;
            }
        }
        if (area.action === "ResizeEnd" || area.action === "ResizeStart" || area.action === "Move") {
            if (e.calendar.isCalendar) {
                switch (area.action) {
                    case "ResizeEnd":
                        area.cursor = "s-resize";
                        area.dpBorder = "bottom";
                        break;
                    case "ResizeStart":
                        area.cursor = "n-resize";
                        area.dpBorder = "top";
                        break;
                    case "Move":
                        area.cursor = "move";
                        break;
                }
            }
            if (e.calendar.isScheduler || e.calendar.isMonth) {
                switch (area.action) {
                    case "ResizeEnd":
                        area.cursor = "e-resize";
                        area.dpBorder = "right";
                        break;
                    case "ResizeStart":
                        area.cursor = "w-resize";
                        area.dpBorder = "left";
                        break;
                    case "Move":
                        area.cursor = "move";
                        break;
                }
            }
            a.onmousemove = (function (div, e, area) {
                return function (ev) {
                    if (e.calendar.internal && e.calendar.internal.dragInProgress && e.calendar.internal.dragInProgress()) {
                        return;
                    }
                    ev.cancelBubble = true;
                    div.style.cursor = area.cursor;
                    if (area.dpBorder) {
                        div.dpBorder = area.dpBorder;
                    }
                };
            })(ediv, e, area);
            a.onmouseout = (function (div, e, area) {
                return function () {
                    div.style.cursor = '';
                };
            })(ediv, e, area);
        }
        if ((area.action === "ResizeEnd" || area.action === "ResizeStart") && e.isEvent) {
            if (e.calendar.internal.touch) {
                var touchstart = (function (div, e, area) {
                    return function (ev) {
                        ev.cancelBubble = true;
                        var touch = e.calendar.internal.touch;
                        var t = ev.touches ? ev.touches[0] : ev;
                        var coords = { x: t.pageX, y: t.pageY };
                        e.calendar.coords = touch.relativeCoords(ev);
                        touch.preventEventTap = true;
                        if (e.calendar.isScheduler) {
                            touch.startResizing(div, area.action === "ResizeEnd" ? "right" : "left");
                        }
                        else if (e.calendar.isCalendar) {
                            touch.startResizing(div, area.action === "ResizeEnd" ? "bottom" : "top", coords);
                        }
                    };
                })(ediv, e, area);
                DayPilot.rePassive(a, DayPilot.touch.start, touchstart);
            }
        }
        if (area.action === "ContextMenu" && e.isEvent) {
            if (e.calendar.internal.touch) {
                var touchstart = (function (div, e, area) {
                    return function (ev) {
                        ev.cancelBubble = true;
                        ev.preventDefault();
                        showContextMenu(div, e, area, ev);
                        var touch = e.calendar.internal.touch;
                        touch.preventEventTap = true;
                    };
                })(ediv, e, area);
                var touchend = (function (div, e, area) {
                    return function (ev) {
                        ev.cancelBubble = true;
                        ev.preventDefault();
                    };
                })(ediv, e, area);
                DayPilot.reNonPassive(a, DayPilot.touch.start, touchstart);
                DayPilot.reNonPassive(a, DayPilot.touch.end, touchend);
            }
        }
        if (area.action === "Bubble" && e.isEvent) {
            if (e.calendar.internal.touch) {
                var touchstart = (function (div, e, area) {
                    return function (ev) {
                        ev.cancelBubble = true;
                        ev.preventDefault();
                        var args = doOnClick(area, e, ev);
                        if (args.preventDefault.value) {
                            return;
                        }
                        showBubble(e, area, ev);
                        var touch = e.calendar.internal.touch;
                        touch.preventEventTap = true;
                        if (typeof area.onClicked === "function") {
                            area.onClicked(args);
                        }
                    };
                })(ediv, e, area);
                var touchend = (function (div, e, area) {
                    return function (ev) {
                        ev.cancelBubble = true;
                        ev.preventDefault();
                    };
                })(ediv, e, area);
                DayPilot.reNonPassive(a, DayPilot.touch.start, touchstart);
                DayPilot.reNonPassive(a, DayPilot.touch.end, touchend);
            }
        }
        if (area.action === "Move" && e.isEvent) {
            if (e.calendar.internal.touch) {
                var touchstart = (function (div, e, area) {
                    return function (ev) {
                        ev.cancelBubble = true;
                        var touch = e.calendar.internal.touch;
                        var t = ev.touches ? ev.touches[0] : ev;
                        var coords = { x: t.pageX, y: t.pageY };
                        e.calendar.coords = touch.relativeCoords(ev);
                        if (DayPilot.Global && DayPilot.Global.touch) {
                            DayPilot.Global.touch.active = true;
                        }
                        touch.preventEventTap = true;
                        touch.startMoving(div, coords);
                    };
                })(ediv, e, area);
                DayPilot.rePassive(a, DayPilot.touch.start, touchstart);
            }
        }
        if (area.action === "Bubble" && e.isEvent) {
            a.onmousemove = (function (div, e, area) {
                return function () {
                    if (area.bubble) {
                        area.bubble.showEvent(e, true);
                    }
                    else if (e.calendar.bubble) {
                        e.calendar.bubble.showEvent(e, true);
                    }
                };
            })(div, e, area);
            a.onmouseout = (function (div, e, area) {
                return function () {
                    if (typeof DayPilot.Bubble !== "undefined") {
                        if (area.bubble) {
                            area.bubble.hideOnMouseOut();
                        }
                        else if (e.calendar.bubble) {
                            e.calendar.bubble.hideOnMouseOut();
                        }
                    }
                };
            })(div, e, area);
        }
        else if (area.action === "Bubble" && e.isRow) {
            a.onmousemove = (function (div, e, area) {
                return function () {
                    if (area.bubble) {
                        area.bubble.showResource(e, true);
                    }
                    else if (e.calendar.resourceBubble) {
                        e.calendar.resourceBubble.showResource(e, true);
                    }
                };
            })(div, e, area);
            a.onmouseout = (function (div, e, area) {
                return function () {
                    if (typeof DayPilot.Bubble !== "undefined") {
                        if (area.bubble) {
                            area.bubble.hideOnMouseOut();
                        }
                        else if (e.calendar.resourceBubble) {
                            e.calendar.resourceBubble.hideOnMouseOut();
                        }
                    }
                };
            })(div, e, area);
        }
        else if (area.action === "Bubble" && typeof DayPilot.Bubble !== "undefined" && area.bubble instanceof DayPilot.Bubble) {
            a.onmousemove = (function (div, e, area) {
                return function () {
                    area.bubble.showHtml(null, null);
                };
            })(div, e, area);
            a.onmouseout = (function (div, e, area) {
                return function () {
                    if (typeof DayPilot.Bubble !== "undefined") {
                        if (area.bubble) {
                            area.bubble.hideOnMouseOut();
                        }
                    }
                };
            })(div, e, area);
        }
        if (area.action === "HoverMenu") {
            a.onmousemove = (function (div, e, area) {
                return function () {
                    var m = area.menu;
                    if (m && m.show) {
                        if (!m.visible) {
                            m.show(e);
                        }
                        else if (m.source && typeof m.source.id !== 'undefined' && m.source.id !== e.id) {
                            m.show(e);
                        }
                        m.cancelHideTimeout();
                    }
                };
            })(div, e, area);
            a.onmouseout = (function (div, e, area) {
                return function () {
                    var m = area.menu;
                    if (!m) {
                        return;
                    }
                    if (m.hideOnMouseOver) {
                        m.delayedHide();
                    }
                };
            })(div, e, area);
        }
        if (area.action === "None") {
            var touchstart = (function (div, e, area) {
                return function (ev) {
                    var args = doOnClick(area, e, ev);
                    if (typeof area.onClicked === "function") {
                        area.onClicked(args);
                    }
                    ev.preventDefault();
                    ev.stopPropagation();
                };
            })(ediv, e, area);
            DayPilot.reNonPassive(a, DayPilot.touch.start, touchstart);
        }
        a.onmousedown = (function (div, e, area) {
            return function (ev) {
                if (typeof area.onmousedown === 'function') {
                    area.onmousedown(ev);
                }
                if (typeof area.mousedown === 'function') {
                    var args = {};
                    args.area = area;
                    args.div = div;
                    args.originalEvent = ev;
                    args.source = e;
                    area.mousedown(args);
                }
                if (area.action === "Move" && e.isRow) {
                    var row = e.$.row;
                    var startMoving = e.calendar.internal.rowStartMoving;
                    startMoving(row);
                }
                if (typeof DayPilot.Bubble !== "undefined") {
                    DayPilot.Bubble.hideActive();
                }
                if (area.action === "Move") {
                    DayPilot.Global.movingAreaData = area.data;
                }
                if (area.action === "Move" && e.isEvent) {
                    if (e.calendar.internal && e.calendar.internal.startMoving) {
                        e.calendar.internal.startMoving(div, ev);
                    }
                }
                var cancel = true;
                if (cancel) {
                    if (area.action === "Move" || area.action === "ResizeEnd" || area.action === "ResizeStart" || !area.action || area.action === "Default") {
                        return;
                    }
                    ev.preventDefault();
                    ev.cancelBubble = true;
                }
            };
        })(div, e, area);
        a.onclick = (function (div, e, area) {
            return function (ev) {
                var args = doOnClick(area, e, ev);
                if (args.preventDefault.value) {
                    return;
                }
                switch (area.action) {
                    case "ContextMenu":
                        showContextMenu(div, e, area, ev);
                        ev.cancelBubble = true;
                        break;
                    case "None":
                        ev.cancelBubble = true;
                        break;
                }
                if (typeof area.onClicked === "function") {
                    area.onClicked(args);
                }
            };
        })(div, e, area);
        if (typeof area.onMouseEnter === "function") {
            a.addEventListener("mouseenter", (function (div, e, area) {
                return function (ev) {
                    var args = {};
                    args.area = area;
                    args.source = e;
                    args.originalEvent = ev;
                    area.onMouseEnter(args);
                };
            })(div, e, area));
        }
        if (typeof area.onMouseLeave === "function") {
            a.addEventListener("mouseleave", (function (div, e, area) {
                return function (ev) {
                    var args = {};
                    args.area = area;
                    args.source = e;
                    args.originalEvent = ev;
                    area.onMouseLeave(args);
                };
            })(div, e, area));
        }
        function doOnClick(area, source, originalEvent) {
            var args = {};
            args.area = area;
            args.source = source;
            args.originalEvent = originalEvent;
            args.preventDefault = function () {
                args.preventDefault.value = true;
            };
            if (typeof area.onClick === "function") {
                area.onClick(args);
            }
            return args;
        }
        function showBubble(e, area, ev) {
            if (DayPilot.Bubble) {
                DayPilot.Bubble.touchPosition(ev);
            }
            if (e.calendar.bubble) {
                e.calendar.bubble.showEvent(e, true);
            }
        }
        function showContextMenu(div, e, area, ev) {
            if (DayPilot.Menu) {
                DayPilot.Menu.touchPosition(ev);
            }
            var m = area.contextMenu || area.menu;
            if (!(m instanceof DayPilot.Menu)) {
                if (e.isEvent && e.client.contextMenu()) {
                    m = e.client.contextMenu();
                }
                else if (e.isEvent && e.calendar.contextMenu) {
                    m = e.calendar.contextMenu;
                }
            }
            if (m && m.show) {
                var initiator = { "type": "area", "div": div, "e": e, "area": area, "a": a };
                m.show(e, { "initiator": initiator });
            }
        }
        function resolvePosVal(val) {
            if (typeof val === "string" && isNaN(val)) {
                return val;
            }
            else if (typeof val !== "undefined") {
                return val + "px";
            }
            return undefined;
        }
        return a;
    };
    DayPilot.Areas.all = [];
    DayPilot.Areas.hideAreas = function (div, ev) {
        if (!div) {
            return;
        }
        if (!div || !div.active) {
            return;
        }
        var active = div.active;
        var areas = div.areas;
        if (active && active.children) {
            if (ev) {
                var target = ev.toElement || ev.relatedTarget;
                if (~DayPilot.indexOf(active.children, target)) {
                    return;
                }
            }
        }
        if (!areas || areas.length === 0) {
            div.active = null;
            return;
        }
        DayPilot.de(areas);
        div.active = null;
        div.areas = [];
        DayPilot.rfa(DayPilot.Areas.all, div);
        active.children = null;
    };
    DayPilot.Areas.hideAll = function (ev) {
        if (!DayPilot.Areas.all || DayPilot.Areas.all.length === 0) {
            return;
        }
        for (var i = 0; i < DayPilot.Areas.all.length; i++) {
            DayPilot.Areas.hideAreas(DayPilot.Areas.all[i], ev);
        }
    };
    DayPilot.Exception = function (msg) {
        return new Error(msg);
    };
    DayPilot.Locale = function (id, config) {
        this.id = id;
        this.dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        this.dayNamesShort = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
        this.monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        this.datePattern = "M/d/yyyy";
        this.timePattern = "H:mm";
        this.dateTimePattern = "M/d/yyyy H:mm";
        this.timeFormat = "Clock12Hours";
        this.weekStarts = 0;
        if (config) {
            for (var name_3 in config) {
                this[name_3] = config[name_3];
            }
        }
    };
    DayPilot.Locale.all = {};
    DayPilot.Locale.find = function (id) {
        if (!id) {
            return null;
        }
        var normalized = id.toLowerCase();
        if (normalized.length > 2) {
            normalized = DayPilot.Util.replaceCharAt(normalized, 2, '-');
        }
        return DayPilot.Locale.all[normalized];
    };
    DayPilot.Locale.register = function (locale) {
        DayPilot.Locale.all[locale.id] = locale;
    };
    DayPilot.Locale.register(new DayPilot.Locale('ca-es', { 'dayNames': ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'], 'dayNamesShort': ['dg', 'dl', 'dt', 'dc', 'dj', 'dv', 'ds'], 'monthNames': ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre', ''], 'monthNamesShort': ['gen.', 'febr.', 'març', 'abr.', 'maig', 'juny', 'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.', ''], 'timePattern': 'H:mm', 'datePattern': 'dd/MM/yyyy', 'dateTimePattern': 'dd/MM/yyyy H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('cs-cz', { 'dayNames': ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'], 'dayNamesShort': ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'], 'monthNames': ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec', ''], 'monthNamesShort': ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', ''], 'timePattern': 'H:mm', 'datePattern': 'd. M. yyyy', 'dateTimePattern': 'd. M. yyyy H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('da-dk', { 'dayNames': ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'], 'dayNamesShort': ['sø', 'ma', 'ti', 'on', 'to', 'fr', 'lø'], 'monthNames': ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december', ''], 'monthNamesShort': ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd-MM-yyyy', 'dateTimePattern': 'dd-MM-yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('de-at', { 'dayNames': ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'], 'dayNamesShort': ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], 'monthNames': ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember', ''], 'monthNamesShort': ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd.MM.yyyy', 'dateTimePattern': 'dd.MM.yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('de-ch', { 'dayNames': ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'], 'dayNamesShort': ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], 'monthNames': ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember', ''], 'monthNamesShort': ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd.MM.yyyy', 'dateTimePattern': 'dd.MM.yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('de-de', { 'dayNames': ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'], 'dayNamesShort': ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], 'monthNames': ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember', ''], 'monthNamesShort': ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd.MM.yyyy', 'dateTimePattern': 'dd.MM.yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('de-lu', { 'dayNames': ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'], 'dayNamesShort': ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], 'monthNames': ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember', ''], 'monthNamesShort': ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd.MM.yyyy', 'dateTimePattern': 'dd.MM.yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('en-au', { 'dayNames': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], 'dayNamesShort': ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], 'monthNames': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', ''], 'monthNamesShort': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', ''], 'timePattern': 'h:mm tt', 'datePattern': 'd/MM/yyyy', 'dateTimePattern': 'd/MM/yyyy h:mm tt', 'timeFormat': 'Clock12Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('en-ca', { 'dayNames': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], 'dayNamesShort': ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], 'monthNames': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', ''], 'monthNamesShort': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', ''], 'timePattern': 'h:mm tt', 'datePattern': 'yyyy-MM-dd', 'dateTimePattern': 'yyyy-MM-dd h:mm tt', 'timeFormat': 'Clock12Hours', 'weekStarts': 0 }));
    DayPilot.Locale.register(new DayPilot.Locale('en-gb', { 'dayNames': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], 'dayNamesShort': ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], 'monthNames': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', ''], 'monthNamesShort': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd/MM/yyyy', 'dateTimePattern': 'dd/MM/yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('en-us', { 'dayNames': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], 'dayNamesShort': ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], 'monthNames': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', ''], 'monthNamesShort': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', ''], 'timePattern': 'h:mm tt', 'datePattern': 'M/d/yyyy', 'dateTimePattern': 'M/d/yyyy h:mm tt', 'timeFormat': 'Clock12Hours', 'weekStarts': 0 }));
    DayPilot.Locale.register(new DayPilot.Locale('es-es', { 'dayNames': ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], 'dayNamesShort': ['D', 'L', 'M', 'X', 'J', 'V', 'S'], 'monthNames': ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', ''], 'monthNamesShort': ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.', ''], 'timePattern': 'H:mm', 'datePattern': 'dd/MM/yyyy', 'dateTimePattern': 'dd/MM/yyyy H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('es-mx', { 'dayNames': ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], 'dayNamesShort': ['do.', 'lu.', 'ma.', 'mi.', 'ju.', 'vi.', 'sá.'], 'monthNames': ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', ''], 'monthNamesShort': ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.', ''], 'timePattern': 'hh:mm tt', 'datePattern': 'dd/MM/yyyy', 'dateTimePattern': 'dd/MM/yyyy hh:mm tt', 'timeFormat': 'Clock12Hours', 'weekStarts': 0 }));
    DayPilot.Locale.register(new DayPilot.Locale('eu-es', { 'dayNames': ['igandea', 'astelehena', 'asteartea', 'asteazkena', 'osteguna', 'ostirala', 'larunbata'], 'dayNamesShort': ['ig', 'al', 'as', 'az', 'og', 'or', 'lr'], 'monthNames': ['urtarrila', 'otsaila', 'martxoa', 'apirila', 'maiatza', 'ekaina', 'uztaila', 'abuztua', 'iraila', 'urria', 'azaroa', 'abendua', ''], 'monthNamesShort': ['urt.', 'ots.', 'mar.', 'api.', 'mai.', 'eka.', 'uzt.', 'abu.', 'ira.', 'urr.', 'aza.', 'abe.', ''], 'timePattern': 'H:mm', 'datePattern': 'yyyy/MM/dd', 'dateTimePattern': 'yyyy/MM/dd H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('fi-fi', { 'dayNames': ['sunnuntai', 'maanantai', 'tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai'], 'dayNamesShort': ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'], 'monthNames': ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu', 'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu', ''], 'monthNamesShort': ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu', ''], 'timePattern': 'H:mm', 'datePattern': 'd.M.yyyy', 'dateTimePattern': 'd.M.yyyy H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('fr-be', { 'dayNames': ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], 'dayNamesShort': ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'], 'monthNames': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre', ''], 'monthNamesShort': ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd-MM-yy', 'dateTimePattern': 'dd-MM-yy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('fr-ca', { 'dayNames': ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], 'dayNamesShort': ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'], 'monthNames': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre', ''], 'monthNamesShort': ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.', ''], 'timePattern': 'HH:mm', 'datePattern': 'yyyy-MM-dd', 'dateTimePattern': 'yyyy-MM-dd HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 0 }));
    DayPilot.Locale.register(new DayPilot.Locale('fr-ch', { 'dayNames': ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], 'dayNamesShort': ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'], 'monthNames': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre', ''], 'monthNamesShort': ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd.MM.yyyy', 'dateTimePattern': 'dd.MM.yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('fr-fr', { 'dayNames': ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], 'dayNamesShort': ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'], 'monthNames': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre', ''], 'monthNamesShort': ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd/MM/yyyy', 'dateTimePattern': 'dd/MM/yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('fr-lu', { 'dayNames': ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], 'dayNamesShort': ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'], 'monthNames': ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre', ''], 'monthNamesShort': ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd/MM/yyyy', 'dateTimePattern': 'dd/MM/yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('gl-es', { 'dayNames': ['domingo', 'luns', 'martes', 'mércores', 'xoves', 'venres', 'sábado'], 'dayNamesShort': ['do', 'lu', 'ma', 'mé', 'xo', 've', 'sá'], 'monthNames': ['xaneiro', 'febreiro', 'marzo', 'abril', 'maio', 'xuño', 'xullo', 'agosto', 'setembro', 'outubro', 'novembro', 'decembro', ''], 'monthNamesShort': ['xan', 'feb', 'mar', 'abr', 'maio', 'xuño', 'xul', 'ago', 'set', 'out', 'nov', 'dec', ''], 'timePattern': 'H:mm', 'datePattern': 'dd/MM/yyyy', 'dateTimePattern': 'dd/MM/yyyy H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('it-it', { 'dayNames': ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'], 'dayNamesShort': ['do', 'lu', 'ma', 'me', 'gi', 've', 'sa'], 'monthNames': ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre', ''], 'monthNamesShort': ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd/MM/yyyy', 'dateTimePattern': 'dd/MM/yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('it-ch', { 'dayNames': ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'], 'dayNamesShort': ['do', 'lu', 'ma', 'me', 'gi', 've', 'sa'], 'monthNames': ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre', ''], 'monthNamesShort': ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd.MM.yyyy', 'dateTimePattern': 'dd.MM.yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('ja-jp', { 'dayNames': ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'], 'dayNamesShort': ['日', '月', '火', '水', '木', '金', '土'], 'monthNames': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', ''], 'monthNamesShort': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', ''], 'timePattern': 'H:mm', 'datePattern': 'yyyy/MM/dd', 'dateTimePattern': 'yyyy/MM/dd H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 0 }));
    DayPilot.Locale.register(new DayPilot.Locale('ko-kr', { 'dayNames': ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'], 'dayNamesShort': ['일', '월', '화', '수', '목', '금', '토'], 'monthNames': ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', ''], 'monthNamesShort': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', ''], 'timePattern': 'tt h:mm', 'datePattern': 'yyyy-MM-dd', 'dateTimePattern': 'yyyy-MM-dd tt h:mm', 'timeFormat': 'Clock12Hours', 'weekStarts': 0 }));
    DayPilot.Locale.register(new DayPilot.Locale('nb-no', { 'dayNames': ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'], 'dayNamesShort': ['sø', 'ma', 'ti', 'on', 'to', 'fr', 'lø'], 'monthNames': ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember', ''], 'monthNamesShort': ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd.MM.yyyy', 'dateTimePattern': 'dd.MM.yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('nl-nl', { 'dayNames': ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'], 'dayNamesShort': ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], 'monthNames': ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december', ''], 'monthNamesShort': ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec', ''], 'timePattern': 'HH:mm', 'datePattern': 'd-M-yyyy', 'dateTimePattern': 'd-M-yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('nl-be', { 'dayNames': ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'], 'dayNamesShort': ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], 'monthNames': ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december', ''], 'monthNamesShort': ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec', ''], 'timePattern': 'H:mm', 'datePattern': 'd/MM/yyyy', 'dateTimePattern': 'd/MM/yyyy H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('nn-no', { 'dayNames': ['søndag', 'måndag', 'tysdag', 'onsdag', 'torsdag', 'fredag', 'laurdag'], 'dayNamesShort': ['sø', 'må', 'ty', 'on', 'to', 'fr', 'la'], 'monthNames': ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember', ''], 'monthNamesShort': ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd.MM.yyyy', 'dateTimePattern': 'dd.MM.yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('pt-br', { 'dayNames': ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'], 'dayNamesShort': ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'], 'monthNames': ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro', ''], 'monthNamesShort': ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd/MM/yyyy', 'dateTimePattern': 'dd/MM/yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 0 }));
    DayPilot.Locale.register(new DayPilot.Locale('pl-pl', { 'dayNames': ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'], 'dayNamesShort': ['N', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'], 'monthNames': ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień', ''], 'monthNamesShort': ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru', ''], 'timePattern': 'HH:mm', 'datePattern': 'yyyy-MM-dd', 'dateTimePattern': 'yyyy-MM-dd HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('pt-pt', { 'dayNames': ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'], 'dayNamesShort': ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'], 'monthNames': ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro', ''], 'monthNamesShort': ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez', ''], 'timePattern': 'HH:mm', 'datePattern': 'dd/MM/yyyy', 'dateTimePattern': 'dd/MM/yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 0 }));
    DayPilot.Locale.register(new DayPilot.Locale('ro-ro', { 'dayNames': ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'], 'dayNamesShort': ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'], 'monthNames': ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie', ''], 'monthNamesShort': ['ian.', 'feb.', 'mar.', 'apr.', 'mai.', 'iun.', 'iul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.', ''], 'timePattern': 'H:mm', 'datePattern': 'dd.MM.yyyy', 'dateTimePattern': 'dd.MM.yyyy H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('ru-ru', { 'dayNames': ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'], 'dayNamesShort': ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], 'monthNames': ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь', ''], 'monthNamesShort': ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек', ''], 'timePattern': 'H:mm', 'datePattern': 'dd.MM.yyyy', 'dateTimePattern': 'dd.MM.yyyy H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('sk-sk', { 'dayNames': ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'], 'dayNamesShort': ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'], 'monthNames': ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december', ''], 'monthNamesShort': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', ''], 'timePattern': 'H:mm', 'datePattern': 'd.M.yyyy', 'dateTimePattern': 'd.M.yyyy H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('sv-se', { 'dayNames': ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'], 'dayNamesShort': ['sö', 'må', 'ti', 'on', 'to', 'fr', 'lö'], 'monthNames': ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december', ''], 'monthNamesShort': ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec', ''], 'timePattern': 'HH:mm', 'datePattern': 'yyyy-MM-dd', 'dateTimePattern': 'yyyy-MM-dd HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('tr-tr', { 'dayNames': ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'], 'dayNamesShort': ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'], 'monthNames': ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık', ''], 'monthNamesShort': ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara', ''], 'timePattern': 'HH:mm', 'datePattern': 'd.M.yyyy', 'dateTimePattern': 'd.M.yyyy HH:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('uk-ua', { 'dayNames': ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота'], 'dayNamesShort': ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], 'monthNames': ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень', ''], 'monthNamesShort': ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру', ''], 'timePattern': 'H:mm', 'datePattern': 'dd.MM.yyyy', 'dateTimePattern': 'dd.MM.yyyy H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('zh-cn', { 'dayNames': ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'], 'dayNamesShort': ['日', '一', '二', '三', '四', '五', '六'], 'monthNames': ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月', ''], 'monthNamesShort': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', ''], 'timePattern': 'H:mm', 'datePattern': 'yyyy/M/d', 'dateTimePattern': 'yyyy/M/d H:mm', 'timeFormat': 'Clock24Hours', 'weekStarts': 1 }));
    DayPilot.Locale.register(new DayPilot.Locale('zh-tw', { 'dayNames': ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'], 'dayNamesShort': ['日', '一', '二', '三', '四', '五', '六'], 'monthNames': ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月', ''], 'monthNamesShort': ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月', ''], 'timePattern': 'tt hh:mm', 'datePattern': 'yyyy/M/d', 'dateTimePattern': 'yyyy/M/d tt hh:mm', 'timeFormat': 'Clock12Hours', 'weekStarts': 0 }));
    DayPilot.Locale.US = DayPilot.Locale.find("en-us");
    DayPilot.Switcher = function (options) {
        var This = this;
        this._views = [];
        this._triggers = [];
        this._navigator = {};
        this.selectedClass = null;
        this.syncScrollbar = true;
        this._active = null;
        this._day = DayPilot.Date.today();
        this._scrollY = null;
        this.onChange = null;
        this.onChanged = null;
        this.onSelect = null;
        this._navigator.updateMode = function (mode) {
            var control = This._navigator.control;
            if (!control) {
                return;
            }
            control.selectMode = mode;
            control.select(This._day);
        };
        this.addView = function (spec, options) {
            var element;
            if (typeof spec === 'string') {
                element = document.getElementById(spec);
                if (!element) {
                    throw "Element not found: " + spec;
                }
            }
            else {
                element = spec;
            }
            var control = element;
            var view = {};
            view._isView = true;
            view._id = control.id;
            view.control = control;
            view._options = options || {};
            view._hide = function () {
                if (control.hide) {
                    control.hide();
                }
                else if (control.nav && control.nav.top) {
                    control.nav.top.style.display = 'none';
                }
                else {
                    control.style.display = 'none';
                }
            };
            view._sendNavigate = function (date) {
                var serverBased = (function () {
                    if (control.backendUrl) {
                        return true;
                    }
                    if (typeof WebForm_DoCallback === 'function' && control.uniqueID) {
                        return true;
                    }
                    return false;
                })();
                if (serverBased) {
                    if (control.commandCallBack) {
                        control.commandCallBack("navigate", { "day": date });
                    }
                }
                else {
                    control.startDate = date;
                    control.update();
                }
            };
            view._show = function () {
                This._hideViews();
                if (control.show) {
                    control.show();
                }
                else if (control.nav && control.nav.top) {
                    control.nav.top.style.display = '';
                }
                else {
                    control.style.display = '';
                }
            };
            view._selectMode = function () {
                if (view._options.navigatorSelectMode) {
                    return view._options.navigatorSelectMode;
                }
                if (control.isCalendar) {
                    switch (control.viewType) {
                        case "Day":
                            return "day";
                        case "Week":
                            return "week";
                        case "WorkWeek":
                            return "week";
                        default:
                            return "day";
                    }
                }
                else if (control.isMonth) {
                    switch (control.viewType) {
                        case "Month":
                            return "month";
                        case "Weeks":
                            return "week";
                        default:
                            return "day";
                    }
                }
                return "day";
            };
            this._views.push(view);
            return view;
        };
        this.addTrigger = function (id, control) {
            var element;
            if (typeof id === 'string') {
                element = document.getElementById(id);
                if (!element) {
                    throw "Element not found: " + id;
                }
            }
            else {
                element = id;
            }
            var view = this._findViewByControl(control);
            if (!view) {
                view = this.addView(control);
            }
            var trigger = {};
            trigger._isTrigger = true;
            trigger._element = element;
            trigger._id = element.id;
            trigger._view = view;
            trigger._onClick = function (ev) {
                This.show(trigger);
                This._select(trigger);
                ev === null || ev === void 0 ? void 0 : ev.preventDefault();
            };
            DayPilot.re(element, 'click', trigger._onClick);
            this._triggers.push(trigger);
            return trigger;
        };
        this.addButton = this.addTrigger;
        this.select = function (id) {
            var trigger = this._findTriggerById(id);
            if (trigger) {
                trigger._onClick();
            }
            else if (this._triggers.length > 0) {
                this._triggers[0]._onClick();
            }
        };
        this._findTriggerById = function (id) {
            for (var i = 0; i < this._triggers.length; i++) {
                var trigger = this._triggers[i];
                if (trigger._id === id) {
                    return trigger;
                }
            }
            return null;
        };
        this._select = function (trigger) {
            if (!this.selectedClass) {
                return;
            }
            for (var i = 0; i < this._triggers.length; i++) {
                var s = this._triggers[i];
                DayPilot.Util.removeClass(s._element, this.selectedClass);
            }
            DayPilot.Util.addClass(trigger._element, this.selectedClass);
        };
        this.addNavigator = function (control) {
            This._navigator.control = control;
            control.timeRangeSelectedHandling = "JavaScript";
            control.onTimeRangeSelected = function () {
                var start, end, day;
                if (control.api === 1) {
                    start = arguments[0];
                    end = arguments[1];
                    day = arguments[2];
                }
                else {
                    var args = arguments[0];
                    start = args.start;
                    end = args.end;
                    day = args.day;
                }
                This._day = day;
                navigate(start, end, day);
            };
        };
        this.show = function (el) {
            var view, trigger;
            if (el._isTrigger) {
                trigger = el;
                view = trigger._view;
            }
            else {
                view = el._isView ? el : this._findViewByControl(el);
                if (this._active === view) {
                    return;
                }
            }
            if (This.onSelect) {
                var args = {};
                args.source = trigger ? trigger._element : null;
                args.target = view.control;
                This.onSelect(args);
            }
            var syncScrollbar = This.syncScrollbar;
            if (syncScrollbar) {
                var active = this._active && this._active.control;
                if (active && active.isCalendar) {
                    This._scrollY = active.getScrollY();
                }
            }
            this._active = view;
            view._show();
            if (This._scrollY !== null && view.control.isCalendar) {
                view.control.setScrollY(This._scrollY);
            }
            var mode = view._selectMode();
            This._navigator.updateMode(mode);
            var start = This._navigator.control.selectionStart;
            var end = This._navigator.control.selectionEnd.addDays(1);
            var day = This._navigator.control.selectionDay;
            navigate(start, end, day);
        };
        this._findViewByControl = function (control) {
            for (var i = 0; i < this._views.length; i++) {
                if (this._views[i].control === control) {
                    return this._views[i];
                }
            }
            return null;
        };
        this._hideViews = function () {
            for (var i = 0; i < this._views.length; i++) {
                this._views[i]._hide();
            }
        };
        Object.defineProperty(this, "active", {
            get: function () {
                return This._active;
            }
        });
        this.events = {};
        this.events.load = function (url, success, error) {
            if (This._active && This._active.control) {
                This._active.control.events.load(url, success, error);
            }
            else {
                throw "DayPilot.Switcher.events.load(): Active view not found";
            }
        };
        this._previousArgs = null;
        this._init = function () {
            if (!options) {
                return;
            }
            for (var name_4 in options) {
                if (name_4 === "triggers") {
                    var triggers = options.triggers || [];
                    triggers.forEach(function (item) {
                        This.addTrigger(item.id, item.view);
                    });
                }
                else if (name_4 === "navigator") {
                    This.addNavigator(options.navigator);
                }
                else {
                    This[name_4] = options[name_4];
                }
            }
        };
        this._init();
        function navigate(start, end, day) {
            var args = {};
            args.start = start;
            args.end = end;
            args.day = day;
            args.target = This._active.control;
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            var previous = This._previousArgs;
            if (previous) {
                if (previous.start === args.start && previous.end === args.end && previous.day === args.day && previous.target === args.target) {
                    return;
                }
            }
            This._previousArgs = args;
            if (typeof This.onChange === "function") {
                This.onChange(args);
                if (args.preventDefault.value) {
                    return;
                }
            }
            if (typeof This.onTimeRangeSelect === "function") {
                This.onTimeRangeSelect(args);
                if (args.preventDefault.value) {
                    return;
                }
            }
            This._active._sendNavigate(This._day);
            if (typeof This.onChanged === "function") {
                This.onChanged(args);
            }
            if (typeof This.onTimeRangeSelected === "function") {
                This.onTimeRangeSelected(args);
            }
        }
    };
    DayPilot.Duration = function (ticks) {
        var d = this;
        var day = 1000 * 60 * 60 * 24.0;
        var hour = 1000 * 60 * 60.0;
        var minute = 1000 * 60.0;
        var second = 1000.0;
        if (arguments.length === 2) {
            var start = arguments[0];
            var end = arguments[1];
            if (!(start instanceof DayPilot.Date) && (typeof start !== "string")) {
                throw "DayPilot.Duration(): Invalid start argument, DayPilot.Date expected";
            }
            if (!(end instanceof DayPilot.Date) && (typeof end !== "string")) {
                throw "DayPilot.Duration(): Invalid end argument, DayPilot.Date expected";
            }
            if (typeof start === "string") {
                start = new DayPilot.Date(start);
            }
            if (typeof end === "string") {
                end = new DayPilot.Date(end);
            }
            ticks = end.getTime() - start.getTime();
        }
        this.ticks = ticks;
        if (DayPilot.Date.Cache.DurationCtor["" + ticks]) {
            return DayPilot.Date.Cache.DurationCtor["" + ticks];
        }
        DayPilot.Date.Cache.DurationCtor["" + ticks] = this;
        this.toString = function (pattern) {
            if (!pattern) {
                return d.days() + "." + d.hours() + ":" + d.minutes() + ":" + d.seconds() + "." + d.milliseconds();
            }
            var minutes = d.minutes();
            minutes = (minutes < 10 ? "0" : "") + minutes;
            var result = pattern;
            result = result.replace("mm", minutes);
            result = result.replace("m", d.minutes());
            result = result.replace("H", d.hours());
            result = result.replace("h", d.hours());
            result = result.replace("d", d.days());
            result = result.replace("s", d.seconds());
            return result;
        };
        this.totalHours = function () {
            return d.ticks / hour;
        };
        this.totalDays = function () {
            return d.ticks / day;
        };
        this.totalMinutes = function () {
            return d.ticks / minute;
        };
        this.totalSeconds = function () {
            return d.ticks / second;
        };
        this.days = function () {
            return Math.floor(d.totalDays());
        };
        this.hours = function () {
            var hourPartTicks = d.ticks - d.days() * day;
            return Math.floor(hourPartTicks / hour);
        };
        this.minutes = function () {
            var minutePartTicks = d.ticks - Math.floor(d.totalHours()) * hour;
            return Math.floor(minutePartTicks / minute);
        };
        this.seconds = function () {
            var secondPartTicks = d.ticks - Math.floor(d.totalMinutes()) * minute;
            return Math.floor(secondPartTicks / second);
        };
        this.milliseconds = function () {
            return d.ticks % second;
        };
    };
    DayPilot.Duration.weeks = function (i) {
        return new DayPilot.Duration(i * 1000 * 60 * 60 * 24 * 7);
    };
    DayPilot.Duration.days = function (i) {
        return new DayPilot.Duration(i * 1000 * 60 * 60 * 24);
    };
    DayPilot.Duration.hours = function (i) {
        return new DayPilot.Duration(i * 1000 * 60 * 60);
    };
    DayPilot.Duration.minutes = function (i) {
        return new DayPilot.Duration(i * 1000 * 60);
    };
    DayPilot.Duration.seconds = function (i) {
        return new DayPilot.Duration(i * 1000);
    };
    DayPilot.TimeSpan = function () {
        throw "Please use DayPilot.Duration class instead of DayPilot.TimeSpan.";
    };
    try {
        DayPilot.TimeSpan.prototype = Object.create(DayPilot.Duration.prototype);
    }
    catch (_a) {
        ;
    }
    DayPilot.Date = function (date, readLocal) {
        if (date instanceof DayPilot.Date) {
            return date;
        }
        var ticks;
        if (DayPilot.Util.isNullOrUndefined(date)) {
            ticks = DayPilot.DateUtil.fromLocal().getTime();
            date = ticks;
        }
        var cache = DayPilot.Date.Cache.Ctor;
        if (cache[date]) {
            DayPilot.Stats.cacheHitsCtor += 1;
            return cache[date];
        }
        var isString = false;
        if (typeof date === "string" || date instanceof String) {
            try {
                ticks = DayPilot.DateUtil.fromStringSortable(date, readLocal).getTime();
            }
            catch (_a) {
                throw new DayPilot.Exception("DayPilot.Date - Unable to parse ISO8601 date/time string: " + date);
            }
            isString = true;
        }
        else if (typeof date === "number" || date instanceof Number) {
            if (isNaN(date)) {
                throw "Cannot create DayPilot.Date from NaN";
            }
            ticks = date;
        }
        else if (date instanceof Date) {
            if (readLocal) {
                ticks = DayPilot.DateUtil.fromLocal(date).getTime();
            }
            else {
                ticks = date.getTime();
            }
        }
        else {
            throw "Unrecognized parameter: use Date, number or string in ISO 8601 format";
        }
        var value = ticksToSortable(ticks);
        if (cache[value]) {
            return cache[value];
        }
        cache[value] = this;
        cache[ticks] = this;
        if (isString && value !== date && DayPilot.DateUtil.hasTzSpec(date)) {
            cache[date] = this;
        }
        if (Object.defineProperty) {
            Object.defineProperty(this, "ticks", {
                get: function () { return ticks; }
            });
            Object.defineProperty(this, "value", {
                "value": value,
                "writable": false,
                "enumerable": true
            });
        }
        else {
            this.ticks = ticks;
            this.value = value;
        }
        if (DayPilot.Date.Config.legacyShowD) {
            this.d = new Date(ticks);
        }
        DayPilot.Stats.dateObjects += 1;
    };
    DayPilot.Date.Config = {};
    DayPilot.Date.Config.legacyShowD = false;
    DayPilot.Date.Cache = {};
    DayPilot.Date.Cache.Parsing = {};
    DayPilot.Date.Cache.Ctor = {};
    DayPilot.Date.Cache.Ticks = {};
    DayPilot.Date.Cache.DurationCtor = {};
    DayPilot.Date.Cache.clear = function () {
        DayPilot.Date.Cache.Parsing = {};
        DayPilot.Date.Cache.Ctor = {};
        DayPilot.Date.Cache.Ticks = {};
        DayPilot.Date.Cache.DurationCtor = {};
    };
    DayPilot.Date.prototype.addDays = function (days) {
        if (!days) {
            return this;
        }
        return new DayPilot.Date(this.ticks + days * 24 * 60 * 60 * 1000);
    };
    DayPilot.Date.prototype.addHours = function (hours) {
        if (!hours) {
            return this;
        }
        return this.addTime(hours * 60 * 60 * 1000);
    };
    DayPilot.Date.prototype.addMilliseconds = function (millis) {
        if (!millis) {
            return this;
        }
        return this.addTime(millis);
    };
    DayPilot.Date.prototype.addMinutes = function (minutes) {
        if (!minutes) {
            return this;
        }
        return this.addTime(minutes * 60 * 1000);
    };
    DayPilot.Date.prototype.addMonths = function (months) {
        if (!months) {
            return this;
        }
        var date = new Date(this.ticks);
        var y = date.getUTCFullYear();
        var m = date.getUTCMonth() + 1;
        if (months > 0) {
            while (months >= 12) {
                months -= 12;
                y++;
            }
            if (months > 12 - m) {
                y++;
                m = months - (12 - m);
            }
            else {
                m += months;
            }
        }
        else {
            while (months <= -12) {
                months += 12;
                y--;
            }
            if (m + months <= 0) {
                y--;
                m = 12 + m + months;
            }
            else {
                m = m + months;
            }
        }
        var d = new Date(date.getTime());
        d.setUTCDate(1);
        d.setUTCFullYear(y);
        d.setUTCMonth(m - 1);
        var max = new DayPilot.Date(d).daysInMonth();
        d.setUTCDate(Math.min(max, date.getUTCDate()));
        return new DayPilot.Date(d);
    };
    DayPilot.Date.prototype.addSeconds = function (seconds) {
        if (!seconds) {
            return this;
        }
        return this.addTime(seconds * 1000);
    };
    DayPilot.Date.prototype.addTime = function (ticks) {
        if (!ticks) {
            return this;
        }
        if (ticks instanceof DayPilot.Duration) {
            ticks = ticks.ticks;
        }
        return new DayPilot.Date(this.ticks + ticks);
    };
    DayPilot.Date.prototype.addYears = function (years) {
        var original = new Date(this.ticks);
        var d = new Date(this.ticks);
        var y = this.getYear() + years;
        var m = this.getMonth();
        d.setUTCDate(1);
        d.setUTCFullYear(y);
        d.setUTCMonth(m);
        var max = new DayPilot.Date(d).daysInMonth();
        d.setUTCDate(Math.min(max, original.getUTCDate()));
        return new DayPilot.Date(d);
    };
    DayPilot.Date.prototype.dayOfWeek = function () {
        return new Date(this.ticks).getUTCDay();
    };
    DayPilot.Date.prototype.dayOfWeekISO = function () {
        return new Date(this.ticks).getUTCDay() || 7;
    };
    DayPilot.Date.prototype.getDayOfWeek = function () {
        return new Date(this.ticks).getUTCDay();
    };
    DayPilot.Date.prototype.getDayOfYear = function () {
        var first = this.firstDayOfYear();
        return DayPilot.DateUtil.daysDiff(first, this) + 1;
    };
    DayPilot.Date.prototype.daysInMonth = function () {
        var date = new Date(this.ticks);
        var month = date.getUTCMonth() + 1;
        var year = date.getUTCFullYear();
        var m = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (month !== 2) {
            return m[month - 1];
        }
        if (year % 4 !== 0) {
            return m[1];
        }
        if (year % 100 === 0 && year % 400 !== 0) {
            return m[1];
        }
        return m[1] + 1;
    };
    DayPilot.Date.prototype.daysInYear = function () {
        var year = this.getYear();
        if (year % 4 !== 0) {
            return 365;
        }
        if (year % 100 === 0 && year % 400 !== 0) {
            return 365;
        }
        return 366;
    };
    DayPilot.Date.prototype.dayOfYear = function () {
        return Math.ceil((this.getDatePart().getTime() - this.firstDayOfYear().getTime()) / 86400000) + 1;
    };
    DayPilot.Date.prototype.equals = function (another) {
        if (another === null) {
            return false;
        }
        if (another instanceof DayPilot.Date) {
            return this === another;
        }
        else {
            throw "The parameter must be a DayPilot.Date object (DayPilot.Date.equals())";
        }
    };
    DayPilot.Date.prototype.firstDayOfMonth = function () {
        var d = new Date();
        d.setUTCFullYear(this.getYear(), this.getMonth(), 1);
        d.setUTCHours(0);
        d.setUTCMinutes(0);
        d.setUTCSeconds(0);
        d.setUTCMilliseconds(0);
        return new DayPilot.Date(d);
    };
    DayPilot.Date.prototype.firstDayOfYear = function () {
        var year = this.getYear();
        var d = new Date();
        d.setUTCFullYear(year, 0, 1);
        d.setUTCHours(0);
        d.setUTCMinutes(0);
        d.setUTCSeconds(0);
        d.setUTCMilliseconds(0);
        return new DayPilot.Date(d);
    };
    DayPilot.Date.prototype.firstDayOfWeek = function (weekStarts) {
        var d = this;
        if (weekStarts instanceof DayPilot.Locale) {
            weekStarts = weekStarts.weekStarts;
        }
        else if (typeof weekStarts === "string" && DayPilot.Locale.find(weekStarts)) {
            var locale = DayPilot.Locale.find(weekStarts);
            weekStarts = locale.weekStarts;
        }
        else {
            weekStarts = weekStarts || 0;
        }
        var day = d.dayOfWeek();
        while (day !== weekStarts) {
            d = d.addDays(-1);
            day = d.dayOfWeek();
        }
        return new DayPilot.Date(d);
    };
    DayPilot.Date.prototype.getDay = function () {
        return new Date(this.ticks).getUTCDate();
    };
    DayPilot.Date.prototype.getDatePart = function () {
        var d = new Date(this.ticks);
        d.setUTCHours(0);
        d.setUTCMinutes(0);
        d.setUTCSeconds(0);
        d.setUTCMilliseconds(0);
        return new DayPilot.Date(d);
    };
    DayPilot.Date.prototype.getYear = function () {
        return new Date(this.ticks).getUTCFullYear();
    };
    DayPilot.Date.prototype.getHours = function () {
        return new Date(this.ticks).getUTCHours();
    };
    DayPilot.Date.prototype.getMilliseconds = function () {
        return new Date(this.ticks).getUTCMilliseconds();
    };
    DayPilot.Date.prototype.getMinutes = function () {
        return new Date(this.ticks).getUTCMinutes();
    };
    DayPilot.Date.prototype.getMonth = function () {
        return new Date(this.ticks).getUTCMonth();
    };
    DayPilot.Date.prototype.getSeconds = function () {
        return new Date(this.ticks).getUTCSeconds();
    };
    DayPilot.Date.prototype.getTotalTicks = function () {
        return this.getTime();
    };
    DayPilot.Date.prototype.getTime = function () {
        return this.ticks;
    };
    DayPilot.Date.prototype.getTimePart = function () {
        var datePart = this.getDatePart();
        return DayPilot.DateUtil.diff(this, datePart);
    };
    DayPilot.Date.prototype.lastDayOfMonth = function () {
        var d = new Date(this.firstDayOfMonth().getTime());
        var length = this.daysInMonth();
        d.setUTCDate(length);
        return new DayPilot.Date(d);
    };
    DayPilot.Date.prototype.weekNumber = function () {
        var first = this.firstDayOfYear();
        var days = (this.getTime() - first.getTime()) / 86400000;
        return Math.ceil((days + first.dayOfWeek() + 1) / 7);
    };
    DayPilot.Date.prototype.weekNumberISO = function () {
        var thursdayFlag = false;
        var dayOfYear = this.dayOfYear();
        var startWeekDayOfYear = this.firstDayOfYear().dayOfWeek();
        var endWeekDayOfYear = this.firstDayOfYear().addYears(1).addDays(-1).dayOfWeek();
        if (startWeekDayOfYear === 0) {
            startWeekDayOfYear = 7;
        }
        if (endWeekDayOfYear === 0) {
            endWeekDayOfYear = 7;
        }
        var daysInFirstWeek = 8 - (startWeekDayOfYear);
        if (startWeekDayOfYear === 4 || endWeekDayOfYear === 4) {
            thursdayFlag = true;
        }
        var fullWeeks = Math.ceil((dayOfYear - (daysInFirstWeek)) / 7);
        var weekNumber = fullWeeks;
        if (daysInFirstWeek >= 4) {
            weekNumber = weekNumber + 1;
        }
        if (weekNumber > 52 && !thursdayFlag) {
            weekNumber = 1;
        }
        if (weekNumber === 0) {
            weekNumber = this.firstDayOfYear().addDays(-1).weekNumberISO();
        }
        return weekNumber;
    };
    DayPilot.Date.prototype.toDateLocal = function () {
        var date = new Date(this.ticks);
        var d = new Date();
        d.setFullYear(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        d.setHours(date.getUTCHours());
        d.setMinutes(date.getUTCMinutes());
        d.setSeconds(date.getUTCSeconds());
        d.setMilliseconds(date.getUTCMilliseconds());
        return d;
    };
    DayPilot.Date.prototype.toDate = function () {
        return new Date(this.ticks);
    };
    DayPilot.Date.prototype.toJSON = function () {
        return this.value;
    };
    DayPilot.Date.prototype.toString = function (pattern, locale) {
        if (!pattern) {
            return this.toStringSortable();
        }
        return new Pattern(pattern, locale).print(this);
    };
    DayPilot.Date.prototype.toStringSortable = function () {
        return ticksToSortable(this.ticks);
    };
    function ticksToSortable(ticks) {
        var cache = DayPilot.Date.Cache.Ticks;
        if (cache[ticks]) {
            DayPilot.Stats.cacheHitsTicks += 1;
            return cache[ticks];
        }
        var d = new Date(ticks);
        var millisecond;
        var ms = d.getUTCMilliseconds();
        if (ms === 0) {
            millisecond = "";
        }
        else if (ms < 10) {
            millisecond = ".00" + ms;
        }
        else if (ms < 100) {
            millisecond = ".0" + ms;
        }
        else {
            millisecond = "." + ms;
        }
        var second = d.getUTCSeconds();
        if (second < 10) {
            second = "0" + second;
        }
        var minute = d.getUTCMinutes();
        if (minute < 10) {
            minute = "0" + minute;
        }
        var hour = d.getUTCHours();
        if (hour < 10) {
            hour = "0" + hour;
        }
        var day = d.getUTCDate();
        if (day < 10) {
            day = "0" + day;
        }
        var month = d.getUTCMonth() + 1;
        if (month < 10) {
            month = "0" + month;
        }
        var year = d.getUTCFullYear();
        if (year <= 0) {
            throw "The minimum year supported is 1.";
        }
        if (year < 10) {
            year = "000" + year;
        }
        else if (year < 100) {
            year = "00" + year;
        }
        else if (year < 1000) {
            year = "0" + year;
        }
        var result = year + "-" + month + "-" + day + 'T' + hour + ":" + minute + ":" + second + millisecond;
        cache[ticks] = result;
        return result;
    }
    DayPilot.Date.parse = function (str, pattern, locale) {
        var p = new Pattern(pattern, locale);
        return p.parse(str);
    };
    DayPilot.Date.today = function () {
        return new DayPilot.Date(DayPilot.DateUtil.localToday(), true);
    };
    DayPilot.Date.now = function () {
        return new DayPilot.Date();
    };
    DayPilot.Date.fromYearMonthDay = function (year, month, day) {
        month = month || 1;
        day = day || 1;
        var d = new Date(0);
        d.setUTCFullYear(year);
        d.setUTCMonth(month - 1);
        d.setUTCDate(day);
        return new DayPilot.Date(d);
    };
    DayPilot.DateUtil = {};
    DayPilot.DateUtil.fromStringSortable = function (string, readLocal) {
        if (!string) {
            throw "Can't create DayPilot.Date from an empty string";
        }
        var len = string.length;
        var date = len === 10;
        var datetime = len === 19;
        var long = len > 19;
        if (!date && !datetime && !long) {
            throw "Invalid string format (use '2010-01-01' or '2010-01-01T00:00:00'): " + string;
        }
        if (DayPilot.Date.Cache.Parsing[string] && !readLocal) {
            DayPilot.Stats.cacheHitsParsing += 1;
            return DayPilot.Date.Cache.Parsing[string];
        }
        var year = string.substring(0, 4);
        var month = string.substring(5, 7);
        var day = string.substring(8, 10);
        var d = new Date(0);
        d.setUTCFullYear(year, month - 1, day);
        if (date) {
            DayPilot.Date.Cache.Parsing[string] = d;
            return d;
        }
        var hours = string.substring(11, 13);
        var minutes = string.substring(14, 16);
        var seconds = string.substring(17, 19);
        d.setUTCHours(hours);
        d.setUTCMinutes(minutes);
        d.setUTCSeconds(seconds);
        if (datetime) {
            DayPilot.Date.Cache.Parsing[string] = d;
            return d;
        }
        var tzdir = string[19];
        var tzoffset = 0;
        if (tzdir === ".") {
            var ms = parseInt(string.substring(20, 23));
            d.setUTCMilliseconds(ms);
            tzoffset = DayPilot.DateUtil.getTzOffsetMinutes(string.substring(23));
        }
        else {
            tzoffset = DayPilot.DateUtil.getTzOffsetMinutes(string.substring(19));
        }
        var dd = new DayPilot.Date(d);
        if (!readLocal) {
            dd = dd.addMinutes(-tzoffset);
        }
        d = dd.toDate();
        DayPilot.Date.Cache.Parsing[string] = d;
        return d;
    };
    DayPilot.DateUtil.getTzOffsetMinutes = function (string) {
        if (DayPilot.Util.isNullOrUndefined(string) || string === "") {
            return 0;
        }
        if (string === "Z") {
            return 0;
        }
        var tzdir = string[0];
        var tzhours = parseInt(string.substring(1, 3));
        var tzminutes = parseInt(string.substring(4));
        var tzoffset = tzhours * 60 + tzminutes;
        if (tzdir === "-") {
            return -tzoffset;
        }
        else if (tzdir === "+") {
            return tzoffset;
        }
        else {
            throw "Invalid timezone spec: " + string;
        }
    };
    DayPilot.DateUtil.hasTzSpec = function (string) {
        if (string.indexOf("+")) {
            return true;
        }
        if (string.indexOf("-")) {
            return true;
        }
        return false;
    };
    DayPilot.DateUtil.daysDiff = function (first, second) {
        if (!first || !second) {
            throw new Error('two parameters required');
        }
        first = new DayPilot.Date(first);
        second = new DayPilot.Date(second);
        if (first.getTime() > second.getTime()) {
            return null;
        }
        var i = 0;
        var fDay = first.getDatePart();
        var sDay = second.getDatePart();
        while (fDay.getTime() < sDay.getTime()) {
            fDay = fDay.addDays(1);
            i++;
        }
        return i;
    };
    DayPilot.DateUtil.daysSpan = function (first, second) {
        if (!first || !second) {
            throw new Error('two parameters required');
        }
        first = new DayPilot.Date(first);
        second = new DayPilot.Date(second);
        if (first.getTime() === second.getTime()) {
            return 0;
        }
        var diff = DayPilot.DateUtil.daysDiff(first, second);
        if (second.getTime() === second.getDatePart().getTime()) {
            diff--;
        }
        return diff;
    };
    DayPilot.DateUtil.diff = function (first, second) {
        if (!(first && second && first.getTime && second.getTime)) {
            throw "Both compared objects must be Date objects (DayPilot.Date.diff).";
        }
        return first.getTime() - second.getTime();
    };
    DayPilot.DateUtil.fromLocal = function (localDate) {
        if (!localDate) {
            localDate = new Date();
        }
        var d = new Date();
        d.setUTCFullYear(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
        d.setUTCHours(localDate.getHours());
        d.setUTCMinutes(localDate.getMinutes());
        d.setUTCSeconds(localDate.getSeconds());
        d.setUTCMilliseconds(localDate.getMilliseconds());
        return d;
    };
    DayPilot.DateUtil.localToday = function () {
        var d = new Date();
        d.setHours(0);
        d.setMinutes(0);
        d.setSeconds(0);
        d.setMilliseconds(0);
        return d;
    };
    DayPilot.DateUtil.hours = function (date, use12) {
        var minute = date.getUTCMinutes();
        if (minute < 10) {
            minute = "0" + minute;
        }
        var hour = date.getUTCHours();
        if (use12) {
            var am = hour < 12;
            hour = hour % 12;
            if (hour === 0) {
                hour = 12;
            }
            var suffix = am ? "AM" : "PM";
            return hour + ':' + minute + ' ' + suffix;
        }
        else {
            return hour + ':' + minute;
        }
    };
    DayPilot.DateUtil.max = function (first, second) {
        if (first.getTime() > second.getTime()) {
            return first;
        }
        else {
            return second;
        }
    };
    DayPilot.DateUtil.min = function (first, second) {
        if (first.getTime() < second.getTime()) {
            return first;
        }
        else {
            return second;
        }
    };
    function Pattern(pattern, locale) {
        if (typeof locale === "string") {
            locale = DayPilot.Locale.find(locale);
        }
        locale = locale || DayPilot.Locale.US;
        var all = [
            { "seq": "yyyy", "expr": "[0-9]{4,4\u007d", "str": function (d) {
                    return d.getYear();
                } },
            { "seq": "yy", "expr": "[0-9]{2,2\u007d", "str": function (d) {
                    return d.getYear() % 100;
                }, "transform": function (input) {
                    return parseInt(input) + 2000;
                } },
            { "seq": "mm", "expr": "[0-9]{2,2\u007d", "str": function (d) {
                    var r = d.getMinutes();
                    return r < 10 ? "0" + r : r;
                } },
            { "seq": "m", "expr": "[0-9]{1,2\u007d", "str": function (d) {
                    var r = d.getMinutes();
                    return r;
                } },
            { "seq": "HH", "expr": "[0-9]{2,2\u007d", "str": function (d) {
                    var r = d.getHours();
                    return r < 10 ? "0" + r : r;
                } },
            { "seq": "H", "expr": "[0-9]{1,2\u007d", "str": function (d) {
                    var r = d.getHours();
                    return r;
                } },
            { "seq": "hh", "expr": "[0-9]{2,2\u007d", "str": function (d) {
                    var hour = d.getHours();
                    hour = hour % 12;
                    if (hour === 0) {
                        hour = 12;
                    }
                    var r = hour;
                    return r < 10 ? "0" + r : r;
                } },
            { "seq": "h", "expr": "[0-9]{1,2\u007d", "str": function (d) {
                    var hour = d.getHours();
                    hour = hour % 12;
                    if (hour === 0) {
                        hour = 12;
                    }
                    return hour;
                } },
            { "seq": "ss", "expr": "[0-9]{2,2\u007d", "str": function (d) {
                    var r = d.getSeconds();
                    return r < 10 ? "0" + r : r;
                } },
            { "seq": "s", "expr": "[0-9]{1,2\u007d", "str": function (d) {
                    var r = d.getSeconds();
                    return r;
                } },
            { "seq": "MMMM", "expr": "[^\\s0-9]*", "str": function (d) {
                    var r = locale.monthNames[d.getMonth()];
                    return r;
                }, "transform": function (input) {
                    var index = DayPilot.indexOf(locale.monthNames, input, equalsIgnoreCase);
                    if (index < 0) {
                        return null;
                    }
                    return index + 1;
                } },
            { "seq": "MMM", "expr": "[^\\s0-9]*", "str": function (d) {
                    var r = locale.monthNamesShort[d.getMonth()];
                    return r;
                }, "transform": function (input) {
                    var index = DayPilot.indexOf(locale.monthNamesShort, input, equalsIgnoreCase);
                    if (index < 0) {
                        return null;
                    }
                    return index + 1;
                } },
            { "seq": "MM", "expr": "[0-9]{2,2\u007d", "str": function (d) {
                    var r = d.getMonth() + 1;
                    return r < 10 ? "0" + r : r;
                } },
            { "seq": "M", "expr": "[0-9]{1,2\u007d", "str": function (d) {
                    var r = d.getMonth() + 1;
                    return r;
                } },
            { "seq": "dddd", "expr": "[^\\s0-9]*", "str": function (d) {
                    var r = locale.dayNames[d.getDayOfWeek()];
                    return r;
                } },
            { "seq": "ddd", "expr": "[^\\s0-9]*", "str": function (d) {
                    var r = locale.dayNamesShort[d.getDayOfWeek()];
                    return r;
                } },
            { "seq": "dd", "expr": "[0-9]{2,2\u007d", "str": function (d) {
                    var r = d.getDay();
                    return r < 10 ? "0" + r : r;
                } },
            { "seq": "%d", "expr": "[0-9]{1,2\u007d", "str": function (d) {
                    var r = d.getDay();
                    return r;
                } },
            { "seq": "d", "expr": "[0-9]{1,2\u007d", "str": function (d) {
                    var r = d.getDay();
                    return r;
                } },
            { "seq": "tt", "expr": "(AM|PM|am|pm)", "str": function (d) {
                    var hour = d.getHours();
                    var am = hour < 12;
                    return am ? "AM" : "PM";
                }, "transform": function (input) {
                    return input.toUpperCase();
                } },
        ];
        var escapeRegex = function (text) {
            return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        };
        this.init = function () {
            this.year = this.findSequence("yyyy") || this.findSequence("yy");
            this.month = this.findSequence("MMMM") || this.findSequence("MMM") || this.findSequence("MM") || this.findSequence("M");
            this.day = this.findSequence("dd") || this.findSequence("d");
            this.hours = this.findSequence("HH") || this.findSequence("H");
            this.minutes = this.findSequence("mm") || this.findSequence("m");
            this.seconds = this.findSequence("ss") || this.findSequence("s");
            this.ampm = this.findSequence("tt");
            this.hours12 = this.findSequence("hh") || this.findSequence("h");
        };
        this.findSequence = function (seq) {
            function defaultTransform(value) {
                return parseInt(value);
            }
            var index = pattern.indexOf(seq);
            if (index === -1) {
                return null;
            }
            return {
                "findValue": function (input) {
                    var prepared = escapeRegex(pattern);
                    var transform = null;
                    for (var i = 0; i < all.length; i++) {
                        var pick = (seq === all[i].seq);
                        var expr = all[i].expr;
                        if (pick) {
                            expr = "(" + expr + ")";
                            transform = all[i].transform;
                        }
                        prepared = prepared.replace(all[i].seq, expr);
                    }
                    prepared = "^" + prepared + "$";
                    try {
                        var r = new RegExp(prepared);
                        var array = r.exec(input);
                        if (!array) {
                            return null;
                        }
                        transform = transform || defaultTransform;
                        return transform(array[1]);
                    }
                    catch (_a) {
                        throw "unable to create regex from: " + prepared;
                    }
                }
            };
        };
        this.print = function (date) {
            var find = function (t) {
                for (var i = 0; i < all.length; i++) {
                    if (all[i] && all[i].seq === t) {
                        return all[i];
                    }
                }
                return null;
            };
            var eos = pattern.length <= 0;
            var pos = 0;
            var components = [];
            while (!eos) {
                var rem = pattern.substring(pos);
                var matches = /%?(.)\1*/.exec(rem);
                if (matches && matches.length > 0) {
                    var match = matches[0];
                    var q = find(match);
                    if (q) {
                        components.push(q);
                    }
                    else {
                        components.push(match);
                    }
                    pos += match.length;
                    eos = pattern.length <= pos;
                }
                else {
                    eos = true;
                }
            }
            for (var i = 0; i < components.length; i++) {
                var c = components[i];
                if (typeof c !== 'string') {
                    components[i] = c.str(date);
                }
            }
            return components.join("");
        };
        this.parse = function (input) {
            var year = this.year.findValue(input);
            if (!year) {
                return null;
            }
            var month = this.month.findValue(input);
            if (DayPilot.Util.isNullOrUndefined(month)) {
                return null;
            }
            if (month > 12 || month < 1) {
                return null;
            }
            var day = this.day.findValue(input);
            var daysInMonth = DayPilot.Date.fromYearMonthDay(year, month).daysInMonth();
            if (day < 1 || day > daysInMonth) {
                return null;
            }
            var hours = this.hours ? this.hours.findValue(input) : 0;
            var minutes = this.minutes ? this.minutes.findValue(input) : 0;
            var seconds = this.seconds ? this.seconds.findValue(input) : 0;
            var ampm = this.ampm ? this.ampm.findValue(input) : null;
            if (this.ampm && this.hours12) {
                var hours12 = this.hours12.findValue(input);
                if (hours12 < 1 || hours12 > 12) {
                    return null;
                }
                if (ampm === "PM") {
                    if (hours12 === 12) {
                        hours = 12;
                    }
                    else {
                        hours = hours12 + 12;
                    }
                }
                else {
                    if (hours12 === 12) {
                        hours = 0;
                    }
                    else {
                        hours = hours12;
                    }
                }
            }
            if (hours < 0 || hours > 23) {
                return null;
            }
            if (minutes < 0 || minutes > 59) {
                return null;
            }
            if (seconds < 0 || seconds > 59) {
                return null;
            }
            var d = new Date();
            d.setUTCFullYear(year, month - 1, day);
            d.setUTCHours(hours);
            d.setUTCMinutes(minutes);
            d.setUTCSeconds(seconds);
            d.setUTCMilliseconds(0);
            return new DayPilot.Date(d);
        };
        this.init();
    }
    function equalsIgnoreCase(str1, str2) {
        if (DayPilot.Util.isNullOrUndefined(str1)) {
            return false;
        }
        if (DayPilot.Util.isNullOrUndefined(str2)) {
            return false;
        }
        return str1.toLocaleLowerCase() === str2.toLocaleLowerCase();
    }
    DayPilot.ColorUtil = {};
    function toHex(dec) {
        dec = Math.min(dec, 255);
        dec = Math.max(dec, 0);
        var str = dec.toString(16);
        return (dec < 16) ? "0" + str : str;
    }
    DayPilot.ColorUtil.hexToRgb = function (hex) {
        if (!/^#[0-9a-f]{6}$/i.test(hex)) {
            throw new DayPilot.Exception("Invalid color, only full hex color string accepted, eg. '#ffaaff'.");
        }
        hex = hex.replace("#", "");
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16),
        };
    };
    DayPilot.ColorUtil.rgbToHex = function (rgb) {
        return "#" + toHex(rgb.r) + toHex(rgb.g) + toHex(rgb.b);
    };
    DayPilot.ColorUtil.adjustLuminance = function (rgb, pt) {
        return {
            r: rgb.r + pt,
            g: rgb.g + pt,
            b: rgb.b + pt
        };
    };
    DayPilot.ColorUtil.darker = function (hexColor, steps) {
        var alpha = "";
        if (hexColor.length === 9) {
            alpha = hexColor.slice(7, 9);
            hexColor = hexColor.slice(0, 7);
        }
        var src = DayPilot.ColorUtil.hexToRgb(hexColor);
        if (typeof steps !== "number") {
            steps = 1;
        }
        var step = 17;
        var pt = Math.round(steps * step);
        var target = DayPilot.ColorUtil.adjustLuminance(src, -pt);
        var result = DayPilot.ColorUtil.rgbToHex(target);
        return result + alpha;
    };
    DayPilot.ColorUtil.lighter = function (hexColor, steps) {
        if (typeof steps !== "number") {
            steps = 1;
        }
        return DayPilot.ColorUtil.darker(hexColor, -steps);
    };
    DayPilot.ColorUtil.pl = function (hexColor) {
        var rgb = DayPilot.ColorUtil.hexToRgb(hexColor);
        var r = rgb.r / 255;
        var g = rgb.g / 255;
        var b = rgb.b / 255;
        var pl = Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b);
        return pl;
    };
    DayPilot.ColorUtil.contrasting = function (hexColor, light, dark) {
        var pl = DayPilot.ColorUtil.pl(hexColor);
        light = light || "#ffffff";
        dark = dark || "#000000";
        return pl > 0.5 ? dark : light;
    };
    DayPilot.Event = function (data, calendar, part) {
        var e = this;
        this.calendar = calendar;
        this.data = data ? data : {};
        this.part = part ? part : {};
        if (typeof this.data.id === 'undefined') {
            this.data.id = this.data.value;
        }
        var copy = {};
        var synced = ["id", "text", "start", "end", "resource"];
        this.isEvent = true;
        this.temp = function () {
            if (copy.dirty) {
                return copy;
            }
            for (var i = 0; i < synced.length; i++) {
                copy[synced[i]] = e.data[synced[i]];
            }
            copy.dirty = true;
            return copy;
        };
        this.copy = function () {
            var result = {};
            for (var i = 0; i < synced.length; i++) {
                result[synced[i]] = e.data[synced[i]];
            }
            return result;
        };
        this.commit = function () {
            if (!copy.dirty) {
                return;
            }
            for (var i = 0; i < synced.length; i++) {
                e.data[synced[i]] = copy[synced[i]];
            }
            copy.dirty = false;
        };
        this.dirty = function () {
            return copy.dirty;
        };
        this.id = function (val) {
            if (typeof val === 'undefined') {
                return e.data.id;
            }
            else {
                this.temp().id = val;
            }
        };
        this.value = function (val) {
            if (typeof val === 'undefined') {
                return e.id();
            }
            else {
                e.id(val);
            }
        };
        this.text = function (val) {
            if (typeof val === 'undefined') {
                return e.data.text;
            }
            else {
                this.temp().text = val;
                this.client.innerHTML(val);
            }
        };
        this.start = function (val) {
            if (typeof val === 'undefined') {
                return new DayPilot.Date(e.data.start);
            }
            else {
                this.temp().start = new DayPilot.Date(val);
            }
        };
        this.end = function (val) {
            if (typeof val === 'undefined') {
                return new DayPilot.Date(e.data.end);
            }
            else {
                this.temp().end = new DayPilot.Date(val);
            }
        };
        this.resource = function (val) {
            if (typeof val === 'undefined') {
                return e.data.resource;
            }
            else {
                this.temp().resource = val;
            }
        };
        this.duration = function () {
            return new DayPilot.Duration(this.start(), this.end());
        };
        this.rawend = function (val) {
            if (typeof val === 'undefined') {
                if (calendar && calendar.internal.adjustEndIn) {
                    return calendar.internal.adjustEndIn(new DayPilot.Date(e.data.end));
                }
                return new DayPilot.Date(e.data.end);
            }
            else {
                throw new DayPilot.Exception("DayPilot.Event.rawend() is readonly");
            }
        };
        this.partStart = function () {
            return new DayPilot.Date(this.part.start);
        };
        this.partEnd = function () {
            return new DayPilot.Date(this.part.end);
        };
        this.tag = function (field) {
            var values = e.data.tag;
            if (!values) {
                return null;
            }
            if (typeof field === 'undefined') {
                return e.data.tag;
            }
            var fields = e.calendar.tagFields;
            var index = -1;
            for (var i = 0; i < fields.length; i++) {
                if (field === fields[i]) {
                    index = i;
                }
            }
            if (index === -1) {
                throw "Field name not found.";
            }
            return values[index];
        };
        this.client = {};
        this.client.innerHTML = function (val) {
            if (typeof val === 'undefined') {
                var data_1 = e.cache || e.data;
                var xssTextHtml = e.calendar && e.calendar.internal && e.calendar.internal.xssTextHtml;
                if (xssTextHtml) {
                    return xssTextHtml(data_1.text, data_1.html);
                }
                return DayPilot.Util.escapeTextHtml(data_1.text, data_1.html);
            }
            else {
                e.data.html = val;
            }
        };
        this.client.html = this.client.innerHTML;
        this.client.header = function (val) {
            if (typeof val === 'undefined') {
                return e.data.header;
            }
            else {
                e.data.header = val;
            }
        };
        this.client.cssClass = function (val) {
            if (typeof val === 'undefined') {
                if (e.cache && typeof e.cache.cssClass !== "undefined") {
                    return e.cache.cssClass;
                }
                return e.data.cssClass;
            }
            else {
                e.data.cssClass = val;
            }
        };
        this.client.toolTip = function (val) {
            if (typeof val === 'undefined') {
                if (e.cache && typeof e.cache.toolTip !== "undefined") {
                    return e.cache.toolTip;
                }
                return typeof e.data.toolTip !== 'undefined' ? e.data.toolTip : e.data.text;
            }
            else {
                e.data.toolTip = val;
            }
        };
        this.client.barVisible = function (val) {
            if (typeof val === 'undefined') {
                if (e.cache && typeof e.cache.barHidden !== "undefined") {
                    return !e.cache.barHidden;
                }
                return e.calendar.durationBarVisible && !e.data.barHidden;
            }
            else {
                e.data.barHidden = !val;
            }
        };
        this.client.backColor = function (val) {
            if (typeof val === 'undefined') {
                if (e.cache && typeof e.cache.backColor !== "undefined") {
                    return e.cache.backColor;
                }
                return typeof e.data.backColor !== "undefined" ? e.data.backColor : e.calendar.eventBackColor;
            }
            else {
                e.data.backColor = val;
            }
        };
        this.client.borderColor = function (val) {
            if (typeof val === 'undefined') {
                if (e.cache && typeof e.cache.borderColor !== "undefined") {
                    return e.cache.borderColor;
                }
                return typeof e.data.borderColor !== "undefined" ? e.data.borderColor : e.calendar.eventBorderColor;
            }
            else {
                e.data.borderColor = val;
            }
        };
        this.client.contextMenu = function (val) {
            if (typeof val === 'undefined') {
                if (e.oContextMenu) {
                    return e.oContextMenu;
                }
                var cm = e.cache ? e.cache.contextMenu : e.data.contextMenu;
                return cm;
            }
            else {
                e.oContextMenu = val;
            }
        };
        this.client.moveEnabled = function (val) {
            if (typeof val === 'undefined') {
                if (e.cache && typeof e.cache.moveDisabled !== "undefined") {
                    return !e.cache.moveDisabled;
                }
                return e.calendar.eventMoveHandling !== 'Disabled' && !e.data.moveDisabled;
            }
            else {
                e.data.moveDisabled = !val;
            }
        };
        this.client.resizeEnabled = function (val) {
            if (typeof val === 'undefined') {
                if (e.cache && typeof e.cache.resizeDisabled !== "undefined") {
                    return !e.cache.resizeDisabled;
                }
                return e.calendar.eventResizeHandling !== 'Disabled' && !e.data.resizeDisabled;
            }
            else {
                e.data.resizeDisabled = !val;
            }
        };
        this.client.clickEnabled = function (val) {
            if (typeof val === 'undefined') {
                if (e.cache && typeof e.cache.clickDisabled !== "undefined") {
                    return !e.cache.clickDisabled;
                }
                return e.calendar.eventClickHandling !== 'Disabled' && !e.data.clickDisabled;
            }
            else {
                e.data.clickDisabled = !val;
            }
        };
        this.client.rightClickEnabled = function (val) {
            if (typeof val === 'undefined') {
                if (e.cache && typeof e.cache.rightClickDisabled !== "undefined") {
                    return !e.cache.rightClickDisabled;
                }
                return e.calendar.eventRightClickHandling !== 'Disabled' && !e.data.rightClickDisabled;
            }
            else {
                e.data.rightClickDisabled = !val;
            }
        };
        this.client.deleteEnabled = function (val) {
            if (typeof val === 'undefined') {
                if (e.cache && typeof e.cache.deleteDisabled !== "undefined") {
                    return !e.cache.deleteDisabled;
                }
                return e.calendar.eventDeleteHandling !== 'Disabled' && !e.data.deleteDisabled;
            }
            else {
                e.data.deleteDisabled = !val;
            }
        };
        this.toJSON = function () {
            var json = {};
            json.value = this.id();
            json.id = this.id();
            json.text = this.text();
            json.start = this.start();
            json.end = this.end();
            json.tag = {};
            if (e.calendar && e.calendar.tagFields) {
                var fields = e.calendar.tagFields;
                for (var i = 0; i < fields.length; i++) {
                    json.tag[fields[i]] = this.tag(fields[i]);
                }
            }
            return json;
        };
    };
})(DayPilot);
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
"use strict";
(function (DayPilot) {
    'use strict';
    if (typeof DayPilot.DatePicker !== 'undefined') {
        return;
    }
    DayPilot.DatePicker = function (properties) {
        this.v = '${v}';
        var navigatorId = "navigator_" + new Date().getTime();
        var This = this;
        this.onShow = null;
        this.onTimeRangeSelect = null;
        this.onTimeRangeSelected = null;
        this.prepare = function () {
            this.locale = "en-us";
            this.target = null;
            this.targetAlignment = "left";
            this.resetTarget = true;
            this.pattern = this._resolved.locale().datePattern;
            this.theme = "navigator_default";
            this.patterns = [];
            this.zIndex = null;
            this.showToday = true;
            this.todayText = "Today";
            this.weekStarts = 'Auto';
            if (properties) {
                for (var name_1 in properties) {
                    this[name_1] = properties[name_1];
                }
            }
        };
        this.init = function () {
            this.date = new DayPilot.Date(this.date);
            var value = this._readFromTarget();
            if (this.resetTarget && !value) {
                this._writeToTarget(this.date);
            }
            else if (!this.resetTarget && value) {
                This.date = value;
            }
            var target = this._element();
            if (target) {
                target.addEventListener("input", function () {
                    This.date = This._readFromTarget();
                    if (This.date) {
                        This.navigator.select(This.date, { dontNotify: true });
                    }
                });
            }
            return this;
        };
        this.close = function () {
            document.removeEventListener("mousedown", This.close);
            document.removeEventListener("wheel", This.close);
            window.removeEventListener("resize", This.close);
            if (!This._visible) {
                return;
            }
            This._visible = false;
            if (This.navigator) {
                This.navigator.dispose();
            }
            This.div.innerHTML = '';
            if (This.div && This.div.parentNode === document.body) {
                document.body.removeChild(This.div);
            }
        };
        this._setDate = function (date) {
            this.date = new DayPilot.Date(date);
            this._writeToTarget(this.date);
        };
        this.select = function (date) {
            var args = {};
            args.date = new DayPilot.Date(date);
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            if (typeof This.onTimeRangeSelect === 'function') {
                This.onTimeRangeSelect(args);
                if (args.preventDefault.value) {
                    return;
                }
            }
            this._setDate(date);
            if (typeof This.onTimeRangeSelected === 'function') {
                This.onTimeRangeSelected(args);
            }
        };
        this._readFromTarget = function () {
            var element = this._element();
            if (!element) {
                return this.date;
            }
            var value = null;
            if (element.tagName === "INPUT") {
                value = element.value;
            }
            else {
                value = element.innerText;
            }
            if (!value) {
                return null;
            }
            var date = DayPilot.Date.parse(value, This.pattern);
            for (var i = 0; i < This.patterns.length; i++) {
                if (date) {
                    return date;
                }
                date = DayPilot.Date.parse(value, This.patterns[i]);
            }
            return date;
        };
        this._writeToTarget = function (date) {
            var element = this._element();
            if (!element) {
                return;
            }
            var value = date.toString(This.pattern, This.locale);
            if (element.tagName === "INPUT") {
                element.value = value;
            }
            else {
                element.innerHTML = value;
            }
        };
        this._resolved = {};
        this._resolved.locale = function () {
            return DayPilot.Locale.find(This.locale);
        };
        this._element = function () {
            var id = this.target;
            var element = (id && id.nodeType && id.nodeType === 1) ? id : document.getElementById(id);
            return element;
        };
        Object.defineProperty(this, "visible", {
            get: function () { return This._visible; }
        });
        this.show = function () {
            if (this._visible) {
                return;
            }
            document.addEventListener("mousedown", This.close);
            document.addEventListener("wheel", This.close);
            window.addEventListener("resize", This.close);
            var element = this._element();
            var navigator = new DayPilot.Navigator(navigatorId);
            navigator.api = 2;
            navigator.cssOnly = true;
            navigator.theme = This.theme;
            navigator.weekStarts = "Auto";
            navigator.locale = This.locale;
            navigator.showToday = This.showToday;
            navigator.todayText = This.todayText;
            navigator.weekStarts = This.weekStarts;
            navigator.onTodayClick = function (args) {
                navigator.onTimeRangeSelected({ start: DayPilot.Date.today() });
                args.preventDefault();
            };
            navigator.onTimeRangeSelected = function (targs) {
                This.date = targs.start;
                var start = targs.start.addTime(navigator._pickerTimePart);
                var value = start.toString(This.pattern, This.locale);
                var args = {};
                args.start = start;
                args.date = start;
                args.preventDefault = function () {
                    this.preventDefault.value = true;
                };
                if (typeof This.onTimeRangeSelect === 'function') {
                    This.onTimeRangeSelect(args);
                    if (args.preventDefault.value) {
                        return;
                    }
                }
                This._writeToTarget(value);
                This.close();
                if (typeof This.onTimeRangeSelected === 'function') {
                    This.onTimeRangeSelected(args);
                }
            };
            this.navigator = navigator;
            var position = {
                x: 0,
                y: 0,
                w: 0,
                h: 0
            };
            if (element) {
                position = DayPilot.abs(element);
            }
            var height = position.h;
            var align = This.targetAlignment;
            var div = document.createElement("div");
            div.style.position = "absolute";
            if (align === "left") {
                div.style.left = position.x + "px";
            }
            div.style.top = (position.y + height) + "px";
            if (This.zIndex) {
                div.style.zIndex = This.zIndex;
            }
            var nav = document.createElement("div");
            nav.id = navigatorId;
            div.appendChild(nav);
            div.addEventListener("mousedown", function (ev) {
                ev.stopPropagation();
            });
            document.body.appendChild(div);
            this.div = div;
            var selected = This._readFromTarget() || This.date;
            navigator.startDate = selected;
            navigator._pickerTimePart = selected.getTimePart();
            navigator.selectionDay = selected.getDatePart();
            navigator.init();
            if (align === "right") {
                var left = (position.x + position.w - navigator.nav.top.offsetWidth);
                div.style.left = left + "px";
            }
            this._visible = true;
            if (this.onShow) {
                var args = {};
                this.onShow(args);
            }
        };
        this.prepare();
        this.init();
    };
})(DayPilot);
"use strict";
(function (DayPilot) {
    'use strict';
    if (typeof DayPilot.Menu !== 'undefined' && DayPilot.Menu.def) {
        return;
    }
    var doNothing = function () { };
    var DayPilotMenu = {};
    DayPilotMenu.mouse = null;
    DayPilotMenu.menu = null;
    DayPilotMenu.handlersRegistered = false;
    DayPilotMenu.hideTimeout = null;
    DayPilotMenu.waitingSubmenu = null;
    DayPilot.Menu = function (items) {
        var menu = this;
        var initiatorAreaDiv = null;
        this.v = '${v}';
        this.zIndex = 120;
        this.cssClassPrefix = "menu_default";
        this.cssOnly = true;
        this.menuTitle = null;
        this.showMenuTitle = false;
        this.hideOnMouseOut = false;
        this.hideAfter = 200;
        this.theme = null;
        this.rtl = false;
        this.onShow = null;
        var options = DayPilot.isArray(items) ? null : items;
        this._state = function () { };
        if (items && DayPilot.isArray(items)) {
            this.items = items;
        }
        this.toJSON = function () {
            return null;
        };
        this.show = function (e, options) {
            options = options || {};
            var value = null;
            if (!e) {
                value = null;
            }
            else if (typeof e.id === 'string' || typeof e.id === 'number') {
                value = e.id;
            }
            else if (typeof e.id === 'function') {
                value = e.id();
            }
            else if (typeof e.value === 'function') {
                value = e.value();
            }
            if (typeof (DayPilot.Bubble) !== 'undefined') {
                DayPilot.Bubble.hideActive();
            }
            if (!options.submenu) {
                DayPilotMenu.menuClean();
            }
            this._state.submenu = null;
            if (DayPilotMenu.mouse === null) {
                return;
            }
            if (!menu.cssOnly) {
                menu.cssOnly = true;
            }
            var source = null;
            if (e && e.isRow && e.$.row.task) {
                source = new DayPilot.Task(e.$.row.task, e.calendar);
                source.menuType = "resource";
            }
            else if (e && e.isEvent && e.data.task) {
                source = new DayPilot.Task(e, e.calendar);
            }
            else {
                source = e;
            }
            var div = document.createElement("div");
            if (typeof menu.onShow === "function") {
                var args_1 = {};
                args_1.source = source;
                args_1.menu = menu;
                args_1.div = div;
                args_1.preventDefault = function () {
                    args_1.preventDefault.value = true;
                };
                menu.onShow(args_1);
                if (args_1.preventDefault.value) {
                    return;
                }
            }
            div.style.position = "absolute";
            div.style.top = "0px";
            div.style.left = "0px";
            div.style.display = 'none';
            div.style.overflow = 'hidden';
            div.style.zIndex = this.zIndex + 1;
            div.className = this._applyCssClass('main');
            div.onclick = function (ev) {
                ev.cancelBubble = true;
                this.parentNode.removeChild(this);
            };
            if (menu.rtl) {
                div.style.direction = "rtl";
                div.className += " " + menu._applyCssClass("direction_rtl");
            }
            if (this.hideOnMouseOut) {
                div.onmousemove = function () {
                    clearTimeout(DayPilotMenu.hideTimeout);
                };
                div.onmouseleave = function () {
                    menu.delayedHide({ "hideParent": true });
                };
            }
            if (!this.items || this.items.length === 0) {
                throw "No menu items defined.";
            }
            if (this.showMenuTitle) {
                var title = document.createElement("div");
                title.innerHTML = this.menuTitle;
                title.className = this._applyCssClass("title");
                div.appendChild(title);
            }
            for (var i = 0; i < this.items.length; i++) {
                var mi = this.items[i];
                var item = document.createElement("div");
                DayPilot.Util.addClass(item, this._applyCssClass("item"));
                if (mi.items) {
                    DayPilot.Util.addClass(item, this._applyCssClass("item_haschildren"));
                    DayPilot.Util.addClass(div, this._applyCssClass(("withchildren")));
                }
                if (typeof mi === 'undefined') {
                    continue;
                }
                if (mi.hidden) {
                    continue;
                }
                if (mi.text === '-') {
                    var separator = document.createElement("div");
                    separator.addEventListener("click", function (ev) {
                        ev.stopPropagation();
                    });
                    item.appendChild(separator);
                }
                else {
                    var link = document.createElement("a");
                    link.style.position = 'relative';
                    link.style.display = "block";
                    if (mi.cssClass) {
                        DayPilot.Util.addClass(link, mi.cssClass);
                    }
                    if (mi.disabled) {
                        DayPilot.Util.addClass(link, menu._applyCssClass("item_disabled"));
                    }
                    else {
                        if (mi.onclick || mi.onClick) {
                            link.item = mi;
                            link.onclick = (function (mi, link) {
                                return function (e) {
                                    if (typeof mi.onClick === "function") {
                                        var args_2 = {};
                                        args_2.item = mi;
                                        args_2.source = link.source;
                                        args_2.originalEvent = e;
                                        args_2.preventDefault = function () {
                                            args_2.preventDefault.value = true;
                                        };
                                        mi.onClick(args_2);
                                        if (args_2.preventDefault.value) {
                                            e.stopPropagation();
                                            return;
                                        }
                                    }
                                    if (mi.onclick) {
                                        mi.onclick.call(link, e);
                                    }
                                };
                            })(mi, link);
                            var assignTouchStart = function (mi, link) {
                                return function (e) {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    if (link.source.calendar && link.source.calendar.internal.touch) {
                                        link.source.calendar.internal.touch.active = true;
                                    }
                                };
                            };
                            var assignTouchEnd = function (mi, link) {
                                return function (e) {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    var cleanup = function () {
                                        window.setTimeout(function () {
                                            if (link.source.calendar && link.source.calendar.internal.touch) {
                                                link.source.calendar.internal.touch.active = false;
                                            }
                                        }, 500);
                                    };
                                    if (typeof mi.onClick === "function") {
                                        var args_3 = {};
                                        args_3.item = mi;
                                        args_3.source = link.source;
                                        args_3.originalEvent = e;
                                        args_3.preventDefault = function () {
                                            args_3.preventDefault.value = true;
                                        };
                                        mi.onClick(args_3);
                                        if (args_3.preventDefault.value) {
                                            cleanup();
                                            return;
                                        }
                                    }
                                    if (mi.onclick) {
                                        mi.onclick.call(link, e);
                                    }
                                    DayPilotMenu.menuClean();
                                    cleanup();
                                };
                            };
                            DayPilot.reNonPassive(link, "touchstart", assignTouchStart(mi, link));
                            DayPilot.reNonPassive(link, "touchend", assignTouchEnd(mi, link));
                        }
                        if (mi.items && !mi.disabled) {
                            var assign = function (mi, link) {
                                return function (ev) {
                                    ev.preventDefault();
                                    ev.stopPropagation();
                                    menu._showSubmenu(mi, link);
                                };
                            };
                            link.ontouchend = assign(mi, link);
                        }
                        if (mi.onclick) {
                            doNothing();
                        }
                        else if (mi.href) {
                            link.href = mi.href.replace(/\x7B0\x7D/gim, value);
                            if (mi.target) {
                                link.setAttribute("target", mi.target);
                            }
                        }
                        else if (mi.command) {
                            var assign = function (mi, link) {
                                return function (e) {
                                    var source = link.source;
                                    var item = mi;
                                    item.action = item.action ? item.action : 'CallBack';
                                    var cal = source.calendar || source.root;
                                    e.preventDefault();
                                    if (source instanceof DayPilot.Link) {
                                        cal.internal.linkMenuClick(item.command, source, item.action);
                                    }
                                    else if (source instanceof DayPilot.Selection) {
                                        cal.internal.timeRangeMenuClick(item.command, source, item.action);
                                    }
                                    else if (source instanceof DayPilot.Event) {
                                        cal.internal.eventMenuClick(item.command, source, item.action);
                                    }
                                    else if (source instanceof DayPilot.Task) {
                                        if (source.menuType === "resource") {
                                            cal.internal.resourceHeaderMenuClick(item.command, link.menuSource, item.action);
                                        }
                                        else {
                                            cal.internal.eventMenuClick(item.command, link.menuSource, item.action);
                                        }
                                    }
                                    else {
                                        switch (source.menuType) {
                                            case 'resource':
                                                cal.internal.resourceHeaderMenuClick(item.command, source, item.action);
                                                break;
                                            case 'selection':
                                                cal.internal.timeRangeMenuClick(item.command, source, item.action);
                                                break;
                                            default:
                                                cal.internal.eventMenuClick(item.command, source, item.action);
                                                break;
                                        }
                                    }
                                };
                            };
                            link.onclick = assign(mi, link);
                            link.ontouchend = assign(mi, link);
                        }
                    }
                    if (mi.items) {
                        link.addEventListener("click", function (ev) {
                            ev.stopPropagation();
                        });
                    }
                    link.source = source;
                    link.menuSource = e;
                    var span = document.createElement("span");
                    span.className = menu._applyCssClass("item_text");
                    span.innerHTML = DayPilot.Util.escapeTextHtml(mi.text, mi.html);
                    link.appendChild(span);
                    if (mi.image) {
                        var image = document.createElement("img");
                        image.src = mi.image;
                        image.style.position = 'absolute';
                        image.style.top = '0px';
                        if (!menu.rtl) {
                            image.style.left = '0px';
                        }
                        else {
                            image.style.right = '0px';
                        }
                        link.appendChild(image);
                    }
                    if (mi.icon) {
                        var icon = document.createElement("span");
                        icon.className = menu._applyCssClass("item_icon");
                        var iel = document.createElement("i");
                        iel.className = mi.icon;
                        icon.appendChild(iel);
                        link.appendChild(icon);
                    }
                    if (mi.symbol) {
                        var ns = "http://www.w3.org/2000/svg";
                        var svg = document.createElementNS(ns, "svg");
                        svg.setAttribute("width", "100%");
                        svg.setAttribute("height", "100%");
                        var use = document.createElementNS(ns, "use");
                        use.setAttribute("href", mi.symbol);
                        svg.appendChild(use);
                        var svgWrap = document.createElement("span");
                        svgWrap.className = menu._applyCssClass("item_symbol");
                        svgWrap.style.position = "absolute";
                        svgWrap.style.top = "0px";
                        if (!menu.rtl) {
                            svgWrap.style.left = "0px";
                        }
                        else {
                            svgWrap.style.right = "0px";
                        }
                        svgWrap.appendChild(svg);
                        link.appendChild(svgWrap);
                    }
                    var assignOnMouseOver = function (mi, link) {
                        return function () {
                            var item = mi;
                            var ws = DayPilotMenu.waitingSubmenu;
                            if (ws) {
                                if (ws.parent === item) {
                                    return;
                                }
                                else {
                                    clearTimeout(ws.timeout);
                                    DayPilotMenu.waitingSubmenu = null;
                                }
                            }
                            if (mi.disabled) {
                                return;
                            }
                            DayPilotMenu.waitingSubmenu = {};
                            DayPilotMenu.waitingSubmenu.parent = item;
                            DayPilotMenu.waitingSubmenu.timeout = setTimeout(function () {
                                DayPilotMenu.waitingSubmenu = null;
                                menu._showSubmenu(item, link);
                            }, 300);
                        };
                    };
                    link.onmouseover = assignOnMouseOver(mi, link);
                    item.appendChild(link);
                }
                div.appendChild(item);
            }
            var delayedDismiss = function () {
                window.setTimeout(function () {
                    DayPilotMenu.menuClean();
                    DayPilot.MenuBar.deactivate();
                }, 100);
            };
            div.onclick = delayedDismiss;
            div.ontouchend = delayedDismiss;
            div.onmousedown = function (e) {
                e.stopPropagation();
            };
            div.oncontextmenu = function () {
                return false;
            };
            document.body.appendChild(div);
            menu._state.visible = true;
            menu._state.source = e;
            div.style.display = '';
            var height = div.offsetHeight;
            var width = div.offsetWidth;
            div.style.display = 'none';
            var windowHeight = document.documentElement.clientHeight;
            var windowWidth = window.innerWidth;
            var windowMargin = (typeof options.windowMargin == "number") ? options.windowMargin : 5;
            (function showInitiator() {
                var initiator = options.initiator;
                if (!initiator) {
                    return;
                }
                var div = initiator.div;
                var e = initiator.e;
                var area = initiator.area;
                var v = area.visibility || area.v || "Visible";
                var a = initiator.a;
                if (v !== "Visible") {
                    a = DayPilot.Areas.createArea(div, e, area);
                    div.appendChild(a);
                    initiatorAreaDiv = a;
                }
                if (a) {
                    var abs = DayPilot.abs(a);
                    options.x = abs.x;
                    options.y = abs.y + abs.h + 2;
                    if (menu.rtl) {
                        options.x = abs.x + abs.w;
                    }
                }
            })();
            (function adjustPosition() {
                var x = (typeof options.x === "number") ? options.x : DayPilotMenu.mouse.x + 1;
                var y = (typeof options.y === "number") ? options.y : DayPilotMenu.mouse.y + 1;
                var topOffset = document.body.scrollTop || document.documentElement.scrollTop;
                var leftOffset = document.body.scrollLeft || document.documentElement.scrollLeft;
                var top = 0;
                var left = 0;
                if (y - topOffset > windowHeight - height && windowHeight !== 0) {
                    var offsetY = y - topOffset - (windowHeight - height) + windowMargin;
                    top = (y - offsetY);
                }
                else {
                    top = y;
                }
                menu._state.y = top;
                div.style.top = top + 'px';
                if (options.align === "right" || menu.rtl) {
                    x -= width;
                }
                if (x - leftOffset > windowWidth - width && windowWidth !== 0) {
                    var offsetX = x - leftOffset - (windowWidth - width) + windowMargin;
                    left = (x - offsetX);
                }
                else {
                    left = x;
                }
                menu._state.x = left;
                div.style.left = left + 'px';
            })();
            if (options.parentLink) {
                var parent_1 = options.parentLink;
                var verticalOffset = parseInt(new DayPilot.StyleReader(div).get("border-top-width"));
                var pos = DayPilot.abs(options.parentLink.parentNode);
                var x = pos.x + parent_1.offsetWidth;
                if (menu.rtl) {
                    x = pos.x - width;
                }
                var y = pos.y - verticalOffset;
                if (x + width > windowWidth) {
                    x = Math.max(0, pos.x - width);
                }
                var docScrollTop = document.body.scrollTop + document.documentElement.scrollTop;
                if (y + height - docScrollTop > windowHeight) {
                    y = Math.max(0, windowHeight - height + docScrollTop);
                }
                div.style.left = x + "px";
                div.style.top = y + "px";
            }
            div.style.display = '';
            this.addShadow(div);
            this._state.div = div;
            if (!options.submenu) {
                DayPilot.Menu.active = this;
            }
        };
        this.update = function () {
            if (!menu._state.visible) {
                return;
            }
            var source = menu._state.source;
            menu.hide();
            menu.show(source, { "x": menu._state.x, "y": menu._state.y });
        };
        this._showSubmenu = function (item, link) {
            var mi = item;
            var source = link.source;
            if (menu._state.submenu && menu._state.submenu.item === item) {
                return;
            }
            if (menu._state.submenu && menu._state.submenu.item !== item) {
                DayPilot.Util.removeClass(menu._state.submenu.link.parentNode, menu._applyCssClass("item_haschildren_active"));
                menu._state.submenu.menu.hide();
                menu._state.submenu = null;
            }
            if (!item.items) {
                return;
            }
            var options = menu.cloneOptions();
            options.items = item.items;
            menu._state.submenu = {};
            menu._state.submenu.menu = new DayPilot.Menu(options);
            menu._state.submenu.menu._parentMenu = menu;
            menu._state.submenu.menu.show(source, { "submenu": true, "parentLink": link, "parentItem": mi });
            menu._state.submenu.item = item;
            menu._state.submenu.link = link;
            DayPilot.Util.addClass(link.parentNode, menu._applyCssClass("item_haschildren_active"));
        };
        this._applyCssClass = function (part) {
            var prefix = this.theme || this.cssClassPrefix;
            var sep = (this.cssOnly ? "_" : "");
            if (prefix) {
                return prefix + sep + part;
            }
            else {
                return "";
            }
        };
        this.cloneOptions = function () {
            return DayPilot.Util.copyProps(options, {}, ["cssClassPrefix", "theme", "hideAfter", "hideOnMouseOut", "zIndex", "rtl"]);
        };
        this.hide = function (props) {
            props = props || {};
            if (this._state.submenu) {
                this._state.submenu.menu.hide();
            }
            var ws = DayPilotMenu.waitingSubmenu;
            if (ws) {
                DayPilotMenu.waitingSubmenu = null;
                clearTimeout(ws.timeout);
            }
            this.removeShadow();
            if (this._state.div && this._state.div.parentNode === document.body) {
                document.body.removeChild(this._state.div);
            }
            if (initiatorAreaDiv) {
                DayPilot.de(initiatorAreaDiv);
                initiatorAreaDiv = null;
            }
            menu._state.visible = false;
            menu._state.source = null;
            if (menu._parentMenu && props.hideParent) {
                menu._parentMenu.hide(props);
            }
            if (DayPilot.Menu.active === menu) {
                DayPilot.Menu.active = null;
            }
            if (typeof this.onHide === "function") {
                var args = {};
                this.onHide(args);
            }
        };
        this.delayedHide = function (props) {
            DayPilotMenu.hideTimeout = setTimeout(function () {
                menu.hide(props);
            }, menu.hideAfter);
        };
        this.cancelHideTimeout = function () {
            clearTimeout(DayPilotMenu.hideTimeout);
        };
        this.init = function (ev) {
            DayPilotMenu.mouseMove(ev);
            return this;
        };
        this.addShadow = function () { };
        this.removeShadow = function () {
        };
        if (options) {
            for (var name_1 in options) {
                this[name_1] = options[name_1];
            }
        }
    };
    DayPilot.MenuBar = function (id, options) {
        var menubar = this;
        options = options || {};
        this.items = [];
        this.theme = "menubar_default";
        this.windowMargin = 0;
        this.nav = {};
        this.elements = {};
        this.elements.items = [];
        this._active = null;
        this._initialized = false;
        for (var name_2 in options) {
            this[name_2] = options[name_2];
        }
        this._cssClass = function (cl) {
            return this.theme + "_" + cl;
        };
        this._show = function () {
            this.nav.top = document.getElementById(id);
            var top = this.nav.top;
            top.className = this._cssClass("main");
            var items = menubar.items || [];
            items.forEach(function (item) {
                var div = document.createElement("span");
                div.innerHTML = DayPilot.Util.escapeTextHtml(item.text, item.html);
                div.className = menubar._cssClass("item");
                if (item.cssClass) {
                    div.classList.add(item.cssClass);
                }
                div.data = item;
                div.onclick = function (e) {
                    if (menubar.active && menubar.active.item === item) {
                        menubar._hideActive();
                    }
                    else if (item.children) {
                        menubar._activate(div);
                        return;
                    }
                    if (typeof item.onClick === "function") {
                        var args = {};
                        args.item = item;
                        args.originalEvent = e;
                        item.onClick(args);
                    }
                };
                div.onmousedown = function (ev) {
                    ev.stopPropagation();
                };
                div.onmouseover = function () {
                    if (menubar.active && menubar.active.item !== item) {
                        menubar._activate(div);
                    }
                };
                top.appendChild(div);
                menubar.elements.items.push(div);
            });
        };
        this._hideActive = function () {
            var activeCss = menubar._cssClass("item_active");
            menubar.elements.items.forEach(function (div) {
                DayPilot.Util.removeClass(div, activeCss);
            });
            if (menubar.active && menubar.active.menu) {
                menubar.active.menu.hide();
            }
            menubar.active = null;
        };
        this._isActive = function (div) {
            if (!menubar.active) {
                return false;
            }
            return menubar.active.item === div.data;
        };
        this._activate = function (div) {
            if (menubar._isActive(div)) {
                return;
            }
            menubar._hideActive();
            var item = div.data;
            var a = menubar.active = {};
            a.item = item;
            a.div = div;
            var activeCss = menubar._cssClass("item_active");
            DayPilot.Util.addClass(div, activeCss);
            var abs = DayPilot.abs(div);
            if (item.children) {
                a.menu = new DayPilot.Menu({ "items": item.children });
                var x = abs.x;
                if (item.align === "right") {
                    x += abs.w;
                }
                a.menu.show(null, { "x": x, "y": abs.y + abs.h, "align": item.align, "windowMargin": menubar.windowMargin });
            }
            DayPilot.MenuBar.active = menubar;
        };
        this.init = function () {
            this._show();
            this._initialized = true;
            return this;
        };
        this.dispose = function () {
            if (!this._initialized) {
                return;
            }
            this.nav.top.innerHTML = "";
            this.elements.items = [];
        };
    };
    DayPilot.MenuBar.deactivate = function () {
        if (DayPilot.MenuBar.active) {
            DayPilot.MenuBar.active._hideActive();
            DayPilot.MenuBar.active = null;
        }
    };
    DayPilotMenu.menuClean = function () {
        if (typeof (DayPilot.Menu.active) === 'undefined') {
            return;
        }
        if (DayPilot.Menu.active) {
            DayPilot.Menu.active.hide();
            DayPilot.Menu.active = null;
        }
    };
    DayPilotMenu.mouseDown = function () {
        if (typeof (DayPilotMenu) === 'undefined') {
            return;
        }
        DayPilotMenu.menuClean();
        DayPilot.MenuBar.deactivate();
    };
    DayPilotMenu.pointerDown = function (ev) {
        if (typeof (DayPilotMenu) === 'undefined') {
            return;
        }
        var all = DayPilotMenu._activeWithSubmenus();
        for (var i = 0; i < all.length; i++) {
            var m = all[i];
            if (m._state && m._state.div) {
                var rect = m._state.div.getBoundingClientRect();
                var x = ev.clientX;
                var y = ev.clientY;
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    return;
                }
            }
        }
        DayPilotMenu.menuClean();
    };
    DayPilotMenu._activeWithSubmenus = function () {
        var active = DayPilot.Menu.active;
        if (!active) {
            return [];
        }
        var menus = [active];
        var index = 0;
        while (index < menus.length) {
            var m = menus[index];
            if (m._state && m._state.submenu && m._state.submenu.menu) {
                menus.push(m._state.submenu.menu);
            }
            index++;
        }
        return menus;
    };
    DayPilotMenu.wheel = function () {
        if (typeof (DayPilotMenu) === 'undefined') {
            return;
        }
        DayPilotMenu.menuClean();
        DayPilot.MenuBar.deactivate();
    };
    DayPilotMenu.resize = function () {
        if (typeof (DayPilotMenu) === 'undefined') {
            return;
        }
        DayPilotMenu.menuClean();
        DayPilot.MenuBar.deactivate();
    };
    DayPilotMenu.mouseMove = function (ev) {
        if (typeof (DayPilotMenu) === 'undefined') {
            return;
        }
        DayPilotMenu.mouse = DayPilotMenu.mousePosition(ev);
    };
    DayPilotMenu.touchMove = function (ev) {
        if (typeof (DayPilotMenu) === 'undefined') {
            return;
        }
        DayPilotMenu.mouse = DayPilotMenu.touchPosition(ev);
    };
    DayPilotMenu.touchStart = function (ev) {
        if (typeof (DayPilotMenu) === 'undefined') {
            return;
        }
        DayPilotMenu.mouse = DayPilotMenu.touchPosition(ev);
    };
    DayPilotMenu.touchEnd = function () {
    };
    DayPilotMenu.touchPosition = function (ev) {
        if (!ev || !ev.touches) {
            return null;
        }
        var touch = ev.touches[0];
        var mouse = {};
        mouse.x = touch.pageX;
        mouse.y = touch.pageY;
        return mouse;
    };
    DayPilotMenu.mousePosition = function (e) {
        return DayPilot.mo3(null, e);
    };
    DayPilot.Menu.touchPosition = function (ev) {
        if (ev.touches) {
            DayPilotMenu.mouse = DayPilotMenu.touchPosition(ev);
        }
    };
    DayPilot.Menu.mousePosition = function (ev) {
        DayPilotMenu.mouse = DayPilotMenu.mousePosition(ev);
    };
    DayPilot.Menu.hide = function (options) {
        options = options || {};
        if (options.calendar) {
            var active = DayPilot.Menu.active;
            if (active) {
                var source = active._state.source;
                if (source && source.calendar === options.calendar) {
                    DayPilotMenu.menuClean();
                }
            }
        }
        else {
            DayPilotMenu.menuClean();
        }
    };
    if (!DayPilotMenu.handlersRegistered && typeof document !== 'undefined') {
        DayPilot.re(document, 'mousemove', DayPilotMenu.mouseMove);
        DayPilot.re(document, 'pointerdown', DayPilotMenu.pointerDown);
        DayPilot.re(document, 'wheel', DayPilotMenu.wheel);
        DayPilot.re(document, 'touchmove', DayPilotMenu.touchMove);
        DayPilot.re(document, 'touchstart', DayPilotMenu.touchStart);
        DayPilot.re(document, 'touchend', DayPilotMenu.touchEnd);
        DayPilot.re(window, 'resize', DayPilotMenu.resize);
        DayPilotMenu.handlersRegistered = true;
    }
    DayPilot.Menu.def = {};
})(DayPilot);
"use strict";
(function (DayPilot) {
    'use strict';
    if (DayPilot.ModalStatic) {
        return;
    }
    DayPilot.ModalStatic = {};
    DayPilot.ModalStatic.list = [];
    DayPilot.ModalStatic.hide = function () {
        if (this.list.length > 0) {
            var last = this.list.pop();
            if (last) {
                last.hide();
            }
        }
    };
    DayPilot.ModalStatic.remove = function (modal) {
        var list = DayPilot.ModalStatic.list;
        for (var i = 0; i < list.length; i++) {
            if (list[i] === modal) {
                list.splice(i, 1);
                return;
            }
        }
    };
    DayPilot.ModalStatic.close = function (result) {
        DayPilot.ModalStatic.result(result);
        DayPilot.ModalStatic.hide();
    };
    DayPilot.ModalStatic.result = function (r) {
        var list = DayPilot.ModalStatic.list;
        if (list.length > 0) {
            list[list.length - 1].result = r;
        }
    };
    DayPilot.ModalStatic.displayed = function (modal) {
        var list = DayPilot.ModalStatic.list;
        for (var i = 0; i < list.length; i++) {
            if (list[i] === modal) {
                return true;
            }
        }
        return false;
    };
    DayPilot.ModalStatic.stretch = function () {
        if (this.list.length > 0) {
            var last = this.list[this.list.length - 1];
            if (last) {
                last.stretch();
            }
        }
    };
    DayPilot.ModalStatic.last = function () {
        var list = DayPilot.ModalStatic.list;
        if (list.length > 0) {
            return list[list.length - 1];
        }
        return null;
    };
    var Sheet = function () {
        var _a, _b;
        var blank = {
            add: function () { },
            commit: function () { },
            print: function () { return ""; }
        };
        if (typeof globalThis !== "undefined" && globalThis.__DayPilotDisableCssInjection) {
            return blank;
        }
        if (typeof window === "undefined") {
            return blank;
        }
        var disableUsingMeta = ((_b = (_a = document.querySelector('meta[name="daypilot:css"]')) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === "disable";
        if (disableUsingMeta) {
            return blank;
        }
        function getStyleNonce() {
            var styleNodes = document.querySelectorAll('style[nonce]');
            for (var i = 0; i < styleNodes.length; i++) {
                var styleEl = styleNodes[i];
                if (styleEl.nonce) {
                    return styleEl.nonce;
                }
            }
            if (document.currentScript && document.currentScript.nonce) {
                return document.currentScript.nonce;
            }
            var scriptNodes = document.querySelectorAll('script[nonce]');
            for (var j = 0; j < scriptNodes.length; j++) {
                var scriptEl = scriptNodes[j];
                if (scriptEl.nonce) {
                    return scriptEl.nonce;
                }
            }
            return '';
        }
        var style = document.createElement("style");
        var isSalesforce = !!(document.querySelector('head > script[data-rendered-by-lwc]') || document.querySelector('body > div#auraLoadingBox'));
        if (!isSalesforce) {
            style.nonce = getStyleNonce();
        }
        if (!style.styleSheet) {
            style.appendChild(document.createTextNode(""));
        }
        try {
            var h = document.head || document.getElementsByTagName('head')[0];
            h.appendChild(style);
        }
        catch (_c) {
            return blank;
        }
        var oldStyle = !!style.styleSheet;
        var sheet = {};
        sheet.rules = [];
        sheet.commit = function () {
            try {
                if (oldStyle) {
                    style.styleSheet.cssText = this.rules.join("\n");
                }
            }
            catch (_a) {
            }
        };
        sheet.add = function (selector, rules, index) {
            if (oldStyle) {
                this.rules.push(selector + "{" + rules + "\u007d");
                return;
            }
            if (!style.sheet) {
                return this;
            }
            if (style.sheet.insertRule) {
                if (typeof index === "undefined") {
                    index = style.sheet.cssRules.length;
                }
                style.sheet.insertRule(selector + "{" + rules + "\u007d", index);
            }
            else if (style.sheet.addRule) {
                style.sheet.addRule(selector, rules, index);
            }
            else {
                throw "No CSS registration method found";
            }
        };
        sheet.print = function () {
            var rules = style.sheet.cssRules;
            var all = [];
            for (var i = 0; i < rules.length; i++) {
                all.push(rules[i].cssText);
            }
            return all.join("\n");
        };
        return sheet;
    };
    var iconCalendar = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB3aWR0aD0iMTAiCiAgIGhlaWdodD0iMTUiCj4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLDUpIj4KICAgIDxyZWN0CiAgICAgICBzdHlsZT0iZmlsbDojY2NjY2NjO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDoxLjM4MDM3MzM2O3N0cm9rZS1saW5lY2FwOmJ1dHQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO3N0cm9rZS1taXRlcmxpbWl0OjQ7c3Ryb2tlLWRhc2hhcnJheTpub25lO3N0cm9rZS1vcGFjaXR5OjEiCiAgICAgICBpZD0icmVjdDE5MjgiCiAgICAgICB3aWR0aD0iOS45MTUzMDYxIgogICAgICAgaGVpZ2h0PSIxMS4zNjkzNyIKICAgICAgIHg9IjAuMTE3MTg3NSIKICAgICAgIHk9Ii0zLjAwOTk5NTciCiAgICAgICByeT0iMS4zMTE4NTA1IiAvPgogICAgPHJlY3QKICAgICAgIHN0eWxlPSJmaWxsOiNjY2NjY2M7ZmlsbC1vcGFjaXR5OjE7c3Ryb2tlOm5vbmU7c3Ryb2tlLXdpZHRoOjEuNTk4MTQwMTI7c3Ryb2tlLWxpbmVjYXA6YnV0dDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIKICAgICAgIGlkPSJyZWN0MTkzMCIKICAgICAgIHdpZHRoPSIxLjUzNDQxMzYiCiAgICAgICBoZWlnaHQ9IjIuMjE5ODI1IgogICAgICAgeD0iMi4xNTU4NDgzIgogICAgICAgeT0iLTQuMzkzNzAwMSIKICAgICAgIHJ5PSIwLjY3MTc4OTE3IiAvPgogICAgPHJlY3QKICAgICAgIHJ5PSIwLjI5NjAxNDciCiAgICAgICB5PSItMS4xNjU4NDY2IgogICAgICAgeD0iMS41MjM5NTA2IgogICAgICAgaGVpZ2h0PSIxLjgyOTkwOTEiCiAgICAgICB3aWR0aD0iMS44MzQyMjUxIgogICAgICAgaWQ9InJlY3QxOTQ4IgogICAgICAgc3R5bGU9ImZpbGw6I2ZmZmZmZjtmaWxsLW9wYWNpdHk6MTtzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6MS40MjE4OTE5MztzdHJva2UtbGluZWNhcDpidXR0O3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIiAvPgogICAgPHJlY3QKICAgICAgIHJ5PSIwLjY3MTc4OTE3IgogICAgICAgeT0iLTQuMzkzNzAwMSIKICAgICAgIHg9IjYuNDUyNzIzNSIKICAgICAgIGhlaWdodD0iMi4yMTk4MjUiCiAgICAgICB3aWR0aD0iMS41MzQ0MTM2IgogICAgICAgaWQ9InJlY3QyMDAzIgogICAgICAgc3R5bGU9ImZpbGw6I2NjY2NjYztmaWxsLW9wYWNpdHk6MTtzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6MS41OTgxNDAxMjtzdHJva2UtbGluZWNhcDpidXR0O3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIiAvPgogICAgPHJlY3QKICAgICAgIHN0eWxlPSJmaWxsOiNmZmZmZmY7ZmlsbC1vcGFjaXR5OjE7c3Ryb2tlOm5vbmU7c3Ryb2tlLXdpZHRoOjEuNDIxODkxOTM7c3Ryb2tlLWxpbmVjYXA6YnV0dDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIKICAgICAgIGlkPSJyZWN0MjAwNSIKICAgICAgIHdpZHRoPSIxLjgzNDIyNTEiCiAgICAgICBoZWlnaHQ9IjEuODI5OTA5MSIKICAgICAgIHg9IjQuMjE5MjYzMSIKICAgICAgIHk9Ii0xLjE2NTg0NjYiCiAgICAgICByeT0iMC4yOTYwMTQ3IiAvPgogICAgPHJlY3QKICAgICAgIHJ5PSIwLjI5NjAxNDciCiAgICAgICB5PSItMS4xNjU4NDY2IgogICAgICAgeD0iNi45OTI3MDA2IgogICAgICAgaGVpZ2h0PSIxLjgyOTkwOTEiCiAgICAgICB3aWR0aD0iMS44MzQyMjUxIgogICAgICAgaWQ9InJlY3QyMDA3IgogICAgICAgc3R5bGU9ImZpbGw6I2ZmZmZmZjtmaWxsLW9wYWNpdHk6MTtzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6MS40MjE4OTE5MztzdHJva2UtbGluZWNhcDpidXR0O3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIiAvPgogICAgPHJlY3QKICAgICAgIHN0eWxlPSJmaWxsOiNmZmZmZmY7ZmlsbC1vcGFjaXR5OjE7c3Ryb2tlOm5vbmU7c3Ryb2tlLXdpZHRoOjEuNDIxODkxOTM7c3Ryb2tlLWxpbmVjYXA6YnV0dDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIKICAgICAgIGlkPSJyZWN0MjAxMyIKICAgICAgIHdpZHRoPSIxLjgzNDIyNTEiCiAgICAgICBoZWlnaHQ9IjEuODI5OTA5MSIKICAgICAgIHg9IjEuNTIzOTUwNiIKICAgICAgIHk9IjEuODAyOTAzNCIKICAgICAgIHJ5PSIwLjI5NjAxNDciIC8+CiAgICA8cmVjdAogICAgICAgcnk9IjAuMjk2MDE0NyIKICAgICAgIHk9IjEuODAyOTAzNCIKICAgICAgIHg9IjQuMjE5MjYzMSIKICAgICAgIGhlaWdodD0iMS44Mjk5MDkxIgogICAgICAgd2lkdGg9IjEuODM0MjI1MSIKICAgICAgIGlkPSJyZWN0MjAxNSIKICAgICAgIHN0eWxlPSJmaWxsOiNmZmZmZmY7ZmlsbC1vcGFjaXR5OjE7c3Ryb2tlOm5vbmU7c3Ryb2tlLXdpZHRoOjEuNDIxODkxOTM7c3Ryb2tlLWxpbmVjYXA6YnV0dDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIgLz4KICAgIDxyZWN0CiAgICAgICBzdHlsZT0iZmlsbDojZmZmZmZmO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDoxLjQyMTg5MTkzO3N0cm9rZS1saW5lY2FwOmJ1dHQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO3N0cm9rZS1taXRlcmxpbWl0OjQ7c3Ryb2tlLWRhc2hhcnJheTpub25lO3N0cm9rZS1vcGFjaXR5OjEiCiAgICAgICBpZD0icmVjdDIwMTciCiAgICAgICB3aWR0aD0iMS44MzQyMjUxIgogICAgICAgaGVpZ2h0PSIxLjgyOTkwOTEiCiAgICAgICB4PSI2Ljk5MjcwMDYiCiAgICAgICB5PSIxLjgwMjkwMzQiCiAgICAgICByeT0iMC4yOTYwMTQ3IiAvPgogICAgPHJlY3QKICAgICAgIHJ5PSIwLjI5NjAxNDciCiAgICAgICB5PSI0LjczMjU5MDciCiAgICAgICB4PSIxLjU2MzAxMzEiCiAgICAgICBoZWlnaHQ9IjEuODI5OTA5MSIKICAgICAgIHdpZHRoPSIxLjgzNDIyNTEiCiAgICAgICBpZD0icmVjdDIwMTkiCiAgICAgICBzdHlsZT0iZmlsbDojZmZmZmZmO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDoxLjQyMTg5MTkzO3N0cm9rZS1saW5lY2FwOmJ1dHQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO3N0cm9rZS1taXRlcmxpbWl0OjQ7c3Ryb2tlLWRhc2hhcnJheTpub25lO3N0cm9rZS1vcGFjaXR5OjEiIC8+CiAgICA8cmVjdAogICAgICAgc3R5bGU9ImZpbGw6I2ZmZmZmZjtmaWxsLW9wYWNpdHk6MTtzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6MS40MjE4OTE5MztzdHJva2UtbGluZWNhcDpidXR0O3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIgogICAgICAgaWQ9InJlY3QyMDIxIgogICAgICAgd2lkdGg9IjEuODM0MjI1MSIKICAgICAgIGhlaWdodD0iMS44Mjk5MDkxIgogICAgICAgeD0iNC4yNTgzMjU2IgogICAgICAgeT0iNC43MzI1OTA3IgogICAgICAgcnk9IjAuMjk2MDE0NyIgLz4KICAgIDxyZWN0CiAgICAgICByeT0iMC4yOTYwMTQ3IgogICAgICAgeT0iNC43MzI1OTA3IgogICAgICAgeD0iNy4wMzE3NjMxIgogICAgICAgaGVpZ2h0PSIxLjgyOTkwOTEiCiAgICAgICB3aWR0aD0iMS44MzQyMjUxIgogICAgICAgaWQ9InJlY3QyMDIzIgogICAgICAgc3R5bGU9ImZpbGw6I2ZmZmZmZjtmaWxsLW9wYWNpdHk6MTtzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6MS40MjE4OTE5MztzdHJva2UtbGluZWNhcDpidXR0O3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIiAvPgogIDwvZz4KPC9zdmc+Cg==";
    var iconExpand = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB3aWR0aD0iMTAiCiAgIGhlaWdodD0iMTUiCj4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLDUpIj4KICAgIDxwYXRoCiAgICAgICBpZD0icGF0aDMxNzMiCiAgICAgICBzdHlsZT0iZmlsbDpub25lO3N0cm9rZTojOTk5OTk5O3N0cm9rZS13aWR0aDoxLjg1MTk2ODUzO3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZSIKICAgICAgIGQ9Ik0gMC45NTQxNDgzOCwwLjY4MTYwMzEgNS4wMzkwNjI1LDUuNDExNTM4NiA5LjEyMzk3NjYsMC42ODE2MDMxIgogICAgICAgIC8+CiAgPC9nPgo8L3N2Zz4K";
    var sheet = new Sheet();
    sheet.add(".modal_default_main", "border: 10px solid #ccc; max-width: 90%;");
    sheet.add(".modal_default_main:focus", "outline: none;");
    sheet.add(".modal_default_content", "padding: 10px 0px;");
    sheet.add(".modal_default_inner", "padding: 20px;");
    sheet.add(".modal_default_input", "padding: 10px 0px;");
    sheet.add(".modal_default_buttons", "margin-top: 10px;");
    sheet.add(".modal_default_buttons", "padding: 10px 0px;");
    sheet.add(".modal_default_form_item", "padding: 10px 0px; position: relative;");
    sheet.add(".modal_default_form_item_level1", "border-left: 2px solid #ccc; margin-left: 10px; padding-left: 20px;");
    sheet.add(".modal_default_form_item.modal_default_form_title", "font-size: 1.5rem; font-weight: bold;");
    sheet.add(".modal_default_form_item input[type=text]", "width: 100%; box-sizing: border-box;");
    sheet.add(".modal_default_form_item textarea", "width: 100%; height: 200px; box-sizing: border-box;");
    sheet.add(".modal_default_form_item input[type=select]", "width: 100%; box-sizing: border-box;");
    sheet.add(".modal_default_form_item label", "display: block;");
    sheet.add(".modal_default_form_item select", "width: 100%; box-sizing: border-box;");
    sheet.add(".modal_default_form_item_label", "margin: 2px 0px;");
    sheet.add(".modal_default_form_item_image img", "max-width: 100%; height: auto;");
    sheet.add(".modal_default_form_item_invalid", "");
    sheet.add(".modal_default_form_item_invalid_message", "position: absolute; right: 0px; top: 9px; background-color: red; color: #ffffff; padding: 2px; border-radius: 2px;");
    sheet.add(".modal_default_background", "opacity: 0.5; background-color: #000;");
    sheet.add(".modal_default_ok", "padding: 3px; width: 80px;");
    sheet.add(".modal_default_cancel", "padding: 3px; width: 80px;");
    sheet.add(".modal_default_form_item_date", "position: relative;");
    sheet.add(".modal_default_form_item_date:after", "content: ''; position: absolute; right: 7px; top: 50%; margin-top: 3px; width: 10px; height: 15px; background-image:url(" + iconCalendar + ")");
    if (typeof navigator !== "undefined" && navigator.userAgent.indexOf("Edge") !== -1) {
        sheet.add(".modal_default_form_item_date input::-ms-clear", "display: none;");
    }
    sheet.add(".modal_default_form_item_scrollable_scroll", "width: 100%; height: 200px; box-sizing: border-box; border: 1px solid #ccc; overflow-y: auto;");
    sheet.add(".modal_default_form_item_scrollable_scroll_content", "padding: 5px;");
    sheet.add(".modal_default_form_item_searchable", "position: relative;");
    sheet.add(".modal_default_form_item_searchable_icon", "");
    sheet.add(".modal_default_form_item_searchable_icon:after", "content:''; position: absolute; right: 5px; top: 50%; margin-top: -8px; width: 10px; height: 15px; background-image:url(" + iconExpand + ");");
    sheet.add(".modal_default_form_item_searchable_list", "box-sizing: border-box; border: 1px solid #999; max-height: 150px; overflow-y: auto;");
    sheet.add(".modal_default_form_item_searchable_list_item", "background: white; padding: 2px; cursor: default;");
    sheet.add(".modal_default_form_item_searchable_list_item_highlight", "background: #ccc;");
    sheet.add(".modal_default_form_item_time", "position: relative;");
    sheet.add(".modal_default_form_item_time_icon", "");
    sheet.add(".modal_default_form_item_time_icon:after", "content:''; position: absolute; right: 5px; top: 50%; margin-top: -8px; width: 10px; height: 15px; background-image:url(" + iconExpand + ");");
    sheet.add(".modal_default_form_item_time_list", "box-sizing: border-box; border: 1px solid #999; max-height: 150px; overflow-y: auto;");
    sheet.add(".modal_default_form_item_time_list_item", "background: white; padding: 2px; cursor: default;");
    sheet.add(".modal_default_form_item_time_list_item_highlight", "background: #ccc;");
    sheet.add(".modal_default_form_item_datetime_parent", "display: flex;");
    sheet.add(".modal_default_form_item_datetime .modal_default_form_item_time_main", "margin-left: 5px;");
    sheet.add(".modal_default_form_item_datetime input[type='text'].modal_default_input_date ", "");
    sheet.add(".modal_default_form_item_tabular_main", "margin-top: 10px;");
    sheet.add(".modal_default_form_item_tabular_table", "display: table; width: 100%; xbackground-color: #fff; border-collapse: collapse;");
    sheet.add(".modal_default_form_item_tabular_tbody", "display: table-row-group;");
    sheet.add(".modal_default_form_item_tabular_row", "display: table-row;");
    sheet.add(".modal_default_form_item_tabular_row.modal_default_form_item_tabular_header", "");
    sheet.add(".modal_default_form_item_tabular_cell.modal_default_form_item_tabular_rowaction", "padding: 0px; width: 23px;");
    sheet.add(".modal_default_form_item_tabular_cell", "display: table-cell; border: 0px; padding: 2px 2px 2px 0px; cursor: default; vertical-align: bottom;");
    sheet.add(".modal_default_form_item_tabular_header .modal_default_form_item_tabular_cell", "padding-left: 0px; padding-bottom: 0px;");
    sheet.add(".modal_default_form_item_tabular_table input[type=text], .modal_default_form_item_tabular_table input[type=number]", "width:100%; box-sizing: border-box;");
    sheet.add(".modal_default_form_item_tabular_table select", "width:100%; height:100%; box-sizing: border-box;");
    sheet.add(".modal_default_form_item_tabular_plus", "display: inline-block; background-color: #ccc; color: white; width: 20px; height: 20px; border-radius: 10px; box-sizing: border-box; position: relative; margin-left: 3px; margin-top: 3px; cursor: pointer;");
    sheet.add(".modal_default_form_item_tabular_plus:after", "content: ''; position: absolute; left: 5px; top: 5px; width: 10px; height: 10px;   background-image: url(\"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTSA1LjAgMC41IEwgNS4wIDkuNSBNIDAuNSA1LjAgTCA5LjUgNS4wJyBzdHlsZT0nZmlsbDpub25lO3N0cm9rZTojZmZmZmZmO3N0cm9rZS13aWR0aDoyO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbGluZWNhcDpidXR0JyAvPjwvc3ZnPg==\")");
    sheet.add(".modal_default_form_item_tabular_delete", "display: inline-block; background-color: #ccc; color: white; width: 20px; height: 20px; border-radius: 10px; box-sizing: border-box; position: relative; margin-left: 3px; margin-top: 3px; cursor: pointer;");
    sheet.add(".modal_default_form_item_tabular_delete:after", "content: ''; position: absolute; left: 5px; top: 5px; width: 10px; height: 10px;   background-image: url(\"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTSAwLjUgMC41IEwgOS41IDkuNSBNIDAuNSA5LjUgTCA5LjUgMC41JyBzdHlsZT0nZmlsbDpub25lO3N0cm9rZTojZmZmZmZmO3N0cm9rZS13aWR0aDoyO3N0cm9rZS1saW5lam9pbjpyb3VuZDtzdHJva2UtbGluZWNhcDpidXR0JyAvPjwvc3ZnPg==\")");
    sheet.add(".modal_default_form_item_tabular_disabled .modal_default_form_item_tabular_plus", "display: none;");
    sheet.add(".modal_default_form_item_tabular_plus_max.modal_default_form_item_tabular_plus", "display: none;");
    sheet.add(".modal_default_form_item_tabular_disabled .modal_default_form_item_tabular_delete", "visibility: hidden;");
    sheet.add(".modal_default_form_item_tabular_empty", "height: 1px; margin: 5px 23px 5px 0px; background-color: #ccc;");
    sheet.add(".modal_default_form_item_tabular_spacer .modal_default_form_item_tabular_cell", "padding: 0px;");
    sheet.add(".modal_min_main", "border: 1px solid #ccc; max-width: 90%;");
    sheet.add(".modal_min_background", "opacity: 0.5; background-color: #000;");
    sheet.add(".modal_min_ok", "padding: 3px 10px;");
    sheet.add(".modal_min_cancel", "padding: 3px 10px;");
    sheet.add(".navigator_modal_main", "border-left: 1px solid #c0c0c0;border-right: 1px solid #c0c0c0;border-bottom: 1px solid #c0c0c0;background-color: white;color: #000000; box-sizing: content-box;");
    sheet.add(".navigator_modal_main *, .navigator_modal_main *:before, .navigator_modal_main *:after", "box-sizing: content-box;");
    sheet.add(".navigator_modal_month", "font-size: 11px;");
    sheet.add(".navigator_modal_day", "color: black;");
    sheet.add(".navigator_modal_weekend", "background-color: #f0f0f0;");
    sheet.add(".navigator_modal_dayheader", "color: black;");
    sheet.add(".navigator_modal_line", "border-bottom: 1px solid #c0c0c0;");
    sheet.add(".navigator_modal_dayother", "color: gray;");
    sheet.add(".navigator_modal_todaybox", "border: 1px solid red;");
    sheet.add(".navigator_modal_title, .navigator_modal_titleleft, .navigator_modal_titleright", 'border-top: 1px solid #c0c0c0;border-bottom: 1px solid #c0c0c0;color: #333;background: #f3f3f3;');
    sheet.add(".navigator_modal_busy", "font-weight: bold;");
    sheet.add(".navigator_modal_cell", "text-align: center;");
    sheet.add(".navigator_modal_select .navigator_modal_cell_box", "background-color: #FFE794; opacity: 0.5;");
    sheet.add(".navigator_modal_title", "text-align: center;");
    sheet.add(".navigator_modal_titleleft, .navigator_modal_titleright", "text-align: center;");
    sheet.add(".navigator_modal_dayheader", "text-align: center;");
    sheet.add(".navigator_modal_weeknumber", "text-align: center;");
    sheet.add(".navigator_modal_cell_text", "cursor: pointer;");
    sheet.add(".navigator_modal_todaysection", "box-sizing: border-box; display: flex; align-items: center; justify-content: center; border-top: 1px solid var(--dp-nav-border-color);");
    sheet.add(".navigator_modal_todaysection_button", "cursor: pointer; color: #333; background-color: #f0f0f0; border: 1px solid var(--dp-nav-border-color); padding: 5px 10px; border-radius: 0px; ");
    sheet.commit();
    DayPilot.Modal = function (options) {
        this.autoFocus = true;
        this.focus = null;
        this.autoStretch = true;
        this.autoStretchFirstLoadOnly = false;
        this.className = null;
        this.theme = "modal_default";
        this.disposeOnClose = true;
        this.dragDrop = true;
        this.loadingHtml = null;
        this.maxHeight = null;
        this.scrollWithPage = true;
        this.useIframe = true;
        this.zIndex = 99999;
        this.left = null;
        this.width = 600;
        this.top = 20;
        this.height = 200;
        this.locale = null;
        this.closed = null;
        this.onClose = null;
        this.onClosed = null;
        this.onShow = null;
        var This = this;
        this.id = '_' + new Date().getTime() + 'n' + (Math.random() * 10);
        this._registered = false;
        this._start = null;
        this._coords = null;
        this.showHtml = function (html) {
            if (DayPilot.ModalStatic.displayed(this)) {
                throw "This modal dialog is already displayed.";
            }
            if (!this.div) {
                this._create();
            }
            this._update();
            if (this.useIframe) {
                var delayed = function (p, innerHTML) {
                    return function () {
                        p.setInnerHTML(p.id + "iframe", innerHTML);
                    };
                };
                window.setTimeout(delayed(this, html), 0);
            }
            else {
                if (html.nodeType) {
                    this.div.appendChild(html);
                }
                else {
                    this.div.innerHTML = html;
                }
            }
            this._update();
            this._register();
            this._doShow();
        };
        this.showUrl = function (url) {
            if (DayPilot.ModalStatic.displayed(this)) {
                throw "This modal dialog is already displayed.";
            }
            if (this.useIframe) {
                if (!this.div) {
                    this._create();
                }
                var loadingHtml = this.loadingHtml;
                if (loadingHtml) {
                    this.iframe.src = "about:blank";
                    this.setInnerHTML(this.id + "iframe", loadingHtml);
                }
                this.re(this.iframe, "load", this._onIframeLoad);
                this.iframe.src = url;
                this._update();
                this._register();
                this._doShow();
            }
            else {
                This._ajax({
                    "url": url,
                    "success": function (args) {
                        var html = args.request.responseText;
                        This.showHtml(html);
                    },
                    "error": function () {
                        This.showHtml("Error loading the modal dialog");
                    }
                });
            }
        };
        this._doShow = function () {
            if (typeof This.onShow === "function") {
                var args = {};
                args.root = This._body();
                args.modal = This;
                This.onShow(args);
            }
        };
        this._body = function () {
            return This.iframe ? This.iframe.contentWindow.document : This.div;
        };
        this._ajax = function (object) {
            var req = new XMLHttpRequest();
            if (!req) {
                return;
            }
            var method = object.method || "GET";
            var success = object.success || function () { };
            var error = object.error || function () { };
            var data = object.data;
            var url = object.url;
            req.open(method, url, true);
            req.setRequestHeader('Content-type', 'text/plain');
            req.onreadystatechange = function () {
                if (req.readyState !== 4) {
                    return;
                }
                if (req.status !== 200 && req.status !== 304) {
                    if (error) {
                        var args_1 = {};
                        args_1.request = req;
                        error(args_1);
                    }
                    else {
                        if (window.console) {
                            console.log('HTTP error ' + req.status);
                        }
                    }
                    return;
                }
                var args = {};
                args.request = req;
                success(args);
            };
            if (req.readyState === 4) {
                return;
            }
            if (typeof data === 'object') {
                data = JSON.stringify(data);
            }
            req.send(data);
        };
        this._update = function () {
            delete this.result;
            var win = window;
            var doc = document;
            var scrollY = win.pageYOffset ? win.pageYOffset : ((doc.documentElement && doc.documentElement.scrollTop) ? doc.documentElement.scrollTop : doc.body.scrollTop);
            if (this.theme) {
                this.hideDiv.className = this.theme + "_background";
            }
            if (this.zIndex) {
                this.hideDiv.style.zIndex = this.zIndex;
            }
            this.hideDiv.style.display = '';
            window.setTimeout(function () {
                if (This.hideDiv) {
                    This.hideDiv.onclick = function () {
                        This.hide({ "backgroundClick": true });
                    };
                }
            }, 500);
            if (this.theme) {
                this.div.className = this.theme + "_main";
            }
            else {
                this.div.className = "";
            }
            if (this.className) {
                this.div.className += " " + this.className;
            }
            if (this.left) {
                this.div.style.left = this.left + "px";
            }
            else {
                this.div.style.marginLeft = '-' + Math.floor(this.width / 2) + "px";
            }
            this.div.style.position = 'absolute';
            this.div.style.boxSizing = "content-box";
            this.div.style.top = (scrollY + this.top) + 'px';
            this.div.style.width = this.width + 'px';
            if (this.zIndex) {
                this.div.style.zIndex = this.zIndex;
            }
            if (this.height) {
                if (this.useIframe || !this.autoStretch) {
                    this.div.style.height = this.height + 'px';
                }
                else {
                    this.div.style.height = '';
                }
            }
            if (this.useIframe && this.height) {
                this.iframe.style.height = (this.height) + 'px';
            }
            this.div.style.display = '';
            this._updateHorizontal();
            DayPilot.ModalStatic.remove(this);
            DayPilot.ModalStatic.list.push(this);
        };
        this._onIframeLoad = function () {
            This.iframe.contentWindow.modal = This;
            if (This.autoStretch) {
                This.stretch();
            }
        };
        this.stretch = function () {
            var height = function () {
                return This._windowRect().y;
            };
            var width = function () {
                return This._windowRect().x;
            };
            if (this.useIframe) {
                var maxWidth = width() - 40;
                for (var w = this.width; w < maxWidth && this._hasHorizontalScrollbar(); w += 10) {
                    this.div.style.width = w + 'px';
                    this.div.style.marginLeft = '-' + Math.floor(w / 2) + "px";
                }
                var maxHeight = this.maxHeight || height() - 2 * this.top;
                for (var h = this.height; h < maxHeight && this._hasVerticalScrollbar(); h += 10) {
                    this.iframe.style.height = (h) + 'px';
                    this.div.style.height = h + 'px';
                }
                if (this.autoStretchFirstLoadOnly) {
                    this.ue(this.iframe, "load", this._onIframeLoad);
                }
            }
            else {
                this.div.style.height = '';
            }
        };
        this._hasHorizontalScrollbar = function () {
            var document = this.iframe.contentWindow.document;
            var root = document.compatMode === 'BackCompat' ? document.body : document.documentElement;
            var scrollWidth = root.scrollWidth;
            var children = document.body.children;
            for (var i = 0; i < children.length; i++) {
                var bottom = children[i].offsetLeft + children[i].offsetWidth;
                scrollWidth = Math.max(scrollWidth, bottom);
            }
            var isHorizontalScrollbar = scrollWidth > root.clientWidth;
            return isHorizontalScrollbar;
        };
        this._hasVerticalScrollbar = function () {
            var document = this.iframe.contentWindow.document;
            var root = document.compatMode === 'BackCompat' ? document.body : document.documentElement;
            var scrollHeight = root.scrollHeight;
            var children = document.body.children;
            for (var i = 0; i < children.length; i++) {
                var bottom = children[i].offsetTop + children[i].offsetHeight;
                scrollHeight = Math.max(scrollHeight, bottom);
            }
            var isVerticalScrollbar = scrollHeight > root.clientHeight;
            return isVerticalScrollbar;
        };
        this._windowRect = function () {
            var doc = document;
            if (doc.compatMode === "CSS1Compat" && doc.documentElement && doc.documentElement.clientWidth) {
                var x = doc.documentElement.clientWidth;
                var y = doc.documentElement.clientHeight;
                return { x: x, y: y };
            }
            else {
                var x = doc.body.clientWidth;
                var y = doc.body.clientHeight;
                return { x: x, y: y };
            }
        };
        this._register = function () {
            if (this._registered) {
                return;
            }
            this.re(window, 'resize', this._onWindowResize);
            this.re(window, 'scroll', this._onWindowScroll);
            if (this.dragDrop) {
                this.re(document, 'mousemove', this._onMouseMove);
                this.re(document, 'mouseup', this._onMouseUp);
            }
            this._registered = true;
        };
        this._unregister = function () {
            this.ue(window, 'resize', this._onWindowResize);
            this.ue(window, 'scroll', this._onWindowScroll);
            if (this.dragDrop) {
                this.ue(document, 'mousemove', this._onMouseMove);
                this.ue(document, 'mouseup', this._onMouseUp);
            }
            this._registered = false;
        };
        this._onDragStart = function (e) {
            if (e.target !== This.div) {
                return;
            }
            e.preventDefault();
            This.div.style.cursor = "move";
            This._maskIframe();
            This._coords = This.mc(e || window.event);
            This._start = { x: This.div.offsetLeft, y: This.div.offsetTop };
        };
        this._onMouseMove = function (e) {
            if (!This._coords) {
                return;
            }
            var now = This.mc(e);
            var x = now.x - This._coords.x;
            var y = now.y - This._coords.y;
            This.div.style.marginLeft = '0px';
            This.div.style.top = (This._start.y + y) + "px";
            This.div.style.left = (This._start.x + x) + "px";
        };
        this._onMouseUp = function () {
            if (!This._coords) {
                return;
            }
            This._unmaskIframe();
            This.div.style.cursor = null;
            This._coords = null;
        };
        this._maskIframe = function () {
            if (!this.useIframe) {
                return;
            }
            var opacity = 80;
            var mask = document.createElement("div");
            mask.style.backgroundColor = "#ffffff";
            mask.style.filter = "alpha(opacity=" + opacity + ")";
            mask.style.opacity = "0." + opacity;
            mask.style.width = "100%";
            mask.style.height = this.height + "px";
            mask.style.position = "absolute";
            mask.style.left = '0px';
            mask.style.top = '0px';
            this.div.appendChild(mask);
            this.mask = mask;
        };
        this._unmaskIframe = function () {
            if (!this.useIframe) {
                return;
            }
            this.div.removeChild(this.mask);
            this.mask = null;
        };
        this._onWindowResize = function () {
            This._updateTop();
            This._updateHorizontal();
        };
        this._onWindowScroll = function () {
            This._updateTop();
        };
        this._updateHorizontal = function () {
            if (This.left) {
                return;
            }
            if (!This.div) {
                return;
            }
            var width = This.div.offsetWidth;
            This.div.style.marginLeft = '-' + Math.floor(width / 2) + "px";
        };
        this._updateTop = function () {
            if (!This.hideDiv) {
                return;
            }
            if (!This.div) {
                return;
            }
            if (This.hideDiv.style.display === 'none') {
                return;
            }
            if (This.div.style.display === 'none') {
                return;
            }
            var scrollY = This._parent.scrollY();
            if (!This.scrollWithPage) {
                This.div.style.top = (scrollY + This.top) + 'px';
            }
        };
        this._parent = {};
        this._parent.container = function () {
            return This.container || document.body;
        };
        this._parent.scrollY = function () {
            var c = This._parent.container();
            if (c === document.body) {
                return window.pageYOffset ? window.pageYOffset : ((document.documentElement && document.documentElement.scrollTop) ? document.documentElement.scrollTop : document.body.scrollTop);
            }
            else {
                return c.scrollTop;
            }
        };
        this.re = function (el, ev, func) {
            if (el.addEventListener) {
                el.addEventListener(ev, func, false);
            }
            else if (el.attachEvent) {
                el.attachEvent("on" + ev, func);
            }
        };
        this.ue = function (el, ev, func) {
            if (el.removeEventListener) {
                el.removeEventListener(ev, func, false);
            }
            else if (el.detachEvent) {
                el.detachEvent("on" + ev, func);
            }
        };
        this.mc = function (ev) {
            if (ev.pageX || ev.pageY) {
                return { x: ev.pageX, y: ev.pageY };
            }
            return {
                x: ev.clientX + document.documentElement.scrollLeft,
                y: ev.clientY + document.documentElement.scrollTop
            };
        };
        this.abs = function (element) {
            var r = {
                x: element.offsetLeft,
                y: element.offsetTop
            };
            while (element.offsetParent) {
                element = element.offsetParent;
                r.x += element.offsetLeft;
                r.y += element.offsetTop;
            }
            return r;
        };
        this._create = function () {
            var container = This._parent.container();
            var isRoot = container === document.body;
            var position = isRoot ? "fixed" : "absolute";
            var hide = document.createElement("div");
            hide.id = this.id + "hide";
            hide.style.position = position;
            hide.style.left = "0px";
            hide.style.top = "0px";
            hide.style.right = "0px";
            hide.style.bottom = "0px";
            hide.oncontextmenu = function () { return false; };
            hide.onmousedown = function () { return false; };
            container.appendChild(hide);
            var div = document.createElement("div");
            div.id = this.id + 'popup';
            div.style.position = position;
            div.style.left = '50%';
            div.style.top = '0px';
            div.style.backgroundColor = 'white';
            div.style.width = "50px";
            div.style.height = "50px";
            if (this.dragDrop) {
                div.onmousedown = this._onDragStart;
            }
            div.addEventListener("keydown", function (e) {
                e.stopPropagation();
            });
            var defaultHeight = 50;
            var iframe = null;
            if (this.useIframe) {
                iframe = document.createElement("iframe");
                iframe.id = this.id + "iframe";
                iframe.name = this.id + "iframe";
                iframe.frameBorder = '0';
                iframe.style.width = '100%';
                iframe.style.height = defaultHeight + 'px';
                div.appendChild(iframe);
            }
            container.appendChild(div);
            this.div = div;
            this.iframe = iframe;
            this.hideDiv = hide;
        };
        this.setInnerHTML = function (id, innerHTML) {
            var frame = window.frames[id];
            var doc = frame.contentWindow || frame.document || frame.contentDocument;
            if (doc.document) {
                doc = doc.document;
            }
            if (doc.body == null) {
                doc.write("<body></body>");
            }
            if (innerHTML.nodeType) {
                doc.body.appendChild(innerHTML);
            }
            else {
                doc.body.innerHTML = innerHTML;
            }
            if (This.autoStretch) {
                if (!This.autoStretchFirstLoadOnly || !This._stretched) {
                    This.stretch();
                    This._stretched = true;
                }
            }
        };
        this.close = function (result) {
            this.result = result;
            this.hide();
        };
        this.closeSerialized = function () {
            var ref = This._body();
            var fields = ref.querySelectorAll("input, textarea, select");
            var result = {};
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i];
                var name_1 = field.name;
                if (!name_1) {
                    continue;
                }
                var value = field.value;
                result[name_1] = value;
            }
            This.close(result);
        };
        this.hide = function (options) {
            options = options || {};
            var args = {};
            args.backgroundClick = !!options.backgroundClick;
            args.result = this.result;
            args.canceled = typeof this.result === "undefined";
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            if (typeof this.onClose === "function") {
                this.onClose(args);
                if (args.preventDefault.value) {
                    return;
                }
            }
            if (this.div) {
                this.div.style.display = 'none';
                this.hideDiv.style.display = 'none';
                if (!this.useIframe) {
                    this.div.innerHTML = null;
                }
            }
            window.focus();
            DayPilot.ModalStatic.remove(this);
            if (typeof this.onClosed === "function") {
                this.onClosed(args);
            }
            else if (this.closed) {
                this.closed();
            }
            delete this.result;
            if (this.disposeOnClose) {
                This._unregister();
                This._de(This.div);
                This._de(This.hideDiv);
                This.div = null;
                This.hideDiv = null;
                This.iframe = null;
            }
        };
        this._de = function (e) {
            var _a;
            if (!e) {
                return;
            }
            (_a = e.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(e);
        };
        this._applyOptions = function () {
            if (!options) {
                return;
            }
            for (var name_2 in options) {
                this[name_2] = options[name_2];
            }
        };
        this._applyOptions();
    };
    DayPilot.Modal.alert = function (message, options) {
        options = options || {};
        options.height = options.height || 40;
        options.useIframe = false;
        var okText = options.okText || "OK";
        return DayPilot.getPromise(function (success) {
            options.onClosed = function (args) {
                success(args);
            };
            var modal = new DayPilot.Modal(options);
            var div = document.createElement("div");
            div.className = modal.theme + "_inner";
            var text = document.createElement("div");
            text.className = modal.theme + "_content";
            text.innerHTML = message;
            var buttons = document.createElement("div");
            buttons.className = modal.theme + "_buttons";
            var buttonOK = document.createElement("button");
            buttonOK.innerText = okText;
            buttonOK.className = modal.theme + "_ok";
            buttonOK.onclick = function () {
                DayPilot.ModalStatic.close("OK");
            };
            buttons.appendChild(buttonOK);
            div.appendChild(text);
            div.appendChild(buttons);
            modal.showHtml(div);
            if (modal.autoFocus) {
                buttonOK.focus();
            }
        });
    };
    DayPilot.Modal.confirm = function (message, options) {
        options = options || {};
        options.height = options.height || 40;
        options.useIframe = false;
        var okText = options.okText || "OK";
        var cancelText = options.cancelText || "Cancel";
        return DayPilot.getPromise(function (success) {
            options.onClosed = function (args) {
                success(args);
            };
            var modal = new DayPilot.Modal(options);
            var div = document.createElement("div");
            div.className = modal.theme + "_inner";
            var text = document.createElement("div");
            text.className = modal.theme + "_content";
            text.innerHTML = message;
            var buttons = document.createElement("div");
            buttons.className = modal.theme + "_buttons";
            var buttonOK = document.createElement("button");
            buttonOK.innerText = okText;
            buttonOK.className = modal.theme + "_ok";
            buttonOK.onclick = function () {
                DayPilot.ModalStatic.close("OK");
            };
            var space = document.createTextNode(" ");
            var buttonCancel = document.createElement("button");
            buttonCancel.innerText = cancelText;
            buttonCancel.className = modal.theme + "_cancel";
            buttonCancel.onclick = function () {
                DayPilot.ModalStatic.close();
            };
            buttons.appendChild(buttonOK);
            buttons.appendChild(space);
            buttons.appendChild(buttonCancel);
            div.appendChild(text);
            div.appendChild(buttons);
            modal.showHtml(div);
            if (modal.autoFocus) {
                buttonOK.focus();
            }
        });
    };
    DayPilot.Modal.prompt = function (message, defaultValue, options) {
        if (typeof defaultValue === "object") {
            options = defaultValue;
            defaultValue = "";
        }
        options = options || {};
        options.height = options.height || 40;
        options.useIframe = false;
        var okText = options.okText || "OK";
        var cancelText = options.cancelText || "Cancel";
        var inputText = defaultValue || "";
        return DayPilot.getPromise(function (success) {
            options.onClosed = function (args) {
                success(args);
            };
            var modal = new DayPilot.Modal(options);
            var div = document.createElement("div");
            div.className = modal.theme + "_inner";
            var text = document.createElement("div");
            text.className = modal.theme + "_content";
            text.innerHTML = message;
            var inputs = document.createElement("div");
            inputs.className = modal.theme + "_input";
            var input = document.createElement("input");
            input.value = inputText;
            input.style.width = "100%";
            input.onkeydown = function (e) {
                var letcontinue = false;
                switch (e.keyCode) {
                    case 13:
                        modal.close(this.value);
                        break;
                    case 27:
                        modal.close();
                        break;
                    default:
                        letcontinue = true;
                        break;
                }
                if (!letcontinue) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            };
            inputs.appendChild(input);
            var buttons = document.createElement("div");
            buttons.className = modal.theme + "_buttons";
            var buttonOK = document.createElement("button");
            buttonOK.innerText = okText;
            buttonOK.className = modal.theme + "_ok";
            buttonOK.onclick = function () {
                modal.close(input.value);
            };
            var space = document.createTextNode(" ");
            var buttonCancel = document.createElement("button");
            buttonCancel.innerText = cancelText;
            buttonCancel.className = modal.theme + "_cancel";
            buttonCancel.onclick = function () {
                modal.close();
            };
            buttons.appendChild(buttonOK);
            buttons.appendChild(space);
            buttons.appendChild(buttonCancel);
            div.appendChild(text);
            div.appendChild(inputs);
            div.appendChild(buttons);
            modal.showHtml(div);
            if (modal.autoFocus) {
                input.focus();
            }
        });
    };
    var isArray = function (arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
    };
    function setPathValue(target, path, value) {
        var iodot = path.indexOf(".");
        if (iodot === -1) {
            if (path !== "__proto__" && path !== "constructor") {
                target[path] = value;
            }
            return;
        }
        var segment = path.substring(0, iodot);
        if (segment === "__proto__" || segment === "constructor") {
            return;
        }
        var remainder = path.substring(iodot + 1);
        var child = target[segment];
        if (typeof child !== "object" || child === null) {
            target[segment] = {};
            child = target[segment];
        }
        setPathValue(child, remainder, value);
    }
    DayPilot.Modal.form = function (form, data, options) {
        if (arguments.length === 1) {
            var arg = form;
            var isa = isArray(arg);
            if (isa) {
                data = {};
            }
            else if (typeof arg === "object") {
                data = form;
                form = [];
                for (var name_3 in data) {
                    var item = {};
                    item.name = name_3;
                    item.id = name_3;
                    form.push(item);
                }
            }
            else {
                throw "Invalid DayPilot.Modal.form() parameter";
            }
        }
        var opts = {};
        for (var name_4 in options) {
            opts[name_4] = options[name_4];
        }
        opts.height = opts.height || 40;
        opts.useIframe = false;
        var okText = opts.okText || "OK";
        var cancelText = opts.cancelText || "Cancel";
        return DayPilot.getPromise(function (success) {
            opts.onClosed = function (args) {
                if (args.result) {
                    var mergedResult = JSON.parse(JSON.stringify(data));
                    for (var name_5 in args.result) {
                        setPathValue(mergedResult, name_5, args.result[name_5]);
                    }
                    args.result = mergedResult;
                }
                success(args);
            };
            var modal = new DayPilot.Modal(opts);
            var div = document.createElement("div");
            div.className = modal.theme + "_inner";
            var inputs = document.createElement("div");
            inputs.className = modal.theme + "_input";
            var f = new Form({
                theme: modal.theme,
                form: form,
                data: data,
                zIndex: modal.zIndex,
                locale: modal.locale,
                plugins: modal.plugins,
                onKey: function (args) {
                    switch (args.key) {
                        case "Enter":
                            if (f.validate()) {
                                modal.close(f.serialize());
                            }
                            break;
                        case "Escape":
                            modal.close();
                            break;
                    }
                },
                onChange: function (args) {
                    if (typeof modal.onChange === "function") {
                        modal.onChange(args);
                    }
                }
            });
            var el = f.create();
            inputs.append(el);
            var buttons = document.createElement("div");
            buttons.className = modal.theme + "_buttons";
            var buttonOK = document.createElement("button");
            buttonOK.innerText = okText;
            buttonOK.className = modal.theme + "_ok";
            if (opts.okDisabled) {
                buttonOK.disabled = true;
            }
            buttonOK.onclick = function () {
                if (f.validate()) {
                    modal.close(f.serialize());
                }
            };
            var space = document.createTextNode(" ");
            var buttonCancel = document.createElement("button");
            buttonCancel.innerText = cancelText;
            buttonCancel.className = modal.theme + "_cancel";
            buttonCancel.onclick = function () {
                modal.close();
            };
            buttonCancel.onmousedown = function () {
                f.canceling = true;
            };
            buttons.appendChild(buttonOK);
            buttons.appendChild(space);
            buttons.appendChild(buttonCancel);
            div.appendChild(inputs);
            div.appendChild(buttons);
            modal.showHtml(div);
            modal.div.setAttribute("tabindex", "-1");
            modal.div.addEventListener("keydown", function (e) {
                switch (e.keyCode) {
                    case 27:
                        modal.close();
                        break;
                    case 13:
                        if (f.validate()) {
                            modal.close(f.serialize());
                        }
                        break;
                }
            });
            if (modal.focus) {
                var toBeFocused = null;
                if (typeof modal.focus === "object") {
                    var id = modal.focus.id;
                    var value = modal.focus.value;
                    toBeFocused = f.findViewById(id, value);
                }
                else if (typeof modal.focus === "string") {
                    toBeFocused = f.findViewById(modal.focus);
                }
                if (toBeFocused) {
                    toBeFocused.focus();
                }
            }
            else {
                var first = f.firstFocusable();
                if (modal.autoFocus && first) {
                    first.focus();
                }
                else {
                    modal.div.focus();
                }
            }
        });
    };
    DayPilot.Modal.close = function (result) {
        var opener = DayPilot.Modal.opener();
        if (!opener) {
            return;
        }
        opener.close(result);
    };
    DayPilot.Modal.stretch = function () {
        var opener = DayPilot.Modal.opener();
        if (!opener) {
            throw "Unable to find the opener DayPilot.Modal instance.";
        }
        opener.stretch();
    };
    DayPilot.Modal.closeSerialized = function () {
        var last = DayPilot.Modal.opener() || DayPilot.ModalStatic.last();
        if (last) {
            last.closeSerialized();
        }
    };
    DayPilot.Modal.opener = function () {
        if (typeof DayPilot !== "undefined" && typeof DayPilot.ModalStatic !== "undefined" && DayPilot.ModalStatic.list.length > 0) {
            return DayPilot.ModalStatic.list[DayPilot.ModalStatic.list.length - 1];
        }
        return parent && parent.DayPilot && parent.DayPilot.ModalStatic && parent.DayPilot.ModalStatic.list[parent.DayPilot.ModalStatic.list.length - 1];
    };
    if (typeof DayPilot.getPromise === "undefined") {
        DayPilot.getPromise = function (f) {
            if (typeof Promise !== 'undefined') {
                return new Promise(f);
            }
            DayPilot.Promise = function (f) {
                var p = this;
                this.then = function (onFulfilled, onRejected) {
                    onFulfilled = onFulfilled || function () { };
                    onRejected = onRejected || function () { };
                    f(onFulfilled, onRejected);
                    return DayPilot.getPromise(f);
                };
                this['catch'] = function (onRejected) {
                    p.then(null, onRejected);
                    return DayPilot.getPromise(f);
                };
            };
            return new DayPilot.Promise(f);
        };
    }
    function Form(options) {
        this.form = [];
        this.data = {};
        this.theme = "form_default";
        this.zIndex = 99999;
        this.locale = "en-us";
        this.plugins = {};
        this.onKey = null;
        this._rows = [];
        this._newRows = null;
        this.canceling = false;
        this._validationTimeouts = [];
        this._views = [];
        this._div = null;
        options = options || {};
        for (var name_6 in options) {
            this[name_6] = options[name_6];
        }
    }
    Form.prototype.create = function () {
        this.load();
        this.render();
        return this._div;
    };
    Form.prototype.render = function () {
        var form = this;
        this._div = document.createElement("div");
        this._rows.forEach(function (row) {
            form.createView(row);
        });
        this.applyState();
    };
    Form.prototype.createView = function (row) {
        var theme = this.theme;
        var form = this;
        var div = document.createElement("div");
        div.className = theme + "_form_item " + theme + "_form_item_level" + row.level;
        if (!row.interactive && row.type === "title") {
            div.className += " " + theme + "_form_title";
        }
        else {
            div.className += " " + theme + "_form_item_" + row.type;
        }
        if (row.data.cssClass) {
            div.className += " " + row.data.cssClass;
        }
        if (!row.isValue) {
            var label = document.createElement("div");
            label.className = theme + "_form_item_label";
            label.innerText = row.text;
            div.appendChild(label);
        }
        var interactive = this.createInteractive(row);
        interactive.onInput = function (options) {
            options = options || {};
            form._validateInteractive(interactive, {
                "debounce": !options.immediate
            });
            if (typeof form.onChange === "function") {
                var args = {};
                args.result = form.serialize();
                form.onChange(args);
            }
        };
        interactive.onBlur = function () {
            if (!form.canceling) {
                form._validateInteractive(interactive);
            }
        };
        interactive.apply(row);
        interactive._div = div;
        interactive.row = row;
        if (interactive.element) {
            div.appendChild(interactive.element);
        }
        this._views.push(interactive);
        this._div.appendChild(div);
    };
    Form.prototype.validate = function () {
        var form = this;
        var valid = true;
        this._views.forEach(function (interactive) {
            var iv = form._validateInteractive(interactive);
            valid = valid && iv;
        });
        return valid;
    };
    Form.prototype._validateInteractive = function (interactive, options) {
        options = options || {};
        var debounce = options.debounce;
        var silent = options.silent;
        var row = interactive.row;
        var valid = true;
        var onValidate = typeof row.data.onValidate === "function" ? row.data.onValidate : null;
        var validate = typeof row.data.validate === "function" ? row.data.validate : null;
        var validateHandler = onValidate || validate;
        if (validateHandler) {
            var args_2 = {};
            args_2.valid = true;
            args_2.value = interactive.save()[row.field];
            args_2.message = "Error";
            args_2.values = this.serialize();
            args_2.result = this.serialize();
            validateHandler(args_2);
            var cssClassInvalid_1 = this.theme + "_form_item_invalid";
            var cssClassMessage_1 = this.theme + "_form_item_invalid_message";
            if (args_2.valid) {
                clearTimeout(this._validationTimeouts[row.field]);
                if (interactive._errorMsg) {
                    interactive._errorMsg.remove();
                    interactive._errorMsg = null;
                }
                interactive._div.classList.remove(cssClassInvalid_1);
            }
            else {
                function showInvalid() {
                    if (interactive._errorMsg) {
                        interactive._errorMsg.remove();
                        interactive._errorMsg = null;
                    }
                    interactive._div.classList.add(cssClassInvalid_1);
                    var msg = document.createElement("div");
                    msg.classList.add(cssClassMessage_1);
                    msg.innerText = args_2.message;
                    interactive._errorMsg = msg;
                    interactive._div.appendChild(msg);
                }
                if (!silent) {
                    if (debounce) {
                        var debounceDelay = 1000;
                        clearTimeout(this._validationTimeouts[row.field]);
                        this._validationTimeouts[row.field] = setTimeout(function () {
                            showInvalid();
                        }, debounceDelay);
                    }
                    else {
                        showInvalid();
                    }
                }
            }
            valid = args_2.valid;
        }
        return valid;
    };
    Form.prototype.load = function () {
        var t = this;
        this.form.forEach(function (item) {
            t.processFormItem(item, 0);
        });
        var flat;
        try {
            var stringified = JSON.stringify(this.data);
            var rebuilt = JSON.parse(stringified);
            flat = flatten(rebuilt);
        }
        catch (e) {
            throw new Error("The 'data' object is not serializable (it may contain circular dependencies): " + e);
        }
        for (var name_7 in flat) {
            this.setValue(name_7, flat[name_7]);
        }
    };
    Form.prototype.setValue = function (name, value) {
        this._rows.forEach(function (row) {
            row.applyValue(name, value);
        });
    };
    Form.prototype.updateDependentState = function () {
        var form = this;
        var enabled = [true];
        var source = this._newRows ? this._newRows : this._rows;
        source.forEach(function (row) {
            var updatedRow = form.updateState(row, {
                enabled: enabled[row.level] && !row.data.disabled
            });
            if (updatedRow.isValue) {
                enabled[updatedRow.level + 1] = updatedRow.enabled && updatedRow.checked;
            }
        });
    };
    Form.prototype.processFormItem = function (item, level) {
        var form = this;
        var type = this.getFieldType(item);
        var rows = [];
        if (type === "radio") {
            if (item.name) {
                var row = new RowModel();
                row.field = item.id;
                row.data = item;
                row.level = level;
                row.type = "label";
                row.interactive = false;
                row.text = item.name;
                form._rows.push(row);
                rows.push(row);
            }
            item.options.forEach(function (option) {
                var row = new RowModel();
                row.field = item.id;
                row.data = option;
                row.level = level;
                row.type = type;
                row.isValue = true;
                row.text = option.name;
                row.resolved = option.id;
                form._rows.push(row);
                rows.push(row);
                if (option.children) {
                    option.children.forEach(function (child) {
                        var childRows = form.processFormItem(child, level + 1);
                        rows = rows.concat(childRows);
                    });
                }
            });
        }
        else if (type === "title") {
            var row = new RowModel();
            row.field = item.id;
            row.data = item;
            row.level = level;
            row.type = type;
            row.interactive = false;
            row.text = item.name;
            form._rows.push(row);
            rows.push(row);
        }
        else if (type === "image") {
            var row = new RowModel();
            row.isValue = true;
            row.field = item.id;
            row.data = item;
            row.level = level;
            row.type = type;
            row.interactive = false;
            row.text = null;
            form._rows.push(row);
            rows.push(row);
        }
        else if (type === "html") {
            var row = new RowModel();
            row.isValue = true;
            row.field = item.id;
            row.data = item;
            row.level = level;
            row.type = type;
            row.interactive = false;
            row.text = null;
            form._rows.push(row);
            rows.push(row);
        }
        else if (type === "scrollable") {
            var row = new RowModel();
            row.isValue = true;
            row.field = item.id;
            row.data = item;
            row.level = level;
            row.type = type;
            row.interactive = false;
            row.text = null;
            form._rows.push(row);
            rows.push(row);
        }
        else {
            var row = new RowModel();
            row.field = item.id;
            row.data = item;
            row.level = level;
            row.type = type;
            row.text = item.name;
            row.children = [];
            form._rows.push(row);
            rows.push(row);
            if (type === "checkbox") {
                row.isValue = true;
                row.resolved = true;
                if (item.children) {
                    item.children.forEach(function (child) {
                        var childRows = form.processFormItem(child, level + 1);
                        rows = rows.concat(childRows);
                    });
                }
            }
        }
        return rows;
    };
    Form.prototype.doOnKey = function (key) {
        if (typeof this.onKey === "function") {
            var args = {
                key: key
            };
            this.onKey(args);
        }
    };
    Form.prototype.createInteractive = function (row) {
        var form = this;
        var views = {
            "label": function () {
                return new Interactive();
            },
            "title": function () {
                return new Interactive();
            },
            "image": function () {
                var interactive = new Interactive();
                var image = document.createElement("img");
                image.src = row.data.image;
                interactive.element = image;
                return interactive;
            },
            "html": function () {
                var interactive = new Interactive();
                var div = document.createElement("div");
                if (typeof row.data.text === "string") {
                    div.innerText = row.data.text;
                }
                else if (typeof row.data.html === "string") {
                    div.innerHTML = row.data.html;
                }
                interactive.element = div;
                return interactive;
            },
            "scrollable": function () {
                var interactive = new Interactive();
                var scroll = document.createElement("div");
                scroll.className = form.theme + "_form_item_scrollable_scroll";
                if (row.data.height) {
                    scroll.style.height = row.data.height + "px";
                }
                var div = document.createElement("div");
                div.className = form.theme + "_form_item_scrollable_scroll_content";
                if (typeof row.data.text === "string") {
                    div.innerText = row.data.text;
                }
                else if (typeof row.data.html === "string") {
                    div.innerHTML = row.data.html;
                }
                scroll.appendChild(div);
                interactive.element = scroll;
                return interactive;
            },
            "text": function () {
                var interactive = new Interactive();
                interactive.apply = function (row) {
                    interactive.row = row;
                    var input = interactive.element;
                    input.value = row.value;
                    input.disabled = !row.enabled;
                };
                var input = document.createElement("input");
                input.name = row.field;
                input.type = "text";
                input.autocomplete = "off";
                input.onkeydown = function (e) {
                    var letcontinue = false;
                    switch (e.keyCode) {
                        case 13:
                            form.doOnKey("Enter");
                            break;
                        case 27:
                            form.doOnKey("Escape");
                            break;
                        default:
                            letcontinue = true;
                            break;
                    }
                    if (!letcontinue) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                };
                input.oninput = function () {
                    interactive.onInput();
                };
                input.onblur = function () {
                    interactive.onBlur();
                };
                interactive.element = input;
                interactive.canFocus = function () {
                    return !interactive.element.disabled;
                };
                interactive.focus = function () {
                    interactive.element.focus();
                    interactive.element.setSelectionRange(0, interactive.element.value.length);
                };
                interactive.save = function () {
                    var result = {};
                    result[row.field] = input.value;
                    return result;
                };
                return interactive;
            },
            "textarea": function () {
                var interactive = new Interactive();
                interactive.apply = function (row) {
                    interactive.row = row;
                    var input = interactive.element;
                    input.value = row.value;
                    input.disabled = !row.enabled;
                };
                var textarea = document.createElement("textarea");
                textarea.name = row.field;
                if (row.data.height) {
                    textarea.style.height = row.data.height + "px";
                }
                textarea.onkeydown = function (e) {
                    var letcontinue = false;
                    switch (e.keyCode) {
                        case 13:
                            if (e.ctrlKey || e.metaKey) {
                                form.doOnKey("Enter");
                            }
                            letcontinue = false;
                            break;
                        case 27:
                            form.doOnKey("Escape");
                            break;
                        default:
                            letcontinue = true;
                            break;
                    }
                    if (!letcontinue) {
                        e.stopPropagation();
                    }
                };
                textarea.oninput = function () {
                    interactive.onInput();
                };
                textarea.onblur = function () {
                    interactive.onBlur();
                };
                interactive.element = textarea;
                interactive.canFocus = function () {
                    return !interactive.element.disabled;
                };
                interactive.focus = function () {
                    interactive.element.focus();
                    interactive.element.setSelectionRange(0, 0);
                };
                interactive.save = function () {
                    var result = {};
                    result[row.field] = textarea.value;
                    return result;
                };
                return interactive;
            },
            "date": function () {
                var interactive = new Interactive();
                interactive.apply = function (row) {
                    interactive.row = row;
                    var input = interactive.element;
                    var picker = interactive.picker;
                    if (row.data.dateFormat) {
                        picker.pattern = row.data.dateFormat;
                    }
                    var locale = row.data.locale || form.locale;
                    if (locale) {
                        picker.locale = locale;
                    }
                    input.disabled = !row.enabled;
                    picker.date = new DayPilot.Date(row.value);
                    var formatted = new DayPilot.Date(row.value).toString(row.data.dateFormat || picker.pattern, picker.locale);
                    input.value = formatted;
                };
                var input = document.createElement("input");
                input.name = row.field;
                var picker = new DayPilot.DatePicker({
                    target: input,
                    theme: "navigator_modal",
                    zIndex: form.zIndex + 1,
                    resetTarget: false,
                    targetAlignment: "left",
                    onTimeRangeSelect: function () {
                        interactive.onInput({ "immediate": true });
                    }
                });
                input.picker = picker;
                input.className = form.theme + "_input_date";
                input.type = "text";
                input.onkeydown = function (e) {
                    var letcontinue = false;
                    switch (e.keyCode) {
                        case 13:
                            if (picker.visible) {
                                picker.close();
                            }
                            else {
                                form.doOnKey("Enter");
                            }
                            break;
                        case 27:
                            if (picker.visible) {
                                picker.close();
                            }
                            else {
                                form.doOnKey("Escape");
                            }
                            break;
                        case 9:
                            picker.close();
                            letcontinue = true;
                            break;
                        default:
                            letcontinue = true;
                            break;
                    }
                    if (!letcontinue) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                };
                input.onfocus = function () {
                    picker.show();
                };
                input.onclick = function () {
                    picker.show();
                };
                input.oninput = function () {
                    interactive.onInput();
                };
                input.onblur = function () {
                    interactive.onBlur();
                };
                interactive.element = input;
                interactive.picker = picker;
                interactive.canFocus = function () {
                    return !interactive.element.disabled;
                };
                interactive.focus = function () {
                    interactive.element.focus();
                };
                interactive.save = function () {
                    var value = picker.date ? picker.date.toString() : null;
                    var result = {};
                    result[row.field] = value;
                    return result;
                };
                return interactive;
            },
            "time": function () {
                return form._createInteractiveTime(row);
            },
            "datetime": function () {
                return form._createInteractiveDateTime(row);
            },
            "select": function () {
                var interactive = new Interactive();
                interactive.apply = function (row) {
                    interactive.row = row;
                    var select = interactive.element;
                    select.value = row.value;
                    select.disabled = !row.enabled;
                };
                var select = document.createElement("select");
                select.name = row.field;
                if (row.data.options && row.data.options.forEach) {
                    row.data.options.forEach(function (i) {
                        var option = document.createElement("option");
                        option.innerText = i.name || i.id;
                        option.value = i.id;
                        option._originalValue = i.id;
                        select.appendChild(option);
                    });
                }
                select.onchange = function () {
                    interactive.onInput({ "immediate": true });
                };
                select.onblur = function () {
                    interactive.onBlur();
                };
                interactive.element = select;
                interactive.canFocus = function () {
                    return !interactive.element.disabled;
                };
                interactive.focus = function () {
                    interactive.element.focus();
                };
                interactive.save = function () {
                    var value = null;
                    var option = select.options[select.selectedIndex];
                    if (option && typeof option._originalValue !== "undefined") {
                        value = option._originalValue;
                    }
                    var result = {};
                    result[row.field] = value;
                    return result;
                };
                return interactive;
            },
            "searchable": function () {
                var interactive = new Interactive();
                interactive.apply = function (row) {
                    interactive.row = row;
                    var searchable = interactive.searchable;
                    searchable.disabled = !row.enabled;
                    searchable.select(row.value);
                };
                var searchable = new Searchable({
                    data: row.data.options || [],
                    name: row.field,
                    theme: form.theme + "_form_item_searchable",
                    listZIndex: form.zIndex + 1,
                    onSelect: function (args) {
                        if (args.ui) {
                            interactive.onInput({ "immediate": true });
                        }
                    }
                });
                var element = searchable.create();
                interactive.element = element;
                interactive.searchable = searchable;
                interactive.canFocus = function () {
                    return !interactive.searchable.disabled;
                };
                interactive.focus = function () {
                    interactive.searchable.focus();
                };
                interactive.save = function () {
                    var value = searchable.selected && searchable.selected.id;
                    var result = {};
                    result[row.field] = value;
                    return result;
                };
                return interactive;
            },
            "radio": function () {
                var interactive = new Interactive();
                interactive.apply = function (row) {
                    interactive.row = row;
                    var radio = interactive.radio;
                    radio.checked = row.checked;
                    radio.disabled = !row.enabled;
                };
                var label = document.createElement("label");
                var radio = document.createElement("input");
                radio.type = "radio";
                radio.name = row.field;
                radio._originalValue = row.resolved;
                radio.onchange = function () {
                    var row = interactive.row;
                    form.findRowsByField(row.field).forEach(function (row) {
                        form.updateState(row, {
                            checked: false
                        });
                    });
                    form.updateState(row, {
                        checked: true
                    });
                    form.applyState();
                    interactive.onInput({ "immediate": true });
                };
                radio.onblur = function () {
                    interactive.onBlur();
                };
                label.appendChild(radio);
                var text = document.createTextNode(row.text);
                label.append(text);
                interactive.element = label;
                interactive.radio = radio;
                interactive.canFocus = function () {
                    return false;
                };
                interactive.focus = function () {
                    interactive.radio.focus();
                };
                interactive.save = function () {
                    if (!radio.checked) {
                        return {};
                    }
                    var value = radio._originalValue;
                    var result = {};
                    result[row.field] = value;
                    return result;
                };
                return interactive;
            },
            "checkbox": function () {
                var interactive = new Interactive();
                interactive.apply = function (row) {
                    interactive.row = row;
                    var checkbox = interactive.checkbox;
                    checkbox.checked = row.checked;
                    checkbox.disabled = !row.enabled;
                };
                var label = document.createElement("label");
                var checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.name = row.field;
                checkbox._originalValue = row.resolved;
                checkbox.onchange = function () {
                    var row = interactive.row;
                    form.updateState(row, {
                        checked: this.checked
                    });
                    form.applyState();
                    interactive.onInput({ "immediate": true });
                };
                checkbox.onblur = function () {
                    interactive.onBlur();
                };
                label.appendChild(checkbox);
                var text = document.createTextNode(row.text);
                label.append(text);
                interactive.element = label;
                interactive.checkbox = checkbox;
                interactive.canFocus = function () {
                    return false;
                };
                interactive.focus = function () {
                    interactive.checkbox.focus();
                };
                interactive.save = function () {
                    var value = checkbox.checked;
                    var result = {};
                    result[row.field] = value;
                    return result;
                };
                return interactive;
            },
            "table": function () {
                var interactive = new Interactive();
                interactive.apply = function (row) {
                    interactive.row = row;
                    var table = interactive.table;
                    table.disabled = !row.enabled;
                    table.load(row.value || []);
                };
                var table = new Table({
                    name: row.field,
                    form: form,
                    theme: form.theme + "_form_item_tabular",
                    item: row.data,
                    onInput: function () {
                        interactive.onInput();
                    }
                });
                var element = table.create();
                interactive.element = element;
                interactive.table = table;
                interactive.canFocus = function () {
                    return false;
                };
                interactive.focus = function () {
                    interactive.table.focus();
                };
                interactive.save = function () {
                    var value = table.save();
                    var result = {};
                    result[row.field] = value;
                    return result;
                };
                return interactive;
            }
        };
        if (form.plugins && form.plugins[row.type]) {
            return form.plugins[row.type](row);
        }
        return views[row.type]();
    };
    Form.prototype._createInteractiveTime = function (row) {
        var form = this;
        var interactive = new Interactive();
        interactive.apply = function (row) {
            interactive.row = row;
            var searchable = interactive.searchable;
            searchable.disabled = !row.enabled;
            searchable.select(row.value);
        };
        var data = [];
        var interval = row.data.timeInterval || 15;
        var allowedIntervals = [1, 5, 10, 15, 20, 30, 60];
        if (!allowedIntervals.includes(interval)) {
            interval = 15;
        }
        var perHour = 60 / interval;
        var localeStr = row.data.locale || form.locale;
        var locale = DayPilot.Locale.find(localeStr) || DayPilot.Locale.US;
        var date = DayPilot.Date.today();
        for (var i = 0; i < 24 * perHour; i++) {
            var time = date.addMinutes(interval * i);
            var item = {};
            item.name = time.toString(row.data.timeFormat || locale.timePattern, locale);
            item.id = time.toString("HH:mm");
            data.push(item);
        }
        var searchable = new Searchable({
            data: data,
            name: row.field,
            theme: form.theme + "_form_item_time",
            listZIndex: form.zIndex + 1,
            strategy: "startsWith",
            onSelect: function (args) {
                if (args.ui) {
                    interactive.onInput({ "immediate": true });
                }
            }
        });
        var element = searchable.create();
        interactive.element = element;
        interactive.searchable = searchable;
        interactive.canFocus = function () {
            return !interactive.searchable.disabled;
        };
        interactive.focus = function () {
            interactive.searchable.focus();
        };
        interactive.save = function () {
            var value = searchable.selected && searchable.selected.id;
            var result = {};
            result[row.field] = value;
            return result;
        };
        return interactive;
    };
    Form.prototype._createInteractiveDateTime = function (row) {
        var form = this;
        var interactive = new Interactive();
        interactive.apply = function (row) {
            interactive.row = row;
            var searchable = interactive.searchable;
            searchable.disabled = !row.enabled;
            var timePart = new DayPilot.Date(row.value).toString("HH:mm");
            searchable.select(timePart);
            var input = interactive.dateInput;
            var picker = interactive.picker;
            if (row.data.dateFormat) {
                picker.pattern = row.data.dateFormat;
            }
            var localeStr = row.data.locale || form.locale;
            if (localeStr) {
                var locale = DayPilot.Locale.find(localeStr) || DayPilot.Locale.US;
                picker.locale = localeStr;
                picker.pattern = locale.datePattern;
            }
            input.disabled = !row.enabled;
            picker.date = new DayPilot.Date(row.value);
            var formatted = new DayPilot.Date(row.value).toString(row.data.dateFormat || picker.pattern, picker.locale);
            input.value = formatted;
        };
        var dateElement = (function createDatePicker() {
            var input = document.createElement("input");
            input.name = row.field;
            var picker = new DayPilot.DatePicker({
                target: input,
                theme: "navigator_modal",
                zIndex: form.zIndex + 1,
                resetTarget: false,
                targetAlignment: "left",
                onTimeRangeSelect: function () {
                    interactive.onInput({ "immediate": true });
                }
            });
            input.picker = picker;
            input.className = form.theme + "_input_date";
            input.type = "text";
            input.onkeydown = function (e) {
                var letcontinue = false;
                switch (e.keyCode) {
                    case 13:
                        if (picker.visible) {
                            picker.close();
                        }
                        else {
                            form.doOnKey("Enter");
                        }
                        break;
                    case 27:
                        if (picker.visible) {
                            picker.close();
                        }
                        else {
                            form.doOnKey("Escape");
                        }
                        break;
                    case 9:
                        picker.close();
                        letcontinue = true;
                        break;
                    default:
                        letcontinue = true;
                        break;
                }
                if (!letcontinue) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            };
            input.onfocus = function () {
                picker.show();
            };
            input.onclick = function () {
                picker.show();
            };
            input.oninput = function () {
                interactive.onInput();
            };
            input.onblur = function () {
                interactive.onBlur();
            };
            interactive.dateInput = input;
            interactive.picker = picker;
            return input;
        })();
        var timeElement = (function createTimePicker() {
            var data = [];
            var interval = row.data.timeInterval || 15;
            var allowedIntervals = [1, 5, 10, 15, 20, 30, 60];
            if (!allowedIntervals.includes(interval)) {
                interval = 15;
            }
            var perHour = 60 / interval;
            var localeStr = row.data.locale || form.locale;
            var locale = DayPilot.Locale.find(localeStr) || DayPilot.Locale.US;
            var date = DayPilot.Date.today();
            for (var i = 0; i < 24 * perHour; i++) {
                var time = date.addMinutes(interval * i);
                var item = {};
                item.name = time.toString(row.data.timeFormat || locale.timePattern, locale);
                item.id = time.toString("HH:mm");
                data.push(item);
            }
            var searchable = new Searchable({
                data: data,
                name: row.field,
                theme: form.theme + "_form_item_time",
                listZIndex: form.zIndex + 1,
                strategy: "startsWith",
                onSelect: function (args) {
                    if (args.ui) {
                        interactive.onInput({ "immediate": true });
                    }
                }
            });
            interactive.searchable = searchable;
            return searchable.create();
        })();
        var element = document.createElement("div");
        element.className = form.theme + "_form_item_datetime_parent";
        element.appendChild(dateElement);
        element.appendChild(timeElement);
        interactive.element = element;
        interactive.canFocus = function () {
            return !interactive.searchable.disabled;
        };
        interactive.focus = function () {
            interactive.dateInput.focus();
        };
        interactive.save = function () {
            var timeValue = interactive.searchable.selected && interactive.searchable.selected.id;
            var dateValue = interactive.picker.date ? interactive.picker.date.toString() : null;
            var date = new DayPilot.Date(dateValue).getDatePart();
            var value = DayPilot.Date.parse(date.toString("yyyy-dd-MM ") + timeValue, "yyyy-dd-MM HH:mm");
            var result = {};
            result[row.field] = value;
            return result;
        };
        return interactive;
    };
    Form.prototype.findRowsByField = function (field) {
        return this._rows.filter(function (row) {
            return row.field === field;
        });
    };
    Form.prototype.findViewById = function (id, value) {
        return this._views.find(function (v) {
            if (v.row.field === id) {
                if (v.row.type === "radio") {
                    return v.row.resolved === value;
                }
                else {
                    return true;
                }
            }
            return false;
        });
    };
    Form.prototype.firstFocusable = function () {
        return this._views.find(function (v) {
            return v.canFocus && v.canFocus();
        });
    };
    Form.prototype.updateState = function (row, props) {
        var source = this._newRows ? this._newRows : this._rows;
        var index = source.indexOf(row);
        this._newRows = source.map(function (srow) {
            if (srow !== row) {
                return srow;
            }
            if (row.propsEqual(props)) {
                return row;
            }
            var cloned = row.clone();
            for (var name_8 in props) {
                cloned[name_8] = props[name_8];
            }
            return cloned;
        });
        return this._newRows[index];
    };
    Form.prototype.updateInteractive = function (row) {
        var index = this._newRows.indexOf(row);
        this._views[index].apply(row);
    };
    Form.prototype.applyState = function () {
        var form = this;
        this.updateDependentState();
        if (!this._newRows) {
            return;
        }
        var dirtyRows = this._newRows.filter(function (row, i) {
            return form._rows[i] !== row;
        });
        dirtyRows.forEach(function (row) {
            form.updateInteractive(row);
        });
        this._rows = this._newRows;
        this._newRows = null;
    };
    Form.prototype.getFieldType = function (item) {
        var known = ["text", "date", "select", "searchable", "radio", "checkbox", "table", "title", "image", "html", "textarea", "scrollable", "time", "datetime"];
        if (known.indexOf(item.type) !== -1) {
            return item.type;
        }
        if (item.type && this.plugins && this.plugins[item.type]) {
            return item.type;
        }
        if (item.image) {
            return "image";
        }
        if (item.html || item.text) {
            return "html";
        }
        if (!item.id) {
            return "title";
        }
        if (item.options) {
            return "searchable";
        }
        if (item.dateFormat) {
            return "date";
        }
        if (item.columns) {
            return "table";
        }
        return "text";
    };
    Form.prototype.serialize = function () {
        var result = {};
        this._views.forEach(function (interactive) {
            var out = interactive.save();
            for (var name_9 in out) {
                result[name_9] = out[name_9];
            }
        });
        return result;
    };
    function RowModel() {
        this.id = this.guid();
        this.field = null;
        this.data = null;
        this.type = null;
        this.level = 0;
        this.enabled = true;
        this.value = null;
        this.text = null;
        this.interactive = true;
        this.isValue = false;
        this.checked = false;
        this.resolved = null;
    }
    RowModel.prototype.clone = function () {
        var rm = new RowModel();
        for (var name_10 in this) {
            if (name_10 === "id") {
                continue;
            }
            rm[name_10] = this[name_10];
        }
        return rm;
    };
    RowModel.prototype.propsEqual = function (props) {
        for (var name_11 in props) {
            if (this[name_11] !== props[name_11]) {
                return false;
            }
        }
        return true;
    };
    RowModel.prototype.guid = function () {
        var S4 = function () {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        };
        return ("" + S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
    };
    RowModel.prototype.applyValue = function (name, value) {
        if (this.field !== name) {
            return;
        }
        this.value = value;
        if (this.isValue && value === this.resolved) {
            this.checked = true;
        }
    };
    function Interactive() {
        this.element = null;
        this.canFocus = function () {
            return false;
        };
        this.apply = function () {
        };
        this.focus = function () {
        };
        this.save = function () {
            return {};
        };
    }
    function flatten(object, result, prefix) {
        result = result || {};
        prefix = prefix || "";
        for (var name_12 in object) {
            var src = object[name_12];
            if (typeof src === "object") {
                if (Object.prototype.toString.call(src) === '[object Array]') {
                    result[prefix + name_12] = src;
                }
                else if (src && src.toJSON) {
                    result[prefix + name_12] = src.toJSON();
                }
                else {
                    flatten(src, result, prefix + name_12 + ".");
                }
            }
            else {
                result[prefix + name_12] = src;
            }
        }
        return result;
    }
    DayPilot.Modal.Experimental = {};
    DayPilot.Modal.Experimental.Form = Form;
    function Searchable(options) {
        this.data = [];
        this.name = null;
        this.theme = "searchable_default";
        this._disabled = false;
        this.listZIndex = 100000;
        this.onSelect = null;
        this._selected = null;
        this._highlighted = null;
        this._collapsed = false;
        this._input = null;
        this._list = null;
        this._options = [];
        this._hidden = null;
        options = options || {};
        var t = this;
        var specialHandling = {
            "selected": {
                post: function (val) {
                    if (typeof val === "object" && val.id) {
                        t._selected = val;
                    }
                    else if (typeof val === "string" || typeof val === "number") {
                        t.select(val);
                    }
                }
            }
        };
        Object.defineProperty(this, "selected", {
            get: function () {
                return this._selected;
            },
        });
        Object.defineProperty(this, "disabled", {
            get: function () {
                return this._disabled;
            },
            set: function (val) {
                this._disabled = val;
                if (this._input) {
                    this._input.disabled = val;
                    if (val) {
                        this._cancel();
                    }
                }
            }
        });
        for (var name_13 in options) {
            if (!specialHandling[name_13]) {
                this[name_13] = options[name_13];
            }
        }
        for (var name_14 in options) {
            if (specialHandling[name_14]) {
                specialHandling[name_14].post(options[name_14]);
            }
        }
    }
    Searchable.prototype.select = function (id) {
        this._selected = this.data.find(function (item) { return item.id === id; });
        this._doOnSelect(false);
        return this;
    };
    Searchable.prototype.create = function () {
        var component = this;
        var t = this;
        var div = document.createElement("div");
        div.className = this.theme + "_main";
        div.style.position = "relative";
        var icon = document.createElement("div");
        icon.className = this.theme + "_icon";
        icon.style.position = "absolute";
        icon.style.right = "0";
        icon.style.top = "0";
        icon.style.bottom = "0";
        icon.style.width = "20px";
        icon.addEventListener("mousedown", function (ev) {
            ev.preventDefault();
            if (component._collapsed) {
                component.focus();
                expand();
            }
            else {
                cancel();
                collapse();
            }
        });
        var list = document.createElement("div");
        list.className = this.theme + "_list";
        list.style.display = "none";
        list.style.position = "absolute";
        list.style.zIndex = this.listZIndex;
        var hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = this.name;
        hidden.searchable = t;
        this._hidden = hidden;
        var input = document.createElement("input");
        input.type = "text";
        input.className = this.theme + "_input";
        input.disabled = this._disabled;
        input.addEventListener("click", function () {
            expand();
        });
        input.addEventListener("focus", function () {
            filter("all");
        });
        input.addEventListener("input", function () {
            filter();
        });
        input.addEventListener("blur", function () {
            input.removeAttribute("readonly");
            cancel();
        });
        input.addEventListener("keydown", function (ev) {
            if (component._collapsed) {
                if (ev.key === "Enter") {
                    return;
                }
                if (ev.key === "Esc" || ev.key === "Escape") {
                    return;
                }
                expand();
            }
            if (ev.key === "ArrowDown") {
                var index = t._options.indexOf(t._highlighted);
                if (index + 1 < t._options.length) {
                    t._highlighted = t._options[index + 1];
                }
                updateHiglight();
            }
            else if (ev.key === "ArrowUp") {
                var index = t._options.indexOf(t._highlighted);
                if (index - 1 >= 0) {
                    t._highlighted = t._options[index - 1];
                }
                updateHiglight();
            }
            else if (ev.key === "Enter") {
                if (component._highlighted) {
                    ev.stopPropagation();
                    selectOption(component._highlighted);
                }
                else {
                    ev.stopPropagation();
                    cancel();
                    collapse();
                }
            }
            else if (ev.key === "Esc" || ev.key === "Escape") {
                ev.stopPropagation();
                cancel();
                collapse();
            }
        });
        this._input = input;
        this._list = list;
        if (!this._selected) {
            this._selected = this.data[0];
            if (this._selected) {
                input.value = this._selected.name;
            }
        }
        function filter(strategy) {
            var defaultStrategy = component.strategy;
            if (component.strategy !== "includes" && component.strategy !== "startsWith") {
                defaultStrategy = "includes";
            }
            strategy = strategy || defaultStrategy || "includes";
            list.style.display = "";
            list.style.top = input.offsetHeight + "px";
            list.style.left = "0px";
            list.style.width = input.offsetWidth + "px";
            list.innerHTML = "";
            list.addEventListener("mousedown", function (ev) {
                ev.preventDefault();
            });
            component._highlighted = null;
            component._options = [];
            var first = null;
            component.data.forEach(function (item) {
                var name = item.name || item.id;
                if (strategy === "includes") {
                    if (name.toLowerCase().indexOf(input.value.toLowerCase()) === -1) {
                        return;
                    }
                }
                else if (strategy === "startsWith") {
                    if (name.toLowerCase().indexOf(input.value.toLowerCase()) !== 0) {
                        return;
                    }
                }
                else if (strategy === "all") {
                }
                var option = document.createElement("div");
                option.className = component.theme + "_list_item";
                option.innerText = name;
                option.item = item;
                if (item === component._selected) {
                    component._highlighted = option;
                }
                if (!first) {
                    first = option;
                }
                option.addEventListener("mousedown", function (ev) {
                    selectOption(option);
                    ev.preventDefault();
                });
                option.addEventListener("mousemove", function () {
                    if (component._highlighted === option) {
                        return;
                    }
                    component._highlighted = option;
                    updateHiglight({ dontScroll: true });
                });
                list.appendChild(option);
                component._options.push(option);
            });
            if (!component._highlighted) {
                component._highlighted = first;
            }
            updateHiglight();
        }
        function updateHiglight(options) {
            options = options || {};
            var scrollIntoView = !options.dontScroll;
            var previous = document.querySelectorAll("." + component.theme + "_list_item_highlight");
            previous.forEach(function (p) {
                p.className = p.className.replace(component.theme + "_list_item_highlight", "");
            });
            if (component._highlighted) {
                component._highlighted.className += " " + component.theme + "_list_item_highlight";
                if (scrollIntoView && !isScrolledIntoView(component._highlighted, list)) {
                    component._highlighted.scrollIntoView();
                }
            }
        }
        function isScrolledIntoView(target, viewport) {
            var tRect = target.getBoundingClientRect();
            var vRect = viewport.getBoundingClientRect();
            return tRect.top >= vRect.top && tRect.bottom <= vRect.bottom;
        }
        function selectOption(option) {
            var item = option.item;
            component._selected = item;
            component._doOnSelect(true);
            hide();
            collapse();
        }
        function cancel() {
            component._cancel();
        }
        function hide() {
            component._hide();
        }
        function collapse() {
            component._collapsed = true;
            input.setAttribute("readonly", "readonly");
            input.focus();
        }
        function expand() {
            component._collapsed = false;
            input.removeAttribute("readonly");
            input.select();
            filter("all");
        }
        div.appendChild(input);
        div.appendChild(icon);
        div.appendChild(hidden);
        div.appendChild(list);
        return div;
    };
    Searchable.prototype._cancel = function () {
        this._hide();
        if (!this._selected) {
            this._input.value = "";
            this._doOnSelect(true);
        }
        else {
            this._input.value = this._selected.name;
        }
    };
    Searchable.prototype.focus = function () {
        this._collapsed = true;
        this._input.setAttribute("readonly", "readonly");
        this._input.focus();
        this._cancel();
    };
    Searchable.prototype._hide = function () {
        this._list.style.display = "none";
    };
    Searchable.prototype._doOnSelect = function (byUser) {
        this._hidden.value = this.selected ? this.selected.id : null;
        if (this._selected) {
            this._input.value = this._selected.name;
        }
        else {
            this._input.value = "";
        }
        if (typeof this.onSelect === "function") {
            var args = {
                control: this,
                ui: byUser
            };
            this.onSelect(args);
        }
    };
    function Table(options) {
        this.form = null;
        this.item = null;
        this.data = null;
        this.name = null;
        this.theme = "edit_table_default";
        this.onInput = null;
        this.nav = {};
        this._activeEdit = null;
        this._rows = [];
        options = options || {};
        for (var name_15 in options) {
            this[name_15] = options[name_15];
        }
    }
    Table.prototype.create = function () {
        var table = this;
        var div = document.createElement("div");
        div.className = this.theme + "_main";
        div.style.position = "relative";
        var hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = table.name;
        hidden.table = this;
        div.appendChild(hidden);
        var tableElement = document.createElement("div");
        tableElement.className = this.theme + "_table";
        var header = this._createHeader();
        tableElement.appendChild(header);
        var spacerRow = table._createRowState({});
        spacerRow.spacer = true;
        var spacer = this._renderRow(spacerRow);
        spacer.classList.add(table.theme + "_spacer");
        tableElement.appendChild(spacer);
        var body = document.createElement("div");
        body.className = table.theme + "_tbody";
        tableElement.appendChild(body);
        div.appendChild(tableElement);
        var after = document.createElement("div");
        div.appendChild(after);
        this.nav.body = body;
        this.nav.table = tableElement;
        this.nav.main = div;
        this.nav.after = after;
        var add = document.createElement("div");
        var plus = document.createElement("span");
        plus.className = this.theme + "_plus";
        plus.addEventListener("click", function () {
            if (table.disabled) {
                return;
            }
            var generate = table.item.onNewRow;
            var value = {};
            if (typeof generate === "function") {
                var args = {};
                args.result = table.form.serialize();
                args.value = {};
                generate(args);
                value = args.value;
            }
            var row = table._createRowState(value);
            table._rows.push(row);
            table._render();
            table._doOnInput();
        });
        this.nav.plus = plus;
        add.appendChild(plus);
        div.appendChild(add);
        return div;
    };
    Table.prototype._createHeader = function () {
        var table = this;
        var row = document.createElement("div");
        row.classList.add(this.theme + "_row");
        row.classList.add(this.theme + "_header");
        this.item.columns.forEach(function (item) {
            var cell = document.createElement("div");
            cell.classList.add(table.theme + "_cell");
            cell.innerText = item.name;
            row.appendChild(cell);
        });
        return row;
    };
    Table.prototype._maxRowsReached = function () {
        var max = this.item.max || 0;
        if (max && this._rows.length >= max) {
            return true;
        }
        return false;
    };
    Table.prototype.save = function () {
        var table = this;
        var data = [];
        table._rows.forEach(function (row) {
            var item = {};
            row.cells.forEach(function (cell) {
                item[cell.id] = cell.value;
            });
            data.push(item);
        });
        return data;
    };
    Table.prototype.load = function (data) {
        var isArray = Object.prototype.toString.call(data) === '[object Array]';
        if (!isArray) {
            throw new Error("Array expected");
        }
        this.data = data;
        this._createState();
        this._render();
    };
    Table.prototype._updateCss = function () {
        if (this.disabled) {
            this.nav.main.classList.add(this.theme + "_disabled");
        }
        else {
            this.nav.main.classList.remove(this.theme + "_disabled");
        }
        var maxReached = this._maxRowsReached();
        if (maxReached) {
            this.nav.plus.classList.add(this.theme + "_plus_max");
        }
        else {
            this.nav.plus.classList.remove(this.theme + "_plus_max");
        }
    };
    Table.prototype._createState = function () {
        var table = this;
        this._rows = [];
        this.data.forEach(function (dataRow) {
            var row = table._createRowState(dataRow);
            table._rows.push(row);
        });
    };
    Table.prototype._removeRow = function (row) {
        var table = this;
        var index = table._rows.indexOf(row);
        table._rows.splice(index, 1);
    };
    Table.prototype._createRowState = function (dataRow) {
        var table = this;
        var row = {};
        row.data = dataRow;
        row.cells = [];
        table.item.columns.forEach(function (formItem) {
            var id = formItem.id;
            var value = dataRow[id];
            var type = table._formItemType(formItem);
            if (typeof value === "undefined") {
                if (type === "text") {
                    value = "";
                }
                else if (type === "number") {
                    value = 0;
                }
                else if (type === "select") {
                    var options = formItem.options;
                    value = options && options[0].id;
                }
            }
            var cell = {};
            cell.id = id;
            cell.value = value;
            cell.type = type;
            cell.data = formItem;
            row.cells.push(cell);
        });
        return row;
    };
    Table.prototype._formItemType = function (formItem) {
        var type = formItem.type;
        if (!type) {
            if (formItem.options) {
                type = "select";
            }
            else {
                type = "text";
            }
        }
        return type;
    };
    Table.prototype._render = function () {
        var table = this;
        this.nav.body.innerHTML = "";
        this.nav.after.innerHTML = "";
        this._rows.forEach(function (row) {
            var el = table._renderRow(row);
            table.nav.body.appendChild(el);
        });
        if (this._rows.length === 0) {
            var el = table._renderEmpty();
            table.nav.after.appendChild(el);
        }
        this._updateCss();
    };
    Table.prototype._renderEmpty = function () {
        var div = document.createElement("div");
        div.className = this.theme + "_empty";
        return div;
    };
    Table.prototype._renderRow = function (row) {
        var table = this;
        var el = document.createElement("div");
        el.className = table.theme + "_row";
        row.cells.forEach(function (cell) {
            var cellEl = document.createElement("div");
            cellEl.className = table.theme + "_cell";
            var interactive = table._renderCell(cell);
            if (row.spacer) {
                var wrap = document.createElement("div");
                wrap.style.height = "0px";
                wrap.style.overflow = "hidden";
                wrap.appendChild(interactive);
                cellEl.appendChild(wrap);
            }
            else {
                cellEl.appendChild(interactive);
            }
            el.appendChild(cellEl);
        });
        var cell = document.createElement("div");
        cell.classList.add(table.theme + "_cell");
        cell.classList.add(table.theme + "_rowaction");
        var span = document.createElement("span");
        span.className = this.theme + "_delete";
        span.addEventListener("click", function () {
            if (table.disabled) {
                return;
            }
            table._removeRow(row);
            table._render();
            table._doOnInput();
        });
        if (!row.spacer) {
            cell.appendChild(span);
        }
        el.appendChild(cell);
        return el;
    };
    Table.prototype._doOnInput = function () {
        var table = this;
        if (typeof table.onInput === "function") {
            var args = {};
            table.onInput(args);
        }
    };
    Table.prototype._renderCell = function (cell) {
        var table = this;
        var type = cell.type;
        if (type === "text" || type === "number") {
            var input = document.createElement("input");
            input.type = type;
            if (table.disabled) {
                input.disabled = true;
            }
            if (cell.value) {
                input.value = cell.value;
            }
            input.addEventListener("keyup", function () {
                if (type === "number") {
                    cell.value = Number(this.value);
                }
                else {
                    cell.value = this.value;
                }
                table._doOnInput();
            });
            return input;
        }
        else if (type === "select") {
            var select_1 = document.createElement("select");
            if (table.disabled) {
                select_1.disabled = true;
            }
            cell.data.options.forEach(function (item) {
                var option = document.createElement("option");
                option.innerText = item.name;
                option.value = item.id;
                option._originalValue = item.id;
                select_1.appendChild(option);
                if (cell.value === item.id) {
                    option.setAttribute("selected", true);
                }
            });
            select_1.addEventListener("change", function () {
                var option = select_1.options[select_1.selectedIndex];
                if (option && typeof option._originalValue !== "undefined") {
                    cell.value = option._originalValue;
                }
                table._doOnInput();
            });
            return select_1;
        }
        throw new Error("Unsupported item type: " + type);
    };
    Table.prototype.focus = function () {
    };
})(DayPilot);
"use strict";
(function (DayPilot) {
    'use strict';
    if (typeof DayPilot.Month !== 'undefined' && DayPilot.Month.events) {
        return;
    }
    var DayPilotMonth = {};
    var isVueVNode = DayPilot.Util.isVueVNode;
    DayPilotMonth.Month = function (placeholder, options) {
        this.v = '${v}';
        this.nav = {};
        var calendar = this;
        this.id = placeholder;
        this.isMonth = true;
        this.api = 2;
        this.backendUrl = null;
        this.cellHeaderHeight = 24;
        this.cellHeight = 100;
        this.cellMarginBottom = 0;
        this.contextMenu = null;
        this.cssClassPrefix = "month_default";
        this.eventBarVisible = true;
        this.eventBorderRadius = null;
        this.eventHeight = 25;
        this.eventsLoadMethod = "GET";
        this.headerHeight = 30;
        this.hideUntilInit = true;
        this.lineSpace = 1;
        this.locale = "en-us";
        this.showToolTip = true;
        this.startDate = new DayPilot.Date();
        this.theme = null;
        this.visible = true;
        this.weekStarts = "Auto";
        this.width = '100%';
        this.xssProtection = "Enabled";
        this.afterRender = function () { };
        this.cellHeaderClickHandling = "Enabled";
        this.eventClickHandling = "Enabled";
        this.eventDeleteHandling = "Disabled";
        this.eventMoveHandling = "Update";
        this.eventResizeHandling = "Update";
        this.eventRightClickHandling = "ContextMenu";
        this.headerClickHandling = "Enabled";
        this.timeRangeSelectedHandling = "Enabled";
        this.onCellHeaderClick = null;
        this.onCellHeaderClicked = null;
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
        this.onTimeRangeSelect = null;
        this.onTimeRangeSelected = null;
        this.onBeforeEventRender = null;
        this.onBeforeCellRender = null;
        this.cellEvents = [];
        this.elements = {};
        this.elements.events = [];
        this.cache = {};
        this._disposed = false;
        this._resolved = {};
        var resolved = this._resolved;
        this._updateView = function (json) {
            var result = JSON.parse(json);
            if (result.CallBackRedirect) {
                document.location.href = result.CallBackRedirect;
                return;
            }
            if (result.UpdateType === "None") {
                calendar.fireAfterRenderDetached(result.CallBackData, true);
                return;
            }
            calendar.events.list = result.Events;
            if (result.UpdateType === "Full") {
                calendar.startDate = result.StartDate;
                calendar.timeFormat = result.TimeFormat ? result.TimeFormat : calendar.timeFormat;
                if (typeof result.WeekStarts !== 'undefined') {
                    calendar.weekStarts = result.WeekStarts;
                }
                calendar.hashes = result.Hashes;
            }
            calendar._deleteEvents();
            calendar._prepareRows();
            calendar._loadEvents();
            if (result.UpdateType === "Full") {
                calendar._clearTable();
                calendar._drawTable();
            }
            calendar._updateHeight();
            calendar.show();
            calendar._drawEvents();
            calendar.fireAfterRenderDetached(result.CallBackData, true);
        };
        this.fireAfterRenderDetached = function (data, isCallBack) {
            var afterRenderDelayed = function (data, isc) {
                return function () {
                    if (calendar.afterRender) {
                        calendar.afterRender(data, isc);
                    }
                };
            };
            window.setTimeout(afterRenderDelayed(data, isCallBack), 0);
        };
        this.lineHeight = function () {
            return this.eventHeight + this.lineSpace;
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
                throw "DayPilot.Month.events.add() expects an object or DayPilot.Event instance.";
            }
            if (!calendar.events.list) {
                calendar.events.list = [];
            }
            calendar.events.list.push(data);
            calendar.update();
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
            calendar.update();
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
            calendar.update();
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
                        calendar.update();
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
        this.events.forRange = function (start, end) {
            start = new DayPilot.Date(start);
            end = new DayPilot.Date(end);
            var events = (calendar.events.list || []).map(function (data) { return new DayPilot.Event(data); });
            events.sort(calendar._eventComparer);
            return events.filter(function (e) {
                var estart = e.start();
                var eend = e.end();
                var startPointOnly = estart === eend && estart === start;
                return startPointOnly || DayPilot.Util.overlaps(start, end, estart, eend);
            });
        };
        this.update = function (options) {
            calendar._loadOptions(options);
            if (!this._initialized) {
                return;
            }
            if (calendar._disposed) {
                throw new DayPilot.Exception("You are trying to update a DayPilot.Month instance that has been disposed.");
            }
            if (!this.cells) {
                return;
            }
            var full = true;
            calendar._deleteEvents();
            calendar._prepareRows();
            calendar._loadEvents();
            if (full) {
                calendar._clearTable();
                calendar._drawTable();
            }
            calendar._updateHeight();
            calendar._show();
            calendar._drawEvents();
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
        this._cache = {};
        this._cache.events = [];
        this._doBeforeEventRender = function (i) {
            var cache = this._cache.events;
            var data = this.events.list[i];
            var evc = {};
            for (var name_3 in data) {
                evc[name_3] = data[name_3];
            }
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
            if (!events) {
                return;
            }
            if (!DayPilot.isArray(events)) {
                throw new DayPilot.Exception("DayPilot.Month.events.list expects an array object. You supplied: " + (typeof events));
            }
            if (typeof this.onBeforeEventRender === 'function') {
                for (var i = 0; i < events.length; i++) {
                    this._doBeforeEventRender(i);
                }
            }
            for (var x = 0; x < events.length; x++) {
                var data = events[x];
                if (typeof data !== "object") {
                    throw new DayPilot.Exception("Event data item must be an object");
                }
                if (!data.start) {
                    throw new DayPilot.Exception("Event data item must specify 'start' property");
                }
                if (!data.end) {
                    throw new DayPilot.Exception("Event data item must specify 'end' property");
                }
                var start = new DayPilot.Date(data.start);
                var end = new DayPilot.Date(data.end);
                if (start.getTime() > end.getTime()) {
                    continue;
                }
                for (var i = 0; i < this.rows.length; i++) {
                    var row = this.rows[i];
                    var ep = new DayPilot.Event(data, this);
                    if (row.belongsHere(ep)) {
                        row.events.push(ep);
                        if (typeof this.onBeforeEventRender === 'function') {
                            ep.cache = this._cache.events[x];
                        }
                    }
                }
            }
            for (var ri = 0; ri < this.rows.length; ri++) {
                var row = this.rows[ri];
                row.events.sort(this._eventComparer);
                for (var ei = 0; ei < this.rows[ri].events.length; ei++) {
                    var ev = row.events[ei];
                    var colStart = row.getStartColumn(ev);
                    var colWidth = row.getWidth(ev);
                    row.putIntoLine(ev, colStart, colWidth, ri);
                }
            }
        };
        this._deleteEvents = function () {
            for (var i = 0; i < this.elements.events.length; i++) {
                var e = this.elements.events[i];
                calendar._deleteEvent(e);
            }
            this.elements.events = [];
        };
        this._deleteEvent = function (div) {
            (function domRemove() {
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
            div.event = null;
            div.click = null;
            div.parentNode.removeChild(div);
        };
        this._drawEvents = function () {
            this._drawEventsRows();
        };
        this._drawEventsRows = function () {
            this.elements.events = [];
            for (var ri = 0; ri < this.rows.length; ri++) {
                var row = this.rows[ri];
                for (var li = 0; li < row.lines.length; li++) {
                    var line = row.lines[li];
                    for (var pi = 0; pi < line.length; pi++) {
                        this._drawEvent(line[pi]);
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
        this.drawShadow = function (x, y, line, width, offset) {
            if (!offset) {
                offset = 0;
            }
            var remains = width;
            this.shadow = {};
            this.shadow.list = [];
            this.shadow.start = { x: x, y: y };
            this.shadow.width = width;
            var hidden = y * 7 + x - offset;
            if (hidden < 0) {
                remains += hidden;
                x = 0;
                y = 0;
            }
            var remainingOffset = offset;
            while (remainingOffset >= 7) {
                y--;
                remainingOffset -= 7;
            }
            if (remainingOffset > x) {
                var plus = 7 - this.getColCount();
                if (remainingOffset > (x + plus)) {
                    y--;
                    x = x + 7 - remainingOffset;
                }
                else {
                    remains = remains - remainingOffset + x;
                    x = 0;
                }
            }
            else {
                x -= remainingOffset;
            }
            if (y < 0) {
                y = 0;
                x = 0;
            }
            var cursor = null;
            if (DayPilotMonth.resizingEvent) {
                cursor = 'w-resize';
            }
            else if (DayPilotMonth.movingEvent) {
                cursor = "move";
            }
            this.nav.top.style.cursor = cursor;
            var eventBorderRadius = calendar.eventBorderRadius;
            if (typeof eventBorderRadius === "number") {
                eventBorderRadius += "px";
            }
            while (remains > 0 && y < this.rows.length) {
                var drawNow = Math.min(this.getColCount() - x, remains);
                var row = this.rows[y];
                var top_1 = this.getRowTop(y);
                var height = row.getHeight();
                var shadow = document.createElement("div");
                shadow.setAttribute("unselectable", "on");
                shadow.style.position = 'absolute';
                shadow.style.left = (this.getCellWidth() * x) + '%';
                shadow.style.width = (this.getCellWidth() * drawNow) + '%';
                shadow.style.top = (top_1) + 'px';
                shadow.style.height = (height) + 'px';
                shadow.style.cursor = cursor;
                shadow.classList.add(calendar._prefixCssClass("_shadow"));
                var inside = document.createElement("div");
                inside.setAttribute("unselectable", "on");
                shadow.appendChild(inside);
                inside.style.position = "absolute";
                inside.style.top = "0px";
                inside.style.right = "0px";
                inside.style.left = "0px";
                inside.style.bottom = "0px";
                inside.classList.add(calendar._prefixCssClass("_shadow_inner"));
                if (eventBorderRadius) {
                    if (remains === width) {
                        shadow.style.borderTopLeftRadius = eventBorderRadius;
                        shadow.style.borderBottomLeftRadius = eventBorderRadius;
                        inside.style.borderTopLeftRadius = eventBorderRadius;
                        inside.style.borderBottomLeftRadius = eventBorderRadius;
                    }
                    if (remains <= drawNow) {
                        shadow.style.borderTopRightRadius = eventBorderRadius;
                        shadow.style.borderBottomRightRadius = eventBorderRadius;
                        inside.style.borderTopRightRadius = eventBorderRadius;
                        inside.style.borderBottomRightRadius = eventBorderRadius;
                    }
                }
                this.nav.top.appendChild(shadow);
                this.shadow.list.push(shadow);
                remains -= (drawNow + 7 - this.getColCount());
                x = 0;
                y++;
            }
        };
        this.clearShadow = function () {
            if (this.shadow) {
                for (var i = 0; i < this.shadow.list.length; i++) {
                    this.nav.top.removeChild(this.shadow.list[i]);
                }
                this.shadow = null;
                this.nav.top.style.cursor = '';
            }
        };
        this.getEventTop = function (row, line) {
            var top = this.headerHeight;
            for (var i = 0; i < row; i++) {
                top += this.rows[i].getHeight();
            }
            top += this.cellHeaderHeight;
            top += line * this.lineHeight();
            return top;
        };
        this.getDateFromCell = function (x, y) {
            return this.firstDate.addDays(y * 7 + x);
        };
        this._drawEvent = function (e) {
            var data = e.cache || e.data;
            var eventBorderRadius = data.borderRadius || calendar.eventBorderRadius;
            if (typeof eventBorderRadius === "number") {
                eventBorderRadius += "px";
            }
            var row = e.part.row;
            var line = e.part.line;
            var colStart = e.part.colStart;
            var colWidth = e.part.colWidth;
            var left = this.getCellWidth() * (colStart);
            var width = this.getCellWidth() * (colWidth);
            var top = this.getEventTop(row, line);
            var div = document.createElement("div");
            div.setAttribute("unselectable", "on");
            div.style.height = this.eventHeight + 'px';
            div.style.overflow = "hidden";
            div.className = this._prefixCssClass("_event");
            if (data.cssClass) {
                DayPilot.Util.addClass(div, data.cssClass);
            }
            if (!e.part.startsHere) {
                DayPilot.Util.addClass(div, this._prefixCssClass("_event_continueleft"));
            }
            if (!e.part.endsHere) {
                DayPilot.Util.addClass(div, this._prefixCssClass("_event_continueright"));
            }
            div.event = e;
            div.style.width = width + '%';
            div.style.position = 'absolute';
            div.style.left = left + '%';
            div.style.top = top + 'px';
            if (this.showToolTip && e.client.toolTip()) {
                div.title = e.client.toolTip();
            }
            div.onclick = calendar._eventClickDispatch;
            div.oncontextmenu = calendar._onEventContextMenu;
            div.onmousedown = function (ev) {
                ev = ev || window.event;
                var button = ev.which || ev.button;
                ev.cancelBubble = true;
                if (ev.stopPropagation) {
                    ev.stopPropagation();
                }
                if (button === 1) {
                    DayPilotMonth.movingEvent = null;
                    if (this.style.cursor === 'w-resize' || this.style.cursor === 'e-resize') {
                        var resizing = {};
                        resizing.start = {};
                        resizing.start.x = colStart;
                        resizing.start.y = row;
                        resizing.event = div.event;
                        resizing.width = DayPilot.DateUtil.daysSpan(resizing.event.start(), resizing.event.end()) + 1;
                        resizing.direction = this.style.cursor;
                        DayPilotMonth.resizingEvent = resizing;
                    }
                    else if (this.style.cursor === 'move' || e.client.moveEnabled()) {
                        calendar.clearShadow();
                        var coords = DayPilot.mo3(calendar.nav.top, ev);
                        if (!coords) {
                            return;
                        }
                        var cell = calendar.getCellBelowPoint(coords.x, coords.y);
                        var hidden = DayPilot.DateUtil.daysDiff(e.start(), calendar.rows[row].start);
                        var offset = (cell.y * 7 + cell.x) - (row * 7 + colStart);
                        if (hidden) {
                            offset += hidden;
                        }
                        var moving = {};
                        moving.start = {};
                        moving.start.x = colStart;
                        moving.start.y = row;
                        moving.start.line = line;
                        moving.offset = calendar.eventMoveToPosition ? 0 : offset;
                        moving.colWidth = colWidth;
                        moving.event = div.event;
                        moving.coords = coords;
                        DayPilotMonth.movingEvent = moving;
                    }
                }
            };
            div.onmousemove = function (ev) {
                if (typeof (DayPilotMonth) === 'undefined') {
                    return;
                }
                if (DayPilotMonth.movingEvent || DayPilotMonth.resizingEvent) {
                    return;
                }
                var offset = DayPilot.mo3(div, ev);
                if (!offset) {
                    return;
                }
                if (div.deleteIcon) {
                    div.deleteIcon.style.display = "";
                }
                var resizeMargin = 6;
                if (offset.x <= resizeMargin && e.client.resizeEnabled()) {
                    if (e.part.startsHere) {
                        div.style.cursor = "w-resize";
                        div.dpBorder = 'left';
                    }
                    else {
                        div.style.cursor = 'not-allowed';
                    }
                }
                else if (div.clientWidth - offset.x <= resizeMargin && e.client.resizeEnabled()) {
                    if (e.part.endsHere) {
                        div.style.cursor = "e-resize";
                        div.dpBorder = 'right';
                    }
                    else {
                        div.style.cursor = 'not-allowed';
                    }
                }
                else if (e.client.clickEnabled()) {
                    div.style.cursor = "pointer";
                }
                else {
                    div.style.cursor = 'default';
                }
            };
            div.onmouseleave = function () {
                if (div.deleteIcon) {
                    div.deleteIcon.style.display = "none";
                }
                div.style.cursor = '';
            };
            div.onmouseenter = function () {
                if (div.deleteIcon) {
                    div.deleteIcon.style.display = "";
                }
            };
            var inner = document.createElement("div");
            inner.setAttribute("unselectable", "on");
            inner.className = this._prefixCssClass("_event_inner");
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
                var bar = document.createElement("div");
                bar.setAttribute("unselectable", "on");
                bar.className = this._prefixCssClass("_event_bar");
                bar.style.position = "absolute";
                var barInner = document.createElement("div");
                barInner.setAttribute("unselectable", "on");
                barInner.className = this._prefixCssClass("_event_bar_inner");
                barInner.style.top = "0%";
                barInner.style.height = "100%";
                if (data.barColor) {
                    barInner.style.backgroundColor = data.barColor;
                }
                bar.appendChild(barInner);
                div.appendChild(bar);
            }
            if (e.client.deleteEnabled()) {
                var dheight = 18;
                var dwidth = 18;
                var dtop = Math.floor(calendar.eventHeight / 2 - dheight / 2);
                var del = document.createElement("div");
                del.style.position = "absolute";
                del.style.right = "2px";
                del.style.top = dtop + "px";
                del.style.width = dwidth + "px";
                del.style.height = dheight + "px";
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
                            calendar._vue._renderVueNode(args.element, target, { "style": { "flexGrow": 1 } });
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
            this.elements.events.push(div);
            this.nav.events.appendChild(div);
        };
        this.lastVisibleDayOfMonth = function () {
            return this.startDate.lastDayOfMonth();
        };
        this._prepareRows = function () {
            if (typeof this.startDate === 'string') {
                this.startDate = new DayPilot.Date(this.startDate);
            }
            this.startDate = this.startDate.firstDayOfMonth();
            this.firstDate = this.startDate.firstDayOfWeek(this.getWeekStart());
            var lastVisibleDayOfMonth = this.lastVisibleDayOfMonth();
            var count = DayPilot.DateUtil.daysDiff(this.firstDate, lastVisibleDayOfMonth) + 1;
            var rowCount = Math.ceil(count / 7);
            this.days = rowCount * 7;
            this.rows = [];
            var _loop_1 = function (x) {
                var r = {};
                r.start = this_1.firstDate.addDays(x * 7);
                r.end = r.start.addDays(this_1.getColCount());
                r.events = [];
                r.lines = [];
                r.index = x;
                r.minHeight = this_1.cellHeight;
                r.calendar = this_1;
                r.belongsHere = function (ev) {
                    if (ev.end().getTime() === ev.start().getTime() && ev.start().getTime() === this.start.getTime()) {
                        return true;
                    }
                    return !(ev.end().getTime() <= this.start.getTime() || ev.start().getTime() >= this.end.getTime());
                };
                r.getPartStart = function (ev) {
                    return DayPilot.DateUtil.max(this.start, ev.start());
                };
                r.getPartEnd = function (ev) {
                    return DayPilot.DateUtil.min(this.end, ev.end());
                };
                r.getStartColumn = function (ev) {
                    var partStart = this.getPartStart(ev);
                    return DayPilot.DateUtil.daysDiff(this.start, partStart);
                };
                r.getWidth = function (ev) {
                    return DayPilot.DateUtil.daysSpan(this.getPartStart(ev), this.getPartEnd(ev)) + 1;
                };
                r.putIntoLine = function (ev, colStart, colWidth, row) {
                    var thisRow = r;
                    for (var i = 0; i < this.lines.length; i++) {
                        var line_1 = this.lines[i];
                        if (line_1.isFree(colStart, colWidth)) {
                            line_1.addEvent(ev, colStart, colWidth, row, i);
                            return i;
                        }
                    }
                    var line = [];
                    line.isFree = function (colStart, colWidth) {
                        var free = true;
                        for (var i = 0; i < this.length; i++) {
                            if (!(colStart + colWidth - 1 < this[i].part.colStart || colStart > this[i].part.colStart + this[i].part.colWidth - 1)) {
                                free = false;
                            }
                        }
                        return free;
                    };
                    line.addEvent = function (ep, colStart, colWidth, row, index) {
                        ep.part.colStart = colStart;
                        ep.part.colWidth = colWidth;
                        ep.part.row = row;
                        ep.part.line = index;
                        ep.part.startsHere = thisRow.start.getTime() <= ep.start().getTime();
                        ep.part.endsHere = thisRow.end.getTime() >= ep.end().getTime();
                        this.push(ep);
                    };
                    line.addEvent(ev, colStart, colWidth, row, this.lines.length);
                    this.lines.push(line);
                    return this.lines.length - 1;
                };
                r.getHeight = function () {
                    return Math.max(this.lines.length * calendar.lineHeight() + calendar.cellHeaderHeight + calendar.cellMarginBottom, this.calendar.cellHeight);
                };
                this_1.rows.push(r);
            };
            var this_1 = this;
            for (var x = 0; x < rowCount; x++) {
                _loop_1(x);
            }
            this.endDate = this.firstDate.addDays(rowCount * 7);
        };
        this.visibleStart = function () {
            return calendar.firstDate;
        };
        this.visibleEnd = function () {
            return calendar.endDate;
        };
        this.getHeight = function () {
            var height = this.headerHeight;
            for (var i = 0; i < this.rows.length; i++) {
                height += this.rows[i].getHeight();
            }
            return height;
        };
        this.getWidth = function (start, end) {
            var diff = (end.y * 7 + end.x) - (start.y * 7 + start.x);
            return diff + 1;
        };
        this.getMinCoords = function (first, second) {
            if ((first.y * 7 + first.x) < (second.y * 7 + second.x)) {
                return first;
            }
            else {
                return second;
            }
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
        this._drawTop = function () {
            var relative = this.nav.top;
            relative.setAttribute("unselectable", "on");
            relative.style.MozUserSelect = 'none';
            relative.style.KhtmlUserSelect = 'none';
            relative.style.WebkitUserSelect = 'none';
            relative.style.position = 'relative';
            if (this.width) {
                relative.style.width = this.width;
            }
            relative.style.height = this.getHeight() + 'px';
            relative.onselectstart = function () { return false; };
            if (this.hideUntilInit) {
                relative.style.visibility = 'hidden';
            }
            if (!this.visible) {
                relative.style.display = "none";
            }
            relative.className = this._prefixCssClass("_main");
            var cells = document.createElement("div");
            this.nav.cells = cells;
            cells.style.position = "absolute";
            cells.style.left = "0px";
            cells.style.right = "0px";
            cells.setAttribute("unselectable", "on");
            relative.appendChild(cells);
            var events = document.createElement("div");
            this.nav.events = events;
            events.style.position = "absolute";
            events.style.left = "0px";
            events.style.right = "0px";
            events.setAttribute("unselectable", "on");
            relative.appendChild(events);
            relative.onmousemove = function (ev) {
                if (DayPilotMonth.resizingEvent) {
                    var coords = DayPilot.mo3(calendar.nav.top, ev);
                    if (!coords) {
                        return;
                    }
                    var cell = calendar.getCellBelowPoint(coords.x, coords.y);
                    calendar.clearShadow();
                    var resizing = DayPilotMonth.resizingEvent;
                    var width = void 0, start = void 0;
                    if (resizing.direction === 'w-resize') {
                        start = cell;
                        var endDate = resizing.event.end();
                        if (endDate.getDatePart() === endDate) {
                            endDate = endDate.addDays(-1);
                        }
                        var end = calendar.getCellFromDate(endDate);
                        width = calendar.getWidth(cell, end);
                    }
                    else {
                        start = calendar.getCellFromDate(resizing.event.start());
                        width = calendar.getWidth(start, cell);
                    }
                    if (width < 1) {
                        width = 1;
                    }
                    calendar.drawShadow(start.x, start.y, 0, width);
                }
                else if (DayPilotMonth.movingEvent) {
                    var coords = DayPilot.mo3(calendar.nav.top, ev);
                    if (!coords) {
                        return;
                    }
                    if (coords.x === DayPilotMonth.movingEvent.coords.x && coords.y === DayPilotMonth.movingEvent.coords.y) {
                        return;
                    }
                    var minDistance = 3;
                    var distance = Math.abs(coords.x - DayPilotMonth.movingEvent.coords.x) + Math.abs(coords.y - DayPilotMonth.movingEvent.coords.y);
                    if (distance <= minDistance) {
                        return;
                    }
                    var cell = calendar.getCellBelowPoint(coords.x, coords.y);
                    calendar.clearShadow();
                    var event_1 = DayPilotMonth.movingEvent.event;
                    var offset = DayPilotMonth.movingEvent.offset;
                    var width = calendar.cellMode ? 1 : DayPilot.DateUtil.daysSpan(event_1.start(), event_1.end()) + 1;
                    if (width < 1) {
                        width = 1;
                    }
                    calendar.drawShadow(cell.x, cell.y, 0, width, offset, event_1);
                }
                else if (DayPilotMonth.timeRangeSelecting) {
                    var coords = DayPilot.mo3(calendar.nav.top, ev);
                    if (!coords) {
                        return;
                    }
                    var cell = calendar.getCellBelowPoint(coords.x, coords.y);
                    calendar.clearShadow();
                    var start = DayPilotMonth.timeRangeSelecting;
                    var startIndex = start.y * 7 + start.x;
                    var cellIndex = cell.y * 7 + cell.x;
                    var width = Math.abs(cellIndex - startIndex) + 1;
                    if (width < 1) {
                        width = 1;
                    }
                    var shadowStart = startIndex < cellIndex ? start : cell;
                    DayPilotMonth.timeRangeSelecting.from = { x: shadowStart.x, y: shadowStart.y };
                    DayPilotMonth.timeRangeSelecting.width = width;
                    DayPilotMonth.timeRangeSelecting.moved = true;
                    calendar.drawShadow(shadowStart.x, shadowStart.y, 0, width, 0, null);
                }
            };
        };
        this._updateHeight = function () {
            this.nav.top.style.height = this.getHeight() + 'px';
            for (var x = 0; x < this.cells.length; x++) {
                for (var y = 0; y < this.cells[x].length; y++) {
                    this.cells[x][y].style.top = this.getRowTop(y) + 'px';
                    this.cells[x][y].style.height = this.rows[y].getHeight() + 'px';
                }
            }
        };
        this.getCellBelowPoint = function (x, y) {
            var columnWidth = Math.floor(this.nav.top.clientWidth / this.getColCount());
            var column = Math.min(Math.floor(x / columnWidth), this.getColCount() - 1);
            var row = null;
            var height = this.headerHeight;
            var relativeY = 0;
            for (var i = 0; i < this.rows.length; i++) {
                var baseHeight = height;
                height += this.rows[i].getHeight();
                if (y < height) {
                    relativeY = y - baseHeight;
                    row = i;
                    break;
                }
            }
            if (row === null) {
                row = this.rows.length - 1;
            }
            var cell = {};
            cell.x = column;
            cell.y = row;
            cell.relativeY = relativeY;
            return cell;
        };
        this.getCellFromDate = function (date) {
            var width = DayPilot.DateUtil.daysDiff(this.firstDate, date);
            var cell = { x: 0, y: 0 };
            while (width >= 7) {
                cell.y++;
                width -= 7;
            }
            cell.x = width;
            return cell;
        };
        this._drawTable = function () {
            var table = document.createElement("div");
            table.oncontextmenu = function () { return false; };
            this.nav.cells.appendChild(table);
            this.cells = [];
            for (var x = 0; x < this.getColCount(); x++) {
                this.cells[x] = [];
                var header = document.createElement("div");
                header.setAttribute("unselectable", "on");
                header.style.position = 'absolute';
                header.style.left = (this.getCellWidth() * x) + '%';
                header.style.width = (this.getCellWidth()) + '%';
                header.style.top = '0px';
                header.style.height = (this.headerHeight) + 'px';
                var dayIndex = x + this.getWeekStart();
                if (dayIndex > 6) {
                    dayIndex -= 7;
                }
                header.className = this._prefixCssClass("_header");
                var inner = document.createElement("div");
                inner.setAttribute("unselectable", "on");
                inner.innerHTML = resolved.locale().dayNames[dayIndex];
                header.appendChild(inner);
                inner.style.position = "absolute";
                inner.style.top = "0px";
                inner.style.bottom = "0px";
                inner.style.left = "0px";
                inner.style.right = "0px";
                inner.className = this._prefixCssClass("_header_inner");
                inner.innerHTML = resolved.locale().dayNames[dayIndex];
                table.appendChild(header);
                for (var y = 0; y < this.rows.length; y++) {
                    this._drawCell(x, y, table);
                }
            }
        };
        this._clearTable = function () {
            for (var x = 0; x < this.cells.length; x++) {
                for (var y = 0; y < this.cells[x].length; y++) {
                    var div = calendar.cells[x][y];
                    calendar._deleteCell(div);
                }
            }
            this.nav.cells.innerHTML = '';
        };
        this._deleteCell = function (div) {
            (function domRemove() {
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
            div.onclick = null;
        };
        this._api2 = function () {
            return calendar.api === 2;
        };
        this._drawCell = function (x, y, table) {
            var row = this.rows[y];
            var d = this.firstDate.addDays(y * 7 + x);
            var date = d.getDay();
            var headerHtml = null;
            if (date === 1) {
                headerHtml = resolved.locale().monthNames[d.getMonth()] + ' ' + date;
            }
            else {
                headerHtml = "" + date;
            }
            var business = !calendar.isWeekend(d);
            var cellInfo = {
                "start": d,
                "end": d.addDays(1),
                "properties": {
                    "headerHtml": headerHtml,
                    "backColor": null,
                    "business": business,
                    "html": null
                }
            };
            var args = {};
            args.control = calendar;
            args.cell = cellInfo;
            if (typeof calendar.onBeforeCellRender === "function") {
                calendar.onBeforeCellRender(args);
            }
            var props = args.cell.properties;
            var cell = document.createElement("div");
            cell.setAttribute("unselectable", "on");
            cell.style.position = 'absolute';
            cell.style.cursor = 'default';
            cell.style.left = (this.getCellWidth() * x) + '%';
            cell.style.width = (this.getCellWidth()) + '%';
            cell.style.top = (this.getRowTop(y)) + 'px';
            cell.style.height = (row.getHeight()) + 'px';
            cell.className = this._prefixCssClass("_cell");
            if (props.business) {
                var businessCss = this._prefixCssClass("_cell_business");
                DayPilot.Util.addClass(cell, businessCss);
            }
            var inner = document.createElement("div");
            inner.setAttribute("unselectable", "on");
            cell.appendChild(inner);
            inner.style.position = "absolute";
            inner.style.left = "0px";
            inner.style.right = "0px";
            inner.style.top = "0px";
            inner.style.bottom = "0px";
            inner.className = this._prefixCssClass("_cell_inner");
            if (props.backColor) {
                inner.style.backgroundColor = args.cell.properties.backColor;
            }
            cell.onmousedown = function () {
                if (calendar.timeRangeSelectedHandling !== 'Disabled') {
                    calendar.clearShadow();
                    DayPilotMonth.timeRangeSelecting = { "root": calendar, "x": x, "y": y, "from": { x: x, y: y }, "width": 1 };
                }
            };
            cell.onclick = function () {
                var single = function (d) {
                    var start = new DayPilot.Date(d);
                    var end = start.addDays(1);
                    calendar._timeRangeSelectedDispatch(start, end);
                };
                if (calendar.timeRangeSelectedHandling !== 'Disabled') {
                    single(d);
                    return;
                }
            };
            var day = document.createElement("div");
            day.setAttribute("unselectable", "on");
            day.style.height = this.cellHeaderHeight + "px";
            day.className = this._prefixCssClass("_cell_header");
            day.onclick = function (ev) {
                if (calendar.cellHeaderClickHandling !== "Enabled") {
                    return;
                }
                ev.stopPropagation();
                var args = {};
                args.control = calendar;
                args.start = d;
                args.end = d.addDays(1);
                args.preventDefault = function () {
                    this.preventDefault.value = true;
                };
                if (typeof calendar.onCellHeaderClick === "function") {
                    calendar.onCellHeaderClick(args);
                    if (args.preventDefault.value) {
                        return;
                    }
                }
                if (typeof calendar.onCellHeaderClicked === "function") {
                    calendar.onCellHeaderClicked(args);
                }
            };
            day.innerHTML = props.headerHtml;
            inner.appendChild(day);
            if (props.html) {
                var html = document.createElement("div");
                html.style.height = (row.getHeight() - this.cellHeaderHeight) + 'px';
                html.style.overflow = 'hidden';
                html.innerHTML = props.html;
                inner.appendChild(html);
            }
            (function domAdd() {
                if (typeof calendar.onBeforeCellDomAdd !== "function" && typeof calendar.onBeforeCellDomRemove !== "function") {
                    return;
                }
                var args = {};
                args.control = calendar;
                args.cell = cellInfo;
                args.element = null;
                cell.domArgs = args;
                if (typeof calendar.onBeforeCellDomAdd === "function") {
                    calendar.onBeforeCellDomAdd(args);
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
            })();
            this.cells[x][y] = cell;
            table.appendChild(cell);
        };
        this.getWeekStart = function () {
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
        this.getColCount = function () {
            return 7;
        };
        this.getCellWidth = function () {
            return 14.285;
        };
        this.getRowTop = function (index) {
            var top = this.headerHeight;
            for (var i = 0; i < index; i++) {
                top += this.rows[i].getHeight();
            }
            return top;
        };
        this._callBack2 = function (action, data, parameters) {
            var envelope = {};
            envelope.action = action;
            envelope.parameters = parameters;
            envelope.data = data;
            envelope.header = this._getCallBackHeader();
            var commandstring = "JSON" + JSON.stringify(envelope);
            if (this.backendUrl) {
                DayPilot.request(this.backendUrl, this._callBackResponse, commandstring, this.ajaxError);
            }
        };
        this._callBackResponse = function (response) {
            calendar._updateView(response.responseText);
        };
        this._getCallBackHeader = function () {
            var h = {};
            h.control = "dpm";
            h.id = this.id;
            h.v = this.v;
            h.visibleStart = new DayPilot.Date(this.firstDate);
            h.visibleEnd = h.visibleStart.addDays(this.days);
            h.startDate = calendar.startDate;
            h.timeFormat = this.timeFormat;
            h.weekStarts = this.weekStarts;
            return h;
        };
        this.eventClickCallBack = function (e, data) {
            this._callBack2('EventClick', data, e);
        };
        this._eventClickDispatch = function (e) {
            DayPilotMonth.movingEvent = null;
            DayPilotMonth.resizingEvent = null;
            var div = e.currentTarget;
            e.cancelBubble = true;
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            calendar.eventClickSingle(div, e);
        };
        this.eventClickSingle = function (div, ev) {
            var e = div.event;
            if (!e) {
                return;
            }
            if (!e.client.clickEnabled()) {
                return;
            }
            if (calendar._api2()) {
                var args_1 = {};
                args_1.e = e;
                args_1.control = calendar;
                args_1.div = div;
                args_1.originalEvent = ev;
                args_1.meta = ev.metaKey;
                args_1.ctrl = ev.ctrlKey;
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
                    case 'CallBack':
                        calendar.eventClickCallBack(e);
                        break;
                    case 'JavaScript':
                        calendar.onEventClick(e);
                        break;
                }
            }
        };
        this._onEventContextMenu = function (ev) {
            var e = ev.currentTarget;
            calendar._eventRightClickDispatch(e.event);
            return false;
        };
        this._eventRightClickDispatch = function (e) {
            this.event = e;
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
                    return;
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
                            calendar.contextMenu.show(this.event);
                        }
                    }
                    break;
                }
            }
            if (typeof calendar.onEventRightClicked === 'function') {
                calendar.onEventRightClicked(args);
            }
            return false;
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
        this.eventDeleteCallBack = function (e, data) {
            this._callBack2('EventDelete', data, e);
        };
        this.eventDeletePostBack = function (e, data) {
            this._postBack2('EventDelete', data, e);
        };
        this.eventMoveCallBack = function (e, newStart, newEnd, data, position) {
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
            params.position = position;
            this._callBack2('EventMove', data, params);
        };
        this._eventMoveDispatch = function (e, x, y, offset, ev) {
            var startOffset = e.start().getTimePart();
            var endDate = e.end().getDatePart();
            if (endDate.getTime() !== e.end().getTime()) {
                endDate = endDate.addDays(1);
            }
            var endOffset = DayPilot.DateUtil.diff(e.end(), endDate);
            var boxStart = this.getDateFromCell(x, y);
            boxStart = boxStart.addDays(-offset);
            var width = DayPilot.DateUtil.daysSpan(e.start(), e.end()) + 1;
            var boxEnd = boxStart.addDays(width);
            var newStart = boxStart.addTime(startOffset);
            var newEnd = boxEnd.addTime(endOffset);
            if (calendar._api2()) {
                var args_3 = {};
                args_3.e = e;
                args_3.control = calendar;
                args_3.newStart = newStart;
                args_3.newEnd = newEnd;
                args_3.ctrl = ev.ctrlKey;
                args_3.shift = ev.shiftKey;
                args_3.preventDefault = function () {
                    this.preventDefault.value = true;
                };
                if (typeof calendar.onEventMove === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onEventMove(args_3);
                    });
                    if (args_3.preventDefault.value) {
                        return;
                    }
                }
                switch (calendar.eventMoveHandling) {
                    case 'CallBack':
                        calendar.eventMoveCallBack(e, newStart, newEnd);
                        break;
                    case 'Update':
                        e.start(newStart);
                        e.end(newEnd);
                        calendar.events.update(e);
                        break;
                }
                if (typeof calendar.onEventMoved === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onEventMoved(args_3);
                    });
                }
            }
            else {
                switch (calendar.eventMoveHandling) {
                    case 'CallBack':
                        calendar.eventMoveCallBack(e, newStart, newEnd);
                        break;
                    case 'JavaScript':
                        calendar.onEventMove(e, newStart, newEnd);
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
        this._eventResizeDispatch = function (e, start, width) {
            var startOffset = e.start().getTimePart();
            var endDate = e.end().getDatePart();
            if (endDate.getTime() !== e.end().getTime()) {
                endDate = endDate.addDays(1);
            }
            var endOffset = DayPilot.DateUtil.diff(e.end(), endDate);
            var boxStart = this.getDateFromCell(start.x, start.y);
            var boxEnd = boxStart.addDays(width);
            var newStart = boxStart.addTime(startOffset);
            var newEnd = boxEnd.addTime(endOffset);
            if (calendar._api2()) {
                var args_4 = {};
                args_4.e = e;
                args_4.control = calendar;
                args_4.newStart = newStart;
                args_4.newEnd = newEnd;
                args_4.preventDefault = function () {
                    this.preventDefault.value = true;
                };
                if (typeof calendar.onEventResize === 'function') {
                    calendar._angular.apply(function () {
                        calendar.onEventResize(args_4);
                    });
                    if (args_4.preventDefault.value) {
                        return;
                    }
                }
                switch (calendar.eventResizeHandling) {
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
                        calendar.onEventResized(args_4);
                    });
                }
            }
            else {
                switch (calendar.eventResizeHandling) {
                    case 'CallBack':
                        calendar.eventResizeCallBack(e, newStart, newEnd);
                        break;
                    case 'JavaScript':
                        calendar.onEventResize(e, newStart, newEnd);
                        break;
                }
            }
        };
        this.timeRangeSelectedCallBack = function (start, end, data) {
            var range = {};
            range.start = start;
            range.end = end;
            this._callBack2('TimeRangeSelected', data, range);
        };
        this._timeRangeSelectedDispatch = function (start, end) {
            if (this._api2()) {
                var args_5 = {};
                args_5.control = calendar;
                args_5.start = start;
                args_5.end = end;
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
                    case 'CallBack':
                        calendar.timeRangeSelectedCallBack(start, end);
                        break;
                    case 'JavaScript':
                        calendar.onTimeRangeSelected(start, end);
                        break;
                }
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
        this.clearSelection = function () {
            calendar.clearShadow();
        };
        this.commandCallBack = function (command, data) {
            var params = {};
            params.command = command;
            this._callBack2('Command', data, params);
        };
        this.isWeekend = function (date) {
            date = new DayPilot.Date(date);
            var sunday = 0;
            var saturday = 6;
            if (date.dayOfWeek() === sunday) {
                return true;
            }
            if (date.dayOfWeek() === saturday) {
                return true;
            }
            return false;
        };
        this._resolved.locale = function () {
            var found = DayPilot.Locale.find(calendar.locale);
            if (!found) {
                return DayPilot.Locale.US;
            }
            return found;
        };
        this._resolved._xssProtectionEnabled = function () {
            return calendar.xssProtection !== "Disabled";
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
        this.dispose = function () {
            var c = calendar;
            if (c._disposed) {
                return;
            }
            c._disposed = true;
            c._clearTable();
            c._deleteEvents();
            c.nav.top.removeAttribute("style");
            c.nav.top.removeAttribute("class");
            c.nav.top.innerHTML = '';
            c.nav.top.dp = null;
            c.nav.top.onmousemove = null;
            c.nav.top = null;
        };
        this.disposed = function () {
            return this._disposed;
        };
        this._registerGlobalHandlers = function () {
            if (!DayPilotMonth.globalHandlers) {
                DayPilotMonth.globalHandlers = true;
                DayPilot.re(document, 'mouseup', DayPilotMonth.gMouseUp);
            }
        };
        this.loadFromServer = function () {
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
        };
        this.hide = function () {
            calendar.visible = false;
            calendar.nav.top.style.display = 'none';
        };
        this._loadTop = function () {
            if (this.id && this.id.tagName) {
                this.nav.top = this.id;
            }
            else if (typeof this.id === "string") {
                this.nav.top = document.getElementById(this.id);
                if (!this.nav.top) {
                    throw "DayPilot.Month: The placeholder element not found: '" + this.id + "'.";
                }
            }
            else {
                throw "DayPilot.Month() constructor requires the target element or its ID as a parameter";
            }
        };
        this._initShort = function () {
            this._prepareRows();
            this._drawTop();
            this._drawTable();
            this._registerGlobalHandlers();
            this._callBack2('Init');
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
        this._vue._renderVueNode = function (vnode, target, props) {
            var vue = calendar._vue._vueImport;
            if (typeof vue.render === "function") {
                var toRender = vnode;
                if (DayPilot.isArray(vnode)) {
                    toRender = vue.h("div", props, vnode);
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
        this.internal.loadOptions = this._loadOptions;
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
            var loadFromServer = this.loadFromServer();
            if (loadFromServer) {
                this._initShort();
                return;
            }
            this._prepareRows();
            this._loadEvents();
            this._drawTop();
            this._drawTable();
            this._show();
            this._drawEvents();
            this._registerGlobalHandlers();
            this.fireAfterRenderDetached(null, false);
            this._initialized = true;
            return this;
        };
        this.Init = this.init;
        Object.defineProperty(this, 'durationBarVisible', { get: function () { return calendar.eventBarVisible; } });
        this._loadOptions(options);
    };
    DayPilotMonth.gMouseUp = function (ev) {
        if (DayPilotMonth.movingEvent) {
            var src = DayPilotMonth.movingEvent;
            if (!src.event) {
                return;
            }
            if (!src.event.calendar) {
                return;
            }
            if (!src.event.calendar.shadow) {
                return;
            }
            if (!src.event.calendar.shadow.start) {
                return;
            }
            var calendar = DayPilotMonth.movingEvent.event.calendar;
            var e = DayPilotMonth.movingEvent.event;
            var start = calendar.shadow.start;
            var position = calendar.shadow.position;
            var offset = DayPilotMonth.movingEvent.offset;
            calendar.clearShadow();
            DayPilotMonth.movingEvent = null;
            calendar._eventMoveDispatch(e, start.x, start.y, offset, ev, position);
            ev.cancelBubble = true;
            if (ev.stopPropagation) {
                ev.stopPropagation();
            }
            DayPilotMonth.movingEvent = null;
            return false;
        }
        else if (DayPilotMonth.resizingEvent) {
            var src = DayPilotMonth.resizingEvent;
            if (!src.event) {
                return;
            }
            if (!src.event.calendar) {
                return;
            }
            if (!src.event.calendar.shadow) {
                return;
            }
            if (!src.event.calendar.shadow.start) {
                return;
            }
            var calendar = DayPilotMonth.resizingEvent.event.calendar;
            var e = DayPilotMonth.resizingEvent.event;
            var start = calendar.shadow.start;
            var width = calendar.shadow.width;
            calendar.clearShadow();
            DayPilotMonth.resizingEvent = null;
            calendar._eventResizeDispatch(e, start, width);
            ev.cancelBubble = true;
            DayPilotMonth.resizingEvent = null;
            return false;
        }
        else if (DayPilotMonth.timeRangeSelecting) {
            if (DayPilotMonth.timeRangeSelecting.moved) {
                var sel = DayPilotMonth.timeRangeSelecting;
                var calendar = sel.root;
                var start = new DayPilot.Date(calendar.getDateFromCell(sel.from.x, sel.from.y));
                var end = start.addDays(sel.width);
                calendar._timeRangeSelectedDispatch(start, end);
            }
            DayPilotMonth.timeRangeSelecting = null;
        }
    };
    DayPilot.Month = DayPilotMonth.Month;
    if (typeof jQuery !== 'undefined') {
        (function ($) {
            $.fn.daypilotMonth = function (options) {
                var first = null;
                var j = this.each(function () {
                    if (this.daypilot) {
                        return;
                    }
                    ;
                    var daypilot = new DayPilot.Month(this.id);
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
        app.directive("daypilotMonth", ['$parse', function ($parse) {
                return {
                    "restrict": "E",
                    "template": "<div></div>",
                    "replace": true,
                    "link": function (scope, element, attrs) {
                        var calendar = new DayPilot.Month(element[0]);
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
                        }, true);
                        watch.call(scope, events, function (value) {
                            calendar.events.list = value;
                            calendar.update();
                        }, true);
                    }
                };
            }]);
    })();
    if (typeof Sys !== 'undefined' && Sys.Application && Sys.Application.notifyScriptLoaded) {
        Sys.Application.notifyScriptLoaded();
    }
})(DayPilot);
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
"use strict";
(function (DayPilot) {
    'use strict';
    if (typeof DayPilot.Scheduler !== 'undefined') {
        return;
    }
    var DayPilotScheduler = {};
    var doNothing = function () { };
    var debug = false;
    var log = function () {
        var _a;
        if (!debug) {
            return;
        }
        (_a = window.console) === null || _a === void 0 ? void 0 : _a.log.apply(window.console, arguments);
    };
    var console = {
        "log": log
    };
    var body = function () { return document.body; };
    var createDiv = function () { return document.createElement("div"); };
    DayPilot.Scheduler = function (id, options) {
        this.v = '${v}';
        var calendar = this;
        this.isScheduler = true;
        this.id = id;
        this.beforeCellRenderCaching = true;
        this.businessBeginsHour = 9;
        this.businessEndsHour = 18;
        this.businessWeekends = false;
        this.cellDuration = 60;
        this.cellGroupBy = 'Day';
        this.cellSweeping = true;
        this.cellSweepingCacheSize = 1000;
        this.cellWidth = 40;
        this.cellsMarkBusiness = true;
        this.cornerText = null;
        this.cornerHtml = null;
        this.cssClassPrefix = "scheduler_default";
        this.days = 1;
        this.durationBarHeight = 3;
        this.durationBarVisible = true;
        this.dynamicEventRendering = 'Progressive';
        this.dynamicEventRenderingMargin = 50;
        this.dynamicEventRenderingMarginX = null;
        this.dynamicEventRenderingMarginY = null;
        this.dynamicEventRenderingCacheSweeping = false;
        this.dynamicEventRenderingCacheSize = 200;
        this.eventBorderRadius = null;
        this.eventEndSpec = "DateTime";
        this.eventHeight = 35;
        this.eventMinWidth = 1;
        this.eventPadding = null;
        this.eventResizeMargin = 5;
        this.eventTapAndHoldHandling = "Move";
        this.eventTextWrappingEnabled = false;
        this.eventsLoadMethod = "GET";
        this.floatingEvents = DayPilot.browser.ios ? false : true;
        this.floatingTimeHeaders = true;
        this.headerHeight = 30;
        this.heightSpec = 'Max';
        this.height = 600;
        this.locale = "en-us";
        this.progressiveRowRendering = true;
        this.progressiveRowRenderingPreload = 25;
        this.rowHeaderWidth = 80;
        this.rowMarginTop = 0;
        this.rowMarginBottom = 0;
        this.rowsLoadMethod = "GET";
        this.scale = "CellDuration";
        this.scrollDelayEvents = 200;
        this.scrollDelayCells = DayPilot.browser.ios ? 100 : 0;
        this.scrollDelayFloats = 0;
        this.scrollDelayRows = 0;
        this.showToolTip = true;
        this.snapToGrid = true;
        this.startDate = DayPilot.Date.today();
        this.tapAndHoldTimeout = 300;
        this.timeHeaders = [{ "groupBy": "Default" }, { "groupBy": "Cell" }];
        this.timeHeaderTextWrappingEnabled = false;
        this.timeFormat = "Auto";
        this.useEventBoxes = 'Always';
        this.visible = true;
        this.weekStarts = 'Auto';
        this.width = null;
        this.xssProtection = "Enabled";
        this.zoomLevels = [];
        this.zoomPosition = "left";
        this.eventClickHandling = 'Enabled';
        this.eventDeleteHandling = "Disabled";
        this.eventMoveHandling = 'Update';
        this.eventResizeHandling = 'Update';
        this.eventRightClickHandling = 'ContextMenu';
        this.timeHeaderClickHandling = "Enabled";
        this.timeHeaderRightClickHandling = "Enabled";
        this.timeRangeClickHandling = "Enabled";
        this.timeRangeSelectedHandling = 'Enabled';
        this.onEventClick = null;
        this.onEventClicked = null;
        this.onEventMove = null;
        this.onEventMoved = null;
        this.onEventResize = null;
        this.onEventResized = null;
        this.onRowClick = null;
        this.onRowClicked = null;
        this.onTimeHeaderClick = null;
        this.onTimeHeaderClicked = null;
        this.onTimeHeaderRightClick = null;
        this.onTimeHeaderRightClicked = null;
        this.onTimeRangeClick = null;
        this.onTimeRangeClicked = null;
        this.onTimeRangeSelect = null;
        this.onTimeRangeSelected = null;
        this.onBeforeCellRender = null;
        this.onBeforeCornerRender = null;
        this.onBeforeEventRender = null;
        this.onBeforeRowHeaderRender = null;
        this.onBeforeTimeHeaderRender = null;
        this.onScroll = null;
        this.onAfterUpdate = null;
        this._disposed = false;
        this._gridHeight = -1;
        this._previousVisible = true;
        this.rowlist = [];
        this.events = {};
        this.cells = {};
        this.elements = {};
        this.elements.events = [];
        this.elements.bars = [];
        this.elements.text = [];
        this.elements.cells = [];
        this.elements.linesVertical = [];
        this.elements.range = [];
        this.elements.timeHeader = [];
        this._cache = {};
        this._cache.cells = [];
        this._cache.linesVertical = {};
        this._cache.linesHorizontal = {};
        this._cache.timeHeaderGroups = [];
        this._cache.timeHeader = {};
        this._cache.events = [];
        this.nav = {};
        this._resolved = {};
        var resolved = this._resolved;
        this._touch = {};
        var touch = calendar._touch;
        this._eventloading = {};
        var eventloading = this._eventloading;
        var postponedUpdate = {};
        this.scrollTo = function (date) {
            calendar._scrollTo(date);
        };
        this._scrollTo = function (date) {
            if (!date) {
                return;
            }
            if (!calendar._initialized) {
                calendar._scrollToAfterInit = date;
                return;
            }
            var pixels;
            if (date instanceof DayPilot.Date) {
                pixels = this.getPixels(date).left;
            }
            else if (typeof date === "string") {
                pixels = this.getPixels(new DayPilot.Date(date)).left;
            }
            else if (typeof date === "number") {
                pixels = date;
            }
            else {
                throw new DayPilot.Exception("Invalid scrollTo() parameter. Accepted parameters: string (ISO date), number (pixels), DayPilot.Date object");
            }
            var max = calendar._maind.clientWidth;
            var width = calendar.nav.scroll.clientWidth;
            if (pixels < 0) {
                pixels = 0;
            }
            if (pixels > max - width) {
                pixels = max - width;
            }
            calendar._setScrollX(pixels);
        };
        this.scrollToResource = function (param) {
            DayPilot.complete(function () {
                var row;
                if (typeof param === "string" || typeof param === "number") {
                    row = calendar._findRowByResourceId(param);
                }
                else if (param instanceof DayPilot.Row) {
                    row = calendar._findRowByResourceId(param.id);
                }
                else {
                    throw new DayPilot.Exception("Invalid scrollToResource() argument: id or DayPilot.Row expected");
                }
                if (!row) {
                    return;
                }
                setTimeout(function () {
                    var scrollY = row.top;
                    calendar.nav.scroll.scrollTop = scrollY;
                }, 100);
            });
        };
        this._findHeadersInViewPort = function () {
            if (!this.floatingTimeHeaders) {
                return;
            }
            if (!this.timeHeader) {
                return;
            }
            var area = calendar._getDrawArea();
            if (!area) {
                return;
            }
            calendar._markHeaderSectionsForDeletion();
            var start = area.pixels.left;
            var end = area.pixels.right + area.sw;
            var cells = [];
            for (var y = 0; y < this.timeHeader.length; y++) {
                for (var x = 0; x < this.timeHeader[y].length; x++) {
                    var h = this.timeHeader[y][x];
                    var left = h.left;
                    var right = h.left + h.width;
                    var cell = null;
                    if (left < start && start < right) {
                        cell = {};
                        cell.x = x;
                        cell.y = y;
                        cell.marginLeft = start - left;
                        cell.marginRight = 0;
                        cell.div = calendar._cache.timeHeader[x + "_" + y];
                        cells.push(cell);
                    }
                    if (left < end && end < right) {
                        if (!cell) {
                            cell = {};
                            cell.x = x;
                            cell.y = y;
                            cell.marginLeft = 0;
                            cell.div = calendar._cache.timeHeader[x + "_" + y];
                            cells.push(cell);
                        }
                        cell.marginRight = right - end;
                        break;
                    }
                }
            }
            for (var i = 0; i < cells.length; i++) {
                var cell = cells[i];
                calendar._createHeaderSection(cell.div, cell.marginLeft, cell.marginRight);
            }
            calendar._deleteHeaderSections();
        };
        this._updateFloats = function () {
            calendar._findHeadersInViewPort();
            calendar._findEventsInViewPort();
        };
        this._viewport = {};
        var viewport = calendar._viewport;
        viewport._eventsInRectangle = function (x, y, width, height) {
            var startX = x;
            var endX = x + width;
            var startY = y;
            var endY = y + height;
            return calendar.elements.events.filter(function (e) {
                var data = e.event;
                var left = data.part.left;
                var right = data.part.left + data.part.width;
                var row = calendar.rowlist[data.part.dayIndex];
                var top = row.top + data.part.top;
                var bottom = top + calendar.eventHeight;
                if (DayPilot.Util.overlaps(left, right, startX, endX) && DayPilot.Util.overlaps(top, bottom, startY, endY)) {
                    return true;
                }
            });
        };
        viewport._events = function () {
            var list = [];
            var area = calendar._getDrawArea();
            if (!area) {
                return list;
            }
            var start = area.pixels.left;
            for (var i = 0; i < calendar.elements.events.length; i++) {
                var e = calendar.elements.events[i];
                var data = e.event;
                var left = data.part.left;
                var right = data.part.left + data.part.width;
                if (left < start && start < right) {
                    list.push(e);
                }
            }
            list.area = area;
            return list;
        };
        this._findEventsInViewPort = function () {
            if (!this.floatingEvents) {
                return;
            }
            var events = viewport._events();
            calendar._eventSectionStamp = performance.now();
            events.forEach(function (item) {
                var e = item.event;
                var left = events.area.pixels.left;
                var start = e.part.left;
                var marginLeft = left - start;
                calendar._createEventSection(item, marginLeft, 0);
            });
            calendar._deleteEventSections();
        };
        this.elements.sections = [];
        this.elements.hsections = [];
        this._createHeaderSection = function (div, marginLeft, marginRight) {
            var _a;
            if (div.section) {
                var section_1 = div.section;
                section_1.style.left = marginLeft + "px";
                section_1.style.right = marginRight + "px";
                div._delete = false;
                return;
            }
            var section = createDiv();
            section.className = calendar._prefixCssClass("_timeheader_float");
            section.style.position = "absolute";
            section.style.left = marginLeft + "px";
            section.style.right = marginRight + "px";
            section.style.top = "0px";
            section.style.bottom = "0px";
            section.style.overflow = "hidden";
            var inner = createDiv();
            inner.className = calendar._prefixCssClass("_timeheader_float_inner");
            div._floatTarget = inner;
            var props = div.cell.th;
            var renderDefaultHtml = true;
            var argsElement = (_a = div.domArgs) === null || _a === void 0 ? void 0 : _a.element;
            if (argsElement) {
                var target = inner;
                var isReactComponent = DayPilot.Util.isReactComponent(argsElement);
                if (isReactComponent) {
                    if (!calendar._react.reactDOM) {
                        throw new DayPilot.Exception("Can't reach ReactDOM");
                    }
                    calendar._react._render(argsElement, target);
                    renderDefaultHtml = false;
                }
            }
            if (renderDefaultHtml) {
                inner.innerHTML = calendar._xssTextHtml(props.text, props.innerHTML);
            }
            if (props.fontColor) {
                inner.style.color = props.fontColor;
            }
            section.appendChild(inner);
            section._data = {
                marginLeft: marginLeft,
                marginRight: marginRight
            };
            div.section = section;
            div.insertBefore(section, div.firstChild.nextSibling);
            if (argsElement) {
                var el_1 = div.firstChild && div.firstChild.firstChild;
                if (el_1) {
                    setTimeout(function () {
                        el_1.style.display = "none";
                    }, 0);
                }
            }
            else {
                div.firstChild.innerHTML = '';
            }
            this.elements.hsections.push(div);
        };
        this._markHeaderSectionsForDeletion = function () {
            for (var i = 0; i < this.elements.hsections.length; i++) {
                var e = this.elements.hsections[i];
                e._delete = true;
            }
        };
        this._deleteHeaderSections = function () {
            var keep = [];
            for (var i = 0; i < this.elements.hsections.length; i++) {
                var e = this.elements.hsections[i];
                if (!e._delete) {
                    keep.push(e);
                    continue;
                }
                var data = e.cell;
                if (data && e.firstChild) {
                    if (e.domArgs && e.domArgs.element) {
                        var el = e.firstChild && e.firstChild.firstChild;
                        if (el) {
                            el.style.display = "";
                        }
                        var isReact = calendar._react.reactDOM && DayPilot.Util.isReactComponent(e.domArgs.element);
                        if (isReact) {
                            var target = e._floatTarget;
                            calendar._react._unmount(target);
                        }
                    }
                    else {
                        e.firstChild.innerHTML = calendar._xssTextHtml(data.th.text, data.th.innerHTML);
                    }
                }
                DayPilot.de(e.section);
                e.section = null;
                e._delete = false;
            }
            this.elements.hsections = keep;
        };
        this._createEventSection = function (div, marginLeft, marginRight) {
            var _a, _b;
            var section = div.section;
            if (section) {
                if (section._data && section._data.marginLeft === marginLeft && section._data.marginRight === marginRight) {
                    section._data.stamp = calendar._eventSectionStamp;
                    return;
                }
                div.section.style.left = marginLeft + "px";
                div.section.style.right = marginRight + "px";
                section._data = {
                    marginLeft: marginLeft,
                    marginRight: marginRight,
                    stamp: calendar._eventSectionStamp
                };
                return;
            }
            section = createDiv();
            section.className = calendar._prefixCssClass("_event_float");
            section.style.position = "absolute";
            section.style.left = marginLeft + "px";
            section.style.right = marginRight + "px";
            section.style.top = "0px";
            section.style.bottom = "0px";
            section.style.overflow = "hidden";
            var inner = createDiv();
            inner.className = calendar._prefixCssClass("_event_float_inner");
            inner.innerHTML = div.event.client.html();
            section.appendChild(inner);
            var argsElement = (_a = div.domArgs) === null || _a === void 0 ? void 0 : _a.element;
            section._data = {
                marginLeft: marginLeft,
                marginRight: marginRight,
                stamp: calendar._eventSectionStamp
            };
            div.section = section;
            div.insertBefore(section, div.firstChild.nextSibling);
            if (argsElement) {
                var el = (_b = div === null || div === void 0 ? void 0 : div.firstChild) === null || _b === void 0 ? void 0 : _b.firstChild;
                if (el) {
                    el.style.display = "none";
                }
            }
            else {
                div.firstChild.innerHTML = "";
            }
            var e = div.event;
            var cache = e.cache || e.data;
            if (cache.fontColor) {
                inner.style.color = cache.fontColor;
            }
            this.elements.sections.push(div);
        };
        this._deleteEventSections = function () {
            var _a;
            var updated = [];
            for (var i = 0; i < this.elements.sections.length; i++) {
                var e = this.elements.sections[i];
                if (e.section && e.section._data && e.section._data.stamp === calendar._eventSectionStamp) {
                    updated.push(e);
                    continue;
                }
                var data = e.event;
                if (data) {
                    if (e.domArgs && e.domArgs.element) {
                        var el = (_a = e === null || e === void 0 ? void 0 : e.firstChild) === null || _a === void 0 ? void 0 : _a.firstChild;
                        if (el) {
                            el.style.display = '';
                        }
                    }
                    else {
                        e.firstChild.innerHTML = data.client.html();
                    }
                }
                DayPilot.de(e.section);
                e.section = null;
            }
            this.elements.sections = updated;
        };
        this.setScrollX = function (scrollX) {
            if (!calendar._angular2.enabled) {
                calendar._setScrollX(scrollX);
            }
            else {
                calendar._angular2.scrollXRequested = scrollX;
                setTimeout(function () {
                    var scrollX = calendar._angular2.scrollXRequested;
                    if (typeof scrollX === "number") {
                        calendar._setScrollX(scrollX);
                    }
                }, 0);
            }
        };
        this._setScrollX = function (scrollX) {
            var scroll = calendar.nav.scroll;
            var maxWidth = calendar._getGridWidth();
            if (scroll.clientWidth + scrollX > maxWidth) {
                scrollX = maxWidth - scroll.clientWidth;
            }
            calendar.divTimeScroll.scrollLeft = scrollX;
            scroll.scrollLeft = scrollX;
        };
        this.setScrollY = function (scrollY) {
            if (!calendar._angular2.enabled) {
                calendar._setScrollY(scrollY);
            }
            else {
                calendar._angular2.scrollYRequested = scrollY;
                setTimeout(function () {
                    var scrollY = calendar._angular2.scrollYRequested;
                    if (typeof scrollY === "number") {
                        calendar._setScrollY(scrollY);
                    }
                }, 0);
            }
        };
        this._setScrollY = function (scrollY) {
            var scroll = calendar.nav.scroll;
            var maxHeight = calendar._gridHeight;
            if (scroll.clientHeight + scrollY > maxHeight) {
                scrollY = maxHeight - scroll.clientHeight;
            }
            calendar.divResScroll.scrollTop = scrollY;
            scroll.scrollTop = scrollY;
        };
        this.setScroll = function (scrollX, scrollY) {
            calendar.setScrollX(scrollX);
            calendar.setScrollY(scrollY);
        };
        this._updateHeight = function () {
            if (!this.nav.scroll) {
                return;
            }
            (function fromDrawCells() {
                var width = calendar._getGridWidth();
                calendar._maind.style.height = calendar._gridHeight + "px";
                calendar._maind.style.width = width + "px";
                if (width > calendar.nav.scroll.clientWidth) {
                    calendar.nav.scroll.style.overflowX = "auto";
                }
                else {
                    calendar.nav.scroll.style.overflowX = "hidden";
                }
            })();
            var dividerHeight = 1;
            this.nav.scroll.style.height = '30px';
            var height = this._getScrollableHeight();
            var total = height + this._getTotalHeaderHeight() + dividerHeight;
            if (height >= 0) {
                this.nav.scroll.style.height = (height) + 'px';
                this._scrollRes.style.height = (height) + 'px';
            }
            if (this.nav.divider) {
                if (!total || isNaN(total) || total < 0) {
                    total = 0;
                }
                this.nav.divider.style.height = (total) + "px";
            }
            this.nav.top.style.height = (total) + "px";
            if (calendar.nav.resScrollSpace) {
                var spaceHeight = 30;
                if (calendar.heightSpec === "Auto") {
                    spaceHeight = DayPilot.sh(calendar.nav.scroll);
                }
                calendar.nav.resScrollSpace.style.height = spaceHeight + "px";
            }
            for (var i = 0; i < this.elements.linesVertical.length; i++) {
                this.elements.linesVertical[i].style.height = this._gridHeight + 'px';
            }
        };
        this._prepareHeaderGroups = function () {
            this.startDate = new DayPilot.Date(this.startDate).getDatePart();
            this.timeHeader = [];
            var timeHeaders = this.timeHeaders;
            if (!timeHeaders) {
                timeHeaders = [
                    { "groupBy": this.cellGroupBy },
                    { "groupBy": "Cell" }
                ];
            }
            var endDate = calendar.startDate.addDays(calendar.days);
            for (var i = 0; i < timeHeaders.length; i++) {
                var groupBy = timeHeaders[i].groupBy;
                var format = timeHeaders[i].format;
                if (groupBy === "Default") {
                    groupBy = this.cellGroupBy;
                }
                var line = [];
                var start = calendar.startDate;
                while (start.ticks < endDate.ticks) {
                    var h = {};
                    h.start = start;
                    h.end = this._addGroupSize(h.start, groupBy);
                    if (h.start.ticks === h.end.ticks) {
                        break;
                    }
                    h.left = this.getPixels(h.start).left;
                    var right = this.getPixels(h.end).left;
                    var width = right - h.left;
                    h.width = width;
                    if (typeof format === "string") {
                        h.text = h.start.toString(format, resolved._locale());
                    }
                    else {
                        h.text = this._getGroupName(h, groupBy);
                    }
                    if (width > 0) {
                        if (typeof this.onBeforeTimeHeaderRender === 'function') {
                            var cell = {};
                            cell.start = h.start;
                            cell.end = h.end;
                            cell.text = h.text;
                            cell.html = null;
                            cell.toolTip = calendar._xssTextHtml(h.text);
                            cell.backColor = null;
                            cell.fontColor = null;
                            cell.level = this.timeHeader.length;
                            cell.cssClass = null;
                            var args = {};
                            args.header = cell;
                            args.control = calendar;
                            this.onBeforeTimeHeaderRender(args);
                            h.text = cell.text;
                            h.html = cell.html;
                            h.backColor = cell.backColor;
                            h.fontColor = cell.fontColor;
                            h.toolTip = cell.toolTip;
                            h.areas = cell.areas;
                            h.cssClass = cell.cssClass;
                        }
                        line.push(h);
                    }
                    start = h.end;
                }
                this.timeHeader.push(line);
            }
        };
        this.getPixels = function (date) {
            var ticks = date.ticks - this.startDate.ticks;
            var pixels = calendar._ticksToPixels(ticks);
            var w = calendar.cellWidth;
            var i = Math.floor(pixels / w);
            var boxLeft = i * w;
            boxLeft = boxLeft < 0 ? 0 : boxLeft;
            var boxRight = boxLeft + w;
            if (pixels % w === 0) {
                boxRight = boxLeft;
            }
            var maxWidth = calendar._getGridWidth();
            boxRight = boxRight > maxWidth ? maxWidth : boxRight;
            return {
                left: pixels,
                boxLeft: boxLeft,
                boxRight: boxRight,
                i: i
            };
        };
        this.getDate = function (left, precise, isEnd) {
            var position = this._getCellFromPixels(left, isEnd);
            if (!position) {
                return null;
            }
            var x = position.x;
            var itc = calendar._getCell(x);
            if (!itc) {
                return null;
            }
            var start = (isEnd && !precise) ? itc.end : itc.start;
            if (!precise) {
                return start;
            }
            else {
                return start.addTime(this._pixelsToTicks(position.offset));
            }
        };
        this._getCellFromPixels = function (pixels, isEnd) {
            if (isEnd) {
                pixels -= 1;
            }
            var x = Math.floor(pixels / calendar.cellWidth);
            var itc = calendar._getCell(x);
            if (!itc) {
                return null;
            }
            var result = {};
            result.x = x;
            result.offset = pixels % calendar.cellWidth;
            result.cell = itc;
            return result;
        };
        this._getCellFromTime = function (time) {
            var deltaMs = time.ticks - this.startDate.ticks;
            var msPerCell = calendar._getCellDuration() * 60 * 1000;
            if (deltaMs < 0) {
                return {
                    past: true
                };
            }
            var i = Math.floor(deltaMs / msPerCell);
            return {
                i: i,
                current: calendar._getCell(i)
            };
        };
        this._ticksToPixels = function (ticks) {
            var duration = calendar._getCellDuration() * 60 * 1000;
            var width = calendar.cellWidth;
            return Math.floor(width * ticks / duration);
        };
        this._pixelsToTicks = function (pixels) {
            var duration = calendar._getCellDuration() * 60 * 1000;
            var width = calendar.cellWidth;
            return Math.floor(pixels / width * duration);
        };
        this._onEventClick = function (ev) {
            if (DayPilot.Global.touch.start) {
                return;
            }
            if (DayPilotScheduler._preventEventClick) {
                return;
            }
            calendar._moving = {};
            calendar._eventClickDispatch(this, ev);
        };
        this._eventClickDispatch = function (div, ev) {
            var e = div.event;
            if (!e) {
                return;
            }
            calendar._eventClickSingle(div, ev);
        };
        this._eventRightClickDispatch = function (ev) {
            if (DayPilot.Global.touch.active || DayPilot.Global.touch.start) {
                return;
            }
            var e = this.event;
            ev.cancelBubble = true;
            ev.preventDefault();
            if (!this.event.client.rightClickEnabled()) {
                return false;
            }
            calendar._updateCoords(ev);
            var args = {};
            args.e = e;
            args.div = this;
            args.originalEvent = ev;
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
                            calendar.contextMenu.show(this.event);
                        }
                    }
                    break;
                }
            }
            if (typeof calendar.onEventRightClicked === 'function') {
                calendar.onEventRightClicked(args);
            }
            return false;
        };
        this._getCell = function (x) {
            var minutesPerCell = calendar._getCellDuration();
            var msPerCell = minutesPerCell * 60 * 1000;
            var startDate = new DayPilot.Date(calendar.startDate);
            return {
                start: startDate.addTime(x * msPerCell),
                end: startDate.addTime((x + 1) * msPerCell),
                left: x * calendar.cellWidth,
                width: calendar.cellWidth,
            };
        };
        this._eventClickSingle = function (div, ev) {
            if (typeof ev === "boolean") {
                throw new DayPilot.Exception("Invalid _eventClickSingle parameters");
            }
            var e = div.event;
            if (!e) {
                return;
            }
            var ctrlKey = ev.ctrlKey;
            var metaKey = ev.metaKey;
            if (!e.client.clickEnabled()) {
                return;
            }
            calendar._updateCoords(ev);
            var args = {};
            args.e = e;
            args.control = calendar;
            args.div = div;
            args.originalEvent = ev;
            args.ctrl = ctrlKey;
            args.meta = metaKey;
            args.shift = ev.shiftKey;
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            args.toJSON = function () {
                return DayPilot.Util.copyProps(args, {}, ["e", "ctrl", "meta", "shift"]);
            };
            if (typeof calendar.onEventClick === 'function') {
                calendar.onEventClick(args);
                if (args.preventDefault.value) {
                    return;
                }
            }
            if (typeof calendar.onEventClicked === 'function') {
                calendar.onEventClicked(args);
            }
        };
        this._eventDeleteDispatch = function (e) {
            var args = {};
            args.e = e;
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            args.control = calendar;
            args.toJSON = function () {
                return DayPilot.Util.copyProps(args, {}, ["e"]);
            };
            if (typeof calendar.onEventDelete === 'function') {
                calendar.onEventDelete(args);
                if (args.preventDefault.value) {
                    return;
                }
            }
            switch (calendar.eventDeleteHandling) {
                case 'Update':
                    calendar.events.remove(e);
                    break;
            }
            if (typeof calendar.onEventDeleted === 'function') {
                calendar.onEventDeleted(args);
            }
        };
        this.getScrollX = function () {
            return this.nav.scroll.scrollLeft;
        };
        this.getScrollY = function () {
            return this.nav.scroll.scrollTop;
        };
        this._eventResizeDispatch = function (e, newStart, newEnd, what) {
            if (this.eventResizeHandling === 'Disabled') {
                return;
            }
            newEnd = calendar._adjustEndOut(newEnd);
            var args = {};
            args.e = e;
            args.async = false;
            args.loaded = function () {
                performResize();
            };
            args.newStart = newStart;
            args.newEnd = newEnd;
            args.what = what;
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            args.control = calendar;
            args.toJSON = function () {
                return DayPilot.Util.copyProps(args, {}, ["e", "async", "newStart", "newEnd"]);
            };
            function performResize() {
                if (args.preventDefault.value) {
                    return;
                }
                args.loaded = {};
                newStart = args.newStart;
                newEnd = args.newEnd;
                switch (calendar.eventResizeHandling) {
                    case 'Update':
                        calendar._doEventMoveUpdate(args);
                        break;
                }
                if (typeof calendar.onEventResized === 'function') {
                    calendar.onEventResized(args);
                }
            }
            if (typeof calendar.onEventResize === 'function') {
                calendar.onEventResize(args);
            }
            if (!args.async) {
                performResize();
            }
        };
        this._update = function (args) {
            args = args || {};
            clearTimeout(calendar._drawEventsTimeout);
            calendar.timeHeader = null;
            calendar.cellProperties = {};
            calendar._prepareHeaderGroups();
            calendar._loadResources();
            calendar.events._postponedClear();
            calendar._resolved._clearCache();
            calendar.clearSelection();
            calendar._loadEvents();
            calendar._prepareRowTops();
            calendar._drawResHeader();
            calendar._updateCorner();
            calendar._updateTheme();
            calendar._drawTimeHeader();
            calendar._updateRowHeaderHeights();
            calendar._updateRowHeaderWidth();
            calendar._updateHeaderHeight();
            calendar._deleteEvents();
            calendar._deleteCells();
            calendar._bcrCache = {};
            calendar._clearCachedValues();
            calendar._updateHeight();
            calendar._drawCells();
            if (args.immediateEvents) {
                calendar._drawEvents();
            }
            else {
                setTimeout(function () { calendar._drawEvents(); }, 100);
            }
            if (this.visible) {
                if (calendar._previousVisible !== calendar.visible) {
                    this.show();
                }
            }
            else {
                this.hide();
            }
            this._previousVisible = this.visible;
            this._updateFloats();
            calendar._onScroll();
            this._doAfterUpdate();
        };
        this._doAfterUpdate = function () {
            if (typeof calendar.onAfterUpdate !== "function") {
                return;
            }
            var args = {};
            calendar.onAfterUpdate(args);
        };
        this.update = function (options) {
            if (!calendar._initialized) {
                throw new DayPilot.Exception("You are trying to update a DayPilot.Scheduler object that hasn't been initialized.");
            }
            if (calendar._disposed) {
                throw new DayPilot.Exception("You are trying to update a DayPilot.Scheduler object that has been disposed already. Calling .dispose() destroys the object and makes it unusable.");
            }
            postponedUpdate.request(options);
        };
        postponedUpdate.timeout = null;
        postponedUpdate.options = null;
        postponedUpdate.enabled = false;
        postponedUpdate.request = function (options) {
            if (postponedUpdate.enabled) {
                clearTimeout(postponedUpdate.timeout);
                postponedUpdate._mergeOptions(options);
                postponedUpdate.timeout = setTimeout(postponedUpdate.doit);
            }
            else {
                postponedUpdate._mergeOptions(options);
                postponedUpdate.doit();
            }
        };
        postponedUpdate._mergeOptions = function (options) {
            if (!options) {
                return;
            }
            if (!postponedUpdate.options) {
                postponedUpdate.options = {};
            }
            for (var name_1 in options) {
                postponedUpdate.options[name_1] = options[name_1];
            }
        };
        postponedUpdate.doit = function () {
            var options = postponedUpdate.options;
            postponedUpdate.options = null;
            if (!calendar._initialized) {
                calendar._loadOptions(options);
                return;
            }
            calendar._loadOptions(options);
            calendar._update({ "immediateEvents": true });
            calendar._postInit();
        };
        this._drawRowsForced = function (rows) {
            rows.forEach(function (row) {
                calendar._drawRowForced(row.index);
            });
        };
        this._ensureRowsArray = function (rows) {
            if (!rows || rows.length === 0) {
                return [];
            }
            if (rows[0].isRow) {
                return rows;
            }
            return rows.map(function (i) {
                return calendar.rowlist[i];
            });
        };
        this._updateRowsNoLoad = function (rows, appendOnlyIfPossible, finishedCallBack) {
            rows = DayPilot.ua(rows);
            rows = calendar._ensureRowsArray(rows);
            calendar._drawRowsForced(rows);
            if (this._rowsDirty) {
                this._prepareRowTops();
                this._updateRowHeaderHeights();
                this._deleteCells();
                rows.forEach(function (row) {
                    calendar._deleteEventsInRow(row.index);
                });
                rows.forEach(function (row) {
                    calendar._drawEventsInRow(row.index);
                });
                this._drawCells();
                this._updateEventTops();
            }
            else {
                rows.forEach(function (row) {
                    if (!appendOnlyIfPossible) {
                        calendar._deleteEventsInRow(row.index);
                    }
                    calendar._drawEventsInRow(row.index);
                });
                rows.forEach(function (row) {
                    calendar._deleteCellsInRow(row.index);
                });
                calendar._drawCells();
            }
            calendar._findEventsInViewPort();
            if (finishedCallBack) {
                finishedCallBack();
            }
            this._clearCachedValues();
        };
        this._adjustEndOut = function (date) {
            if (calendar.eventEndSpec === "DateTime") {
                return date;
            }
            if (date.getDatePart().ticks === date.ticks) {
                return date.addDays(-1);
            }
            return date.getDatePart();
        };
        this._adjustEndIn = function (date) {
            if (calendar.eventEndSpec === "DateTime") {
                return date;
            }
            return date.getDatePart().addDays(1);
        };
        this._adjustEndNormalize = function (date) {
            if (calendar.eventEndSpec === "DateTime") {
                return date;
            }
            return date.getDatePart();
        };
        this._eventMoveDispatch = function (e, newStart, newEnd, newResource, ev) {
            calendar._lastEventMoving = null;
            if (calendar.eventMoveHandling === 'Disabled') {
                return;
            }
            newEnd = calendar._adjustEndOut(newEnd);
            var args = {};
            args.e = e;
            args.newStart = newStart;
            args.newEnd = newEnd;
            args.newResource = newResource;
            args.ctrl = false;
            args.meta = false;
            args.shift = false;
            if (ev) {
                args.shift = ev.shiftKey;
                args.ctrl = ev.ctrlKey;
                args.meta = ev.metaKey;
            }
            args.control = calendar;
            args.areaData = DayPilot.Global.movingAreaData;
            args.toJSON = function () {
                return DayPilot.Util.copyProps(args, {}, ["e", "newStart", "newEnd", "newResource", "ctrl", "meta", "shift"]);
            };
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            var performMove = function () {
                args.loaded = function () { };
                if (args.preventDefault.value) {
                    calendar._clearMovingShadow();
                    return;
                }
                newStart = args.newStart;
                newEnd = args.newEnd;
                switch (calendar.eventMoveHandling) {
                    case 'Update':
                        calendar._doEventMoveUpdate(args);
                        break;
                }
                calendar._clearMovingShadow();
                if (typeof calendar.onEventMoved === 'function') {
                    calendar.onEventMoved(args);
                }
            };
            args.async = false;
            args.loaded = function () {
                performMove();
            };
            if (typeof calendar.onEventMove === 'function') {
                calendar.onEventMove(args);
            }
            if (!args.async) {
                performMove();
            }
        };
        this._doEventMoveUpdate = function (args) {
            var e = args.e;
            var newStart = args.newStart;
            var newEnd = args.newEnd;
            var newResource = args.newResource;
            e.start(newStart);
            e.end(newEnd);
            e.resource(newResource);
            calendar.events.update(e);
            calendar.events._immediateRefresh();
        };
        this._timeRangeSelectedDispatchFromRange = function (range) {
            if (!range) {
                return;
            }
            if (range.args) {
                calendar._timeRangeSelectedDispatch(range.args.start, range.args.end, range.args.resource);
            }
            else {
                var sel = calendar._getSelection(range);
                if (!sel) {
                    return;
                }
                calendar._timeRangeSelectedDispatch(sel.start, sel.end, sel.resource);
            }
        };
        this._timeRangeSelectedDispatch = function (start, end, resource) {
            if (calendar.timeRangeSelectedHandling === 'Disabled') {
                return;
            }
            var rawend = end;
            end = calendar._adjustEndOut(rawend);
            var args = {};
            args.control = calendar;
            args.start = start;
            args.end = end;
            args.resource = resource;
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            args.toJSON = function () {
                return DayPilot.Util.copyProps(args, {}, ["start", "end", "resource"]);
            };
            if (typeof calendar.onTimeRangeSelect === 'function') {
                calendar.onTimeRangeSelect(args);
                if (args.preventDefault.value) {
                    return;
                }
                start = args.start;
                end = args.end;
            }
            end = calendar._adjustEndIn(end);
            calendar._updateRange(calendar._rangeHold, start, end);
            calendar._drawRange(calendar._rangeHold);
            if (typeof calendar.onTimeRangeSelected === 'function') {
                calendar.onTimeRangeSelected(args);
            }
        };
        this._updateRange = function (range, start, end) {
            if (!range) {
                return;
            }
            var rawend = end;
            var itc;
            if (start.getTime() < calendar.startDate.getTime()) {
                range.start.x = 0;
                range.start.time = calendar.startDate.getTime();
            }
            else {
                itc = calendar._getCellFromTime(start);
                range.start.x = itc.i;
                range.start.time = start;
            }
            var endDate = calendar.startDate.addDays(calendar.days);
            if (rawend.getTime() > endDate.getTime()) {
                range.end.x = calendar._cellCount();
                range.end.time = endDate.getTime();
            }
            else {
                itc = calendar._getCellFromTime(rawend.addMilliseconds(-1));
                range.end.x = itc.i;
                range.end.time = end;
            }
        };
        this._rowClickDispatch = function (e, ev) {
            calendar._rowClickSingle(e, ev);
        };
        this._rowClickSingle = function (e, ev) {
            var args = {};
            args.resource = e;
            args.row = e;
            args.ctrl = ev.ctrlKey;
            args.shift = ev.shiftKey;
            args.meta = ev.metaKey;
            args.originalEvent = ev;
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            if (typeof calendar.onRowClick === 'function') {
                calendar.onRowClick(args);
                if (args.preventDefault.value) {
                    return;
                }
            }
            if (typeof calendar.onRowClicked === 'function') {
                calendar.onRowClicked(args);
            }
        };
        this._timeHeaderClickDispatch = function (e) {
            var args = {};
            args.header = e;
            args.control = calendar;
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            if (typeof calendar.onTimeHeaderClick === 'function') {
                calendar.onTimeHeaderClick(args);
                if (args.preventDefault.value) {
                    return;
                }
            }
            if (typeof calendar.onTimeHeaderClicked === 'function') {
                calendar.onTimeHeaderClicked(args);
            }
        };
        this.getViewport = function () {
            var scrollX = this.nav.scroll.scrollLeft;
            var scrollY = this.nav.scroll.scrollTop;
            var viewport = {};
            var area = calendar._getArea(scrollX, scrollY);
            var res = calendar._getAreaResources(area);
            var leftCell = calendar._getCell(area.start.x);
            var rightCell = calendar._getCell(area.end.x);
            viewport.start = calendar.getDate(scrollX, true);
            viewport.end = calendar.getDate(scrollX + calendar.nav.scroll.clientWidth, true, true);
            viewport.resources = res;
            if (leftCell) {
                viewport.topLeft = {
                    "start": leftCell.start,
                    "end": leftCell.end,
                    x: area.start.x,
                    y: area.start.y,
                    "resource": res[0]
                };
            }
            if (rightCell) {
                viewport.bottomRight = {
                    "start": rightCell.start,
                    "end": rightCell.end,
                    x: area.end.x,
                    y: area.end.y,
                    "resource": res[res.length - 1]
                };
            }
            viewport.rows = function () {
                return viewport.resources.map(function (r) { return calendar.rows.find(r); });
            };
            viewport.events = function () {
                var events = [];
                viewport.rows().forEach(function (r) {
                    events = events.concat(r.events.forRange(viewport.start, viewport.end));
                });
                return events;
            };
            return viewport;
        };
        this._getArea = function (scrollX, scrollY) {
            var area = {};
            area.start = {};
            area.end = {};
            var start = calendar._getCellFromPixels(scrollX);
            var end = calendar._getCellFromPixels(scrollX + calendar.nav.scroll.clientWidth);
            if (start) {
                area.start.x = start.x;
            }
            if (end) {
                area.end.x = end.x;
            }
            var topY = scrollY;
            var bottomY = scrollY + calendar.nav.scroll.clientHeight;
            area.start.y = calendar._getRow(topY).i;
            area.end.y = calendar._getRow(bottomY).i;
            area.start.x = DayPilot.Util.atLeast(area.start.x, 0);
            var maxX = calendar._cellCount();
            if (area.end.x >= maxX) {
                area.end.x = maxX - 1;
            }
            return area;
        };
        this._getAreaResources = function (area) {
            if (!area) {
                area = this._getArea(this.nav.scroll.scrollLeft, this.nav.scroll.scrollTop);
            }
            var res = [];
            res.ignoreToJSON = true;
            for (var i = area.start.y; i <= area.end.y; i++) {
                var r = calendar.rowlist[i];
                if (r) {
                    res.push(r.id);
                }
            }
            return res;
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
        this._updateTheme = function () {
            var needsUpdate = calendar.nav.top.className !== calendar._prefixCssClass("_main");
            if (!needsUpdate) {
                return;
            }
            calendar.nav.top.className = calendar._prefixCssClass("_main");
            calendar.nav.dh1.className = calendar._prefixCssClass("_divider_horizontal");
            calendar.nav.dh2.className = calendar._prefixCssClass("_divider_horizontal");
            calendar.divResScroll.className = calendar._prefixCssClass("_rowheader_scroll");
            calendar.nav.divider.className = calendar._prefixCssClass("_divider") + " " + calendar._prefixCssClass("_splitter");
            calendar.nav.scroll.className = calendar._prefixCssClass("_scrollable");
            calendar._maind.className = calendar._prefixCssClass("_matrix") + " " + calendar._prefixCssClass("_grid_main");
        };
        this._registerDispose = function () {
            this.nav.top.dispose = this.dispose;
        };
        this.dispose = function () {
            var c = calendar;
            if (!c._initialized) {
                return;
            }
            if (c._disposed) {
                return;
            }
            c._disposed = true;
            for (var name_2 in c._timeouts) {
                var item = c._timeouts[name_2];
                if (DayPilot.isArray(item)) {
                    item.forEach(function (t) {
                        clearTimeout(t);
                    });
                }
                else {
                    clearTimeout(item);
                }
            }
            c._deleteEvents();
            c.divCells = null;
            c.divCorner = null;
            c.divEvents = null;
            if (c.divHeader) {
                c.divHeader.rows = null;
            }
            c.divHeader = null;
            c.divLines = null;
            c.divNorth = null;
            c.divRange = null;
            c.divResScroll = null;
            c.divStretch = null;
            c.divTimeScroll = null;
            c._scrollRes = null;
            c._maind.calendar = null;
            c._maind = null;
            c.nav.top.onmousemove = null;
            c.nav.top.onmouseout = null;
            c.nav.top.dispose = null;
            c.nav.top.ontouchstart = null;
            c.nav.top.ontouchmove = null;
            c.nav.top.ontouchend = null;
            c.nav.top.removeAttribute('style');
            c.nav.top.removeAttribute('class');
            c.nav.top.innerHTML = "";
            c.nav.top.dp = null;
            c.nav.top = null;
            c.nav.scroll.onscroll = null;
            c.nav.scroll.root = null;
            c.nav.scroll = null;
            DayPilotScheduler._unregister(c);
            eventloading = null;
        };
        this.disposed = function () {
            return calendar._disposed;
        };
        this._createShadow = function (object) {
            var event = null;
            if (object.nodeType) {
                event = object.event;
            }
            else {
                event = object;
            }
            var eventBorderRadius = calendar.eventBorderRadius;
            if (typeof eventBorderRadius === "number") {
                eventBorderRadius += "px";
            }
            var coords = calendar._getShadowCoords(event);
            var rowlist = calendar.rowlist;
            var height = calendar.eventHeight;
            var top = (event.part && event.part.top && rowlist[event.part.dayIndex]) ? (event.part.top + rowlist[event.part.dayIndex].top) : coords.top;
            var left = coords.left;
            var width = coords.width;
            var shadow = document.createElement('div');
            shadow.style.position = 'absolute';
            shadow.style.width = width + 'px';
            shadow.style.height = height + 'px';
            shadow.style.left = left + 'px';
            shadow.style.top = top + 'px';
            shadow.style.overflow = 'hidden';
            var inner = createDiv();
            shadow.appendChild(inner);
            shadow.className = this._prefixCssClass("_shadow");
            inner.className = this._prefixCssClass("_shadow_inner");
            if (eventBorderRadius) {
                shadow.style.borderRadius = eventBorderRadius;
                inner.style.borderRadius = eventBorderRadius;
            }
            calendar.divShadow.appendChild(shadow);
            shadow.calendar = calendar;
            return shadow;
        };
        this._getRow = function (y) {
            var rowlist = calendar.rowlist;
            var result = {};
            var element;
            var top = 0;
            var rowEnd = 0;
            var iMax = rowlist.length;
            for (var i = 0; i < iMax; i++) {
                var row = rowlist[i];
                rowEnd += row.height;
                top = rowEnd - row.height;
                element = row;
                result.top = top;
                result.bottom = rowEnd;
                result.i = i;
                result.element = element;
                if (y < rowEnd) {
                    break;
                }
            }
            return result;
        };
        this._getRowByIndex = function (i) {
            if (i > this.rowlist.length - 1) {
                throw new DayPilot.Exception("Row index too high");
            }
            var bottom = 0;
            for (var j = 0; j <= i; j++) {
                bottom += this.rowlist[j].height;
            }
            var row = this.rowlist[i];
            var top = bottom - row.height;
            return {
                top: top,
                height: row.height,
                bottom: bottom,
                i: i,
                data: row
            };
        };
        this.events.find = function (id) {
            if (!calendar.events.list || typeof calendar.events.list.length === 'undefined') {
                return null;
            }
            if (typeof id === "function") {
                return calendar._eventsFindByFunction(id);
            }
            var len = calendar.events.list.length;
            for (var i = 0; i < len; i++) {
                if (calendar.events.list[i].id === id) {
                    return new DayPilot.Event(calendar.events.list[i], calendar);
                }
            }
            return null;
        };
        this.events.findAll = function (f) {
            if (typeof f === "function") {
                var len = calendar.events.list.length;
                var result = [];
                for (var i = 0; i < len; i++) {
                    var e = new DayPilot.Event(calendar.events.list[i], calendar);
                    if (f(e)) {
                        result.push(e);
                    }
                }
                return result;
            }
            if (typeof f === "object") {
                return calendar.events.findAll(function (e) {
                    for (var name_3 in f) {
                        if (f[name_3] !== e.data[name_3]) {
                            return false;
                        }
                    }
                    return true;
                });
            }
            throw new DayPilot.Exception("function or object argument expected");
        };
        this._eventsFindByFunction = function (f) {
            var len = calendar.events.list.length;
            for (var i = 0; i < len; i++) {
                var e = new DayPilot.Event(calendar.events.list[i], calendar);
                if (f(e)) {
                    return e;
                }
            }
            return null;
        };
        this.events.focus = function (e) {
            var div = calendar._findEventDivEnsureRendered(e);
            div === null || div === void 0 ? void 0 : div.focus();
        };
        this.events.scrollIntoView = function (e) {
            var div = calendar._findEventDivEnsureRendered(e);
            if (!div) {
                return;
            }
            var target = e.start();
            var viewport = calendar.getViewport();
            if (!DayPilot.Util.overlaps(viewport.start, viewport.end, e.start(), e.end()) && DayPilot.Util.overlaps(calendar._visibleStart(), calendar._visibleEnd(), e.start(), e.end())) {
                calendar.scrollTo(target, "fast", "middle");
            }
            var r = e.resource();
            if (calendar.getViewport().resources.indexOf(r) === -1) {
                calendar.scrollToResource(r);
            }
        };
        this.events.all = function () {
            var list = [];
            for (var i = 0; i < calendar.events.list.length; i++) {
                var e = new DayPilot.Event(calendar.events.list[i], calendar);
                list.push(e);
            }
            return list;
        };
        this.events.forRange = function (start, end) {
            start = start ? new DayPilot.Date(start) : calendar.visibleStart();
            end = end ? new DayPilot.Date(end) : calendar.visibleEnd();
            var list = [];
            for (var i = 0; i < calendar.events.list.length; i++) {
                var e = new DayPilot.Event(calendar.events.list[i], calendar);
                if (DayPilot.Util.overlaps(e.start(), e.end(), start, end)) {
                    list.push(e);
                }
            }
            return list;
        };
        this.events.load = function (url, success, error) {
            if (!url) {
                throw new DayPilot.Exception("events.load(): 'url' parameter required");
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
                    calendar.events.list = sargs.data;
                    if (calendar._initialized) {
                        calendar.update();
                    }
                }
            };
            var usePost = calendar.eventsLoadMethod && calendar.eventsLoadMethod.toUpperCase() === "POST";
            if (usePost) {
                DayPilot.ajax({
                    "method": "POST",
                    "contentType": "application/json",
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
                DayPilot.ajax({
                    "method": "GET",
                    "url": fullUrl,
                    "success": onSuccess,
                    "error": onError
                });
            }
        };
        this.events._removeFromRows = function (data) {
            var rows = [];
            var rowlist = calendar.rowlist;
            rowlist.forEach(function (row) {
                calendar._ensureRowData(row.index);
                for (var r = 0; r < row.events.length; r++) {
                    var rd = row.events[r].data;
                    if (calendar._isSameEvent(rd, data)) {
                        rows.push(row);
                        row.events.splice(r, 1);
                        break;
                    }
                }
            });
            return rows;
        };
        this.events._findEventInRows = function (data) {
            if (!data) {
                return null;
            }
            var rowlist = calendar.rowlist;
            for (var i = 0; i < rowlist.length; i++) {
                var row = rowlist[i];
                calendar._ensureRowData(row.index);
                for (var r = 0; r < row.events.length; r++) {
                    var re = row.events[r];
                    if (calendar._isSameEvent(re.data, data)) {
                        return row.events[r];
                    }
                }
            }
            return null;
        };
        this.events._addToRows = function (data) {
            var rows = [];
            var testAll = calendar._containsDuplicateResources();
            var index = DayPilot.indexOf(calendar.events.list, data);
            calendar._doBeforeEventRender(index);
            var rowlist = calendar.rowlist;
            var quit = false;
            rowlist.forEach(function (row) {
                if (quit) {
                    return;
                }
                calendar._ensureRowData(row.index);
                var ep = calendar._loadEvent(data, row);
                if (ep) {
                    if (typeof calendar.onBeforeEventRender === 'function') {
                        ep.cache = calendar._cache.events[index];
                    }
                    rows.push(row);
                    if (!testAll) {
                        quit = true;
                    }
                }
            });
            return rows;
        };
        this._isSameEvent = function (data1, data2) {
            return DayPilot.Util.isSameEvent(data1, data2);
        };
        this.events.update = function (e) {
            if (typeof e === "object" && !(e instanceof DayPilot.Event)) {
                var ev = calendar.events.find(e.id);
                calendar.events.remove(ev);
                calendar.events.add(e);
                return;
            }
            var inList = calendar.events.list.find(function (item) {
                return calendar._isSameEvent(item, e.data);
            });
            if (!inList) {
                return;
            }
            if (calendar._angular2._eventsFromAttr) {
                calendar._angular2.skip = true;
            }
            var rows = calendar.events._removeFromRows(e.data);
            e.commit();
            rows = rows.concat(calendar.events._addToRows(e.data));
            calendar.events._postponedUpdate(rows);
        };
        this.events.remove = function (e) {
            if (!e) {
                return;
            }
            if (typeof e === "string" || typeof e === "number") {
                var found = calendar.events.find(e);
                calendar.events.remove(found);
                return;
            }
            var inList = calendar._findEventInList(e.data);
            if (inList) {
                calendar.events.list.splice(inList.index, 1);
            }
            if (calendar._angular2._eventsFromAttr) {
                calendar._angular2.skip = true;
            }
            var rows = calendar.events._removeFromRows(e.data);
            calendar.events._postponedUpdate(rows);
        };
        this.events.add = function (e, data, options) {
            options = options || {};
            var renderOnly = options.renderOnly;
            if (!(e instanceof DayPilot.Event)) {
                e = new DayPilot.Event(e);
            }
            e.calendar = calendar;
            if (!calendar.events.list) {
                calendar.events.list = [];
            }
            var inList = calendar._findEventInList(e);
            if (renderOnly) {
                if (!inList) {
                    throw new DayPilot.Exception("Unexpected: event not found in list");
                }
            }
            else {
                if (inList) {
                    throw new DayPilot.Exception("The event you are trying to add using DayPilot.Scheduler.events.add() is already loaded. A unique ID is required.");
                }
                if (!inList) {
                    calendar.events.list.push(e.data);
                }
            }
            if (!calendar._initialized) {
                return;
            }
            if (calendar._angular2._eventsFromAttr) {
                calendar._angular2.skip = true;
            }
            var rows = calendar.events._addToRows(e.data);
            calendar.events._postponedUpdate(rows);
        };
        this.events._overlaps = function (e) {
            var data = e instanceof DayPilot.Event ? e.data : e;
            var start = new DayPilot.Date(data.start);
            var end = new DayPilot.Date(data.end);
            var overlapping = calendar.events.list.find(function (item) {
                if (calendar._isSameEvent(data, item)) {
                    return false;
                }
                if (data.resource !== item.resource) {
                    return false;
                }
                var itemStart = new DayPilot.Date(item.start);
                var itemEnd = new DayPilot.Date(item.end);
                return DayPilot.Util.overlaps(start, end, itemStart, itemEnd);
            });
            return !!overlapping;
        };
        this.events._postponedData = { "rows": [] };
        this.events._postponedTimeout = null;
        this.events._postponedClear = function () {
            clearTimeout(calendar.events._postponedTimeout);
            calendar.events._postponedTimeout = null;
            calendar.events._postponedData.rows = [];
        };
        this.events._queueUpdateInterval = 0;
        this.events._postponedUpdate = function (rows) {
            var update = calendar.events._postponedData.rows;
            rows.forEach(function (row) {
                update.push(row);
            });
            calendar.events._postponedData.rows = DayPilot.ua(update);
            var doit = calendar.events._immediateRefresh;
            if (!calendar.events._postponedTimeout) {
                calendar.events._postponedTimeout = setTimeout(doit, calendar.events._queueUpdateInterval);
            }
        };
        this.events._immediateRefresh = function () {
            clearTimeout(calendar.events._postponedTimeout);
            calendar.events._postponedTimeout = null;
            var rows = calendar.events._postponedData.rows;
            calendar.events._postponedData.rows = [];
            calendar._loadRows(rows);
            calendar._updateRowHeights();
            if (calendar._initialized) {
                if (calendar._rowsDirty) {
                    calendar._prepareRowTops();
                }
                calendar._updateHeight();
                calendar._updateRowsNoLoad(rows);
            }
        };
        this._angular2 = {};
        this._angular2.enabled = false;
        this._angular2.skip = false;
        this._angular2.skipUpdate = function () {
            return calendar._angular2.skip;
        };
        this._angular2.skipped = function () {
            calendar._angular2.skip = false;
        };
        this._angular2._resourcesFromAttr = false;
        this._angular2._eventsFromAttr = false;
        this._react = {};
        this._react.reactDOM = null;
        this._react.react = null;
        this._getBoxStart = function (date) {
            var start = calendar.startDate;
            if (date.ticks === start.ticks) {
                return date;
            }
            var cursor = start;
            if (date.ticks < start.ticks) {
                while (cursor.ticks > date.ticks) {
                    cursor = cursor.addTime(-calendar._getCellDuration() * 60 * 1000);
                }
                return cursor;
            }
            var cell = this._getCellFromTime(date);
            if (cell.current) {
                return cell.current.start;
            }
            throw new DayPilot.Exception("getBoxStart(): time not found");
        };
        this._getShadowCoords = function (e) {
            var row = this._getRow(calendar.coords.y);
            if (typeof e.end !== 'function') {
                throw new DayPilot.Exception("e.end function is not defined");
            }
            if (!e.end()) {
                throw new DayPilot.Exception("e.end() returns null");
            }
            var duration = DayPilot.DateUtil.diff(e.rawend(), e.start());
            duration = DayPilot.Util.atLeast(duration, 1);
            var useBox = resolved._useBox(duration);
            var startOffsetTime = 0;
            var x = calendar.coords.x;
            if (useBox) {
                startOffsetTime = e.start().getTime() - this._getBoxStart(e.start()).getTime();
            }
            var dragOffsetTime = 0;
            if (DayPilotScheduler._moveDragStart) {
                if (useBox) {
                    var estart = e.start();
                    var boxStart = this._getBoxStart(estart);
                    dragOffsetTime = DayPilotScheduler._moveDragStart.getTime() - boxStart.getTime();
                    var cellDurationTicks = calendar._getCellDuration() * 60 * 1000;
                    dragOffsetTime = Math.floor(dragOffsetTime / cellDurationTicks) * cellDurationTicks;
                }
                else {
                    dragOffsetTime = DayPilotScheduler._moveDragStart.getTime() - e.start().getTime();
                }
            }
            var start = this.getDate(x, true).addTime(-dragOffsetTime);
            if (DayPilotScheduler._resizing) {
                start = e.start();
            }
            var snapToGrid = calendar.snapToGrid;
            if (snapToGrid) {
                start = this._getBoxStart(start);
            }
            start = start.addTime(startOffsetTime);
            var end = start.addTime(duration);
            var adjustedStart = start;
            var adjustedEnd = end;
            var startPixels = this.getPixels(adjustedStart);
            var endPixels = this.getPixels(adjustedEnd);
            var left = (snapToGrid) ? startPixels.boxLeft : startPixels.left;
            var width = (snapToGrid && useBox) ? (endPixels.boxRight - left) : (endPixels.left - left);
            var coords = {};
            coords.top = row.top;
            coords.left = left;
            coords.row = row.element;
            coords.rowIndex = row.i;
            coords.width = width;
            coords.start = start;
            coords.end = end;
            coords.relativeY = calendar.coords.y - row.top;
            return coords;
        };
        this._getCellDuration = function () {
            switch (this.scale) {
                case "CellDuration":
                    return this.cellDuration;
                case "Minute":
                    return 1;
                case "Hour":
                    return 60;
                case "Day":
                    return 60 * 24;
                case "Week":
                    return 60 * 24 * 7;
            }
            throw new DayPilot.Exception("can't guess cellDuration value");
        };
        this._getCellTicks = function (itc) {
            return itc.end.ticks - itc.start.ticks;
        };
        this._updateResizingShadow = function () {
            var shadowWidth = DayPilotScheduler._resizingShadow.width;
            var shadowLeft = DayPilotScheduler._resizingShadow.left;
            var e = DayPilotScheduler._resizingEvent;
            var border = DayPilotScheduler._resizing.dpBorder;
            var newStart = null;
            var newEnd = null;
            var snapToGrid = calendar.snapToGrid;
            var exact = !snapToGrid;
            if (border === 'left') {
                newStart = calendar.getDate(shadowLeft, exact);
                newEnd = e.rawend();
            }
            else if (border === 'right') {
                newStart = e.start();
                newEnd = calendar.getDate(shadowLeft + shadowWidth, exact, true);
            }
            DayPilotScheduler._resizingShadow.start = newStart;
            DayPilotScheduler._resizingShadow.end = newEnd;
        };
        this._resizeShadow = function () {
            var coords = calendar.coords;
            var border = DayPilotScheduler._resizing.dpBorder;
            var e = DayPilotScheduler._resizing.event;
            var refX = e.part.left;
            if (border === "right") {
                refX += e.part.width;
            }
            var _step = DayPilotScheduler._resizing.event.calendar.cellWidth;
            var originalWidth = e.part.width;
            var originalLeft = e.part.left;
            var _startOffset = 0;
            var delta = (coords.x - refX);
            var newLeft, newWidth;
            var snapToGrid = calendar.snapToGrid;
            if (border === 'right') {
                newLeft = originalLeft;
                if (snapToGrid) {
                    var itc = calendar._getCellFromPixels(originalWidth + originalLeft + delta).cell;
                    var startitc = calendar._getCellFromPixels(originalLeft).cell;
                    var minWidth = (startitc.left + startitc.width) - originalLeft;
                    var newRight = itc.left + itc.width;
                    newWidth = newRight - originalLeft;
                    if (newWidth < minWidth) {
                        newWidth = minWidth;
                    }
                }
                else {
                    newWidth = originalWidth + delta;
                }
                var max = calendar._getGridWidth();
                if (originalLeft + newWidth > max) {
                    newWidth = max - originalLeft;
                }
                DayPilotScheduler._resizingShadow.left = originalLeft;
                DayPilotScheduler._resizingShadow.width = newWidth;
                DayPilotScheduler._resizingShadow.style.left = originalLeft + "px";
                DayPilotScheduler._resizingShadow.style.width = newWidth + "px";
            }
            else if (border === 'left') {
                if (snapToGrid) {
                    if (delta >= originalWidth) {
                        delta = originalWidth;
                    }
                    newLeft = Math.floor(((originalLeft + delta) + 0) / _step) * _step;
                    if (newLeft < _startOffset) {
                        newLeft = _startOffset;
                    }
                }
                else {
                    newLeft = originalLeft + delta;
                }
                newWidth = originalWidth - (newLeft - originalLeft);
                var right = originalLeft + originalWidth;
                var min = _step;
                if (!snapToGrid) {
                    min = 1;
                }
                else if (calendar.useEventBoxes === "Never") {
                    if (originalWidth < _step) {
                        min = originalWidth;
                    }
                    else {
                        min = 1;
                    }
                }
                if (newWidth < min) {
                    newWidth = min;
                    newLeft = right - newWidth;
                }
                DayPilotScheduler._resizingShadow.left = newLeft;
                DayPilotScheduler._resizingShadow.width = newWidth;
                DayPilotScheduler._resizingShadow.style.left = newLeft + "px";
                DayPilotScheduler._resizingShadow.style.width = newWidth + "px";
            }
            else {
                throw new DayPilot.Exception("Invalid dpBorder.");
            }
            calendar._updateResizingShadow();
        };
        this._moveShadow = function () {
            if (!calendar.coords) {
                return;
            }
            if (!DayPilotScheduler._movingEvent) {
                return;
            }
            var shadow = DayPilotScheduler._movingShadow;
            var coords = this._getShadowCoords(DayPilotScheduler._movingEvent);
            shadow.row = coords.row;
            shadow.style.height = DayPilot.Util.atLeast(coords.row.height, 0) + 'px';
            shadow.style.top = (coords.top) + 'px';
            shadow.style.left = coords.left + 'px';
            shadow.style.width = (coords.width) + 'px';
            shadow.start = coords.start;
            shadow.end = coords.end;
        };
        this._getTotalRowHeaderWidth = function () {
            return this.rowHeaderWidth;
        };
        this._getAreaRowsWithMargin = function () {
            return this._getAreaRows(calendar.progressiveRowRenderingPreload);
        };
        this._getAreaRows = function (margin) {
            margin = margin || 0;
            var start = 0;
            var end = calendar.rowlist.length;
            var progressive = calendar.progressiveRowRendering;
            if (progressive) {
                var area = calendar._getDrawArea();
                start = area.yStart;
                end = area.yEnd + 1;
                start = DayPilot.Util.atLeast(0, start - margin);
                end = Math.min(calendar.rowlist.length, end + margin);
            }
            return {
                "start": start,
                "end": end
            };
        };
        this._drawResHeader = function () {
            this._resHeaderDivBased = true;
            var totalWidth = this._getTotalRowHeaderWidth();
            clearHeader();
            var wrap = this.divHeader;
            wrap.style.width = totalWidth + "px";
            wrap.style.height = calendar._gridHeight + "px";
            calendar.divHeader = wrap;
            var progressive = calendar.progressiveRowRendering;
            if (progressive) {
                doNothing();
            }
            else {
                var m = this.rowlist.length;
                for (var i = 0; i < m; i++) {
                    calendar._drawRow(i);
                }
            }
            calendar._drawResScrollSpace();
            this.divResScroll.appendChild(wrap);
            function clearHeader() {
                var wrap = calendar.divHeader;
                if (wrap) {
                    wrap.rows = [];
                }
                var content = wrap;
                if (content) {
                    content.innerHTML = '';
                }
            }
        };
        this._drawResHeadersProgressive = function () {
            if (!calendar.progressiveRowRendering) {
                return;
            }
            var area = this._getAreaRowsWithMargin();
            for (var i = 0; i < calendar.rowlist.length; i++) {
                if (area.start <= i && i < area.end) {
                    calendar._drawRow(i);
                }
                else {
                    calendar._deleteRow(i);
                }
            }
        };
        this._drawResScrollSpace = function () {
            if (calendar._resolved._mobile()) {
                return;
            }
            var wrap = calendar.divHeader;
            var space = createDiv();
            space.style.position = "absolute";
            wrap.appendChild(space);
            calendar.nav.resScrollSpace = space;
            var div = createDiv();
            div.style.position = "relative";
            div.style.height = "100%";
            div.className = this._prefixCssClass("_rowheader");
            space.appendChild(div);
            var totalWidth = this._getTotalRowHeaderWidth();
            space.style.width = totalWidth + "px";
            space.style.top = this._gridHeight + "px";
        };
        this._deleteRow = function (i) {
            var row = calendar.divHeader.rows[i];
            if (!row) {
                return;
            }
            DayPilot.de(row);
            calendar.divHeader.rows[i] = null;
        };
        this._drawRowForced = function (i) {
            this._deleteRow(i);
            this._drawRow(i);
        };
        this._drawRow = function (i) {
            var rowlist = calendar.rowlist;
            var divHeader = calendar.divHeader;
            if (!divHeader) {
                return;
            }
            if (divHeader.rows[i]) {
                return;
            }
            var totalWidth = this._getTotalRowHeaderWidth();
            var row = rowlist[i];
            if (!row) {
                return;
            }
            var args = this._doBeforeRowHeaderRender(row);
            var c = createDiv();
            c.style.position = "absolute";
            c.style.top = row.top + "px";
            divHeader.rows[i] = c;
            c.row = row;
            c.index = i;
            var props = args.row;
            var width = this.rowHeaderWidth;
            c.style.width = (width) + "px";
            c.style.border = "0px none";
            var toolTip = props.toolTip || props.toolTip;
            if (toolTip) {
                c.title = toolTip;
            }
            if (typeof props.ariaLabel !== "undefined") {
                c.setAttribute("aria-label", props.ariaLabel);
            }
            else {
                c.setAttribute("aria-label", props.text || "");
            }
            c.onclick = calendar._onResClick;
            var div = createDiv();
            div.style.width = (width) + "px";
            div.className = this._prefixCssClass('_rowheader');
            if (props.cssClass) {
                DayPilot.Util.addClass(div, props.cssClass);
            }
            if (props.cssClass) {
                DayPilot.Util.addClass(div, props.cssClass);
            }
            var backColor = props.backColor || props.backColor;
            if (backColor) {
                div.style.background = backColor;
            }
            var fontColor = props.fontColor || props.fontColor;
            if (fontColor) {
                div.style.color = fontColor;
            }
            var horizontalAlignment = props.horizontalAlignment || props.horizontalAlignment;
            if (horizontalAlignment) {
                div.style.textAlign = horizontalAlignment;
            }
            div.style.height = (row.height) + "px";
            div.style.overflow = 'hidden';
            div.style.position = 'relative';
            var inner = createDiv();
            inner.className = this._prefixCssClass('_rowheader_inner');
            switch (horizontalAlignment) {
                case "right":
                    inner.style.justifyContent = "flex-end";
                    break;
                case "left":
                    inner.style.justifyContent = "flex-start";
                    break;
                case "center":
                    inner.style.justifyContent = "center";
                    break;
            }
            div.appendChild(inner);
            var areas = props.areas || [];
            var ro = calendar._createRowObject(row);
            DayPilot.Areas.attach(div, ro, {
                areas: areas,
            });
            var border = createDiv();
            border.style.position = "absolute";
            border.style.bottom = "0px";
            border.style.width = "100%";
            border.style.height = "0px";
            border.style.boxSizing = "content-box";
            border.style.borderBottom = "1px solid transparent";
            border.className = this._prefixCssClass("_resourcedivider");
            div.appendChild(border);
            var wrap = createDiv();
            var text = createDiv();
            text.innerHTML = calendar._xssTextHtml(props.text, props.html);
            text.className = calendar._prefixCssClass("_rowheader_inner_text");
            c.textDiv = text;
            c.cellDiv = div;
            wrap.appendChild(text);
            inner.appendChild(wrap);
            var va = props.verticalAlignment || props.verticalAlignment;
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
            c.appendChild(div);
            divHeader.appendChild(c);
            div.style.width = totalWidth + "px";
        };
        this._onResClick = function (ev) {
            var row = this.row;
            var r = calendar._createRowObject(row, this.index);
            calendar._rowClickDispatch(r, ev);
        };
        this._onTimeHeaderClick = function () {
            if (calendar.timeHeaderClickHandling === "Disabled") {
                return;
            }
            var cell = {};
            cell.start = this.cell.start;
            cell.level = this.cell.level;
            cell.end = this.cell.end;
            if (!cell.end) {
                cell.end = new DayPilot.Date(cell.start).addMinutes(calendar._getCellDuration());
            }
            calendar._timeHeaderClickDispatch(cell);
        };
        this._onTimeHeaderRightClick = function (ev) {
            if (calendar.timeHeaderRightClickHandling === "Disabled") {
                return;
            }
            ev.cancelBubble = true;
            ev.preventDefault();
            var cell = {};
            cell.start = this.cell.start;
            cell.level = this.cell.level;
            cell.end = this.cell.end;
            if (!cell.end) {
                cell.end = new DayPilot.Date(cell.start).addMinutes(calendar._getCellDuration());
            }
            var args = {};
            args.header = cell;
            args.preventDefault = function () {
                this.preventDefault.value = true;
            };
            if (typeof calendar.onTimeHeaderRightClick === 'function') {
                calendar.onTimeHeaderRightClick(args);
                if (args.preventDefault.value) {
                    return;
                }
            }
            if (typeof calendar.onTimeHeaderRightClicked === 'function') {
                calendar.onTimeHeaderRightClicked(args);
            }
        };
        this._createRowObject = function (row) {
            return new DayPilot.Row(row, calendar);
        };
        this._ensureRowData = function (i) {
            var rowlist = calendar.rowlist;
            var row = rowlist[i];
            if (!row.events) {
                row.resetEvents();
            }
        };
        this._eventHashes = {};
        this._loadEvents = function (events) {
            if (events) {
                this.events.list = events;
            }
            else if (!this.events.list) {
                this.events.list = [];
            }
            if (this.events.list != null && !DayPilot.isArray(this.events.list)) {
                throw new DayPilot.Exception("DayPilot.Scheduler.events.list expects an array object");
            }
            eventloading.prepareRows(true);
            var list = this.events.list;
            var ober = typeof this.onBeforeEventRender === 'function';
            var rows;
            calendar._eventHashes = {};
            for (var j = 0; j < list.length; j++) {
                var edata = list[j];
                if (!edata) {
                    continue;
                }
                if (typeof edata !== "object") {
                    throw new DayPilot.Exception("Event data item must be an object");
                }
                if (!edata.start) {
                    throw new DayPilot.Exception("Event data item must specify 'start' property");
                }
                if (edata instanceof DayPilot.Event) {
                    throw new DayPilot.Exception("DayPilot.Scheduler: DayPilot.Event object detected in events.list array. Use raw event data instead.");
                }
                var validId = typeof edata.id === "string" || typeof edata.id === "number";
                if (!validId) {
                    throw new DayPilot.Exception("All events must have an id property (string or number)");
                }
                var hash = "_" + edata.id;
                if (calendar._eventHashes[hash]) {
                    throw new DayPilot.Exception("Duplicate event IDs are not allowed: " + hash);
                }
                calendar._eventHashes[hash] = true;
                if (ober) {
                    this._doBeforeEventRender(j);
                }
                rows = calendar._rowcacheFor(edata.resource);
                for (var x = 0; rows && x < rows.length; x++) {
                    var row = rows[x];
                    var ep = this._loadEvent(edata, row);
                    if (!ep) {
                        continue;
                    }
                    if (ober) {
                        ep.cache = this._cache.events[j];
                    }
                }
            }
            var rowlist = calendar.rowlist;
            rowlist.forEach(function (row) {
                calendar._loadRow(row);
            });
            calendar._updateRowHeights();
        };
        eventloading.rowcache = {};
        eventloading.prepareRows = function (resetEvents) {
            eventloading.rowcache = {};
            var rows = calendar.rowlist;
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                if (resetEvents) {
                    row.resetEvents();
                }
                calendar._ensureRowData(row.index);
                if (!row.id) {
                    continue;
                }
                var key = typeof row.id + "_" + row.id;
                if (!eventloading.rowcache[key]) {
                    eventloading.rowcache[key] = [];
                }
                eventloading.rowcache[key].push(row);
            }
        };
        this._rowcacheFor = function (id) {
            var key = typeof id + "_" + id;
            return eventloading.rowcache[key] || [];
        };
        this._containsDuplicateResources = function () {
            var idlist = {};
            for (var i = 0; i < calendar.rowlist.length; i++) {
                var row = calendar.rowlist[i];
                var id_1 = row.id;
                if (idlist[id_1]) {
                    return true;
                }
                idlist[id_1] = true;
            }
            return false;
        };
        this._doBeforeEventRender = function (i) {
            var cache = this._cache.events;
            var data = this.events.list[i];
            var evc = {};
            if (data instanceof DayPilot.Event) {
                data = data.data;
            }
            for (var name_4 in data) {
                evc[name_4] = data[name_4];
            }
            if (typeof evc.start === "string") {
                evc.start = new DayPilot.Date(evc.start);
            }
            if (typeof evc.end === "string") {
                evc.end = new DayPilot.Date(evc.end);
            }
            if (typeof this.onBeforeEventRender === 'function') {
                var args = {};
                args.e = evc;
                args.data = evc;
                this.onBeforeEventRender(args);
            }
            cache[i] = evc;
        };
        this._loadRow = function (row) {
            row.lines = [];
            row.sections = null;
            row.events.sort(this._eventComparer);
            for (var j = 0; j < row.events.length; j++) {
                var e = row.events[j];
                row.putIntoLine(e);
            }
        };
        this._loadRows = function (rows) {
            rows = DayPilot.ua(rows);
            rows = calendar._ensureRowsArray(rows);
            rows.forEach(function (row) {
                calendar._loadRow(row);
            });
            rows.forEach(function (row) {
                calendar._updateEventPositionsInRow(row);
            });
        };
        this._loadEvent = function (e, row) {
            var start = new DayPilot.Date(e.start);
            var end = new DayPilot.Date(e.end);
            end = calendar._adjustEndIn(end);
            var startTicks = start.ticks;
            var endTicks = end.ticks;
            var schedulerStartTicks = calendar.startDate.ticks;
            var schedulerEndTicks = calendar.startDate.addDays(calendar.days).ticks;
            if (endTicks < startTicks) {
                return null;
            }
            var cache = null;
            if (typeof calendar.onBeforeEventRender === 'function') {
                var index = DayPilot.indexOf(calendar.events.list, e);
                cache = calendar._cache.events[index];
            }
            var belongsHere = row.id === e.resource && (!(endTicks <= schedulerStartTicks || startTicks >= schedulerEndTicks) || (startTicks === endTicks && startTicks === schedulerStartTicks));
            if (!belongsHere) {
                return null;
            }
            var ep = new DayPilot.Event(e, calendar);
            ep.part.dayIndex = calendar.rowlist.indexOf(row);
            ep.part.start = schedulerStartTicks < startTicks ? start : calendar.startDate;
            ep.part.end = schedulerEndTicks > endTicks ? end : calendar.startDate.addDays(calendar.days);
            var partStartPixels = this.getPixels(ep.part.start);
            var partEndPixels = this.getPixels(ep.part.end);
            if (ep.part.start === ep.part.end) {
                partEndPixels = this.getPixels(ep.part.end.addMilliseconds(1));
            }
            var left = partStartPixels.left;
            var right = partEndPixels.left;
            var useBox = resolved._useBox(endTicks - startTicks);
            if (useBox) {
                var boxLeft = partStartPixels.boxLeft;
                var boxRight = partEndPixels.boxRight;
                ep.part.left = boxLeft;
                ep.part.width = boxRight - boxLeft;
                ep.part.barLeft = Math.max(left - ep.part.left, 0);
                ep.part.barWidth = Math.max(right - left, 1);
            }
            else {
                ep.part.left = left;
                ep.part.width = Math.max(right - left, 1);
                ep.part.barLeft = 0;
                ep.part.barWidth = Math.max(right - left, 1);
            }
            var minWidth = calendar.eventMinWidth;
            ep.part.width = Math.max(ep.part.width, minWidth);
            ep.part.right = ep.part.left + ep.part.width;
            ep.cache = cache;
            row.events.push(ep);
            return ep;
        };
        this._eventComparer = function (a, b) {
            if (!a || !b || !a.start || !b.start) {
                return 0;
            }
            var byStart = a.start().ticks - b.start().ticks;
            if (byStart !== 0) {
                return byStart;
            }
            var byEnd = b.end().ticks - a.end().ticks;
            return byEnd;
        };
        this.rows = {};
        this.rows.all = function () {
            var list = [];
            for (var i = 0; i < calendar.rowlist.length; i++) {
                var r = calendar._createRowObject(calendar.rowlist[i]);
                list.push(r);
            }
            return list;
        };
        this.rows.each = function (f) {
            calendar.rows.all().forEach(f);
        };
        this.rows.forEach = function (f) {
            calendar.rows.all().forEach(f);
        };
        this.rows.find = function (param, start) {
            if (typeof param === "string" || typeof param === "number" || (!param && start)) {
                var matchingRows = calendar._rowcacheFor(param);
                if (!param) {
                    matchingRows = calendar.rowlist;
                }
                var first = null;
                if (typeof start === "string" || start instanceof DayPilot.Date) {
                    start = new DayPilot.Date(start);
                    first = matchingRows.find(function (item) {
                        return start === item.start;
                    });
                }
                else {
                    first = matchingRows[0];
                }
                if (first) {
                    return new DayPilot.Row(first, calendar);
                }
                return null;
            }
            else if (typeof param === "function") {
                var index_1 = start || 0;
                var r = calendar.rowlist.find(function (r, i) {
                    if (i < index_1) {
                        return false;
                    }
                    var row = calendar._createRowObject(r);
                    return param(row);
                });
                if (r) {
                    return calendar._createRowObject(r);
                }
            }
            else {
                throw new DayPilot.Exception("Invalid rows.find() argument: id or function expected");
            }
        };
        this.rows.load = function (url, success, error) {
            if (!url) {
                throw new DayPilot.Exception("rows.load(): 'url' parameter required");
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
                    calendar.resources = sargs.data;
                    if (calendar._initialized) {
                        calendar.update();
                    }
                }
            };
            var usePost = calendar.rowsLoadMethod && calendar.rowsLoadMethod.toUpperCase() === "POST";
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
        this.rows.remove = function (row) {
            if (typeof row === "number" || typeof row === "string") {
                var rf = calendar.rows.find(row);
                if (!rf) {
                    throw new DayPilot.Exception("The row to be removed was not found");
                }
                calendar.rows.remove(rf);
                return;
            }
            var data = row.$.row.resource;
            var sourceIndex = DayPilot.indexOf(calendar.resources, data);
            calendar.resources.splice(sourceIndex, 1);
            calendar.update();
        };
        this.rows.add = function (data) {
            calendar.resources.push(data);
            calendar._update();
        };
        this.rows.update = function (r) {
            if (!(r instanceof DayPilot.Row || typeof r === "object")) {
                throw new DayPilot.Exception("DayPilot.Scheduler.rows.update() expects a DayPilot.Row object or a data object.");
            }
            if (!(r instanceof DayPilot.Row)) {
                var data = r;
                r = calendar.rows.find(data.id);
                if (!r) {
                    return;
                }
                r.data = data;
            }
            var index = r.index;
            var rowlist = calendar.rowlist;
            var oldRow = rowlist[index];
            var res = r.data;
            var rcustomized = calendar._createRowParams(res);
            var row = calendar._createRowFromResource(rcustomized);
            row.level = oldRow.level;
            row.index = index;
            row.top = oldRow.top;
            row.height = oldRow.height;
            rowlist[index] = row;
            row.resetEvents();
            calendar._ensureRowData(row.index);
            calendar._loadEventsForRow(row);
            calendar._loadRow(row);
            calendar._drawRowForced(row.index);
            calendar._deleteCells();
            calendar._drawCells();
        };
        this._loadEventsForRow = function (row) {
            var events = calendar.events.list;
            var listlength = events.length;
            var ober = typeof calendar.onBeforeEventRender === "function";
            for (var j = 0; j < listlength; j++) {
                var edata = events[j];
                if (!edata) {
                    continue;
                }
                if (edata instanceof DayPilot.Event) {
                    throw new DayPilot.Exception("DayPilot.Scheduler: DayPilot.Event object detected in events.list array. Use raw event data instead.");
                }
                var belongsHere = edata.resource === row.id;
                if (!belongsHere) {
                    continue;
                }
                if (ober) {
                    this._doBeforeEventRender(j);
                }
                var ep = this._loadEvent(edata, row);
                if (!ep) {
                    continue;
                }
                if (ober) {
                    ep.cache = this._cache.events[j];
                }
            }
        };
        this._loadResources = function () {
            var resources = this.resources;
            var index = {};
            index.i = 0;
            if (resources != null && !DayPilot.isArray(resources)) {
                throw new DayPilot.Exception("DayPilot.Scheduler.resources expects an array object");
            }
            resources = resources || [];
            calendar.rowlist = [];
            this._loadResourcesFromArray(resources);
        };
        this._visibleStart = function () {
            return new DayPilot.Date(this.startDate);
        };
        this._visibleEnd = function () {
            var start = new DayPilot.Date(calendar.startDate);
            return start.addDays(calendar.days);
        };
        this.visibleStart = function () {
            return this._visibleStart();
        };
        this.visibleEnd = function () {
            return this._visibleEnd();
        };
        this._createRowFromResource = function (res) {
            var row = {};
            row.backColor = res.backColor;
            row.fontColor = res.fontColor;
            row.cssClass = res.cssClass;
            row.name = res.name;
            row.html = calendar._xssTextHtml(res.name, res.html);
            row.id = res.id;
            row.toolTip = res.toolTip;
            row.areas = res.areas;
            row.tags = res.tags;
            row.height = calendar.eventHeight;
            row.level = 0;
            row.resource = res._data;
            row.lines = [];
            row.isRow = true;
            row.getHeight = function () {
                return Math.max(calendar.eventHeight, this.lines.length * calendar.eventHeight);
            };
            row.resetEvents = function () {
                var r = row;
                r.events = [];
                r.events.forRange = function (start, end) {
                    start = new DayPilot.Date(start);
                    end = end ? new DayPilot.Date(end) : calendar.startDate.addDays(calendar.days);
                    var result = [];
                    for (var i = 0; i < r.events.length; i++) {
                        var ev = r.events[i];
                        var evEnd = calendar._adjustEndIn(ev.end());
                        if (DayPilot.Util.overlaps(ev.start(), evEnd, start, end)) {
                            result.push(ev);
                        }
                    }
                    return result;
                };
            };
            row._createLine = function () {
                var line = [];
                line.add = function (ep) {
                    this.push(ep);
                };
                line.isFree = function (colStart, colWidth, except) {
                    var end = colStart + colWidth - 1;
                    var max = this.length;
                    for (var i = 0; i < max; i++) {
                        var e = this[i];
                        if (!(end < e.part.left || colStart > e.part.left + e.part.width - 1)) {
                            if (DayPilot.contains(except, e.data)) {
                                continue;
                            }
                            return false;
                        }
                    }
                    return true;
                };
                return line;
            };
            row.findFreeLine = function (left, width) {
                for (var i = 0; i < this.lines.length; i++) {
                    var line_1 = this.lines[i];
                    if (line_1.isFree(left, width)) {
                        return i;
                    }
                }
                var line = row._createLine();
                this.lines.push(line);
                return this.lines.length - 1;
            };
            row.putIntoLine = function (ep) {
                var i = row.findFreeLine(ep.part.left, ep.part.width);
                this.lines[i].add(ep);
                return i;
            };
            return row;
        };
        this._loadResourcesFromArray = function (resources) {
            if (!resources) {
                return;
            }
            var rowlist = calendar.rowlist;
            for (var i = 0; i < resources.length; i++) {
                if (!resources[i]) {
                    continue;
                }
                var additional = {};
                additional.index = i;
                var res = this._createRowParams(resources[i], additional);
                var row = calendar._createRowFromResource(res, parent);
                row.index = i;
                rowlist.push(row);
            }
        };
        this._doBeforeRowHeaderRender = function (row) {
            var args = {};
            args.row = this._createRowObject(row);
            DayPilot.Util.copyProps(row, args.row, ['html', 'backColor', 'fontColor', 'cssClass', 'toolTip', 'areas']);
            if (typeof this.onBeforeRowHeaderRender === "function") {
                this.onBeforeRowHeaderRender(args);
            }
            return args;
        };
        this._createRowParams = function (res, additional) {
            var r = {
                get $data() { return this._data; }
            };
            for (var name_5 in additional) {
                r[name_5] = additional[name_5];
            }
            for (var name_6 in res) {
                r[name_6] = res[name_6];
            }
            r.html = calendar._xssTextHtml(res.name, res.html);
            r._data = res;
            return r;
        };
        this._initPrepareDiv = function () {
            this.nav.top.dp = this;
            this.nav.top.innerHTML = "";
            DayPilot.Util.addClass(this.nav.top, this._prefixCssClass("_main"));
            this.nav.top.setAttribute("role", "region");
            this.nav.top.setAttribute("aria-label", "scheduler");
            this.nav.top.style.userSelect = 'none';
            this.nav.top.style.webkitUserSelect = 'none';
            this.nav.top.style.WebkitTapHighlightColor = "rgba(0,0,0,0)";
            this.nav.top.style.WebkitTouchCallout = "none";
            if (this.width) {
                this.nav.top.style.width = this.width;
            }
            this.nav.top.style.lineHeight = "1.2";
            this.nav.top.style.position = "relative";
            if (!this.visible) {
                this.nav.top.style.display = "none";
            }
            this.nav.top.ontouchstart = touch._onMainTouchStart;
            this.nav.top.ontouchmove = touch._onMainTouchMove;
            this.nav.top.ontouchend = touch._onMainTouchEnd;
            var rowHeaderWidth = this.rowHeaderWidth;
            var left = createDiv();
            left.style.position = "absolute";
            left.style.left = "0px";
            left.style.width = (rowHeaderWidth) + "px";
            var dh1 = createDiv();
            dh1.style.height = "0px";
            dh1.style.boxSizing = "content-box";
            dh1.style.borderTop = "1px solid transparent";
            dh1.className = this._prefixCssClass("_divider_horizontal");
            this.nav.dh1 = dh1;
            this.nav.left = left;
            left.appendChild(this._drawCorner());
            left.appendChild(dh1);
            left.appendChild(this._drawResScroll());
            var divider = createDiv();
            divider.style.position = "absolute";
            divider.style.left = (rowHeaderWidth) + "px";
            divider.style.width = "1px";
            divider.style.height = (this._getTotalHeaderHeight() + this._getScrollableHeight()) + "px";
            divider.className = this._prefixCssClass("_splitter");
            this.nav.divider = divider;
            var right = createDiv();
            right.style.marginLeft = (rowHeaderWidth + 1) + "px";
            right.style.position = 'relative';
            this.nav.right = right;
            var dh2 = createDiv();
            dh2.style.position = "absolute";
            dh2.style.top = this._getTotalHeaderHeight() + "px";
            dh2.style.width = "100%";
            dh2.style.height = "1px";
            dh2.style.boxSizing = "border-box";
            dh2.style.borderBottom = "1px solid transparent";
            dh2.setAttribute("data-dh2", "true");
            dh2.className = this._prefixCssClass("_divider_horizontal");
            this.nav.dh2 = dh2;
            right.appendChild(calendar._drawTimeHeaderDiv());
            right.appendChild(calendar._drawMainContent());
            right.appendChild(dh2);
            var clear = createDiv();
            clear.style.clear = 'left';
            var dividerTop = createDiv();
            dividerTop.style.height = "1px";
            dividerTop.style.position = "absolute";
            dividerTop.style.left = "0px";
            dividerTop.style.right = "0px";
            dividerTop.style.display = "none";
            dividerTop.className = this._prefixCssClass("_divider_horizontal");
            this.nav.dividerTop = dividerTop;
            var dividerBottom = createDiv();
            dividerBottom.style.height = "1px";
            dividerBottom.style.position = "absolute";
            dividerBottom.style.left = "0px";
            dividerBottom.style.right = "0px";
            dividerBottom.style.display = "none";
            dividerBottom.className = this._prefixCssClass("_divider_horizontal") + " " + this._prefixCssClass("_divider_horizontal_frozen_bottom");
            this.nav.dividerBottom = dividerBottom;
            this.nav.top.appendChild(left);
            this.nav.top.appendChild(divider);
            this.nav.top.appendChild(right);
            this.nav.top.appendChild(clear);
            this.nav.top.appendChild(dividerTop);
            this.nav.top.appendChild(dividerBottom);
        };
        this._updateHeaderHeight = function () {
            var height = this._getTotalHeaderHeight();
            if (this.nav.corner) {
                this.nav.corner.style.height = (height) + "px";
            }
            if (this.divTimeScroll) {
                this.divTimeScroll.style.height = height + "px";
            }
            if (this.divNorth) {
                this.divNorth.style.height = height + "px";
            }
            if (this.nav.dh1 && this.nav.dh2) {
                this.nav.dh1.style.top = height + "px";
                this.nav.dh2.style.top = height + "px";
            }
            this.nav.scroll.style.top = (height + 1) + "px";
        };
        this._updateRowHeaderWidthOuter = function () {
            var dividerWidth = 1;
            var width = this.rowHeaderWidth;
            if (this.nav.corner) {
                this.nav.corner.style.width = width + "px";
            }
            this.divResScroll.style.width = width + "px";
            this.nav.left.style.width = (width) + "px";
            this.nav.divider.style.left = (width - dividerWidth) + "px";
            this.nav.right.style.marginLeft = (width) + "px";
        };
        this._updateRowHeaderWidthInner = function () {
            var total = this.rowHeaderWidth;
            var table = this.divHeader;
            table.style.width = total + "px";
            var range = calendar._getAreaRowsWithMargin();
            for (var i = range.start; i < range.end; i++) {
                var row = table.rows[i];
                if (!row) {
                    continue;
                }
                var width = calendar.rowHeaderWidth;
                row.style.width = width + "px";
                var div = row.firstChild;
                div.style.width = width + "px";
            }
            if (calendar.nav.resScrollSpace) {
                calendar.nav.resScrollSpace.style.width = total + "px";
            }
        };
        this._updateRowHeaderWidth = function () {
            this._updateRowHeaderWidthOuter();
            this._updateRowHeaderWidthInner();
        };
        this._drawCorner = function () {
            var rowHeaderWidth = this.rowHeaderWidth;
            var div = createDiv();
            calendar.nav.corner = div;
            div.style.width = rowHeaderWidth + "px";
            div.style.height = (this._getTotalHeaderHeight()) + "px";
            div.style.overflow = 'hidden';
            div.style.position = 'relative';
            div.oncontextmenu = function () { return false; };
            div.className = this._prefixCssClass('_corner');
            var inner = createDiv();
            inner.style.position = "absolute";
            inner.style.top = "0px";
            inner.style.left = "0px";
            inner.style.right = "0px";
            inner.style.bottom = "0px";
            inner.className = this._prefixCssClass('_corner_inner');
            inner.innerHTML = '&nbsp;';
            this.divCorner = inner;
            div.appendChild(inner);
            return div;
        };
        this._getTotalHeaderHeight = function () {
            if (calendar.timeHeaders) {
                return calendar.timeHeaders.length * calendar.headerHeight;
            }
            else {
                return 0;
            }
        };
        this._rowHeaderScrollSyncTimeout = null;
        this._drawResScroll = function () {
            var div = createDiv();
            div.style.width = (this.rowHeaderWidth) + "px";
            div.style.height = this._getScrollableHeight() + "px";
            div.style.overflow = 'hidden';
            div.style.position = 'relative';
            div.className = calendar._prefixCssClass("_rowheader_scroll");
            var mobile = calendar._resolved._mobile();
            if (mobile) {
                div.style.overflowY = "auto";
            }
            div.ontouchstart = function () {
                DayPilotScheduler._touchingRes = true;
            };
            div.oncontextmenu = function () { return false; };
            div.onscroll = function () {
                if (calendar._rowHeaderScrollSyncTimeout) {
                    clearTimeout(calendar._rowHeaderScrollSyncTimeout);
                }
                if (mobile) {
                    var f = function () {
                        var maxScrollY = calendar._getScrollableInnerHeight() - calendar.nav.scroll.offsetHeight;
                        div.scrollTop = Math.min(div.scrollTop, maxScrollY);
                        calendar.nav.scroll.scrollTop = div.scrollTop;
                    };
                    if (DayPilot.browser.ios) {
                        if (DayPilotScheduler._touchingRes) {
                            calendar._rowHeaderScrollSyncTimeout = setTimeout(f, 10);
                        }
                    }
                    else {
                        calendar._rowHeaderScrollSyncTimeout = setTimeout(f, 10);
                    }
                }
                else {
                    calendar._rowHeaderScrollSyncTimeout = setTimeout(function () {
                        calendar.nav.scroll.scrollTop = div.scrollTop;
                    }, 500);
                }
            };
            div.setAttribute("role", "region");
            div.setAttribute("aria-label", "scheduler rows");
            var wrap = createDiv();
            this.divHeader = wrap;
            div.appendChild(wrap);
            this.divResScroll = div;
            this._scrollRes = div;
            return div;
        };
        this._wd = null;
        this._watchObserver = null;
        this._watchWidthChanges = function () {
            var fix = function () {
                calendar._resize();
                calendar._onScroll();
            };
            var detect = function () {
                var top = calendar.nav.top;
                if (!top) {
                    return;
                }
                if (!calendar._wd) {
                    calendar._wd = {};
                    calendar._wd.width = top.offsetWidth;
                    return;
                }
                var widthChanged = calendar._wd.width !== top.offsetWidth;
                if (widthChanged) {
                    calendar._wd.width = top.offsetWidth;
                    fix();
                }
            };
            if (calendar._watchObserver) {
                return;
            }
            var observer = new ResizeObserver(DayPilot.debounce(detect, 100));
            observer.observe(calendar.nav.top);
            calendar._watchObserver = observer;
        };
        this._resize = function () {
            if (calendar._disposed) {
                return;
            }
            calendar._updateHeight();
            calendar._updateSelectionPosition();
            calendar._cache.drawArea = null;
        };
        this._updateSelectionPosition = function () {
            var range = calendar._rangeHold;
            calendar.clearSelection();
            calendar._rangeHold = range;
            calendar._drawRange(range, { "justDraw": true });
        };
        this._drawTimeHeaderDiv = function () {
            var div = createDiv();
            div.style.overflow = 'hidden';
            div.style.display = 'block';
            div.style.position = 'absolute';
            div.style.top = "0px";
            div.style.width = "100%";
            div.style.height = this._getTotalHeaderHeight() + "px";
            div.style.overflow = "hidden";
            div.className = calendar._prefixCssClass("_timeheader_scroll");
            this.divTimeScroll = div;
            var inner = createDiv();
            inner.style.width = (this._getGridWidth() + 5000) + "px";
            this.divNorth = inner;
            div.appendChild(inner);
            return div;
        };
        this._getScrollableHeight = function () {
            var height = 0;
            var spec = calendar.heightSpec;
            if (spec === 'Fixed') {
                return this.height ? this.height : 0;
            }
            else {
                height = calendar._getScrollableInnerHeight();
            }
            var maxMode = spec === "Max";
            if (maxMode && height > calendar.height) {
                return calendar.height;
            }
            return height;
        };
        this._getScrollableInnerHeight = function () {
            var height;
            if (this._gridHeight !== -1) {
                height = this._gridHeight;
                if (this._gridHeight > 0 && calendar.nav.scroll.style.overflowX === "auto") {
                    height += DayPilot.sh(calendar.nav.scroll) + 1;
                }
            }
            else {
                height = this.rowlist.length * calendar.eventHeight;
            }
            return height;
        };
        this._drawMainContent = function () {
            var div = createDiv();
            div.style.overflow = "auto";
            div.style.overflowX = "auto";
            div.style.overflowY = "auto";
            div.style.height = (this._getScrollableHeight()) + "px";
            div.style.top = (this._getTotalHeaderHeight() + 1) + "px";
            div.style.position = "absolute";
            div.style.width = "100%";
            div.className = this._prefixCssClass("_scrollable");
            div.oncontextmenu = function () { return false; };
            this.nav.scroll = div;
            this._maind = createDiv();
            var maind = this._maind;
            maind.style.userSelect = "none";
            maind.style.webkitUserSelect = "none";
            maind.calendar = this;
            maind.style.position = 'absolute';
            var gridwidth = this._getGridWidth();
            if (gridwidth > 0) {
                maind.style.width = (gridwidth) + "px";
            }
            maind.onmousedown = this._onMaindMouseDown;
            maind.onmousemove = this._onMaindMouseMove;
            maind.onmouseup = this._onMaindMouseUp;
            maind.oncontextmenu = this._onMaindRightClick;
            maind.className = this._prefixCssClass("_matrix");
            this.divStretch = createDiv();
            this.divStretch.style.position = 'absolute';
            this.divStretch.style.height = '1px';
            maind.appendChild(this.divStretch);
            this.divCells = createDiv();
            this.divCells.style.position = 'absolute';
            this.divCells.oncontextmenu = this._onMaindRightClick;
            maind.appendChild(this.divCells);
            this.divLines = createDiv();
            this.divLines.style.position = 'absolute';
            this.divLines.oncontextmenu = this._onMaindRightClick;
            maind.appendChild(this.divLines);
            this.divSeparators = createDiv();
            this.divSeparators.style.position = 'absolute';
            this.divSeparators.oncontextmenu = this._onMaindRightClick;
            maind.appendChild(this.divSeparators);
            this.divRange = createDiv();
            this.divRange.style.position = 'absolute';
            this.divRange.oncontextmenu = this._onMaindRightClick;
            maind.appendChild(this.divRange);
            this.divEvents = createDiv();
            this.divEvents.style.position = 'absolute';
            maind.appendChild(this.divEvents);
            this.divShadow = createDiv();
            this.divShadow.style.position = 'absolute';
            maind.appendChild(this.divShadow);
            div.appendChild(maind);
            return div;
        };
        this._registerGlobalHandlers = function () {
            if (!DayPilotScheduler._globalHandlers) {
                DayPilotScheduler._globalHandlers = true;
                DayPilot.re(document, 'mouseup', DayPilotScheduler._gMouseUp);
                DayPilot.reNonPassive(document, 'touchmove', DayPilotScheduler._gTouchMove);
                DayPilot.re(document, 'touchend', DayPilotScheduler._gTouchEnd);
            }
        };
        this._registerOnScroll = function () {
            this.nav.scroll.root = this;
            this.nav.scroll.onscroll = this._onScroll;
            calendar._scrollPos = this.nav.scroll.scrollLeft;
            calendar._scrollTop = this.nav.scroll.scrollTop;
            if (this.divNorth) {
                calendar._scrollWidth = this.divNorth.clientWidth;
            }
        };
        this._batch = {};
        this._batch.step = 300;
        this._batch.delay = 10;
        this._batch.mode = "display";
        this._batch.layers = false;
        this._updateEventPositionsInRow = function (row) {
            var lineTop = 0;
            for (var j = 0; j < row.lines.length; j++) {
                var line = row.lines[j];
                for (var k = 0; k < line.length; k++) {
                    var e = line[k];
                    e.part.line = j;
                    e.part.top = lineTop + calendar.rowMarginTop;
                    e.part.right = e.part.left + e.part.width;
                }
                lineTop += calendar.eventHeight;
            }
        };
        this._drawEventsTimeout = null;
        this._drawEvents = function (batch) {
            if (calendar._disposed) {
                return;
            }
            var step = this._batch.step;
            if (this._batch.mode === 'display') {
                this.divEvents.style.display = 'none';
            }
            else if (this._batch.mode === 'visibility') {
                this.divEvents.style.visibility = 'hidden';
            }
            this.divEvents.setAttribute("role", "region");
            this.divEvents.setAttribute("aria-label", "scheduler events");
            var dynamic = this.dynamicEventRendering === 'Progressive';
            var area = this._getDrawArea();
            var top = area.pixels.top;
            var bottom = area.pixels.bottom;
            var rowlist = calendar.rowlist.filter(function (row) {
                var rowTop = row.top - resolved._progressiveMarginY();
                var rowBottom = rowTop + row.height + 2 * resolved._progressiveMarginY();
                if (dynamic && (rowBottom <= top || rowTop >= bottom)) {
                    return false;
                }
                return true;
            });
            rowlist.forEach(function (row) {
                calendar._updateEventPositionsInRow(row);
                for (var j = 0; j < row.lines.length; j++) {
                    var line = row.lines[j];
                    for (var k = 0; k < line.length; k++) {
                        var e = line[k];
                        var rendered = calendar._drawEvent(e);
                        if (batch && rendered) {
                            step--;
                            if (step <= 0) {
                                calendar.divEvents.style.visibility = '';
                                calendar.divEvents.style.display = '';
                                calendar._drawEventsTimeout = setTimeout(function () { calendar._drawEvents(batch); }, calendar._batch.delay);
                                return;
                            }
                        }
                    }
                }
            });
            this.divEvents.style.display = '';
            this._findEventsInViewPort();
        };
        this._drawEventsInRow = function (rowIndex) {
            var row = calendar.rowlist[rowIndex];
            this._updateEventPositionsInRow(row);
            for (var j = 0; j < row.lines.length; j++) {
                var line = row.lines[j];
                for (var k = 0; k < line.length; k++) {
                    var e = line[k];
                    this._drawEvent(e);
                }
            }
        };
        this._deleteEvents = function () {
            if (this.elements.events) {
                var length_1 = this.elements.events.length;
                for (var i = 0; i < length_1; i++) {
                    var div = this.elements.events[i];
                    this._deleteEvent(div);
                }
            }
            this.elements.events = [];
        };
        this._deleteEventsInRow = function (rowIndex) {
            if (this.elements.events) {
                var length_2 = this.elements.events.length;
                var removed = [];
                for (var i = 0; i < length_2; i++) {
                    var div = this.elements.events[i];
                    var e = div.event;
                    if (e.part.dayIndex === rowIndex) {
                        this._deleteEvent(div);
                        removed.push(i);
                    }
                }
                for (var i = removed.length - 1; i >= 0; i--) {
                    this.elements.events.splice(removed[i], 1);
                }
            }
        };
        this._deleteEvent = function (div) {
            var domArgs = div.domArgs;
            div.domArgs = null;
            if (domArgs && typeof calendar.onBeforeEventDomRemove === "function") {
                calendar.onBeforeEventDomRemove(domArgs);
            }
            if (domArgs && typeof calendar.onBeforeEventDomAdd === "function") {
                var target = domArgs && domArgs._targetElement;
                if (target) {
                    var isReact = calendar._react.reactDOM && DayPilot.Util.isReactComponent(domArgs.element);
                    var isVue = calendar._vue._vueImport && DayPilot.Util.isVueVNode(domArgs.element);
                    if (isReact) {
                        calendar._react._unmount(target);
                    }
                    else if (isVue) {
                        calendar._vue._renderingEvent = true;
                        calendar._vue._unmountVueComponent(target);
                        calendar._vue._renderingEvent = false;
                    }
                }
            }
            div.remove();
            div.onclick = null;
            div.oncontextmenu = null;
            div.onmouseover = null;
            div.onmouseout = null;
            div.onmousemove = null;
            div.onmousedown = null;
            div.ondblclick = null;
            if (div.event) {
                div.event.rendered = null;
                div.event = null;
            }
        };
        this._deleteOldEvents = function () {
            if (this.dynamicEventRendering !== 'Progressive') {
                return;
            }
            var deleteOld = calendar.dynamicEventRenderingCacheSweeping;
            if (!deleteOld) {
                return;
            }
            var keepPlus = calendar.dynamicEventRenderingCacheSize || 0;
            this.divEvents.style.display = 'none';
            var updated = [];
            var length = this.elements.events.length;
            for (var i = length - 1; i >= 0; i--) {
                var div = this.elements.events[i];
                if (this._oldEvent(div.event)) {
                    if (keepPlus > 0) {
                        keepPlus--;
                        updated.unshift(div);
                    }
                    else {
                        this._deleteEvent(div);
                    }
                }
                else {
                    updated.unshift(div);
                }
            }
            this.elements.events = updated;
            this.divEvents.style.display = '';
        };
        this._deleteOldCells = function (keepPlus) {
            var area = this._getDrawArea();
            var length = this.elements.cells.length;
            for (var i = length - 1; i >= 0; i--) {
                var div = this.elements.cells[i];
                var visible = (area.xStart < div.coords.x && div.coords.x <= area.xEnd) && (area.yStart < div.coords.y && div.coords.y <= area.yEnd);
                if (!visible) {
                    if (keepPlus > 0) {
                        keepPlus--;
                    }
                    else {
                        this._deleteCell(div);
                    }
                }
            }
        };
        this._deleteCell = function (div) {
            if (!div) {
                return;
            }
            if (!div.coords) {
                return;
            }
            var x = div.coords.x;
            var y = div.coords.y;
            (function cellDomRemove() {
                var domArgs = div.domArgs;
                div.domArgs = null;
                if (domArgs && typeof calendar.onBeforeCellDomRemove === "function") {
                    calendar.onBeforeCellDomRemove(domArgs);
                }
                if (domArgs && typeof calendar.onBeforeCellDomAdd === "function") {
                    var target = domArgs && domArgs._targetElement;
                    if (target) {
                        var isReact = calendar._react.reactDOM && DayPilot.Util.isReactComponent(domArgs.element);
                        var isVue = calendar._vue._vueImport && DayPilot.Util.isVueVNode(domArgs.element);
                        if (isReact) {
                            calendar._react._unmount(target);
                        }
                        else if (isVue) {
                            calendar._vue._renderingEvent = true;
                            calendar._vue._unmountVueComponent(target);
                            calendar._vue._renderingEvent = false;
                        }
                    }
                }
            })();
            DayPilot.rfa(calendar.elements.cells, div);
            DayPilot.de(div);
            calendar._cache.cells[x + "_" + y] = null;
        };
        this._hiddenEvents = function () {
            var dynamic = this.dynamicEventRendering === 'Progressive';
            if (!this.nav.scroll) {
                return false;
            }
            var top = this.nav.scroll.scrollTop - resolved._progressiveMarginY();
            var bottom = top + this.nav.scroll.clientHeight + 2 * resolved._progressiveMarginY();
            for (var i = 0; i < this.rowlist.length; i++) {
                var row = this.rowlist[i];
                var rowTop = row.top;
                var rowBottom = row.top + row.height;
                if (dynamic && (rowTop >= bottom || rowBottom <= top)) {
                    continue;
                }
                for (var j = 0; j < row.lines.length; j++) {
                    var line = row.lines[j];
                    for (var k = 0; k < line.length; k++) {
                        var e = line[k];
                        if (this._hiddenEvent(e)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        };
        this._hiddenEvent = function (data) {
            if (data.rendered) {
                return false;
            }
            var dynamic = this.dynamicEventRendering === 'Progressive';
            var left = this.nav.scroll.scrollLeft - resolved._progressiveMarginX();
            var right = left + this.nav.scroll.clientWidth + 2 * resolved._progressiveMarginX();
            var eventLeft = data.part.left;
            var eventRight = data.part.left + data.part.width;
            if (dynamic && (right <= eventLeft || left >= eventRight)) {
                return false;
            }
            return true;
        };
        this._oldEvent = function (ev) {
            if (!ev.rendered) {
                return true;
            }
            var area = this._getDrawArea();
            var top = area.pixels.top;
            var bottom = area.pixels.bottom;
            var left = area.pixels.left - this.dynamicEventRenderingMargin;
            var right = area.pixels.right + this.dynamicEventRenderingMargin;
            var eventLeft = ev.part.left;
            var eventRight = ev.part.right;
            var eventTop = ev.part.top;
            var eventBottom = ev.part.top + calendar.eventHeight;
            if (right <= eventLeft || left >= eventRight) {
                return true;
            }
            if (bottom <= eventTop || top >= eventBottom) {
                return true;
            }
            return false;
        };
        this._drawEvent = function (e, options) {
            options = options || {};
            var forced = options.forced;
            if (e.rendered) {
                return false;
            }
            var dynamic = this.dynamicEventRendering === 'Progressive';
            var rowIndex = e.part.dayIndex;
            var divEvents = calendar.divEvents;
            var rowlist = calendar.rowlist;
            var row = rowlist[rowIndex];
            var rowTop = row.top;
            var area = this._getDrawArea();
            var left = area.pixels.left - resolved._progressiveMarginX();
            var right = area.pixels.right + resolved._progressiveMarginX();
            var top = area.pixels.top;
            var bottom = area.pixels.bottom;
            var eventLeft = e.part.left;
            var eventRight = e.part.left + e.part.width;
            var eventTop = e.part.top + rowTop;
            var eventBottom = eventTop + calendar.eventHeight;
            var horizontalOut = right <= eventLeft || left >= eventRight;
            var verticalOut = (bottom <= eventTop || top >= eventBottom);
            if (!forced && dynamic && (horizontalOut || verticalOut)) {
                return false;
            }
            var width = e.part.width;
            var height = calendar.eventHeight;
            var cache = e.cache || e.data;
            var eventBorderRadius = cache.borderRadius || calendar.eventBorderRadius;
            if (typeof eventBorderRadius === "number") {
                eventBorderRadius += "px";
            }
            var padding = cache.padding || calendar.eventPadding;
            if (typeof padding === "number") {
                padding = padding + "px";
            }
            width = DayPilot.Util.atLeast(0, width);
            height = DayPilot.Util.atLeast(0, height);
            var div = createDiv();
            div.style.position = 'absolute';
            div.style.left = e.part.left + 'px';
            div.style.top = (rowTop + e.part.top) + 'px';
            div.style.width = width + 'px';
            div.style.height = height + 'px';
            if (!calendar.eventTextWrappingEnabled) {
                div.style.whiteSpace = 'nowrap';
            }
            div.style.overflow = 'hidden';
            div.className = this._prefixCssClass("_event");
            if (cache.cssClass) {
                DayPilot.Util.addClass(div, cache.cssClass);
            }
            var lineClasses = true;
            if (lineClasses && typeof e.part.line === "number") {
                DayPilot.Util.addClass(div, this._prefixCssClass("_event_line" + e.part.line));
            }
            if (eventBorderRadius) {
                div.style.borderRadius = eventBorderRadius;
            }
            if (this.showToolTip) {
                div.title = e.client.toolTip() || "";
            }
            div.onmousemove = this._onEventMouseMove;
            div.onmousedown = this._onEventMouseDown;
            div.onmouseup = this._onEventMouseUp;
            div.ontouchstart = touch._onEventTouchStart;
            div.ontouchmove = touch._onEventTouchMove;
            div.ontouchend = touch._onEventTouchEnd;
            if (e.client.clickEnabled()) {
                div.onclick = this._onEventClick;
            }
            if (typeof cache.ariaLabel !== "undefined") {
                div.setAttribute("aria-label", cache.ariaLabel);
            }
            else {
                div.setAttribute("aria-label", cache.text);
            }
            div.setAttribute("tabindex", "-1");
            var inner = createDiv();
            inner.className = calendar._prefixCssClass("_event_inner");
            if (eventBorderRadius) {
                inner.style.borderRadius = eventBorderRadius;
            }
            if (padding) {
                inner.style.padding = padding;
            }
            if (cache.backColor) {
                inner.style.background = cache.backColor;
            }
            if (cache.fontColor) {
                inner.style.color = cache.fontColor;
            }
            if (cache.borderColor === "darker" && cache.backColor) {
                inner.style.borderColor = DayPilot.ColorUtil.darker(cache.backColor, 2);
            }
            else {
                inner.style.borderColor = cache.borderColor;
            }
            if (cache.backImage) {
                inner.style.backgroundImage = "url(" + cache.backImage + ")";
                if (cache.backRepeat) {
                    inner.style.backgroundRepeat = cache.backRepeat;
                }
            }
            div.appendChild(inner);
            var startsHere = e.start().getTime() === e.part.start.getTime();
            var endsHere = e.rawend().getTime() === e.part.end.getTime();
            if (!startsHere) {
                DayPilot.Util.addClass(div, this._prefixCssClass("_event_continueleft"));
            }
            if (!endsHere) {
                DayPilot.Util.addClass(div, this._prefixCssClass("_event_continueright"));
            }
            if (e.client.barVisible() && width > 0) {
                var barLeft = 100 * e.part.barLeft / (width);
                var barWidth = Math.ceil(100 * e.part.barWidth / (width));
                var bar = createDiv();
                bar.className = this._prefixCssClass("_event_bar");
                bar.style.position = "absolute";
                if (cache.barBackColor) {
                    bar.style.backgroundColor = cache.barBackColor;
                }
                var barInner = createDiv();
                barInner.className = this._prefixCssClass("_event_bar_inner");
                barInner.style.left = barLeft + "%";
                if (0 < barWidth && barWidth <= 1) {
                    barInner.style.width = "1px";
                }
                else {
                    barInner.style.width = barWidth + "%";
                }
                if (cache.barColor) {
                    barInner.style.backgroundColor = cache.barColor;
                }
                if (cache.barImageUrl) {
                    barInner.style.backgroundImage = "url(" + cache.barImageUrl + ")";
                }
                bar.appendChild(barInner);
                div.appendChild(bar);
            }
            div.row = rowIndex;
            div.event = e;
            (function domAdd() {
                if (typeof calendar.onBeforeEventDomAdd !== "function" && typeof calendar.onBeforeEventDomRemove !== "function") {
                    calendar._xssTextHtmlForElement(inner, cache.text, cache.html);
                    return;
                }
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
                        var isReactComponent = DayPilot.Util.isReactComponent(args.element);
                        var isVueNode = DayPilot.Util.isVueVNode(args.element);
                        if (isReactComponent) {
                            if (!calendar._react.reactDOM) {
                                throw new DayPilot.Exception("Can't reach ReactDOM");
                            }
                            calendar._react._render(args.element, target);
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
                else {
                    inner.innerHTML = e.client.innerHTML();
                }
            })();
            var areas = [];
            (function deleteIcon() {
                if (calendar.eventDeleteHandling !== "Disabled" && !cache.deleteDisabled) {
                    areas.push({
                        v: "Hover",
                        w: 18,
                        h: 18,
                        top: "calc(50% - 9px)",
                        right: 2,
                        action: "None",
                        css: calendar._prefixCssClass("_event_delete"),
                        onClick: function (args) { calendar._eventDeleteDispatch(args.source); }
                    });
                }
            })();
            if (cache.areas) {
                areas = areas.concat(cache.areas);
            }
            DayPilot.Areas.attach(div, e, { areas: areas });
            this.elements.events.push(div);
            divEvents.appendChild(div);
            e.rendered = true;
            return true;
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
        this._xssTextHtmlForElement = function (element, text, html) {
            if (!DayPilot.Util.isNullOrUndefined(html)) {
                element.innerHTML = html;
            }
            else if (text !== null && text !== undefined) {
                if (calendar._resolved._xssProtectionEnabled()) {
                    element.innerText = text;
                }
                else {
                    element.innerHTML = text;
                }
            }
        };
        this._updateEventTops = function () {
            for (var i = 0; i < this.elements.events.length; i++) {
                var div = this.elements.events[i];
                var event_1 = div.event;
                var rowIndex = event_1.part.dayIndex;
                var row = calendar.rowlist[rowIndex];
                var rowTop = row.top;
                var top_1 = rowTop + event_1.part.top;
                var rowHeight = row.height;
                var height = calendar.eventHeight;
                if (event_1.part.top + height > rowHeight) {
                    height = Math.max(0, rowHeight - event_1.part.top);
                }
                div.style.top = top_1 + 'px';
                div.style.height = height + "px";
            }
        };
        this._findEventDiv = function (e) {
            if (!e) {
                return null;
            }
            for (var i = 0; i < calendar.elements.events.length; i++) {
                var div = calendar.elements.events[i];
                if (div.event === e || div.event.data === e.data) {
                    return div;
                }
            }
            return null;
        };
        this._findEventDivEnsureRendered = function (e) {
            var ev = calendar.events._findEventInRows(e.data);
            if (!ev) {
                return null;
            }
            var row = calendar.rowlist[ev.part.dayIndex];
            calendar._updateEventPositionsInRow(row);
            calendar._drawEvent(ev, { "forced": true });
            return calendar._findEventDiv(ev);
        };
        this._onEventMouseMove = function (ev) {
            var div = ev.currentTarget;
            while (div && !div.event) {
                div = div.parentNode;
            }
            calendar._eventUpdateCursor(div, ev);
            calendar._updateCoords(ev);
        };
        this._moving = {};
        this._onEventMouseDown = function (ev) {
            calendar._updateCoords(ev);
            var button = DayPilot.Util.mouseButton(ev);
            ev.preventDefault();
            ev.stopPropagation();
            if (button.left) {
                if (this.style.cursor === 'w-resize' || this.style.cursor === 'e-resize') {
                    DayPilotScheduler._preventEventClick = true;
                    DayPilotScheduler._resizing = this;
                    DayPilotScheduler._resizingEvent = this.event;
                    DayPilotScheduler._originalMouse = DayPilot.mc(ev);
                    body().style.cursor = this.style.cursor;
                }
                else if ((this.style.cursor === 'move') || (this.event.client.moveEnabled())) {
                    calendar._startMoving(this, ev);
                }
            }
        };
        this._onEventMouseUp = function (ev) {
            var button = DayPilot.Util.mouseButton(ev);
            if (button.right) {
                calendar._eventRightClickDispatch.call(this, ev);
            }
        };
        this._startMoving = function (div, ev) {
            var moving = calendar._moving;
            calendar._updateCoords(ev);
            moving._movingStarted = true;
            moving._moving = div;
            moving._movingEvent = div.event;
            moving._originalMouse = DayPilot.mc(ev);
            moving._moveOffsetX = DayPilot.mo3(div, ev).x;
            moving._moveDragStart = calendar.getDate(calendar.coords.x, true);
        };
        if (typeof DayPilot.Global.touch === "undefined") {
            DayPilot.Global.touch = {};
        }
        DayPilot.Global.touch.active = false;
        DayPilot.Global.touch.start = false;
        touch._timeouts = [];
        touch.relativeCoords = function (ev) {
            return touch._relativeCoords(ev);
        };
        touch.startResizing = function (div, border) {
            touch._startResizing(div, border);
        };
        touch.startMoving = function (div, coords) {
            touch._startMoving(div, coords);
        };
        touch._onEventTouchStart = function (ev) {
            if (DayPilot.Global.touch.active || DayPilot.Global.touch.start) {
                return;
            }
            ev.stopPropagation();
            touch._clearTimeouts();
            DayPilot.Global.touch.start = true;
            DayPilot.Global.touch.active = false;
            var div = ev.currentTarget;
            calendar.coords = touch._relativeCoords(ev);
            var holdfor = calendar.tapAndHoldTimeout;
            touch._timeouts.push(setTimeout(function () {
                DayPilot.Global.touch.active = true;
                DayPilot.Global.touch.start = false;
                ev.preventDefault();
                var e = div.event;
                switch (calendar.eventTapAndHoldHandling) {
                    case "Move":
                        if (e.client.moveEnabled()) {
                            var coords = touchMousePos(ev);
                            touch._startMoving(div, coords);
                        }
                        break;
                }
            }, holdfor));
        };
        touch._onEventTouchMove = function () {
            touch._clearTimeouts();
            DayPilot.Global.touch.start = false;
        };
        touch._onEventTouchEnd = function (ev) {
            if (DayPilot.Util.isMouseEvent(ev)) {
                return;
            }
            touch._clearTimeouts();
            if (DayPilot.Global.touch.start) {
                DayPilot.Global.touch.start = false;
                ev.preventDefault();
                ev.stopPropagation();
                var div_1 = ev.currentTarget;
                setTimeout(function () {
                    calendar._eventClickSingle(div_1, ev);
                });
            }
            setTimeout(function () {
                DayPilot.Global.touch.start = false;
                DayPilot.Global.touch.active = false;
            }, 500);
        };
        touch._onMainTouchStart = function (ev) {
            if (DayPilot.Global.touch.active || DayPilot.Global.touch.start) {
                return;
            }
            if (ev.touches.length > 1) {
                return;
            }
            if (calendar.timeRangeSelectedHandling === 'Disabled') {
                return;
            }
            touch._clearTimeouts();
            DayPilot.Global.touch.start = true;
            DayPilot.Global.touch.active = false;
            var holdfor = calendar.tapAndHoldTimeout;
            touch._timeouts.push(setTimeout(function () {
                DayPilot.Global.touch.active = true;
                DayPilot.Global.touch.start = false;
                if (typeof DayPilot.Menu !== "undefined") {
                    DayPilot.Menu.hide();
                }
                calendar.coords = touch._relativeCoords(ev);
                touch._range = calendar._rangeFromCoords();
            }, holdfor));
            var tapAllowed = true;
            if (tapAllowed) {
                calendar.coords = touch._relativeCoords(ev);
            }
        };
        touch._onMainTouchMove = function (ev) {
            touch._clearTimeouts();
            DayPilot.Global.touch.start = false;
            if (DayPilotScheduler._resizing) {
                ev.preventDefault();
                touch._updateResizing();
                return;
            }
            if (DayPilot.Global.touch.active) {
                ev.preventDefault();
                calendar.coords = touch._relativeCoords(ev);
                if (DayPilotScheduler._moving) {
                    touch._updateMoving();
                    return;
                }
                if (touch._range) {
                    var range = touch._range;
                    range.end = {
                        x: Math.floor(calendar.coords.x / calendar.cellWidth),
                        "time": calendar.getDate(calendar.coords.x, true)
                    };
                    calendar._drawRange(range);
                }
            }
        };
        touch.debug = function () { };
        touch._onMainTouchEnd = function (ev) {
            touch._clearTimeouts();
            var tapAllowed = true;
            if (DayPilot.Global.touch.active) {
                if (DayPilotScheduler._moving) {
                    ev.preventDefault();
                    var e = DayPilotScheduler._movingEvent;
                    if (calendar !== DayPilotScheduler._movingShadow.calendar) {
                        return;
                    }
                    var newStart = DayPilotScheduler._movingShadow.start;
                    var newEnd = DayPilotScheduler._movingShadow.end;
                    var newResource = DayPilotScheduler._movingShadow.row.id;
                    DayPilot.Util.removeClass(DayPilotScheduler._moving, calendar._prefixCssClass("_event_moving_source"));
                    DayPilot.de(DayPilotScheduler._movingShadow);
                    DayPilotScheduler._movingShadow.calendar = null;
                    body().style.cursor = '';
                    DayPilotScheduler._moving = null;
                    DayPilotScheduler._movingEvent = null;
                    DayPilotScheduler._movingShadow = null;
                    calendar._eventMoveDispatch(e, newStart, newEnd, newResource);
                }
                if (touch._range) {
                    var range = touch._range;
                    touch._range = null;
                    var shadow = calendar.elements.range2;
                    if (shadow && shadow.overlapping) {
                        calendar.clearSelection();
                    }
                    else {
                        calendar._timeRangeSelectedDispatchFromRange(range);
                    }
                }
            }
            else if (DayPilot.Global.touch.start && tapAllowed) {
                if (calendar.coords.x < calendar.getScrollX()) {
                    return;
                }
                var range = calendar._rangeFromCoords();
                calendar._drawRange(range);
                var shadow = calendar.elements.range2;
                if (shadow && shadow.overlapping) {
                    calendar.clearSelection();
                }
                else {
                    calendar._timeRangeSelectedDispatchFromRange(range);
                }
            }
            setTimeout(function () {
                DayPilot.Global.touch.start = false;
                DayPilot.Global.touch.active = false;
            }, 500);
        };
        touch._clearTimeouts = function () {
            for (var i = 0; i < touch._timeouts.length; i++) {
                clearTimeout(touch._timeouts[i]);
            }
            touch._timeouts = [];
        };
        touch._relativeCoords = function (ev) {
            var ref = calendar._maind;
            var t = ev.touches ? ev.touches[0] : ev;
            var x = t.pageX;
            var y = t.pageY;
            var coords = offset(x, y, ref);
            function offset(x, y, div) {
                var abs = DayPilot.abs(div);
                var coords = { x: x - abs.x, y: y - abs.y, toString: function () { return "x: " + this.x + ", y:" + this.y; } };
                return coords;
            }
            return coords;
        };
        touch._startMoving = function (div, coords) {
            DayPilotScheduler._moving = div;
            DayPilotScheduler._movingEvent = div.event;
            DayPilotScheduler._originalMouse = coords;
            var absE = DayPilot.abs(div);
            DayPilotScheduler._moveOffsetX = coords.x - absE.x;
            DayPilotScheduler._moveDragStart = calendar.getDate(calendar.coords.x, true);
            DayPilotScheduler._movingShadow = calendar._createShadow(div);
            calendar._moveShadow();
        };
        touch._startResizing = function (div, border) {
            DayPilotScheduler._resizing = div;
            DayPilotScheduler._resizingEvent = div.event;
            DayPilotScheduler._resizing.dpBorder = border;
            if (!DayPilotScheduler._resizingShadow) {
                DayPilotScheduler._resizingShadow = calendar._createShadow(div);
            }
            calendar._resizeShadow();
        };
        touch._updateResizing = function () {
            if (!DayPilotScheduler._resizingShadow) {
                var mv = DayPilotScheduler._resizing;
                DayPilotScheduler._resizingShadow = calendar._createShadow(mv);
            }
            calendar._resizeShadow();
        };
        touch._updateMoving = function () {
            if (!DayPilotScheduler._movingShadow) {
                var mv = DayPilotScheduler._moving;
                DayPilotScheduler._movingShadow = calendar._createShadow(mv);
            }
            var target = DayPilotScheduler._movingShadow.calendar;
            target._moveShadow();
        };
        this._eventUpdateCursor = function (div, ev) {
            var resizeMargin = this.eventResizeMargin;
            var object = div;
            if (typeof (DayPilotScheduler) === 'undefined') {
                return;
            }
            var offset = DayPilot.mo3(div, ev);
            if (!offset) {
                return;
            }
            calendar.eventOffset = offset;
            if (DayPilotScheduler._resizing) {
                return;
            }
            if (DayPilotScheduler._moving) {
                return;
            }
            var isFirstPart = object.event.part.start.toString() === object.event.start().toString();
            var isLastPart = object.event.part.end.toString() === object.event.rawend().toString();
            if (offset.x <= resizeMargin && object.event.client.resizeEnabled()) {
                if (isFirstPart) {
                    div.style.cursor = "w-resize";
                    div.dpBorder = 'left';
                }
                else {
                    div.style.cursor = 'not-allowed';
                }
            }
            else if (div.offsetWidth - offset.x <= resizeMargin && object.event.client.resizeEnabled()) {
                if (isLastPart) {
                    div.style.cursor = "e-resize";
                    div.dpBorder = 'right';
                }
                else {
                    div.style.cursor = 'not-allowed';
                }
            }
            else if (!DayPilotScheduler._resizing && !DayPilotScheduler._moving) {
                if (object.event.client.clickEnabled()) {
                    div.style.cursor = 'pointer';
                }
                else {
                    div.style.cursor = 'default';
                }
            }
        };
        this._cellCount = function () {
            var cellDuration = calendar._getCellDuration();
            var days = calendar.days;
            var cellsPerDay = 1440 / cellDuration;
            return days * cellsPerDay;
        };
        this._getSelection = function (range) {
            range = range || DayPilotScheduler._range || calendar._rangeHold;
            if (!range) {
                return null;
            }
            var row = calendar.rowlist[range.start.y];
            if (!row) {
                return null;
            }
            var r = range;
            var natural = r.end.time > r.start.time;
            var resource = row.id;
            var startX = natural ? r.start.x : r.end.x;
            var endX = (natural ? r.end.x : r.start.x);
            var snapToGrid = calendar.snapToGrid;
            var start, end;
            if (snapToGrid) {
                start = calendar._getCell(startX).start;
                end = calendar._getCell(endX).end;
            }
            else {
                if (natural) {
                    start = r.start.time;
                    end = r.end.time;
                }
                else {
                    start = r.end.time;
                    end = r.start.time;
                }
            }
            var sel = new DayPilot.Selection(start, end, resource, calendar);
            sel.allowed = !range.div || !range.div.overlapping;
            return sel;
        };
        this._drawTimeHeader = function () {
            this._cache.timeHeader = {};
            if (calendar.elements.timeHeader.length > 0) {
                calendar.elements.timeHeader = [];
            }
            var header = createDiv();
            header.style.position = "relative";
            this.nav.timeHeader = header;
            for (var y = 0; y < this.timeHeader.length; y++) {
                var row = this.timeHeader[y];
                for (var x = 0; x < row.length; x++) {
                    this._drawTimeHeaderCell2(x, y);
                }
            }
            var north = this.divNorth;
            if (north.childNodes.length === 1) {
                north.replaceChild(header, north.childNodes[0]);
            }
            else {
                north.innerHTML = '';
                north.appendChild(header);
            }
            var gridwidth = this._getGridWidth();
            north.style.width = (gridwidth + 5000) + "px";
            if (gridwidth > 0) {
                this.divStretch.style.width = (gridwidth) + "px";
            }
        };
        this._getGroupName = function (h, cellGroupBy) {
            var html = null;
            var locale = this._resolved._locale();
            cellGroupBy = cellGroupBy || this.cellGroupBy;
            var from = h.start;
            switch (cellGroupBy) {
                case 'Minute':
                    html = from.toString("m");
                    break;
                case 'Hour':
                    html = (calendar._resolved._timeFormat() === 'Clock12Hours') ? from.toString("h tt", locale) : from.toString("H", locale);
                    break;
                case 'Day':
                    html = from.toString(locale.datePattern);
                    break;
                case 'Week':
                    html = resolved._weekStarts() === 1 ? from.weekNumberISO() : from.weekNumber();
                    break;
                case 'Month':
                    html = from.toString("MMMM yyyy", locale);
                    break;
                case 'Quarter':
                    html = "Q" + Math.floor(from.getMonth() / 3 + 1);
                    break;
                case 'Year':
                    html = from.toString("yyyy");
                    break;
                case 'None':
                    html = '';
                    break;
                case 'Cell': {
                    var duration = (h.end.ticks - h.start.ticks) / 60000;
                    html = this._getCellName(from, duration);
                    break;
                }
                default:
                    throw new DayPilot.Exception("Invalid groupBy value: " + cellGroupBy);
            }
            return html;
        };
        this._getCellName = function (start, duration) {
            var locale = this._resolved._locale();
            duration = duration || this.cellDuration;
            if (duration < 1) {
                return start.toString("ss");
            }
            else if (duration < 60) {
                return start.toString("mm");
            }
            else if (duration < 1440) {
                return calendar._resolved._timeFormat() === 'Clock12Hours' ? start.toString("h tt", locale) : start.toString("H", locale);
            }
            else if (duration < 10080) {
                return start.toString("d");
            }
            else if (duration === 10080) {
                return resolved._weekStarts() === 1 ? start.weekNumberISO() : start.weekNumber();
            }
            else {
                return start.toString("MMMM yyyy", locale);
            }
        };
        this._addGroupSize = function (from, cellGroupBy, isScale) {
            var to;
            var endDate = calendar.startDate.addDays(calendar.days);
            cellGroupBy = cellGroupBy || this.cellGroupBy;
            var cellDuration = 60;
            switch (cellGroupBy) {
                case 'Minute':
                    if (from.getMinutes() + from.getSeconds() + from.getMilliseconds() > 0) {
                        from = from.getDatePart().addHours(from.getHours()).addMinutes(from.getMinutes());
                    }
                    to = from.addMinutes(1);
                    break;
                case 'Hour':
                    if (from.getHours() + from.getMinutes() + from.getSeconds() + from.getMilliseconds() > 0) {
                        from = from.getDatePart().addHours(from.getHours());
                    }
                    to = from.addHours(1);
                    break;
                case 'Day':
                    to = from.getDatePart().addDays(1);
                    break;
                case 'Week':
                    to = from.getDatePart().addDays(1);
                    while (to.dayOfWeek() !== resolved._weekStarts()) {
                        to = to.addDays(1);
                    }
                    break;
                case 'Month': {
                    from = from.getDatePart();
                    to = from.addMonths(1);
                    to = to.firstDayOfMonth();
                    var isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    while (!isInt) {
                        to = to.addHours(1);
                        isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    }
                    break;
                }
                case "Quarter": {
                    from = from.getDatePart();
                    to = from.addMonths(1);
                    to = to.firstDayOfMonth();
                    while (to.getMonth() % 3) {
                        to = to.addMonths(1);
                    }
                    var isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    while (!isInt) {
                        to = to.addHours(1);
                        isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    }
                    break;
                }
                case 'Year': {
                    from = from.getDatePart();
                    to = from.addYears(1);
                    to = to.firstDayOfYear();
                    var isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    while (!isInt) {
                        to = to.addHours(1);
                        isInt = (DayPilot.DateUtil.diff(to, from) / (1000.0 * 60)) % cellDuration === 0;
                    }
                    break;
                }
                case 'None':
                    to = endDate;
                    break;
                case 'Cell': {
                    var cell = this._getCellFromTime(from);
                    if (cell.current) {
                        to = cell.current.end;
                    }
                    break;
                }
                default:
                    if (isScale) {
                        throw new DayPilot.Exception("Invalid scale value: " + cellGroupBy);
                    }
                    else {
                        throw new DayPilot.Exception("Invalid groupBy value: " + cellGroupBy);
                    }
            }
            if (to.getTime() > endDate.getTime()) {
                to = endDate;
            }
            return to;
        };
        this._drawTimeHeaderCell2 = function (x, y) {
            var header = this.nav.timeHeader;
            var p = this.timeHeader[y][x];
            var isGroup = y < this.timeHeader.length - 1;
            var left = p.left;
            var width = p.width;
            var top = y * calendar.headerHeight;
            var height = calendar.headerHeight;
            var cell = createDiv();
            cell.style.position = "absolute";
            cell.style.top = top + "px";
            cell.style.left = left + "px";
            cell.style.width = width + "px";
            cell.style.height = height + "px";
            if (p.toolTip) {
                cell.title = p.toolTip;
            }
            cell.setAttribute("aria-hidden", "true");
            if (p.cssClass) {
                DayPilot.Util.addClass(cell, p.cssClass);
            }
            cell.style.userSelect = 'none';
            cell.style.webkitUserSelect = 'none';
            cell.oncontextmenu = function () { return false; };
            cell.cell = {};
            cell.cell.start = p.start;
            cell.cell.end = p.end;
            cell.cell.level = y;
            cell.cell.th = p;
            cell.onclick = this._onTimeHeaderClick;
            cell.oncontextmenu = this._onTimeHeaderRightClick;
            DayPilot.rePassive(cell, DayPilot.touch.start, function (ev) {
                ev.stopPropagation();
            });
            cell.style.overflow = 'hidden';
            if (!calendar.timeHeaderTextWrappingEnabled) {
                cell.style.whiteSpace = "nowrap";
            }
            var inner = createDiv();
            inner.innerHTML = calendar._xssTextHtml(p.text, p.html);
            if (p.backColor) {
                inner.style.background = p.backColor;
            }
            if (p.fontColor) {
                inner.style.color = p.fontColor;
            }
            var cl = this._prefixCssClass("_timeheadercol");
            var cli = this._prefixCssClass("_timeheadercol_inner");
            if (isGroup) {
                cl = this._prefixCssClass("_timeheadergroup");
                cli = this._prefixCssClass("_timeheadergroup_inner");
            }
            DayPilot.Util.addClass(cell, cl);
            DayPilot.Util.addClass(inner, cli);
            DayPilot.Util.addClass(cell, calendar._prefixCssClass("_timeheader_cell"));
            DayPilot.Util.addClass(inner, calendar._prefixCssClass("_timeheader_cell_inner"));
            cell.appendChild(inner);
            DayPilot.Areas.attach(cell, p, { areas: p.areas });
            this._cache.timeHeader[x + "_" + y] = cell;
            this.elements.timeHeader.push(cell);
            header.appendChild(cell);
        };
        this._updateCorner = function () {
            var div = this.nav.corner;
            if (!div) {
                return;
            }
            var inner = this.divCorner;
            div.className = this._prefixCssClass('_corner');
            inner.className = this._prefixCssClass('_corner_inner');
            (function _updateCornerHtml() {
                var args = {};
                args.control = calendar;
                args.backColor = null;
                args.html = calendar.cornerHtml;
                args.text = calendar.cornerText;
                args.verticalAlignment = null;
                args.horizontalAlignment = null;
                args.areas = null;
                if (typeof calendar.onBeforeCornerRender === "function") {
                    calendar.onBeforeCornerRender(args);
                }
                var cell = calendar.divCorner;
                if (cell) {
                    var html = calendar._xssTextHtml(args.text, args.html);
                    var halign = args.horizontalAlignment;
                    var valign = args.verticalAlignment;
                    cell.innerHTML = html || '';
                    if (args.backColor) {
                        cell.style.background = args.backColor;
                    }
                    if (halign || valign) {
                        cell.style.display = "flex";
                        switch (halign) {
                            case "right":
                                cell.style.justifyContent = "flex-end";
                                break;
                            case "left":
                                cell.style.justifyContent = "flex-start";
                                break;
                            case "center":
                                cell.style.justifyContent = "center";
                                break;
                        }
                        switch (valign) {
                            case "center":
                                cell.style.alignItems = "center";
                                break;
                            case "top":
                                cell.style.alignItems = "flex-start";
                                break;
                            case "bottom":
                                cell.style.alignItems = "flex-end";
                                break;
                        }
                    }
                }
                if (args.areas) {
                    DayPilot.Areas.attach(calendar.nav.corner, {}, { "areas": args.areas });
                }
            })();
        };
        this._updateRowHeights = function () {
            var rowlist = calendar.rowlist;
            rowlist.forEach(function (row) {
                var updated = row.getHeight() + calendar.rowMarginTop + calendar.rowMarginBottom;
                if (row.height !== updated) {
                    calendar._rowsDirty = true;
                }
                row.height = updated;
            });
            if (calendar._rowsDirty) {
                calendar._cache.drawArea = null;
            }
        };
        this._updateRowHeaderHeights = function () {
            var rowlist = calendar.rowlist;
            rowlist.forEach(function (row) {
                var header = calendar.divHeader;
                if (!header) {
                    return;
                }
                var index = row.index;
                if (!header.rows[index]) {
                    return;
                }
                var headerCell = header.rows[index];
                if (calendar._resHeaderDivBased) {
                    headerCell.style.top = row.top + "px";
                }
                var newHeight = row.height;
                if (headerCell && headerCell.firstChild && parseInt(headerCell.firstChild.style.height, 10) !== newHeight) {
                    headerCell.firstChild.style.height = newHeight + "px";
                }
            });
            if (calendar._resHeaderDivBased) {
                if (calendar.nav.resScrollSpace) {
                    calendar.nav.resScrollSpace.style.top = calendar._gridHeight + "px";
                }
            }
        };
        this._onMaindMouseDown = function (ev) {
            if (DayPilot.Global.touch.start || DayPilot.Global.touch.active) {
                return false;
            }
            calendar._updateCoords(ev);
            if (calendar.timeRangeSelectedHandling === "Disabled") {
                return false;
            }
            var button = DayPilot.Util.mouseButton(ev);
            if (typeof DayPilot.Menu !== "undefined") {
                DayPilot.Menu.hide();
            }
            if (calendar._dragInProgress()) {
                return false;
            }
            if (button.middle || button.right) {
                return false;
            }
            if (calendar._isWithinRange(calendar.coords)) {
                return false;
            }
            var buttonAsString = button.left ? "left" : (button.right ? "right" : (button.middle ? "middle" : "unknown"));
            calendar._rangeButton = buttonAsString;
            DayPilotScheduler._range = calendar._rangeFromCoords();
            if (DayPilotScheduler._range) {
                DayPilotScheduler._rangeCalendar = calendar;
            }
            return false;
        };
        this._rangeFromCoords = function () {
            var range = {};
            var cx = calendar._getCellFromPixels(calendar.coords.x).x;
            var time = calendar.getDate(calendar.coords.x, true);
            range.start = {
                y: calendar._getRow(calendar.coords.y).i,
                x: cx,
                "time": time
            };
            range.end = {
                x: cx,
                "time": time
            };
            range.calendar = calendar;
            calendar._drawRange(range);
            return range;
        };
        this._onMaindMouseUp = function (ev) {
            calendar._moving = {};
            if (calendar._rangeHold) {
                var button = DayPilot.Util.mouseButton(ev);
                if (button.left) {
                    var range = calendar._rangeHold;
                    if (calendar._isWithinRange(calendar.coords)) {
                        var createTimeRangeClickDispatcher = function (range) {
                            return function () {
                                DayPilotScheduler._timeRangeTimeout = null;
                                var sel = calendar._getSelection(range);
                                if (!sel) {
                                    return;
                                }
                                var args = {};
                                args.start = sel.start;
                                args.end = sel.end;
                                args.resource = sel.resource;
                                args.preventDefault = function () {
                                    args.preventDefault.value = true;
                                };
                                if (typeof calendar.onTimeRangeClick === "function") {
                                    calendar.onTimeRangeClick(args);
                                }
                                if (!args.preventDefault.value) {
                                    if (typeof calendar.onTimeRangeClicked === "function") {
                                        calendar.onTimeRangeClicked(args);
                                    }
                                }
                            };
                        };
                        if (calendar.timeRangeClickHandling !== "Disabled") {
                            createTimeRangeClickDispatcher(range)();
                        }
                    }
                }
            }
        };
        this._dragInProgress = function () {
            var inProgress = DayPilotScheduler._resizing || DayPilotScheduler._moving || DayPilotScheduler._range;
            if (inProgress) {
                return true;
            }
            if (calendar._moving._movingStarted) {
                return true;
            }
            return false;
        };
        this.dragInProgress = function () {
            return calendar._dragInProgress();
        };
        this._updateCoords = function (ev) {
            var coords = DayPilot.mo3(calendar._maind, ev);
            coords = coords || {};
            coords.stamp = coords.x + "_" + coords.y;
            if (!calendar.coords || calendar.coords.stamp !== coords.stamp) {
                calendar.coords = coords;
            }
        };
        this._onMaindMouseMove = function (ev) {
            if (DayPilot.Global.touch.active) {
                return;
            }
            var mousePos = DayPilot.mc(ev);
            calendar._updateCoords(ev);
            if (calendar._moving._movingStarted) {
                var requiredDistance = 2;
                var distance = DayPilot.distance(calendar._moving._originalMouse, mousePos);
                if (distance > requiredDistance) {
                    DayPilot.Util.copyProps(calendar._moving, DayPilotScheduler);
                    body().style.cursor = 'move';
                    calendar._moving = {};
                }
            }
            if (DayPilotScheduler._resizing && DayPilotScheduler._resizingEvent.calendar === calendar) {
                if (!DayPilotScheduler._resizing.event) {
                    DayPilotScheduler._resizing.event = DayPilotScheduler._resizingEvent;
                }
                calendar._mouseMoveUpdateResizing();
            }
            else if (DayPilotScheduler._movingEvent) {
                calendar._mouseMoveUpdateMoving();
            }
            else if (DayPilotScheduler._range && DayPilotScheduler._range.calendar === calendar) {
                DayPilotScheduler._range.moved = true;
                calendar._mouseMoveUpdateRange();
            }
        };
        this._mouseMoveUpdateRange = function () {
            var range = DayPilotScheduler._range;
            var x = calendar._getCellFromPixels(calendar.coords.x).x;
            var time = calendar.getDate(calendar.coords.x, true);
            range.end = {
                x: x,
                "time": time
            };
            calendar._drawRange(range);
        };
        this._mouseMoveUpdateResizing = function () {
            if (!DayPilotScheduler._resizingShadow) {
                DayPilotScheduler._resizingShadow = calendar._createShadow(DayPilotScheduler._resizing);
            }
            calendar._resizeShadow();
        };
        this._mouseMoveUpdateMoving = function () {
            if (!DayPilotScheduler._movingShadow) {
                DayPilot.Util.addClass(DayPilotScheduler._moving, calendar._prefixCssClass("_event_moving_source"));
                var mv = DayPilotScheduler._movingEvent;
                DayPilotScheduler._movingShadow = calendar._createShadow(mv);
            }
            calendar._moveShadow();
        };
        this._onMaindRightClick = function (ev) {
            ev.cancelBubble = true;
            return false;
        };
        this._isWithinRange = function (coords) {
            var range = calendar._rangeHold;
            if (!range || !range.start || !range.end) {
                return false;
            }
            var row = this._getRowByIndex(range.start.y);
            var leftToRight = range.start.x < range.end.x;
            var rangeLeft = (leftToRight ? range.start.x : range.end.x) * this.cellWidth;
            var rangeRight = (leftToRight ? range.end.x : range.start.x) * this.cellWidth + this.cellWidth;
            var rangeTop = row.top;
            var rangeBottom = row.bottom;
            if (coords.x >= rangeLeft && coords.x <= rangeRight && coords.y >= rangeTop && coords.y <= rangeBottom) {
                return true;
            }
            return false;
        };
        this._drawRange = function (range) {
            range = range || DayPilotScheduler._range;
            if (!range) {
                return;
            }
            var eventBorderRadius = calendar.eventBorderRadius;
            if (typeof eventBorderRadius === "number") {
                eventBorderRadius += "px";
            }
            var snapToGrid = calendar.snapToGrid;
            var rowlist = calendar.rowlist;
            draw(range);
            function draw(range) {
                var natural = range.end.time > range.start.time;
                var left, right;
                var startTime, endTime;
                var y = range.start.y;
                var timesAvailable = range.start.time && range.end.time;
                if (snapToGrid || !timesAvailable) {
                    var startX = natural ? range.start.x : range.end.x;
                    var endX = (natural ? range.end.x : range.start.x);
                    var start = calendar._getCell(startX);
                    var end = calendar._getCell(endX);
                    left = start.left;
                    right = end.left + end.width;
                }
                else {
                    if (natural) {
                        startTime = range.start.time;
                        endTime = range.end.time;
                    }
                    else {
                        startTime = range.end.time;
                        endTime = range.start.time;
                    }
                    left = calendar.getPixels(startTime).left;
                    right = calendar.getPixels(endTime).left;
                }
                var width = right - left;
                var cell = calendar.elements.range2;
                if (!cell) {
                    cell = createDiv();
                    cell.style.position = 'absolute';
                    var inner = createDiv();
                    inner.className = calendar._prefixCssClass("_shadow_inner");
                    if (eventBorderRadius) {
                        cell.style.borderRadius = eventBorderRadius;
                        inner.style.borderRadius = eventBorderRadius;
                    }
                    cell.appendChild(inner);
                    calendar.divShadow.appendChild(cell);
                }
                cell.className = calendar._prefixCssClass("_shadow");
                cell.firstChild.innerHTML = "";
                cell.style.left = (left) + "px";
                cell.style.top = rowlist[y].top + "px";
                cell.style.width = width + "px";
                cell.style.height = (rowlist[y].height - 1) + "px";
                cell.calendar = calendar;
                calendar.elements.range2 = cell;
                return cell;
            }
        };
        this._copyRange = function (range) {
            return {
                "start": {
                    "x": range.start.x,
                    "y": range.start.y,
                    "time": range.start.time,
                },
                "end": {
                    "x": range.end.x,
                    "time": range.end.time
                },
                "calendar": range.calendar,
                "args": range.args,
            };
        };
        this.getCoords = function () {
            if (!calendar.coords) {
                return null;
            }
            var result = {};
            result.x = calendar.coords.x;
            result.y = calendar.coords.y;
            var row = calendar._getRow(result.y, result.grid).element;
            result.row = calendar._createRowObject(row);
            result.time = calendar.getDate(result.x, true);
            return result;
        };
        this.zoom = {};
        this.zoom.active = -1;
        this.zoom.setActive = function (index, position, date) {
            var level;
            if (typeof index === "number") {
                level = calendar.zoomLevels[index];
            }
            else if (typeof index === "string") {
                var i = calendar.zoom._findById(index);
                level = calendar.zoomLevels[i];
            }
            else {
                throw new DayPilot.Exception("Unexpected parameter type (string or number required): " + typeof index);
            }
            if (!level) {
                throw new DayPilot.Exception("Zoom level not found: " + index + " (" + (typeof index) + ")");
            }
            if (index === calendar.zoom.active && !date) {
                return;
            }
            if (!date) {
                date = calendar.zoom._getPosition(position);
            }
            if (date) {
                calendar.startDate = new DayPilot.Date(date).getDatePart();
            }
            calendar.zoom._applyLevelProps(index, date);
            if (calendar._initialized) {
                calendar.update();
            }
            if (date) {
                calendar.scrollTo(date, null, position || calendar.zoomPosition);
            }
        };
        this.zoom._findById = function (id) {
            var zoomLevels = calendar.zoomLevels || [];
            return zoomLevels.findIndex(function (level) {
                return level.id === id;
            });
        };
        this.zoom._getPosition = function (position) {
            position = position || calendar.zoomPosition || "left";
            var date = null;
            if (!calendar.nav.scroll) {
                return null;
            }
            var viewport = calendar.getViewport();
            switch (position) {
                case "left":
                    date = viewport.start;
                    break;
                case "middle":
                    date = viewport.start && viewport.start.addTime((calendar.getViewport().end.getTime() - calendar.getViewport().start.getTime()) / 2);
                    break;
                case "right":
                    date = viewport.end;
                    break;
            }
            return date;
        };
        this.zoom._applyLevelProps = function (index, date) {
            var max = calendar.zoomLevels.length - 1;
            if (index > max) {
                index = max;
            }
            if (index < 0) {
                index = 0;
            }
            calendar.zoom.active = index;
            var level = calendar.zoomLevels[index];
            var args = {};
            args.date = date || new DayPilot.Date(calendar.startDate);
            args.level = level;
            DayPilot.Util.ownPropsAsArray(level.properties).forEach(function (item) {
                if (item.key.indexOf("on") === 0) {
                    return;
                }
                if (typeof item.val === "function") {
                    calendar[item.key] = item.val(args);
                    return;
                }
                calendar[item.key] = item.val;
            });
            return args;
        };
        this._timeouts = {};
        this._timeouts._drawEvents = null;
        this._timeouts.drawCells = null;
        this._timeouts.drawRows = null;
        this._timeouts.click = null;
        this._timeouts.resClick = [];
        this._timeouts.updateFloats = null;
        this._onScroll = function () {
            if (calendar._disposed) {
                return;
            }
            if (typeof DayPilot.Menu !== "undefined") {
                DayPilot.Menu.hide();
            }
            calendar._clearCachedValues();
            var divScroll = calendar.nav.scroll;
            calendar._scrollPos = divScroll.scrollLeft;
            calendar._scrollTop = divScroll.scrollTop;
            calendar._scrollWidth = divScroll.clientWidth;
            if (calendar.divTimeScroll) {
                calendar.divTimeScroll.scrollLeft = calendar._scrollPos;
            }
            if (DayPilot.browser.ios && DayPilotScheduler._touchingRes) {
                doNothing();
            }
            else {
                calendar.divResScroll.scrollTop = calendar._scrollTop;
            }
            if (calendar.progressiveRowRendering) {
                if (calendar._timeouts.drawRows) {
                    clearTimeout(calendar._timeouts.drawRows);
                    calendar._timeouts.drawRows = null;
                }
                if (calendar.scrollDelayRows > 0) {
                    calendar._timeouts.drawRows = setTimeout(function () { calendar._drawResHeadersProgressive(); }, calendar.scrollDelayRows);
                }
                else {
                    calendar._drawResHeadersProgressive();
                }
            }
            if (calendar._timeouts.drawCells) {
                clearTimeout(calendar._timeouts.drawCells);
                calendar._timeouts.drawCells = null;
            }
            if (calendar.scrollDelayCells > 0) {
                calendar._timeouts.drawCells = setTimeout(calendar._delayedDrawCells(), calendar.scrollDelayCells);
            }
            else {
                var f = calendar._delayedDrawCells();
                f();
            }
            if (calendar._timeouts._drawEvents) {
                clearTimeout(calendar._timeouts._drawEvents);
                calendar._timeouts._drawEvents = null;
            }
            if (calendar.scrollDelayEvents > 0) {
                calendar._timeouts._drawEvents = setTimeout(calendar._delayedDrawEvents(), calendar.scrollDelayEvents);
            }
            else {
                calendar._drawEvents();
            }
            if (calendar._timeouts.updateFloats) {
                clearTimeout(calendar._timeouts.updateFloats);
                calendar._timeouts.updateFloats = null;
            }
            if (calendar.scrollDelayFloats > 0) {
                calendar._timeouts.updateFloats = setTimeout(function () { calendar._updateFloats(); }, calendar.scrollDelayFloats);
            }
            else {
                calendar._updateFloats();
            }
            calendar.onScrollCalled = true;
            if (typeof calendar.onScroll === "function") {
                var args = {
                    control: calendar,
                    viewport: calendar.getViewport()
                };
                calendar.onScroll(args);
            }
        };
        this._delayedDrawCells = function () {
            return function () {
                if (!calendar) {
                    return;
                }
                calendar._drawCells();
            };
        };
        this._delayedDrawEvents = function () {
            var batch = true;
            return function () {
                if (!calendar) {
                    return;
                }
                if (calendar._hiddenEvents()) {
                    setTimeout(function () {
                        calendar._deleteOldEvents();
                        setTimeout(function () { calendar._drawEvents(batch); }, 50);
                    }, 50);
                }
                else {
                    calendar._findEventsInViewPort();
                }
            };
        };
        this._clearCachedValues = function () {
            calendar._cache.drawArea = null;
        };
        this.show = function () {
            calendar.visible = true;
            calendar._previousVisible = true;
            calendar.nav.top.style.display = '';
            calendar._show();
            calendar._resize();
            calendar._onScroll();
        };
        this.hide = function () {
            calendar.visible = false;
            calendar._previousVisible = false;
            calendar.nav.top.style.display = 'none';
        };
        this._findEventInList = function (data) {
            if (!calendar.events.list) {
                return null;
            }
            for (var j = 0; j < this.events.list.length; j++) {
                var ex = this.events.list[j];
                if (calendar._isSameEvent(ex, data)) {
                    var result = {};
                    result.ex = ex;
                    result.index = j;
                    return result;
                }
            }
            return null;
        };
        this._drawCellsFull = function () {
            var area = this._getDrawArea();
            var cellLeft = area.xStart;
            var cellWidth = area.xEnd - area.xStart;
            var cellTop = area.yStart;
            var cellHeight = area.yEnd - area.yStart;
            if (!this.cellProperties) {
                this.cellProperties = {};
            }
            for (var i = 0; i <= cellWidth; i++) {
                var x = cellLeft + i;
                for (var j = 0; j < cellHeight; j++) {
                    var y = cellTop + j;
                    this._drawCell(x, y);
                }
                this._drawLineVertical(x);
            }
            var rarea = this._getAreaRowsWithMargin();
            for (var y = rarea.start; y < rarea.end; y++) {
                this._drawLineHorizontal(y);
            }
        };
        this._drawCells = function () {
            if (calendar._disposed) {
                return;
            }
            var rowlist = calendar.rowlist;
            if (rowlist && rowlist.length > 0) {
                var sweep = this.cellSweeping;
                if (sweep) {
                    var keepOld = this.cellSweepingCacheSize;
                    this._deleteOldCells(keepOld);
                }
                this._drawCellsFull();
            }
            this._rowsDirty = false;
        };
        this._getDrawArea = function () {
            if (calendar._cache.drawArea) {
                return calendar._cache.drawArea;
            }
            if (!this.nav.scroll) {
                return null;
            }
            var scrollTop = calendar._scrollTop;
            var area = {};
            var marginX = resolved._progressiveMarginX();
            var marginY = resolved._progressiveMarginY();
            var left = calendar._scrollPos - marginX;
            var right = left + calendar._scrollWidth + 2 * marginX;
            var start = 0;
            var end = 0;
            start = calendar._getCellFromPixels(left).x;
            end = calendar._getCellFromPixels(right, true).x;
            var totalWidth = this._cellCount();
            end = Math.min(end, totalWidth - 1);
            start = DayPilot.Util.atLeast(start, 0);
            var top = scrollTop - marginY;
            var bottom = scrollTop + this.nav.scroll.offsetHeight + 2 * marginY;
            var cellTop = this._getRow(top).i;
            var cellBottom = this._getRow(bottom).i;
            if (cellBottom < this.rowlist.length) {
                cellBottom++;
            }
            area.xStart = start;
            area.xEnd = end;
            area.yStart = cellTop;
            area.yEnd = cellBottom;
            var ref = calendar.nav.scroll;
            if (ref.clientWidth === 0) {
                ref = calendar.divTimeScroll;
            }
            area.pixels = {};
            area.pixels.left = ref.scrollLeft;
            area.pixels.right = ref.scrollLeft + ref.clientWidth;
            area.pixels.top = ref.scrollTop;
            area.pixels.bottom = ref.scrollTop + ref.clientHeight;
            area.pixels.width = ref.scrollWidth;
            area.sw = DayPilot.sw(calendar.nav.scroll);
            calendar._cache.drawArea = area;
            return area;
        };
        this._getGridWidth = function () {
            return calendar._cellCount() * calendar.cellWidth;
        };
        this._drawLineHorizontal = function (y) {
            var rowlist = calendar.rowlist;
            var divLines = calendar.divLines;
            var index = "y_" + y;
            if (this._cache.linesHorizontal[index]) {
                return;
            }
            var row = rowlist[y];
            var height = row.height;
            var top = row.top + height - 1;
            var width = this._getGridWidth();
            var line = createDiv();
            line.style.left = "0px";
            line.style.top = top + "px";
            line.style.width = width + "px";
            line.style.height = "1px";
            line.style.fontSize = '1px';
            line.style.lineHeight = '1px';
            line.style.overflow = 'hidden';
            line.style.position = 'absolute';
            line.className = this._prefixCssClass("_matrix_horizontal_line");
            divLines.appendChild(line);
            this._cache.linesHorizontal[index] = line;
        };
        this._drawLineVertical = function (x) {
            var itc = calendar._getCell(x);
            if (!itc) {
                return;
            }
            var divLines = calendar.divLines;
            var height = calendar._gridHeight;
            var index = "x_" + x;
            if (this._cache.linesVertical[index]) {
                return;
            }
            var left = itc.left + itc.width - 1;
            var line = createDiv();
            line.style.left = left + "px";
            line.style.top = "0px";
            line.style.width = "1px";
            line.style.height = height + "px";
            line.style.fontSize = '1px';
            line.style.lineHeight = '1px';
            line.style.overflow = 'hidden';
            line.style.position = 'absolute';
            line.className = this._prefixCssClass("_matrix_vertical_line");
            divLines.appendChild(line);
            this.elements.linesVertical.push(line);
            this._cache.linesVertical[index] = line;
        };
        this._prepareRowTops = function () {
            calendar._gridHeight = calendar._prepareRowTopsRowlist(calendar.rowlist);
        };
        this._prepareRowTopsRowlist = function (rowlist) {
            var top = 0;
            for (var i = 0; i < rowlist.length; i++) {
                var row = rowlist[i];
                row.top = top;
                top += row.height;
            }
            return top;
        };
        this._deleteCells = function () {
            calendar.elements.cells = [];
            calendar._cache.cells = [];
            calendar.divCells.innerHTML = '';
            calendar._deleteLines();
        };
        this._deleteLines = function () {
            calendar.divLines.innerHTML = '';
            calendar._cache.linesVertical = {};
            calendar._cache.linesHorizontal = {};
            calendar.elements.linesVertical = [];
        };
        this._deleteCellsInRow = function (y) {
            var list = [];
            for (var name_7 in calendar._cache.cells) {
                list.push(calendar._cache.cells[name_7]);
            }
            list.filter(function (item) {
                return item && item.coords && item.coords.y === y;
            }).forEach(function (item) {
                calendar._deleteCell(item);
            });
        };
        this._drawCell = function (x, y) {
            if (!this._initialized) {
                return;
            }
            var itc = calendar._getCell(x);
            if (!itc) {
                return;
            }
            var rowlist = calendar.rowlist;
            var divCells = calendar.divCells;
            var index = x + '_' + y;
            if (this._cache.cells[index]) {
                return;
            }
            var p = this._getCellProperties(x, y);
            var args = calendar._doBeforeCellRender(x, y);
            var cell = createDiv();
            cell.style.left = (itc.left) + "px";
            cell.style.top = rowlist[y].top + "px";
            cell.style.width = (itc.width) + "px";
            cell.style.height = (rowlist[y].height) + "px";
            cell.style.position = 'absolute';
            if (p && p.backColor) {
                cell.style.backgroundColor = p.backColor;
            }
            cell.className = this._prefixCssClass('_cell');
            cell.coords = {};
            cell.coords.x = x;
            cell.coords.y = y;
            if (p) {
                if (p.cssClass) {
                    DayPilot.Util.addClass(cell, p.cssClass);
                }
                cell.innerHTML = calendar._xssTextHtml(p.text, p.html);
                if (p.backImage) {
                    cell.style.backgroundImage = "url(\"" + p.backImage + "\")";
                }
                if (p.backRepeat) {
                    cell.style.backgroundRepeat = p.backRepeat;
                }
                if (p.business && calendar.cellsMarkBusiness) {
                    DayPilot.Util.addClass(cell, calendar._prefixCssClass("_cell_business"));
                }
                if (p.disabled) {
                    DayPilot.Util.addClass(cell, calendar._prefixCssClass("_cell_disabled"));
                }
                if (p.backColor) {
                    cell.style.backgroundColor = p.backColor;
                }
                if (p.fontColor) {
                    cell.style.color = p.fontColor;
                }
                if (p.horizontalAlignment || p.verticalAlignment) {
                    cell.style.display = "flex";
                    switch (p.horizontalAlignment) {
                        case "right":
                            cell.style.justifyContent = "flex-end";
                            break;
                        case "left":
                            cell.style.justifyContent = "flex-start";
                            break;
                        case "center":
                            cell.style.justifyContent = "center";
                            break;
                    }
                    switch (p.verticalAlignment) {
                        case "center":
                            cell.style.alignItems = "center";
                            break;
                        case "top":
                            cell.style.alignItems = "flex-start";
                            break;
                        case "bottom":
                            cell.style.alignItems = "flex-end";
                            break;
                    }
                }
                DayPilot.Areas.attach(cell, args.cell, { "areas": p.areas });
            }
            var c = {
                start: itc.start,
                end: itc.end,
                resource: rowlist[y].id,
                div: cell,
                properties: p,
                x: x,
                y: y,
            };
            (function domAdd() {
                if (typeof calendar.onBeforeCellDomAdd !== "function" && typeof calendar.onBeforeCellDomRemove !== "function") {
                    return;
                }
                var args = {};
                args.control = calendar;
                args.cell = c;
                args.element = null;
                cell.domArgs = args;
                if (typeof calendar.onBeforeCellDomAdd === "function") {
                    calendar.onBeforeCellDomAdd(args);
                }
                if (args.element) {
                    var target = cell;
                    if (target) {
                        args._targetElement = target;
                        var isReactComponent = DayPilot.Util.isReactComponent(args.element);
                        var isVueNode = DayPilot.Util.isVueVNode(args.element);
                        if (isReactComponent) {
                            if (!calendar._react.reactDOM) {
                                throw new DayPilot.Exception("Can't reach ReactDOM");
                            }
                            calendar._react._render(args.element, target);
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
            divCells.appendChild(cell);
            this.elements.cells.push(cell);
            this._cache.cells[index] = cell;
        };
        this._doBeforeCellRender = function (x, y) {
            var itc = calendar._getCell(x);
            if (!itc) {
                return null;
            }
            var row = calendar.rowlist[y];
            var resource = row.id;
            var start = itc.start;
            var end = itc.end;
            var args = {};
            args.cell = {
                x: x,
                y: y,
                start: start,
                end: end,
                resource: resource,
                row: calendar._createRowObject(row),
                properties: calendar._getCellProperties(x, y)
            };
            args.control = calendar;
            if (typeof this.onBeforeCellRender === 'function') {
                var index = x + "_" + y;
                if (calendar.beforeCellRenderCaching && calendar._bcrCache[index]) {
                    return args;
                }
                calendar._bcrCache[index] = true;
                this.onBeforeCellRender(args);
            }
            return args;
        };
        this.clearSelection = function () {
            this._deleteRange();
        };
        this._createRangeFromSelection = function (start, end, resource) {
            start = new DayPilot.Date(start);
            end = new DayPilot.Date(end);
            var row = calendar._findRowByResourceId(resource);
            var itcStart = calendar._getCellFromTime(start);
            var cellStart = itcStart.current;
            if (!cellStart) {
                throw new DayPilot.Exception("Time range selection 'start' out of timeline");
            }
            var itcEnd = calendar._getCellFromTime(new DayPilot.Date(end).addMilliseconds(-1));
            var cellEnd = itcEnd.current;
            if (!cellEnd) {
                throw new DayPilot.Exception("Time range selection 'end' out of timeline");
            }
            var range = {};
            range.start = {
                y: row.index,
                x: itcStart.i,
                "time": start
            };
            range.end = {
                x: itcEnd.i,
                "time": end
            };
            range.calendar = this;
            return range;
        };
        this.selectTimeRange = function (start, end, resource, dontFireEvent) {
            var range = calendar._createRangeFromSelection(start, end, resource);
            calendar._drawRange(range);
            if (!dontFireEvent) {
                setTimeout(function () {
                    calendar._timeRangeSelectedDispatchFromRange(range);
                }, 0);
            }
        };
        this._clearMovingShadow = function () {
            var src = DayPilotScheduler._movingShadow && DayPilotScheduler._movingShadow.source;
            if (src) {
                DayPilot.Util.removeClass(src, calendar._prefixCssClass("_event_moving_source"));
            }
            DayPilot.de(DayPilotScheduler._movingShadow);
            DayPilotScheduler._movingShadow = null;
            if (DayPilot.Global.movingLink) {
                DayPilot.Global.movingLink.clear();
                DayPilot.Global.movingLink = null;
            }
        };
        this._deleteRange = function () {
            if (calendar.divShadow) {
                calendar.divShadow.innerHTML = "";
            }
            calendar.elements.range = [];
            calendar.elements.range2 = null;
            calendar._rangeHold = null;
            calendar._lastRange = null;
        };
        resolved._clearCache = function () {
            delete calendar._cache.headerHeight;
        };
        resolved._xssProtectionEnabled = function () {
            return calendar.xssProtection !== "Disabled";
        };
        resolved._locale = function () {
            return DayPilot.Locale.find(calendar.locale);
        };
        resolved._timeFormat = function () {
            if (calendar.timeFormat !== 'Auto') {
                return calendar.timeFormat;
            }
            return resolved._locale().timeFormat;
        };
        resolved._weekStarts = function () {
            if (calendar.weekStarts === 'Auto') {
                var locale = resolved._locale();
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
        resolved._mobile = function () {
            var ua = navigator.userAgent.toLowerCase();
            return ua.indexOf("mobile") !== -1 || ua.indexOf("android") != -1;
        };
        resolved._useBox = function (durationTicks) {
            if (calendar.useEventBoxes === 'Always') {
                return true;
            }
            if (calendar.useEventBoxes === 'Never') {
                return false;
            }
            return durationTicks < calendar._getCellDuration() * 60 * 1000;
        };
        resolved._progressiveMarginX = function () {
            var marginX = calendar.dynamicEventRenderingMarginX;
            if (typeof marginX === "number") {
                return marginX;
            }
            var margin = calendar.dynamicEventRenderingMargin;
            if (typeof margin === "number") {
                return margin;
            }
            return 0;
        };
        resolved._progressiveMarginY = function () {
            var marginY = calendar.dynamicEventRenderingMarginY;
            if (typeof marginY === "number") {
                return marginY;
            }
            var margin = calendar.dynamicEventRenderingMargin;
            if (typeof margin === "number") {
                return margin;
            }
            return 0;
        };
        this._getCellProperties = function (x, y) {
            var index = x + '_' + y;
            var rowlist = calendar.rowlist;
            if (!this.cellProperties) {
                this.cellProperties = {};
            }
            if (this.cellProperties[index]) {
                return this.cellProperties[index];
            }
            if (!this.cellProperties[index]) {
                var row = rowlist[y];
                var resource = row.id;
                var itc = calendar._getCell(x);
                var start = itc.start;
                var end = itc.end;
                var ibj = {};
                ibj.start = start;
                ibj.end = end;
                ibj.resource = resource;
                var cell = {};
                cell.business = calendar.isBusiness(ibj);
                this.cellProperties[index] = cell;
            }
            return this.cellProperties[index];
        };
        this.isBusiness = function (cell, forceBusinessDay) {
            var start = cell.start;
            var end = cell.end;
            var cellDuration = (end.getTime() - start.getTime()) / (1000 * 60);
            if (cellDuration <= 1440) {
                if (!calendar.businessWeekends && !forceBusinessDay) {
                    if (cell.start.dayOfWeek() === 0 || cell.start.dayOfWeek() === 6) {
                        return false;
                    }
                }
            }
            if (cellDuration < 720) {
                var startHour = start.getHours();
                startHour += start.getMinutes() / 60.0;
                startHour += start.getSeconds() / 3600.0;
                startHour += start.getMilliseconds() / 3600000.0;
                var begins = this.businessBeginsHour;
                var ends = this.businessEndsHour;
                if (ends === 0) {
                    ends = 24;
                }
                if (begins === ends) {
                    return false;
                }
                if (begins < ends) {
                    if (startHour < begins) {
                        return false;
                    }
                    if (ends >= 24) {
                        return true;
                    }
                    if (startHour >= ends) {
                        return false;
                    }
                }
                else {
                    if (startHour < ends) {
                        return true;
                    }
                    if (startHour >= begins) {
                        return true;
                    }
                    return false;
                }
            }
            return true;
        };
        this._show = function () {
            if (this.nav.top.style.visibility === 'hidden') {
                this.nav.top.style.visibility = 'visible';
            }
        };
        this._setHeight = function (pixels) {
            this.heightSpec = "Fixed";
            this.height = pixels - (this._getTotalHeaderHeight() + 2);
            this._updateHeight();
        };
        this.setHeight = this._setHeight;
        this._findRowByResourceId = function (id) {
            return calendar._rowcacheFor(id)[0];
        };
        this._loadTop = function () {
            if (this.id && this.id.tagName) {
                this.nav.top = this.id;
            }
            else if (typeof this.id === "string") {
                this.nav.top = document.getElementById(this.id);
                if (!this.nav.top) {
                    throw new DayPilot.Exception("DayPilot.Scheduler: The placeholder element not found: '" + id + "'.");
                }
            }
            else {
                throw new DayPilot.Exception("DayPilot.Scheduler() constructor requires the target element or its ID as a parameter");
            }
        };
        this.init = function () {
            if (this._initialized) {
                throw new DayPilot.Exception("This instance is already initialized. Use update() to change properties.");
            }
            this._loadTop();
            if (this.nav.top.dp) {
                if (this.nav.top.dp === calendar) {
                    return calendar;
                }
                throw new DayPilot.Exception("The target placeholder was already initialized by another DayPilot component instance.");
            }
            this._initUpdateBased();
            this._watchWidthChanges();
            return this;
        };
        this._initUpdateBased = function () {
            this._initPrepareDiv();
            this._registerGlobalHandlers();
            this._registerDispose();
            this._registerOnScroll();
            if (calendar.zoomLevels && calendar.zoomLevels[calendar.zoom.active]) {
                calendar.zoom.setActive(calendar.zoom.active);
            }
            this._update();
            var angular = calendar._angular2.enabled;
            if (calendar.scrollToDate) {
                calendar.scrollTo(calendar.scrollToDate);
            }
            else if (calendar.scrollX || calendar.scrollY) {
                calendar.setScroll(calendar.scrollX, calendar.scrollY);
            }
            else if (!angular) {
                calendar._onScroll();
            }
            if (calendar.scrollToResourceId) {
                calendar.scrollToResource(calendar.scrollToResourceId);
                calendar.scrollToResourceId = null;
            }
            var setScrollY = function () {
                if (calendar.scrollY) {
                    calendar.setScroll(calendar.scrollX, calendar.scrollY);
                }
            };
            setTimeout(setScrollY, 200);
            this._clearCachedValues();
            this._postInit();
            this._initialized = true;
            var p = calendar._scrollToAfterInit;
            if (p) {
                calendar.scrollTo(p);
            }
            else {
                calendar._onScroll();
            }
        };
        this._specialHandling = null;
        this._loadOptions = function (options) {
            if (!options) {
                return;
            }
            var specialHandling = {
                "resources": {
                    "preInit": function () {
                        var resources = this.data;
                        if (!resources) {
                            return;
                        }
                        calendar.resources = resources;
                    }
                },
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
                    },
                    "postInit": function () {
                    }
                },
                "scrollTo": {
                    "preInit": function () {
                    },
                    "postInit": function () {
                        if (this.data) {
                            calendar._scrollTo(this.data);
                        }
                    }
                },
                "scrollX": {
                    "postInit": function () {
                        if (this.data) {
                            calendar._setScrollX(this.data);
                        }
                    }
                },
                "scrollY": {
                    "postInit": function () {
                        if (this.data) {
                            calendar._setScrollY(this.data);
                        }
                    }
                },
                "zoom": {
                    "preInit": function () {
                        var index = this.data;
                        if (typeof index === "string") {
                            var id_2 = index;
                            index = calendar.zoom._findById(id_2);
                        }
                        var levelChanged = index !== calendar.zoom.active;
                        var date = calendar.zoom._getPosition();
                        calendar.zoom._applyLevelProps(index, date);
                        if (levelChanged) {
                            this.date = date;
                        }
                        else {
                            this.date = null;
                        }
                    },
                    "postInit": function () {
                        if (this.date) {
                            calendar._scrollTo(this.date, false, calendar.zoomPosition);
                        }
                    }
                },
            };
            calendar._specialHandling = specialHandling;
            if (calendar._angular2.scrollToRequested) {
                specialHandling.scrollTo.data = calendar._angular2.scrollToRequested;
                calendar._angular2.scrollToRequested = null;
            }
            if (calendar._angular2.scrollXRequested) {
                specialHandling.scrollX.data = calendar._angular2.scrollXRequested;
                calendar._angular2.scrollXRequested = null;
            }
            if (calendar._angular2.scrollYRequested) {
                specialHandling.scrollY.data = calendar._angular2.scrollYRequested;
                calendar._angular2.scrollYRequested = null;
            }
            for (var name_8 in options) {
                if (!specialHandling[name_8]) {
                    calendar[name_8] = options[name_8];
                }
            }
            for (var name_9 in options) {
                if (specialHandling[name_9]) {
                    var item = specialHandling[name_9];
                    item.data = options[name_9];
                    if (item.preInit) {
                        item.preInit();
                    }
                }
            }
        };
        this._postInit = function () {
            var specialHandling = calendar._specialHandling;
            for (var name_10 in specialHandling) {
                var item = specialHandling[name_10];
                if (item.postInit) {
                    item.postInit();
                }
            }
            calendar._specialHandling = {};
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
                    target._root = null;
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
        this.internal.adjustEndIn = calendar._adjustEndIn;
        this.internal.adjustEndNormalize = calendar._adjustEndNormalize;
        this.internal.xssTextHtml = calendar._xssTextHtml;
        this.internal.touch = calendar._touch;
        this.internal.skipUpdate = calendar._angular2.skipUpdate;
        this.internal.skipped = calendar._angular2.skipped;
        this.internal.loadOptions = calendar._loadOptions;
        this.internal.postInit = calendar._postInit;
        this.internal.enableAngular2 = function () { calendar._angular2.enabled = true; };
        this.internal.eventsFromAttr = function () { calendar._angular2._eventsFromAttr = true; };
        this.internal.resourcesFromAttr = function () { calendar._angular2._resourcesFromAttr = true; };
        this.internal.evImmediateRefresh = function () { calendar.events._immediateRefresh(); };
        this.internal.upd = function (options) {
            calendar.update(options);
        };
        this.internal.enableReact = function (react, reactDOM) {
            calendar._react.react = react;
            calendar._react.reactDOM = reactDOM;
        };
        this.internal.reactRefs = function () {
            return DayPilot.Util.copyProps(calendar._react, {}, ["react", "reactDOM"]);
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
        this._loadOptions(options);
    };
    debug = new DayPilot.Scheduler().v === "${v\u007d";
    DayPilot.Row = function (row, calendar) {
        if (!row) {
            throw new DayPilot.Exception("Now row object supplied when creating DayPilot.Row");
        }
        if (!calendar) {
            throw new DayPilot.Exception("No parent control supplied when creating DayPilot.Row");
        }
        this._original = {};
        var original = this._original;
        original.id = row.id;
        original.name = row.name;
        original.data = row.resource;
        original.tags = row.tags;
        var r = this;
        r.isRow = true;
        r.menuType = 'resource';
        r.name = row.name;
        r.id = row.id;
        r.tags = row.tags;
        r.index = row.index;
        r.calendar = calendar;
        r.data = row.resource;
        r._row = row;
        r.$ = {};
        r.$.row = row;
        r.toJSON = function () {
            var json = {};
            json.start = this.start;
            json.name = this.name;
            json.id = this.id;
            json.index = this.index;
            return json;
        };
        r.events = {};
        r.events.all = function () {
            var list = [];
            for (var i = 0; i < r._row.events.length; i++) {
                list.push(r._row.events[i]);
            }
            return list;
        };
        r.events.isEmpty = function () {
            return r._row.events.length === 0;
        };
        r.events.forRange = function (start, end) {
            return r._row.events.forRange(start, end);
        };
        r.events.totalDuration = function () {
            var ticks = 0;
            r.events.all().forEach(function (item) {
                ticks += item.part.end.getTime() - item.part.start.getTime();
            });
            return new DayPilot.Duration(ticks);
        };
        r.remove = function () {
            calendar.rows.remove(r);
        };
        r.addClass = function (cssClass) {
            var table = calendar.divHeader;
            var row = table.rows[r.index];
            DayPilot.Util.addClass(row, cssClass);
            r.$.row.cssClass = DayPilot.Util.addClassToString(r.$.row.cssClass, cssClass);
            r.data.cssClass = cssClass;
        };
        r.removeClass = function (cssClass) {
            var table = calendar.divHeader;
            var row = table.rows[r.index];
            DayPilot.Util.removeClass(row, cssClass);
            r.$.row.cssClass = DayPilot.Util.removeClassFromString(r.$.row.cssClass, cssClass);
            r.data.cssClass = DayPilot.Util.removeClassFromString(r.data.cssClass, cssClass);
        };
    };
    DayPilotScheduler._moving = null;
    DayPilotScheduler._movingEvent = null;
    DayPilotScheduler._originalMouse = null;
    DayPilotScheduler._resizing = null;
    DayPilotScheduler._resizingEvent = null;
    DayPilotScheduler._preventEventClick = false;
    DayPilotScheduler._globalHandlers = false;
    DayPilotScheduler._timeRangeTimeout = null;
    DayPilotScheduler._selectedCells = null;
    DayPilotScheduler._unregister = function () {
        DayPilot.ue(document, 'mouseup', DayPilotScheduler._gMouseUp);
        DayPilot.ue(document, 'touchmove', DayPilotScheduler._gTouchMove);
        DayPilot.ue(document, 'touchend', DayPilotScheduler._gTouchEnd);
        DayPilotScheduler._globalHandlers = false;
    };
    function touchMousePos(ev) {
        var x = ev.touches[0].pageX;
        var y = ev.touches[0].pageY;
        var mousePos = {};
        mousePos.x = x;
        mousePos.y = y;
        return mousePos;
    }
    DayPilotScheduler._gTouchMove = function (ev) {
        if (DayPilotScheduler._resizing) {
            var calendar = DayPilotScheduler._resizing.event.calendar;
            calendar.coords = calendar._touch._relativeCoords(ev);
            calendar._touch._updateResizing();
            ev.preventDefault();
        }
        if (DayPilotScheduler._moving) {
            ev.preventDefault();
            var calendar = DayPilotScheduler._movingEvent.calendar;
            calendar.coords = calendar._touch._relativeCoords(ev);
            calendar._touch._updateMoving();
        }
    };
    DayPilotScheduler._gTouchEnd = function (ev) {
        DayPilotScheduler._touchingRes = false;
        DayPilotScheduler._gMouseUp(ev);
    };
    DayPilotScheduler._gMouseUp = function (ev) {
        if (DayPilotScheduler._resizing) {
            var cleanup = function () {
                var e = DayPilotScheduler._resizingEvent;
                var calendar = e.calendar;
                body().style.cursor = '';
                DayPilotScheduler._resizing = null;
                DayPilotScheduler._resizingEvent = null;
                DayPilot.de(DayPilotScheduler._resizingShadow);
                DayPilotScheduler._resizingShadow = null;
                if (calendar) {
                    calendar._lastEventResizing = null;
                }
            };
            setTimeout(function () {
                DayPilotScheduler._preventEventClick = false;
            });
            if (!DayPilotScheduler._resizingShadow) {
                cleanup();
                return;
            }
            var e = DayPilotScheduler._resizingEvent;
            var calendar = e.calendar;
            var newStart = DayPilotScheduler._resizingShadow.start;
            var newEnd = DayPilotScheduler._resizingShadow.end;
            var what = DayPilotScheduler._resizing.dpBorder === "left" ? "start" : "end";
            cleanup();
            calendar._eventResizeDispatch(e, newStart, newEnd, what);
        }
        else if (DayPilotScheduler._movingEvent) {
            var cleanup = function () {
                DayPilot.Global.movingAreaData = null;
                var calendar = DayPilotScheduler._movingShadow && DayPilotScheduler._movingShadow.calendar;
                if (DayPilotScheduler._movingShadow) {
                    DayPilot.de(DayPilotScheduler._movingShadow);
                    DayPilotScheduler._movingShadow.calendar = null;
                }
                body().style.cursor = '';
                DayPilotScheduler._moving = null;
                DayPilotScheduler._movingEvent = null;
                if (calendar) {
                    calendar._lastEventMoving = null;
                }
            };
            if (!DayPilotScheduler._movingShadow) {
                cleanup();
                return;
            }
            var e = DayPilotScheduler._movingEvent;
            var calendar = DayPilotScheduler._movingShadow.calendar;
            if (!calendar) {
                cleanup();
                return;
            }
            DayPilotScheduler._movingShadow.source = DayPilotScheduler._moving;
            if (!DayPilotScheduler._movingShadow.row) {
                cleanup();
                return;
            }
            var newStart = DayPilotScheduler._movingShadow.start;
            var newEnd = DayPilotScheduler._movingShadow.end;
            var newResource = DayPilotScheduler._movingShadow.row.id;
            DayPilotScheduler._movingShadow.calendar = null;
            body().style.cursor = '';
            DayPilotScheduler._moving = null;
            DayPilotScheduler._movingEvent = null;
            calendar._eventMoveDispatch(e, newStart, newEnd, newResource, ev);
            DayPilot.Global.movingAreaData = null;
        }
        else if (DayPilotScheduler._range) {
            var button = DayPilot.Util.mouseButton(ev);
            var range = DayPilotScheduler._range;
            var calendar_1 = range.calendar;
            var cleanup = function () {
            };
            calendar_1._lastRange = null;
            if (DayPilotScheduler._timeRangeTimeout) {
                clearTimeout(DayPilotScheduler._timeRangeTimeout);
                DayPilotScheduler._timeRangeTimeout = null;
                cleanup();
                return;
            }
            calendar_1._rangeHold = range;
            DayPilotScheduler._range = null;
            var createTimeRangeDispatcher = function (range) {
                return function () {
                    DayPilotScheduler._timeRangeTimeout = null;
                    calendar_1._timeRangeSelectedDispatchFromRange(range);
                    if (calendar_1.timeRangeSelectedHandling !== "Hold" && calendar_1.timeRangeSelectedHandling !== "HoldForever") {
                        doNothing();
                    }
                    else {
                        calendar_1._rangeHold = range;
                    }
                };
            };
            var rc = calendar_1._copyRange(range);
            cleanup();
            if (!button.left) {
                DayPilotScheduler._timeRangeTimeout = null;
                return;
            }
            createTimeRangeDispatcher(rc)();
            ev.cancelBubble = true;
            return false;
        }
        DayPilotScheduler._moveOffsetX = null;
        DayPilotScheduler._moveDragStart = null;
    };
})(DayPilot);
