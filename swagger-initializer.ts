import { generateRegister } from "./swagger-generator.ts";
import { writeDocumentation } from "./swagger-utils.ts";

export async function initSwagger(serverUrl: string, routerUrl: string, schemaPath: string, writePath: string, deniedMiddlewares: string[]) {    
    if (schemaPath.startsWith('.')) {
        schemaPath = schemaPath.substring(1);
    }
    
    await generateRegister(routerUrl, schemaPath, deniedMiddlewares);
    writeDocumentation(writePath, serverUrl);

    const swaggerUIContent = 
    `<!DOCTYPE html>
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
            window.onload = () => {
                window.ui = SwaggerUIBundle({
                    url: ${writePath} + "openapi-docs.yml",
                    dom_id: "#swagger-ui",
                    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
                    layout: "StandaloneLayout"
                });
            };
        </script>
    </body>
    </html>
    `;
    
    const swaggerAppContent = 
    `import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";
    import { send } from "https://deno.land/x/oak@v12.6.1/send.ts";
    
    const swaggerApp = new Application();
    swaggerApp.use(async (ctx) => {
        await send(ctx, ctx.request.url.pathname, {
            root: Deno.cwd(),
            index: ${writePath} + "/swagger-ui.html",
        });
    })
    
    console.log(\`Swagger is listening on port 3000\`);
    swaggerApp.listen({ port: 3000});
    `;

    const textEncorder = new TextEncoder();
    const SwaggerUI = textEncorder.encode(swaggerUIContent);
    Deno.writeFileSync(`${writePath}/swagger-ui.html`, SwaggerUI)

    
    const SwaggerApp = textEncorder.encode(swaggerAppContent);
    Deno.writeFileSync(`${writePath}/swagger-app.ts`, SwaggerApp)
}