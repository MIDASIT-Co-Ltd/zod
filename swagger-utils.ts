import {
    OpenAPIRegistry,
    OpenApiGeneratorV3,
    extendZodWithOpenApi,
} from 'zodOpenapi';
import * as yaml from 'yaml/es2022/yaml.mjs';
import { z } from 'zod';

extendZodWithOpenApi(z);

class APISpecRegister{
    private static instance: OpenAPIRegistry;
    public static getInstance() {
        if(!APISpecRegister.instance){
            APISpecRegister.instance = new OpenAPIRegistry();
        }
        return APISpecRegister.instance;
    }
}

const registry = APISpecRegister.getInstance();

function getOpenApiDocumentation(serverUrl: string) {
    const generator = new OpenApiGeneratorV3(registry.definitions);
    try{
        return generator.generateDocument({    
            openapi: '3.0.0',
            info: {
                version: '1.0.0',
                title: 'Midas API',
                description: 'This is the MIDAS API specification',
            },
            servers: [{ url: serverUrl }],
        });
    } catch(error){
        console.log(error);
    }
}

export function writeDocumentation(writePath: string, serverUrl: string) {
    const docs = getOpenApiDocumentation(serverUrl);
    const fileContent = yaml.stringify(docs);

    const textEncorder = new TextEncoder();
    const Contents = textEncorder.encode(fileContent);

    Deno.writeFileSync(`${writePath}/openapi-docs.yml`, Contents)
}

type Method = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace';
export function registerEndpoint(
    method: Method, 
    path: string, 
    summary: string,
    tag: string,
    requestDetails: {
        body?: {
            description?: string,
            schema?: any
        },
        params?: any,
        query?: any,
        headers?: any | Array<any>
    } = {},
    responseDetails: { [status: string]: { description: string, schema?: any } }
) {
    const requestConfig: any = {};

    if (requestDetails.body) {
        requestConfig.body = {
            description: requestDetails.body.description,
            content: {
                'application/json': {
                    schema: requestDetails.body.schema
                }
            }
        };
    }

    if (requestDetails.headers) {
        requestConfig.headers = requestDetails.headers;
    }

    if (requestDetails.params) {
        requestConfig.params = requestDetails.params;
    }
    
    if (requestDetails.query) {
        requestConfig.query = requestDetails.query;
    }

    const responses: any = {};
    Object.entries(responseDetails).forEach(([statusCode, details]) => {
        responses[statusCode] = {
            description: details.description,
        };
        if (details.schema) {
            responses[statusCode].content = {
                'application/json': {
                    schema: details.schema
                }
            };
        }
    });

    registry.registerPath({
        method : method,
        path : path,
        summary : summary,
        request: requestConfig,
        responses : responses,
        tags : [tag]
    });
}

export {z}
