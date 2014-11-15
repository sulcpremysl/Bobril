﻿/// <reference path="../src/bobril.d.ts"/>
/// <reference path="../src/bobril.router.d.ts"/>

// Heavily inspired by https://github.com/rackt/react-router/ Thanks to authors

interface IRoute {
    name?: string;
    url?: string;
    handler: IBobrilComponent;
    children?: Array<IRoute>;
}

interface OutFindMatch {
    p: { [name: string]: string }
}

((b: IBobrilStatic, window: Window) => {
    function emitOnHashChange(ev: Event, target: Node, node: IBobrilCacheNode) {
        b.invalidate();
        return false;
    }

    b.addEvent("hashchange", 100, emitOnHashChange);

    var PUSH = 0;
    var REPLACE = 1;
    var POP = 2;

    var actionType: number;

    function push(path: string) {
        actionType = PUSH;
        window.location.hash = path;
    }

    function replace(path: string) {
        actionType = REPLACE;
        var l = window.location;
        l.replace(l.pathname + l.search + '#' + path);
    }

    function pop() {
        actionType = POP;
        window.history.back();
    }

    var rootRoutes: IRoute[];
    var nameRouteMap: { [name: string]: IRoute } = {};

    function encodeURL(url: string): string {
        return encodeURIComponent(url).replace(/%20/g, '+');
    }

    function decodeURL(url: string): string {
        return decodeURIComponent(url.replace(/\+/g, ' '));
    }

    function encodeURLPath(path: string): string {
        return String(path).split('/').map(encodeURL).join('/');
    }

    var paramCompileMatcher = /:([a-zA-Z_$][a-zA-Z0-9_$]*)|[*.()\[\]\\+|{}^$]/g;
    var paramInjectMatcher = /:([a-zA-Z_$][a-zA-Z0-9_$?]*[?]?)|[*]/g;

    var compiledPatterns: { [pattern: string]: { matcher: RegExp; paramNames: string[] } } = {};

    function compilePattern(pattern: string) {
        if (!(pattern in compiledPatterns)) {
            var paramNames: Array<string> = [];
            var source = pattern.replace(paramCompileMatcher, (match, paramName) => {
                if (paramName) {
                    paramNames.push(paramName);
                    return '([^/?#]+)';
                } else if (match === '*') {
                    paramNames.push('splat');
                    return '(.*?)';
                } else {
                    return '\\' + match;
                }
            });

            compiledPatterns[pattern] = {
                matcher: new RegExp('^' + source + '$', 'i'),
                paramNames: paramNames
            };
        }

        return compiledPatterns[pattern];
    }

    function extractParamNames(pattern: string): string[] {
        return compilePattern(pattern).paramNames;
    }

    // Extracts the portions of the given URL path that match the given pattern.
    // Returns null if the pattern does not match the given path.
    function extractParams(pattern: string, path: string): { [name: string]: string } {
        var object = compilePattern(pattern);
        var match = decodeURL(path).match(object.matcher);

        if (!match)
            return null;

        var params: { [name: string]: string } = {};

        var pn = object.paramNames;
        var l = pn.length;
        for (var i = 0; i < l; i++) {
            params[pn[i]] = match[i + 1];
        }

        return params;
    }

    // Returns a version of the given route path with params interpolated.
    // Throws if there is a dynamic segment of the route path for which there is no param.
    function injectParams(pattern: string, params?: { [name: string]: string }) {
        params = params || {};

        var splatIndex = 0;

        return pattern.replace(paramInjectMatcher, (match, paramName) => {
            paramName = paramName || 'splat';

            // If param is optional don't check for existence
            if (paramName.slice(-1) !== '?') {
                if (params[paramName] == null)
                    throw new Error('Missing "' + paramName + '" parameter for path "' + pattern + '"');
            } else {
                paramName = paramName.slice(0, -1);
                if (params[paramName] == null) {
                    return '';
                }
            }

            var segment: string;
            if (paramName === 'splat' && Array.isArray(params[paramName])) {
                segment = params[paramName][splatIndex++];

                if (segment == null)
                    throw new Error('Missing splat # ' + splatIndex + ' for path "' + pattern + '"');
            } else {
                segment = params[paramName];
            }

            return encodeURLPath(segment);
        });
    }

    function findMatch(path: string, rs: Array<IRoute>, outParams: OutFindMatch): Array<IRoute> {
        var l = rs.length;
        for (var i = 0; i < l; i++) {
            var r = rs[i];
            if (r.children) {
                var res = findMatch(path, r.children, outParams);
                if (res) {
                    res.push(r);
                    return res;
                }
            }
            if (r.url) {
                var params = extractParams(r.url, path);
                if (params) {
                    outParams.p = params;
                    return [r];
                }
            }
        }
        return null;
    };

    function rootNodeFactory(): IBobrilNode {
        var path = window.location.hash.substr(1);
        if (!isAbsolute(path)) path = "/" + path;
        var out: OutFindMatch = { p: {} };
        var matches = findMatch(path, rootRoutes, out) || [];
        var fn: (otherdata?: any) => IBobrilNode = noop;
        for (var i = 0; i < matches.length; i++) {
            ((fninner: Function, r: IRoute, routeParams: Object) => {
                fn = (otherdata?: any) => {
                    otherdata = otherdata || {};
                    otherdata.activeRouteHandler = fninner;
                    otherdata.routeParams = routeParams;
                    return { data: otherdata, component: r.handler };
                }
            })(fn, matches[i], out.p);
        }
        return fn();
    }

    function noop(): IBobrilNode {
        return null;
    }

    function isAbsolute(url: string): boolean {
        return url[0] == "/";
    }

    function joinPath(p1: string, p2: string): string {
        if (isAbsolute(p2))
            return p2;
        if (p1[p1.length - 1] == "/")
            return p1 + p2;
        return p1 + "/" + p2;
    }

    function registerRoutes(url: string, rs: Array<IRoute>): void {
        var l = rs.length;
        for (var i = 0; i < l; i++) {
            var r = rs[i];
            var u = url;
            var name = r.name;
            if (name) {
                nameRouteMap[name] = r;
                u = joinPath(u, name);
            }
            if (r.url) {
                u = joinPath(url, r.url);
            }
            r.url = u;
            if (r.children)
                registerRoutes(u, r.children);
        }
    }

    function routes(rootroutes: any): void {
        if (!b.isArray(rootroutes)) {
            rootroutes = [rootroutes];
        }
        registerRoutes("/", rootroutes);
        rootRoutes = rootroutes;
        b.init(rootNodeFactory);
    }

    function route(config: IRouteConfig, nestedRoutes?: Array<IRoute>): IRoute {
        return { name: config.name, url: config.url, handler: config.handler, children: nestedRoutes };
    }

    function link(node: IBobrilNode, name: string, params?: { [name: string]: string }): IBobrilNode {
        var r = nameRouteMap[name];
        var url = injectParams(r.url, params);
        node.data = node.data || {};
        node.data.url = url;
        b.postEnhance(node, {
            init: (ctx: any, me: IBobrilNode) => {
                if (me.tag == "a") {
                    me.attrs = me.attrs || {};
                    me.attrs.href = "#" + url;
                }
            },
            onClick: (ctx: any) => {
                push(ctx.data.url);
                return true;
            }
        });
        return node;
    }

    b.routes = routes;
    b.route = route;
    b.link = link;
})(b, window);
