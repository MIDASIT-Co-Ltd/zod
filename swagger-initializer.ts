import { generateRegister } from "./swagger-generator.ts";
import { writeDocumentation } from "./swagger-utils.ts";
import { Router } from "oak/mod.ts";
import { parse } from "yaml/es2022/yaml.mjs";
import { dirname, fromFileUrl, join } from "std/path/mod.ts";

export interface customMiddleware {
    name: string;
    header?: Array<{ [key: string]: string }>;
    path?: Array<{ [key: string]: string }>;
    param?: Array<{ [key: string]: string }>;
    body?: Array<{ [key: string]: string }>;
}
export interface serverUrl {
    url: string;
    description: string;
}

export async function initSwagger(serverUrls: serverUrl[], baseUrl: string, mainRouterFilePath: string, writeOpenAPISpecPath: string, customMiddlewares?: customMiddleware[]) {    
    await generateRegister(baseUrl, mainRouterFilePath, customMiddlewares);
    writeDocumentation(writeOpenAPISpecPath, serverUrls, baseUrl);
    console.log(`OpenAPI Docs generated successfully`)
}

export function getSwaggerRouter(OpenAPISpecPath: string, serverUrls?: serverUrl[], swaggerUrl?: string, loginURL?: string) {
    const apiSpec = JSON.stringify(parse(Deno.readTextFileSync(OpenAPISpecPath + '/openapi-docs.yml')))
    const swaggerRouter = new Router()
        .get('/', (ctx) => {ctx.response.body = getSwaggerUI(apiSpec, loginURL)})
        .get('/openapi', (ctx) => {ctx.response.body = apiSpec})

    console.log(`SwaggerRouter successfully generated:`);        
    swaggerUrl = swaggerUrl ? swaggerUrl : '/{swagger_router_path}';

    if (serverUrls) {
        serverUrls?.forEach(serverUrl => {
            console.log(`   '${serverUrl.description}:`)
            console.log(`       GET \'${serverUrl.url}${swaggerUrl}\' => return swaggerUI`)
            console.log(`       GET \'${serverUrl.url}${swaggerUrl}/openapi\' => return openAPIDocs`)
        })
    } else {
        console.log(`   GET \'{base_url}${swaggerUrl}\' => return swaggerUI`);
        console.log(`   GET \'{base_url}${swaggerUrl}/openapi\' => return openAPIDocs`);
    }

    return swaggerRouter;
}

function getSwaggerUI(apiSpec: string, loginURL? : string) {    
    const __dirname = dirname(fromFileUrl(import.meta.url));
    const filePath = join(__dirname, "login.html");

    const htmlCode = Deno.readTextFileSync(filePath);

    const preRequestScript = loginURL ? `
    async function loginAndStoreToken() {
        let child = document.createElement("div");
        child.innerHTML = \`${htmlCode}\`;
        document.body.appendChild(child);
    }
        
    loginAndStoreToken().then(() => {
        window.ui = SwaggerUIBundle({
            spec: openApiSpec,
            dom_id: "#swagger-ui",
            presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
            plugins: [
                HideTopBarPlugin
            ],
            layout: "StandaloneLayout",
            requestInterceptor: async (request) => {
                        let token = localStorage.getItem("X-AUTH-TOKEN");
                        
                        try {
                            if (token) {
                                const result = await fetch("${loginURL}", {
                                    headers: {
                                        "X-AUTH-TOKEN": token,
                                        "Content-Type": "application/json",
                                    },
                                    credentials: "include",
                                });
                                if (!result.ok) throw new Error("Token invalid");
                                request.headers["X-AUTH-TOKEN"] = token;
                                return request;
                            } else {
                                throw new Error("Token not found");
                            }
                        } catch {
                            document.getElementById("login-container").style.display = "block";
                            return await new Promise((resolve) => {                        
                                document.getElementById("login-cancel").addEventListener("click", () => {
                                    document.getElementById("login-container").style.display = "none";
                                    resolve(request);
                                });
        
                                document.getElementById("login-ok").addEventListener("click", () => {
                                    const email = document.getElementById("login-username").value;
                                    const password = document.getElementById("login-password").value;
        
                                    fetch("${loginURL}", {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json"
                                        },
                                        body: JSON.stringify({
                                            email,
                                            password
                                        })
                                    }).then(async (response) => {
                                        const result = await response.json();
                                        const token = result.token;
                                        localStorage.setItem("X-AUTH-TOKEN", "Bearer " + token);
        
                                        request.headers["X-AUTH-TOKEN"] = "Bearer " + token;
                                        resolve(request);
                                    }).catch(() => {
                                        localStorage.removeItem("X-AUTH-TOKEN");
                                        request.headers["X-AUTH-TOKEN"] = "INVALID TOKEN";
                                        resolve(request);
                                    }).finally(() => {
                                        document.getElementById("login-username").value = "";
                                        document.getElementById("login-password").value = "";
                                        document.getElementById("login-container").style.display = "none";
                                    });
                                });
                            });
                        }
                    }
        });
    });` : ``;

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="SwaggerUI" />
        <title>Moa Catwagger</title>
        <link href="data:image/x-icon;base64,AAABAAEAEBAQAAAAAAAoAQAAFgAAACgAAAAQAAAAIAAAAAEABAAAAAAAgAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAjtv6ALSU/wD///8ADQ0NALhQzACMjIsA2X/rAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEZmQEZmQABERERERERAABFGZmZmZmQAdGZkREREZkBGImRmRmRiJEYiZmZmZmIkRmZEZmRkRmRGZjRmZmNGZEZmZmZmZmZkVGZmZmZmZkB0ZmZmZmZmQHRmZkREZmZAdGZkd1FGZkB0ZkdXcURmQFdEd3dxQEQAd3dXdxFAAADBBwAAAAcAAAADAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAABAAAAAQAAAAEAAAATAAAAHwAA" rel="icon" type="image/x-icon">
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js" crossorigin></script>
        <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-standalone-preset.js" crossorigin></script>
        <script>
            const openApiSpec = ${apiSpec};

            const HideTopBarPlugin = function() {
                return {
                    components: {
                        Topbar: () => null
                    }
                };
            };
            window.onload = () => {
                window.ui = SwaggerUIBundle({
                    spec: openApiSpec,
                    dom_id: "#swagger-ui",
                    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
                    plugins: [
                        HideTopBarPlugin
                    ],
                    layout: "StandaloneLayout"
                });
                ${preRequestScript}
            };
        </script>
    </body>
    </html>`;
}