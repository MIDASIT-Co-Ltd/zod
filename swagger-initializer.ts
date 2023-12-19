import { Application } from "oak/mod.ts";
import { send } from "oak/send.ts";
import { generateRegister } from "./swagger-generator.ts";
import { writeDocumentation } from "./swagger-utils.ts";

export async function initSwagger(serverUrl: string, routerUrl: string, schemaPath: string, writePath: string, deniedMiddlewares: string[]) {    
    if (schemaPath.startsWith('.')) {
        schemaPath = schemaPath.substring(1);
    }
    
    await generateRegister(routerUrl, schemaPath, deniedMiddlewares);
    writeDocumentation(writePath, serverUrl);

    const textEncorder = new TextEncoder();
    const Contents = textEncorder.encode(htmlContent);
    Deno.writeFileSync(`${writePath}/swagger-ui.html`, Contents)

    const swaggerApp = new Application();
    swaggerApp.use(async (ctx) => {
        await send(ctx, ctx.request.url.pathname, {
            root: writePath,
            index: "swagger-ui.html",
        });
    })

    console.log(`Swagger is listening on port 3000`);
    swaggerApp.listen({ port: 3000});
}

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="SwaggerUI" />
    <title>SwaggerUI</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
        window.onload = () => {
            let url = window.location.protocol + "//" + window.location.host + "/" + window.location.pathname.split("/").filter(s => s.length > 0).join("/");
            window.ui = SwaggerUIBundle({
                url: url + "openapi-docs.yml",
                dom_id: "#swagger-ui",
                presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>
`;