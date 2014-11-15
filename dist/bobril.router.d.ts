interface IBobrilStatic {
    // register root routes, basicaly call this instead of b.init
    // routes is IRoute | Array<IRoute>
    routes?(routes: any): void;
    route?(config: IRouteConfig, nestedRoutes?: Array<IRoute>): IRoute;
    link?(node:IBobrilNode, name: string, params?: Object): IBobrilNode;
}

// Just marker interface
interface IRoute {
}

interface IRouteConfig {
    name?: string;
    url?: string;
    handler: any;
}