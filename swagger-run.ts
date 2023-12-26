import { Application } from "oak/mod.ts";
import { send } from "oak/send.ts";

const swaggerApp = new Application();
swaggerApp.use(async (ctx) => {
    await send(ctx, ctx.request.url.pathname, {
        root: './',
        index: "swagger-ui.html",
    });
})

console.log(`Swagger is listening on port 3000`);
swaggerApp.listen({ port: 4442});