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
