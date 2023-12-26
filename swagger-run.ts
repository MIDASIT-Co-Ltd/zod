import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { send } from "https://deno.land/x/oak@v12.6.1/send.ts";

const swaggerApp = new Application();
swaggerApp.use(async (ctx) => {
    await send(ctx, ctx.request.url.pathname, {
        root: './',
        index: "swagger-ui.html",
    });
})

console.log(`Swagger is listening on port 3000`);
swaggerApp.listen({ port: 4442});