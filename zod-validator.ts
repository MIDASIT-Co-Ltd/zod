import { Context, HttpError, Response } from "oak/mod.ts";
import { z } from './swagger-utils.ts';
import { ZodError, ZodRawShape } from "zod";
import { ResponseHandler } from "./response-handler.ts";
import { createHttpError } from "std/http/http_errors.ts";

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

export const usecaseWrapper = (execute: Function) => async(ctx: Context, next: any) => {
    interface RequestConfig {
        body?: any,
        param?: any,
        header?: any,
        path?: any,
        [key: string]: any;
    }

    const request: RequestConfig = {
        body: await ctx.request.body().value || undefined,
        param: ctx.state.param || undefined,
        header: ctx.state.header || undefined,
        path: ctx.state.path || undefined
    };
    Object.keys(request).forEach(key => request[key] === undefined && delete request[key]);

    ResponseHandler(await execute(request, ctx), ctx.response)
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
        else if (error instanceof HttpError) {
            throw createHttpError(error.status, error.message);
        }
    }
};

export const validateBody = (schema: z.ZodSchema) => async (ctx: Context, next: any) => { 
    try {
        const body = await ctx.request.body().value;
        ctx.state.request = {body : body}
        schema.parse(body);
        await next();
    } catch (error) {        
        if (error instanceof z.ZodError) {
            handleZodError(error, ctx.response);
        }
        else if (error instanceof HttpError) {
            throw createHttpError(error.status, error.message);
        }
    }
};

export const validateParam = (schema: z.ZodSchema) => async (ctx: Context, next: any) => {
    try {
        const params = Object.fromEntries(ctx.request.url.searchParams);
        ctx.state.request = {params : params}        
        ctx.state.param = schema.parse(params);
        await next();
    } catch (error) {        
        if (error instanceof z.ZodError) {
            handleZodError(error, ctx.response);
        }
        else if (error instanceof HttpError) {
            throw createHttpError(error.status, error.message);
        }
    }
};  
const pathSchema = z.string().transform(data => isNaN(Number(data)) ? data : Number(data));
export const validatePath = (schema: z.ZodSchema<typeof pathSchema>) => async (ctx: Context, next: any) => {
    try {
        //@ts-ignore: ctx has params
        ctx.state.path = schema.parse(ctx.params);
    }
    catch (error) {        
        if (error instanceof z.ZodError) {
            handleZodError(error, ctx.response);
        }
    }
    await next();
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
        else if (error instanceof HttpError) {
            throw createHttpError(error.status, error.message);
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