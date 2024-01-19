import { generateRegister } from "./swagger-generator.ts";
import { writeDocumentation } from "./swagger-utils.ts";
import { Router } from 'oak/mod.ts'
import { parse } from "yaml/es2022/yaml.mjs";

export interface customMiddleware {
    name: string;
    header?: Array<{ [key: string]: string }>;
    path?: Array<{ [key: string]: string }>;
    param?: Array<{ [key: string]: string }>;
    body?: Array<{ [key: string]: string }>;
}

export async function initSwagger(serverUrl: string, baseUrl: string, mainRouterFilePath: string, 
    schemaFolderPath: string, writeOpenAPISpecPath: string, customMiddlewares?: customMiddleware[]) {    
    
        if (schemaFolderPath.startsWith('.')) {
            schemaFolderPath = schemaFolderPath.substring(1);
    }
    
    await generateRegister(baseUrl, mainRouterFilePath, schemaFolderPath, customMiddlewares);
    writeDocumentation(writeOpenAPISpecPath, serverUrl+baseUrl);
}

export function transplantSwagger(omittedPath: string, writePath: string, router: Router) {
    router
    .get(
        omittedPath + '/swagger', (ctx) => {
          const apiSpec = JSON.stringify(parse(Deno.readTextFileSync(writePath + '/openapi-docs.yml')))
          const ui = `<!DOCTYPE html>
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
                  const openApiSpec = ${apiSpec}

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
                  };
              </script>
          </body>
          </html>
          `
        ctx.response.body = ui
    })
    .get(omittedPath + '/openapi', (ctx) => {
        const apiSpec = JSON.stringify(parse(Deno.readTextFileSync(writePath + '/openapi-docs.yml')))
        ctx.response.body = apiSpec
    })
    
}