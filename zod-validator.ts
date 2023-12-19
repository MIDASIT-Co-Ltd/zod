import { Context, Response } from "oak/mod.ts";
import { z } from "./swagger-utils.ts";
import { ZodError, ZodRawShape } from "zod";

function handleZodError(error: ZodError, response: Response) {
    const errors = error.errors.map(err => err);
    response.status = 400;
    response.body = { error: errors };
};

export const validateResponse = (status: number, schema: z.ZodSchema) => async (ctx: Context, next: any) => {
    try {
        interface responseConfig {
            status: string,
            message: string,
            data?: any
        }
        const response: responseConfig = ctx.response.body as responseConfig

        if (ctx.response.status === status) {
            schema.parse(response.data)
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
        schema.parse(params);

        await next();
    } catch (error) {        
        if (error instanceof z.ZodError) {
            handleZodError(error, ctx.response);
        } else {    
            console.error('알 수 없는 오류:', error);
        }
    }
};  

export const validatePath = (schema: z.ZodSchema) => async ({ params, response}: { params: object, response: Response}, next: any) => {
    try {
        schema.parse(params);

        await next();
    }
    catch (error) {        
        if (error instanceof z.ZodError) {
            handleZodError(error, response);
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
        uppercaseKeys(schema as z.ZodObject<ZodRawShape>).parse(headersObj)

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