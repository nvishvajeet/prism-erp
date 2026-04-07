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
