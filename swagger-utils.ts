import {
    OpenAPIRegistry,
    OpenApiGeneratorV3,
    extendZodWithOpenApi,
} from 'zodOpenapi';
import * as yaml from 'yaml/es2022/yaml.mjs';
import { z } from 'zod';
import { ensureDirSync } from 'std/fs/mod.ts';
import { serverUrl } from "./swagger-initializer.ts";

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

function getOpenApiDocumentation(serverUrls: serverUrl[], baseUrl: string) {
    const generator = new OpenApiGeneratorV3(registry.definitions);
    try{
        return generator.generateDocument({    
            openapi: '3.0.0',
            info: {
                version: '1.0.0',
                title: 'Midas API',
                description: 'This is the MIDAS API specification',
            },
            servers: serverUrls.map(serverUrl => ({
                url: serverUrl.url + baseUrl,
                description: serverUrl.description
            }))
        });
    } catch(error){
        console.log(error);
    }
}

export function writeDocumentation(writePath: string, serverUrls: serverUrl[], baseUrl: string) {
    const docs = getOpenApiDocumentation(serverUrls, baseUrl);
    const fileContent = yaml.stringify(docs);

    const textEncorder = new TextEncoder();
    const Contents = textEncorder.encode(fileContent);
    
    ensureDirSync(writePath);
    Deno.writeFileSync(`${writePath}/openapi-docs.yml`, Contents);
}

type Method = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace';
export function registerEndpoint(
    bearerAuthName: string,
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
                '*/*': {
                    schema: details.schema
                }
            };
        }
    });

    registry.registerPath({
        security : [{[bearerAuthName]: []}],
        method : method,
        path : path,
        summary : summary,
        request: requestConfig,
        responses : responses,
        tags : [tag]
    });
}

export function registerComponent() {
    const bearerAuth = registry.registerComponent(
        'securitySchemes',
        'X-AUTH-TOKEN',
        {
          type: 'apiKey',
          name: 'X-AUTH-TOKEN',
          in: 'header'
        }
      );
    return bearerAuth;
}

export {z}
