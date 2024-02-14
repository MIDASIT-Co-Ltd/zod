import { Context, Response, RouterContext, RouterMiddleware, RouteParams, State } from "oak/mod.ts";
import { z } from './swagger-utils.ts';
import { ZodError, ZodRawShape } from "zod";
import { ResponseHandler } from "./response-handler.ts";

function handleZodError(error: ZodError, response: Response) {
    const newErrors = error.errors.map(err => ({
        message: err.message,
        path: err.path.join('.'),
        code: err.code
    }));

    let existingErrors = [];
    
    //@ts-ignore: body has error
    if (response.body && Array.isArray(response.body.error)) {
        //@ts-ignore: body has error
        existingErrors = response.body.error;
    }

    const combinedErrors = [...existingErrors, ...newErrors];

    response.status = 400;
    response.body = { error: combinedErrors };
}

/**
 * @deprecated The method should not be used
 */
export const middlewareChain = <R extends string, P extends RouteParams<R> = RouteParams<R>, S extends State = Record<string, any>>(
    ...middlewares: RouterMiddleware<R, P, S>[]
  ): RouterMiddleware<R, P, S> => {
    return async (ctx: RouterContext<R, P, S>, next: any) => {
      const composedMiddleware = middlewares.reduceRight(
        (nextMiddleware, currentMiddleware) => {
          return async () => {
            await currentMiddleware(ctx, nextMiddleware);
          };
        },
        next
      );
      await composedMiddleware();
    };
};

export const middlewareWrapper = (execute: Function) => async(ctx: Context, next: any) => {
    interface RequestConfig {
        body?: any,
        param?: any,
        header?: any,
        path?: any,
        state?: any,
        [key: string]: any;
    }

    const request: RequestConfig = {
        body: ctx.state.body || undefined,
        param: ctx.state.param || undefined,
        header: ctx.state.header || undefined,
        path: ctx.state.path || undefined,
        state: ctx.state
    };
    Object.keys(request).forEach(key => request[key] === undefined && delete request[key]);

    const result = await execute(request, ctx);
    if (result) {
        if (result.status && typeof result.status === 'number' && result.status >= 200 && result.status <= 599) {
            const { status, ...response } = result;
            ResponseHandler(response, ctx.response, status)    
        }
        ResponseHandler(result, ctx.response)
    }
    await next();
}

export const validateResponse = (resList: Array<{ status: number; schema: z.ZodSchema }>) => async (ctx: Context, next: any) => {
    try {
        resList.forEach((res) =>{
            if(res.status == ctx.response.status) res.schema.parse(ctx.response.body)
        })
        await next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.errors.map(err => ({
                message: err.message,
                path: err.path.join('.'),
                code: err.code
            }));        
            ctx.response.status = 400;
            ctx.response.body = {error: errors, response: ctx.response.body};
        }
        else {
            throw error;
        }
    }
};

export const validateBody = (schema: z.ZodSchema) => async (ctx: Context, next: any) => { 
    try {
        const body = await ctx.request.body().value;
        ctx.state.body = schema.parse(body);
        await next();
    } catch (error) {        
        if (error instanceof z.ZodError) {
            handleZodError(error, ctx.response);
        }
        else {
            throw error;
        }
    }
};

export const validateParam = (schema: z.ZodSchema) => async (ctx: Context, next: any) => {
    try {
        const params = Object.fromEntries(
            [...ctx.request.url.searchParams.entries()].map(([key, value]) => {
                if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
                    return [key, parseInt(value, 10)];
                }
                return [key, value];
            })
        );
        ctx.state.param = schema.parse(params);
        await next();
    } catch (error) {        
        if (error instanceof z.ZodError) {
            handleZodError(error, ctx.response);
        }
        else {
            throw error;
        }
    }
};  

export const validatePath = (schema: z.ZodSchema) => async (ctx: Context, next: any) => {
    try {
        const params = Object.fromEntries(
            //@ts-ignore: ctx has param
            Object.entries(ctx.params).map(([key, value]) => {
                if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
                    return [key, parseInt(value, 10)];
                }
                return [key, value];
            })
        );
        ctx.state.path = schema.parse(params);
        await next();
    }
    catch (error) {        
        if (error instanceof z.ZodError) {
            handleZodError(error, ctx.response);
        }
        else {
            throw error;
        }
    }
}

export const validateHeader = (schema: z.ZodSchema) => async (ctx: Context, next: any) => {
    try {
        const headersObj: { [key: string]: string } = {};
        for (const [key, value] of ctx.request.headers) {
            headersObj[key.toUpperCase()] = value;
        }
        ctx.state.header = uppercaseKeys(schema as z.ZodObject<ZodRawShape>).parse(headersObj)
        await next();
    } catch (error) {        
        if (error instanceof z.ZodError) {
            handleZodError(error, ctx.response);
        }
        else {
            throw error;
        }
    }
}

function uppercaseKeys<T extends ZodRawShape>(schema: z.ZodObject<T>): z.ZodObject<T> {
    const shape = schema.shape;
    const newShape: any = {};
  
    for (const key in shape) {
      const upperKey = key.toUpperCase();
      newShape[upperKey] = shape[key];
    }
  
    return z.object(newShape as T) as z.ZodObject<T>;
}