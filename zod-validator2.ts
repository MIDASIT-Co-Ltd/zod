import { Context, HttpError, Response } from "oak/mod.ts";
import { z } from './swagger-utils.ts';
import { ZodError, ZodRawShape } from "zod";
import { ResponseHandler } from "./response-handler.ts";
import { createHttpError } from "std/http/http_errors.ts";

interface ValidateRequestConfig {
    body?: z.ZodSchema,
    param?: z.ZodSchema,
    header?: z.ZodSchema,
    path?: z.ZodSchema,
    usecase: Function,
    useWrappedUsecase: boolean,
    response?: Array<{ status: number; schema: z.ZodSchema }>
}
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

// Error handling function
function handleError(error: Error, ctx: Context) {
    if (error instanceof z.ZodError) {
        handleZodError(error, ctx.response);
    } else if (error instanceof HttpError) {
        throw createHttpError(error.status, error.message);
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

// Validation functions
async function validateBody(ctx: Context, schema: z.ZodSchema) {
    const body = await ctx.request.body().value;
    ctx.state.request = { body: body };
    schema.parse(body);
}

function validateParam(ctx: Context, schema: z.ZodSchema) {
    const params = Object.fromEntries(ctx.request.url.searchParams);
    ctx.state.request = { params: params };
    ctx.state.param = schema.parse(params);
}

function validateHeader(ctx: Context, schema: z.ZodSchema) {
    const headersObj: { [key: string]: string } = {};
    for (const [key, value] of ctx.request.headers) {
        headersObj[key.toUpperCase()] = value;
    }
    ctx.state.header = uppercaseKeys(schema as z.ZodObject<ZodRawShape>).parse(headersObj);
}

function validatePath(ctx: Context, schema: z.ZodSchema) {
    //@ts-ignore: ctx has params
    ctx.state.path = schema.parse(ctx.params);
}

// Refactored validator function
export const validator = (request: ValidateRequestConfig) => async (ctx: Context, next: any) => {
    try {
        if (request.body) await validateBody(ctx, request.body);
        if (request.param) validateParam(ctx, request.param);
        if (request.header) validateHeader(ctx, request.header);
        if (request.path) validatePath(ctx, request.path);
    } catch (error) {
        handleError(error, ctx);
        return; // Stop further processing in case of error
    }

    // Process usecase
    if (request.useWrappedUsecase) {
        await handleWrappedUsecase(ctx, request.usecase);
    } else {
        await request.usecase(ctx);
    }

    // Handle response validation
    if (request.response) {
        validateResponse(ctx, request.response);
    }

    await next();
}

// Additional helper functions
async function handleWrappedUsecase(ctx: Context, usecase: Function) {
    const requestConfig = {
        body: await ctx.request.body().value || undefined,
        param: ctx.state.param || undefined,
        header: ctx.state.header || undefined,
        path: ctx.state.path || undefined
    };

    cleanRequestConfig(requestConfig);
    ResponseHandler(await usecase(requestConfig, ctx), ctx.response);
}

function cleanRequestConfig(requestConfig: {[key: string]: any}) {
    Object.keys(requestConfig).forEach(key => {
        if (requestConfig[key] === undefined) {
            delete requestConfig[key];
        }
    });
}

function validateResponse(ctx: Context, responses: Array<{ status: number; schema: z.ZodSchema }>) {
    try {
        responses.forEach((res) => {
            if (res.status == ctx.response.status) {
                res.schema.parse(ctx.response.body);
            }
        });
    } catch (error) {
        handleError(error, ctx);
    }
}
