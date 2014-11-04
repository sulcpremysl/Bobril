﻿/// <reference path="../src/bobril.d.ts"/>
// ReSharper disable InconsistentNaming
declare var DEBUG: boolean;
// ReSharper restore InconsistentNaming
if (typeof DEBUG === 'undefined') DEBUG = true;

// IE8 [].map polyfill Reference: http://es5.github.io/#x15.4.4.19
if (!Array.prototype.map) {
    Array.prototype.map = function (callback: any, thisArg: any) {
        var t: any, a: Array<any>, k: number;
        // ReSharper disable once ConditionIsAlwaysConst
        if (this == null) {
            throw new TypeError("this==null");
        }
        var o = Object(this);
        var len = o.length >>> 0;
        if (typeof callback != "function") {
            throw new TypeError(callback + " isn't func");
        }
        if (arguments.length > 1) {
            t = thisArg;
        }
        a = new Array(len);
        k = 0;
        while (k < len) {
            var kValue: any, mappedValue: any;
            if (k in o) {
                kValue = o[k];
                mappedValue = callback.call(t, kValue, k, o);
                a[k] = mappedValue;
            }
            k++;
        }
        return a;
    };
}

// Object create polyfill
if (!Object.create) {
    Object.create = (o: any) => {
        function f() { }
        f.prototype = o;
        return new (<any>f)();
    }
}

b = ((window: Window, document: Document, undefined?: any): IBobrilStatic => {
    var nodeBackpointer = "data-bobril";
    function assert(shoudBeTrue: boolean, messageIfFalse?: string) {
        if (DEBUG)
            if (!shoudBeTrue)
                throw Error(messageIfFalse || "assertion failed");
    }

    var objectToString = {}.toString;
    var isArray = Array.isArray || ((a: any) => objectToString.call(a) === "[object Array]");
    var objectKeys = Object.keys || ((obj: any) => {
        var keys = <string[]>[];
        for (var i in obj) {
            if (obj.hasOwnProperty(i)) {
                keys.push(i);
            }
        }
        return keys;
    });
    var inNamespace: boolean = false;
    var inSvg: boolean = false;
    var updateCall: Array<boolean> = [];
    var updateInstance: Array<IBobrilCacheNode> = [];

    function updateElement(n: IBobrilCacheNode, el: HTMLElement, newAttrs: IBobrilAttributes, oldAttrs: IBobrilAttributes): IBobrilAttributes {
        if (!newAttrs) return undefined;
        for (var attrName in newAttrs) {
            var newAttr = newAttrs[attrName];
            var oldAttr = oldAttrs[attrName];
            if ((oldAttr === undefined) || (oldAttr !== newAttr)) {
                oldAttrs[attrName] = newAttr;
                if (attrName === "style") {
                    var rule: string;
                    if (oldAttr) {
                        for (rule in newAttr) {
                            var v = newAttr[rule];
                            if (oldAttr[rule] !== v) el.style[<any>rule] = v;
                        }
                        for (rule in oldAttr) {
                            if (!(rule in newAttr)) el.style[<any>rule] = "";
                        }
                    } else {
                        for (rule in newAttr) {
                            el.style[<any>rule] = newAttr[rule];
                        }
                    }
                } else if (inNamespace) {
                    if (attrName === "href") el.setAttributeNS("http://www.w3.org/1999/xlink", "href", newAttr);
                    else if (attrName === "className") el.setAttribute("class", newAttr);
                    else el.setAttribute(attrName, newAttr);
                } else if (attrName === "value" && attrName in el) {
                    var currentValue = ((<any>el)[attrName]);
                    if (oldAttr === undefined) {
                        (<any>n.ctx)["b$value"] = newAttr;
                    }
                    if (newAttr !== currentValue) {
                        if (oldAttr === undefined || currentValue === oldAttr) {
                            (<any>el)[attrName] = newAttr;
                        } else {
                            emitEvent("input", null, el, n);
                        }
                    }
                } else if (attrName in el && !(attrName === "list" || attrName === "form")) {
                    (<any>el)[attrName] = newAttr;
                } else el.setAttribute(attrName, newAttr);
            }
        }
        return oldAttrs;
    }

    function createNode(n: IBobrilNode): IBobrilCacheNode {
        var c = <IBobrilCacheNode>n;
        var backupInNamespace = inNamespace;
        var backupInSvg = inSvg;
        var component = c.component;
        if (component) {
            c.ctx = { data: c.data || {} };
            if (component.init) {
                component.init(c.ctx, n);
            }
        }
        if (n.tag === "") {
            c.element = document.createTextNode("" + c.content);
            return c;
        } else if (n.tag === "/") {
            return c;
        } else if (inSvg || n.tag === "svg") {
            c.element = document.createElementNS("http://www.w3.org/2000/svg", n.tag);
            inNamespace = true;
            inSvg = true;
        } else {
            c.element = document.createElement(n.tag);
        }
        createChildren(c);
        c.attrs = updateElement(c, c.element, c.attrs, {});
        inNamespace = backupInNamespace;
        inSvg = backupInSvg;
        pushInitCallback(c);
        return c;
    }

    function normalizeNode(n: any): IBobrilNode {
        var t = typeof n;
        if (t == "string" || t == "number") {
            return { tag: "", content: n };
        }
        if (t == "boolean") return null;
        return <IBobrilNode>n;
    }

    function createChildren(c: IBobrilCacheNode): void {
        var ch = c.children;
        var element = c.element;
        if (!ch)
            return;
        if (!isArray(ch)) {
            var type = typeof ch;
            if (type == "string" || type == "number") {
                if ('textContent' in element) {
                    element.textContent = "" + ch;
                } else {
                    element.appendChild(document.createTextNode("" + ch));
                }
                return;
            }
            ch = [ch];
        }
        var i = 0, l = ch.length;
        while (i < l) {
            var item = ch[i];
            if (isArray(item)) {
                ch.splice.apply(ch, [i, 1].concat(item));
                l = ch.length;
                continue;
            }
            item = normalizeNode(item);
            if (item == null) {
                ch.splice(i, 1);
                l--;
                continue;
            }
            var j = ch[i] = createNode(item);
            if (j.tag === "/") {
                var before = element.lastChild;
                c.element.insertAdjacentHTML("beforeend", j.content);
                j.element = [];
                if (before) {
                    before = before.nextSibling;
                } else {
                    before = element.firstChild;
                }
                while (before) {
                    before[nodeBackpointer] = j;
                    j.element.push(before);
                    before = before.nextSibling;
                }
            } else {
                element.appendChild(j.element);
            }
            i++;
        }
        c.children = ch;
    }

    function destroyNode(c: IBobrilCacheNode) {
        var ch = c.children;
        if (isArray(ch)) {
            for (var i = 0, l = ch.length; i < l; i++) {
                destroyNode(ch[i]);
            }
        }
        var component = c.component;
        if (component) {
            if (component.destroy)
                component.destroy(c.ctx, c, c.element);
        }
        if (c.tag !== "") {
            var el = c.element;
            if (isArray(el)) {
                for (var j = 0; j < el.length; j++) {
                    el[j][nodeBackpointer] = null;
                }
            } else {
                el[nodeBackpointer] = null;
            }
        }
    }

    function removeNode(c: IBobrilCacheNode) {
        destroyNode(c);
        var el = c.element;
        if (isArray(el)) {
            var pa = el[0].parentNode;
            if (pa) {
                for (var i = 0; i < el.length; i++) {
                    pa.removeChild(el[i]);
                }
            }
        } else {
            var p = el.parentNode;
            if (p) p.removeChild(el);
        }
    }

    function pushInitCallback(c: IBobrilCacheNode) {
        c.element[nodeBackpointer] = c;
        var cc = c.component;
        if (cc) {
            if (cc.postInitDom) {
                updateCall.push(false);
                updateInstance.push(c);
            }
        }
    }

    function pushUpdateCallback(c: IBobrilCacheNode) {
        var cc = c.component;
        if (cc) {
            if (cc.postUpdateDom) {
                updateCall.push(true);
                updateInstance.push(c);
            }
        }
    }

    function getCacheNode(n: Node): IBobrilCacheNode {
        return (<any>n)[nodeBackpointer];
    }

    function updateNode(n: IBobrilNode, c: IBobrilCacheNode): IBobrilCacheNode {
        var component = n.component;
        var backupInNamespace = inNamespace;
        var backupInSvg = inSvg;
        if (component) {
            if (component.shouldChange)
                if (!component.shouldChange(c.ctx, n, c))
                    return c;
            (<any>c.ctx).data = n.data || {};
            c.component = component;
            if (component.init)
                component.init(c.ctx, n, c);
        }
        if (n.tag === "/") {
            var el = c.element;
            if (isArray(el)) el = el[0];
            var elprev = el.previousSibling;
            var removeEl = false;
            var parent = el.parentNode;
            if (!el.insertAdjacentHTML) {
                el = parent.insertBefore(document.createElement("i"), el);
                removeEl = true;
            }
            el.insertAdjacentHTML("beforebegin", n.content);
            if (elprev) {
                elprev = elprev.nextSibling;
            }
            else {
                elprev = parent.firstChild;
            }
            var newElements = <Array<Node>>[];
            while (elprev !== el) {
                elprev[nodeBackpointer] = n;
                newElements.push(elprev);
                elprev = elprev.nextSibling;
            }
            (<IBobrilCacheNode>n).element = newElements;
            if (removeEl) {
                parent.removeChild(el);
            }
            removeNode(c);
            return n;
        }
        if (n.tag === c.tag && (inSvg || !inNamespace)) {
            if (n.tag === "") {
                if (c.content !== n.content) {
                    c.content = n.content;
                    if ('textContent' in c.element) {
                        c.element.textContent = "" + c.content;
                        return c;
                    }
                } else return c;
            } else {
                if (n.tag === "svg") {
                    inNamespace = true;
                    inSvg = true;
                }
                if (!n.attrs && !c.attrs || n.attrs && c.attrs && objectKeys(n.attrs).join() === objectKeys(c.attrs).join() && n.attrs.id === c.attrs.id) {
                    updateChildrenNode(n, c);
                    if (c.attrs)
                        c.attrs = updateElement(c, c.element, n.attrs, c.attrs);
                    inNamespace = backupInNamespace;
                    inSvg = backupInSvg;
                    pushUpdateCallback(c);
                    return c;
                }
                inSvg = backupInSvg;
                inNamespace = backupInNamespace;
            }
        }
        var r = createNode(n);
        var pn = c.element.parentNode;
        if (pn) {
            pn.insertBefore(r.element, c.element);
        }
        removeNode(c);
        return r;
    }

    function callPostCallbacks() {
        var count = updateInstance.length;
        for (var i = 0; i < count; i++) {
            var n: IBobrilCacheNode;
            if (updateCall[i]) {
                n = updateInstance[i];
                n.component.postUpdateDom(n.ctx, n, n.element);
            } else {
                n = updateInstance[i];
                n.component.postInitDom(n.ctx, n, n.element);
            }
        }
        updateCall = [];
        updateInstance = [];
    }

    function updateChildrenNode(n: IBobrilNode, c: IBobrilCacheNode): void {
        c.children = updateChildren(c.element, n.children, c.children);
    }

    function updateChildren(element: HTMLElement, newChildren: any, cachedChildren: any): Array<IBobrilCacheNode> {
        newChildren = newChildren || [];
        if (!isArray(newChildren)) {
            var type = typeof newChildren;
            if ((type == "string" || type == "number") && !isArray(cachedChildren)) {
                if (newChildren === cachedChildren) return cachedChildren;
                if ('textContent' in element) {
                    element.textContent = "" + newChildren;
                } else {
                    element.innerHTML = "";
                    element.appendChild(document.createTextNode("" + newChildren));
                }
                return newChildren;
            }
            newChildren = [newChildren];
        }
        cachedChildren = cachedChildren || [];
        if (!isArray(cachedChildren)) {
            element.removeChild(element.firstChild);
            cachedChildren = [];
        }
        var newLength = newChildren.length;
        var cachedLength = cachedChildren.length;
        for (var newIndex = 0; newIndex < newLength;) {
            var item = newChildren[newIndex];
            if (isArray(item)) {
                newChildren.splice.apply(newChildren, [newIndex, 1].concat(item));
                newLength = newChildren.length;
                continue;
            }
            item = normalizeNode(item);
            if (item == null) {
                newChildren.splice(newIndex, 1);
                continue;
            }
            newChildren[newIndex] = item;
            newIndex++;
        }
        var minNewCachedLength = newLength < cachedLength ? newLength : cachedLength;
        newIndex = 0;
        for (; newIndex < minNewCachedLength; newIndex++) {
            if (newChildren[newIndex].key !== cachedChildren[newIndex].key)
                break;
            cachedChildren[newIndex] = updateNode(newChildren[newIndex], cachedChildren[newIndex]);
        }
        if (newIndex === minNewCachedLength) {
            // all keys up to common length were identical = simple case
            while (newIndex < newLength) {
                cachedChildren.push(createNode(newChildren[newIndex]));
                element.appendChild(cachedChildren[newIndex].element);
                newIndex++;
            }
            while (cachedLength > newIndex) {
                cachedLength--;
                removeNode(cachedChildren[cachedLength]);
                cachedChildren.pop();
            }
        } else {
            // order of keyed nodes ware changed => reorder keyed nodes first
            var cachedIndex: number;
            var cachedKeys: { [keyName: string]: number } = {};
            var newKeys: { [keyName: string]: number } = {};
            var key: string;
            var node: IBobrilNode;
            var backupCommonIndex = newIndex;
            var deltaKeyless = 0;
            for (cachedIndex = backupCommonIndex; cachedIndex < cachedLength; cachedIndex++) {
                node = cachedChildren[cachedIndex];
                key = node.key;
                if (key != null) {
                    assert(!(key in cachedKeys));
                    cachedKeys[key] = cachedIndex;
                }
                else
                    deltaKeyless--;
            }
            for (; newIndex < newLength; newIndex++) {
                node = newChildren[newIndex];
                key = node.key;
                if (key != null) {
                    assert(!(key in newKeys));
                    newKeys[key] = newIndex;
                }
                else
                    deltaKeyless++;
            }
            var delta = 0;
            newIndex = backupCommonIndex;
            cachedIndex = backupCommonIndex;
            var cachedKey: string;
            while (cachedIndex < cachedLength && newIndex < newLength) {
                if (cachedChildren[cachedIndex] === null) { // already moved somethere else
                    cachedChildren.splice(cachedIndex, 1);
                    cachedLength--;
                    delta--;
                    continue;
                }
                cachedKey = cachedChildren[cachedIndex].key;
                if (cachedKey == null) {
                    cachedIndex++;
                    continue;
                }
                key = newChildren[newIndex].key;
                if (key == null) {
                    newIndex++;
                    while (newIndex < newLength) {
                        key = newChildren[newIndex].key;
                        if (key != null)
                            break;
                        newIndex++;
                    }
                    if (key == null)
                        break;
                }
                var akpos = cachedKeys[key];
                if (akpos === undefined) {
                    // New key
                    cachedChildren.splice(cachedIndex, 0, createNode(newChildren[newIndex]));
                    element.insertBefore(cachedChildren[cachedIndex].element, cachedChildren[cachedIndex + 1].element);
                    delta++;
                    newIndex++;
                    cachedIndex++;
                    cachedLength++;
                    continue;
                }
                if (!(cachedKey in newKeys)) {
                    // Old key
                    removeNode(cachedChildren[cachedIndex]);
                    cachedChildren.splice(cachedIndex, 1);
                    delta--;
                    cachedLength--;
                    continue;
                }
                if (cachedIndex === akpos + delta) {
                    // Inplace update
                    cachedChildren[cachedIndex] = updateNode(newChildren[newIndex], cachedChildren[cachedIndex]);
                    newIndex++;
                    cachedIndex++;
                } else {
                    // Move
                    cachedChildren.splice(cachedIndex, 0, cachedChildren[akpos + delta]);
                    delta++;
                    cachedChildren[akpos + delta] = null;
                    element.insertBefore(cachedChildren[cachedIndex].element, cachedChildren[cachedIndex + 1].element);
                    cachedChildren[cachedIndex] = updateNode(newChildren[newIndex], cachedChildren[cachedIndex]);
                    cachedIndex++;
                    cachedLength++;
                    newIndex++;
                }
            }
            // remove old keyed cached nodes
            while (cachedIndex < cachedLength) {
                if (cachedChildren[cachedIndex] === null) { // already moved somethere else
                    cachedChildren.splice(cachedIndex, 1);
                    cachedLength--;
                    continue;
                }
                if (cachedChildren[cachedIndex].key != null) { // this key is only in old
                    removeNode(cachedChildren[cachedIndex]);
                    cachedChildren.splice(cachedIndex, 1);
                    cachedLength--;
                    continue;
                }
                cachedIndex++;
            }
            // add new keyed nodes
            while (newIndex < newLength) {
                key = newChildren[newIndex].key;
                if (key != null) {
                    cachedChildren.push(createNode(newChildren[newIndex]));
                    element.insertBefore(cachedChildren[cachedIndex].element, cachedIndex == cachedLength ? null : cachedChildren[cachedIndex + 1].element);
                    delta++;
                    cachedIndex++;
                    cachedLength++;
                }
                newIndex++;
            }
            // reorder just nonkeyed nodes
            newIndex = cachedIndex = backupCommonIndex;
            while (newIndex < newLength) {
                if (cachedIndex < cachedLength) {
                    cachedKey = cachedChildren[cachedIndex].key;
                    if (cachedKey != null) {
                        cachedIndex++;
                        continue;
                    }
                }
                key = newChildren[newIndex].key;
                if (newIndex < cachedLength && key === cachedChildren[newIndex].key) {
                    if (key != null) {
                        newIndex++;
                        continue;
                    }
                    cachedChildren[newIndex] = updateNode(newChildren[newIndex], cachedChildren[newIndex]);
                    newIndex++;
                    if (cachedIndex < newIndex) cachedIndex = newIndex;
                    continue;
                }
                if (key != null) {
                    assert(newIndex === cachedIndex);
                    if (newLength - newIndex - deltaKeyless == cachedLength - cachedIndex) {
                        while (true) {
                            removeNode(cachedChildren[cachedIndex]);
                            cachedChildren.splice(cachedIndex, 1);
                            cachedLength--;
                            deltaKeyless++;
                            assert(cachedIndex !== cachedLength, "there still need to exist key node");
                            if (cachedChildren[cachedIndex].key != null)
                                break;
                        }
                        continue;
                    }
                    while (cachedChildren[cachedIndex].key == null)
                        cachedIndex++;
                    assert(key !== cachedChildren[cachedIndex].key);
                    cachedChildren.splice(newIndex, 0, cachedChildren[cachedIndex]);
                    cachedChildren.splice(cachedIndex + 1, 1);
                    element.insertBefore(cachedChildren[newIndex].element, cachedChildren[newIndex + 1].element);
                    newIndex++;
                    cachedIndex = newIndex;
                    continue;
                }
                if (cachedIndex < cachedLength) {
                    cachedChildren.splice(newIndex, 0, cachedChildren[cachedIndex]);
                    cachedChildren.splice(cachedIndex + 1, 1);
                    if (key != null) {
                        newIndex++;
                        while (newIndex < newLength) {
                            key = newChildren[newIndex].key;
                            if (key == null)
                                break;
                        }
                        if (key != null)
                            break;
                    }
                    cachedChildren[cachedIndex] = updateNode(newChildren[newIndex], cachedChildren[cachedIndex]);
                    newIndex++;
                    cachedIndex++;
                } else {
                    cachedChildren.splice(newIndex, 0, createNode(newChildren[newIndex]));
                    element.insertBefore(cachedChildren[newIndex].element, newIndex == cachedLength ? null : cachedChildren[newIndex + 1].element);
                    newIndex++;
                    cachedIndex++;
                    cachedLength++;
                }
            }
            while (cachedLength > newIndex) {
                cachedLength--;
                removeNode(cachedChildren[cachedLength]);
                cachedChildren.pop();
            }
        }
        return cachedChildren;
    }

    var hasNativeRaf = false;
    var nativeRaf = window.requestAnimationFrame;
    if (nativeRaf) {
        nativeRaf((param) => { if (param === +param) hasNativeRaf = true; });
    }

    var now = Date.now || (() => (new Date).getTime());
    var startTime = now();
    var lastTickTime = 0;

    function requestAnimationFrame(callback: (time: number) => void) {
        if (hasNativeRaf) {
            nativeRaf(callback);
        } else {
            var delay = 50 / 3 + lastTickTime - now();
            if (delay < 0) delay = 0;
            window.setTimeout(() => {
                lastTickTime = now();
                callback(lastTickTime - startTime);
            }, delay);
        }
    }

    var rootFactory: () => any;
    var rootCacheChildren: Array<IBobrilCacheNode> = [];

    var scheduled = false;
    function scheduleUpdate() {
        if (scheduled)
            return;
        scheduled = true;
        requestAnimationFrame(update);
    }

    var regEvents: { [name: string]: Array<(ev: Event, target: Node, node: IBobrilCacheNode) => boolean> };
    var registryEvents: { [name: string]: Array<{ priority: number; callback: (ev: Event, target: Node, node: IBobrilCacheNode) => boolean }> }
    regEvents = {};
    registryEvents = {};

    function addEvent(name: string, priority: number, callback: (ev: Event, target: Node, node: IBobrilCacheNode) => boolean): void {
        var list = registryEvents[name] || [];
        list.push({ priority: priority, callback: callback });
        registryEvents[name] = list;
    }

    function emitEvent(name: string, ev: Event, target: Node, node: IBobrilCacheNode) {
        var events = regEvents[name];
        if (events) for (var i = 0; i < events.length; i++) {
            if (events[i](ev, target, node))
                break;
        }
    }

    function addListener(el: HTMLElement, name: string) {
        function enhanceEvent(ev: Event) {
            ev = ev || window.event;
            var t = ev.target || ev.srcElement;
            var n = getCacheNode(<any>t);
            emitEvent(name, ev, <Node>t, n);
        }
        if (el.addEventListener) {
            el.addEventListener(name, enhanceEvent);
        } else {
            el.attachEvent("on" + name, enhanceEvent);
        }
    }

    var eventsCaptured = false;
    function initEvents() {
        if (eventsCaptured)
            return;
        eventsCaptured = true;
        var eventNames = objectKeys(registryEvents);
        for (var j = 0; j < eventNames.length; j++) {
            var eventName = eventNames[j];
            var arr = registryEvents[eventName];
            arr = arr.sort((a, b) => a.priority - b.priority);
            regEvents[eventName] = arr.map(v => v.callback);
        }
        registryEvents = null;
        var body = document.body;
        for (var i = 0; i < eventNames.length; i++) {
            addListener(body, eventNames[i]);
        }
    }

    function init(factory: () => any) {
        rootFactory = factory;
        scheduleUpdate();
    }

    var uptime = 0;

    function update(time: number) {
        initEvents();
        uptime = time;
        scheduled = false;
        var newChildren = rootFactory();
        rootCacheChildren = updateChildren(document.body, newChildren, rootCacheChildren);
        callPostCallbacks();
    }

    function bubbleEvent(node: IBobrilCacheNode, name: string, param: any): boolean {
        while (node) {
            var c = node.component;
            if (c) {
                var m = (<any>c)[name];
                if (m) {
                    if (m.call(c, node.ctx, param))
                        return true;
                }
            }
            var el = node.element.parentNode;
            node = el ? getCacheNode(el) : null;
        }
        return false;
    }

    function merge(f1: Function, f2: Function): Function {
        return () => {
            var result = f1.apply(this, arguments);
            if (result === true) return result;
            return f2.apply(this, arguments);
        }
    }

    function postEnhance(node: IBobrilNode, methods: { id?: string;[name: string]: any }): IBobrilNode {
        var comp = node.component;
        if (!comp) {
            node.component = methods;
            return node;
        }
        var id = methods.id;
        var res: any;
        if (id) {
            id = "b$a" + id;
            res = (<any>comp)[id];
            if (res) {
                node.component = res;
                return node;
            }
        }
        res = Object.create(comp);
        for (var i in methods) {
            if (methods.hasOwnProperty(i) && i !== "id") {
                var m = methods[i];
                var origM = (<any>comp)[i];
                if (typeof (m) == "function" && origM) {
                    res[i] = merge(origM, m);
                } else {
                    res[i] = m;
                }
            }
        }
        if (id) {
            (<any>comp)[id] = res;
        }
        node.component = res;
        return node;
    }

    return {
        createNode: createNode,
        updateNode: updateNode,
        updateChildren: updateChildren,
        callPostCallbacks: callPostCallbacks,
        init: init,
        isArray: isArray,
        uptime: () => uptime,
        now: now,
        invalidate: scheduleUpdate,
        vmlNode: () => inNamespace = true,
        deref: getCacheNode,
        addEvent: addEvent,
        bubble: bubbleEvent,
        postEnhance: postEnhance
    };
})(window, document);
