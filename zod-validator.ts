import { Context, Response } from "oak/mod.ts";
import { z } from './swagger-utils.ts';
import { ZodError, ZodRawShape } from "zod";
import { ResponseHandler } from "./response-handler.ts";

function handleZodError(error: ZodError, response: Response) {
    const errors = error.errors.map(err => err);
    response.status = 400;
    response.body = { error: errors, response: response.body };
};

export const executeAndValidateResponses = (execute: Function, resList: Array<{ status: number; schema: z.ZodSchema }>) => async(ctx: Context, next: any) => {
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

    ResponseHandler(await execute(request), ctx.response)

    try {
        resList.forEach((res) =>{
            if(res.status == ctx.response.status) res.schema.parse(ctx.response.body)
        })
        await next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            handleZodError(error, ctx.response);
        } else {    
            console.error('알 수 없는 오류:', error);
        }
    }
}

export const validateResponse = (status: number, schema: z.ZodSchema) => async (ctx: Context, next: any) => {
    try {
        const response = ctx.response.body
        if (ctx.response.status === status) {
            schema.parse(response)
        }
        await next();
    } catch (error) {        
        if (error instanceof z.ZodError) {
            handleZodError(error, ctx.response);
        } else {    
            console.error('알 수 없는 오류:', error);
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
        } else {    
            console.error('알 수 없는 오류:', error);
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
        } else {    
            console.error('알 수 없는 오류:', error);
        }
    }
};  

export const validatePath = (schema: z.ZodSchema) => async (ctx: Context, next: any) => {
    try {
        //@ts-ignore: ctx has params
        ctx.state.path = schema.parse(ctx.params);

        await next();
    }
    catch (error) {        
        if (error instanceof z.ZodError) {
            handleZodError(error, ctx.response);
        } else {    
            console.error('알 수 없는 오류:', error);
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
        } else {    
            console.error('알 수 없는 오류:', error);
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