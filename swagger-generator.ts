import { z, registerEndpoint } from "./swagger-utils.ts";
import { ZodObject } from "zod";
import * as path from "std/path/mod.ts";
import {customMiddleware} from "./swagger-initializer.ts"

export const generateRegister = async(routerPath: string, schemaUrl: string, deniedMiddlewares: string[], customMiddlewares: customMiddleware[]) => {
    const code = await Deno.readTextFile(routerPath);
    const routers = extractRouters(code);


    for (const [router, mainPath] of routers) {
        const routerSection = extractRouterSection(code, router, routerPath);
        const httpMethods = extractHttpMethods(routerSection);

        for (const methodToken of httpMethods) {
            const method = extractMethod(methodToken);
            const [path, middlewares] = extractPathAndMiddlewares(methodToken, mainPath);
            const summary = extractSummary(middlewares, deniedMiddlewares);
            const tag = router;

            const request = await createRequestConfig(middlewares, schemaUrl, customMiddlewares);
            const responses = await createResponseConfig(middlewares, schemaUrl);

            registerEndpoint(method, path, summary, tag, request, responses);
        }
    }
}

function extractRouters(code: string): string[][] {
    const routerRegex = /\.use\(["']\/([^"']+)["'],\s*(\w+)\.routes\(\),\s*\2\.allowedMethods\(\)\);/g;
    const matches = [...code.matchAll(routerRegex)];

    return matches.map(match => [match[2], match[1]]);
}

function extractRouterSection(text: string, routerName: string, routerPath: string): string {
    const routerStartRegex = new RegExp(`const ${routerName} = new Router\\(\\)`, 'g');
    const nextRouterStartRegex = /const [^ ]+ = new Router\(\)/g;

    let startIndex = text.search(routerStartRegex);
    let endIndex = text.length;

    if (startIndex === -1) {
        const routerRegex = new RegExp(`import { (${routerName}) } from '(.*?)'`)
        const matchImport = text.match(routerRegex)

        const currentWorkingDirectory = Deno.cwd();

        const relativePath = routerPath;
        
        const absolutePath = path.resolve(currentWorkingDirectory, relativePath);
        const directoryPath = path.dirname(absolutePath);

        if (!matchImport) return '';
        const newAbsolutePath = path.join(directoryPath, matchImport![2]);

        text = Deno.readTextFileSync(newAbsolutePath);

        startIndex = text.search(routerStartRegex);
        endIndex = text.length;
    }

    nextRouterStartRegex.lastIndex = startIndex;
    let match;
    while ((match = nextRouterStartRegex.exec(text)) !== null) {
        if (match.index > startIndex) {
            endIndex = match.index;
            break;
        }
    }

    return text.substring(startIndex, endIndex);
}

function extractHttpMethods(str: string): string[] {
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'];
    const tokens = [];
    let currentIndex = 0;

    while (currentIndex < str.length) {
        const foundMethod = methods.find(method => str.substring(currentIndex).startsWith('.' + method));
        if (foundMethod) {
            const start = str.indexOf('(', currentIndex) + 1;
            let end = start;
            let stack = 1;

            while (end < str.length && stack > 0) {
                if (str[end] === '(') {
                    stack++;
                } else if (str[end] === ')') {
                    stack--;
                }
                end++;
            }

            if (stack === 0) {
                tokens.push(str.substring(currentIndex, end));
                currentIndex = end;
            } else {
                break;
            }
        } else {
            currentIndex++;
        }
    }

    return tokens;
}

type Method = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace';
function extractMethod(token: string): Method {
    const methodMatch = token.match(/\.(get|post|put|delete|patch|head|options|trace)\(/);
    return methodMatch![1] as Method;
}

function extractPathAndMiddlewares(token: string, mainPath: string): [string, string[]] {
    const result = splitTopLevelCommas(extractParenthesesContent(token));
    const rawPath = result[0].replace(/['"]/g, '') ?? "";
    const path = rawPath.replace(/:([^\/]+)/g, '{$1}')

    const middlewares = result.slice(1);
    return ['/' + mainPath + path, middlewares];
}

function extractParenthesesContent(str: string): string {
    let depth = 0;
    let result = '';

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (char === '(') {
            depth++;
            if (depth > 1) result += char;
        } else if (char === ')') {
            depth--;
            if (depth >= 1) result += char;
        } else {
            if (depth >= 1) result += char;
        }
    }

    return result;
}

function splitTopLevelCommas(str: string): string[] {
    let depth = 0;
    let start = 0;
    const result = [];

    for (let i = 0; i < str.length; i++) {
        switch (str[i]) {
            case '(':
                depth++;
                break;
            case ')':
                depth--;
                break;
            case ',':
                if (depth === 0) {
                    result.push(str.substring(start, i).trim());
                    start = i + 1;
                }
                break;
        }
    }

    if (start < str.length) {
        result.push(str.substring(start).trim());
    }

    return result;
}

interface RequestConfig {
    query?: z.ZodSchema,
    params?: z.ZodSchema,
    headers?: z.ZodSchema,
    body?: {
        schema?: z.ZodSchema;
    };
}
async function createRequestConfig(middlewares: string[], schemaUrl: string, customMiddlewares: customMiddleware[]): Promise<RequestConfig> {
    const request: RequestConfig = {};

    for (const middleware of middlewares) {
        if (middleware.includes('validateParam')) {
            const match = middleware.match(/validateParam\(([^)]+)\)/);

            if (match && match[1]) {
                const [moduleName, schemaName] = match[1].split('.').slice(-2);
                const newSchema = await getSchemaObject(moduleName, schemaName, schemaUrl)
                request.query = request.query! ? request.query.merge(newSchema) : newSchema; 
            }
        }

        if (middleware.includes('validateBody')) {
            const match = middleware.match(/validateBody\(([^)]+)\)/);

            if (match && match[1]) {
                const [moduleName, schemaName] = match[1].split('.').slice(-2);
                const newSchema = await getSchemaObject(moduleName, schemaName, schemaUrl)
                const schema = request.body! && request.body.schema! ? request.body.schema.merge(newSchema) : newSchema;
                request.body = {schema: schema}
            }
        }

        if (middleware.includes('validatePath')) {
            const match = middleware.match(/validatePath\(([^)]+)\)/);
            
            if (match && match[1]) {
                const [moduleName, schemaName] = match[1].split('.').slice(-2);
                const newSchema = await getSchemaObject(moduleName, schemaName, schemaUrl)
                request.params = request.params! ? request.params.merge(newSchema) : newSchema; 
            }
        }

        if (middleware.includes('validateHeader')) {
            const match = middleware.match(/validateHeader\(([^)]+)\)/);
            
            if (match && match[1]) {
                const [moduleName, schemaName] = match[1].split('.').slice(-2);
                const newSchema = await getSchemaObject(moduleName, schemaName, schemaUrl)
                request.headers = request.headers! ? request.headers.merge(newSchema) : newSchema; 
            }
        }

        for (const customMiddleware of customMiddlewares) {
            if (middleware.includes(customMiddleware.name)) {
                const match = middleware.match(new RegExp(`${customMiddleware.name}`));
                
                // Param 처리
                if (customMiddleware.param) {
                    const paramSchema = z.object(
                        customMiddleware.param.reduce((acc, curr) => {
                            acc[curr.key] = z.string(); // Zod 타입 인스턴스 사용
                            return acc;
                        }, {} as { [key: string]: z.ZodType<any, any, any> })
                    );
                    request.query = request.query ? request.query.merge(paramSchema) : paramSchema;
                }
                // Body 처리
                if (customMiddleware.body) {
                    const bodySchema = z.object(
                        customMiddleware.body.reduce((acc, curr) => {
                            acc[curr.key] = z.string();
                            return acc;
                        }, {} as { [key: string]: z.ZodType<any, any, any> })
                    );
                    request.body = request.body && request.body.schema ? 
                        { schema: request.body.schema.merge(bodySchema) } : { schema: bodySchema };
                }
        
                // Path 처리
                if (customMiddleware.path) {
                    const pathSchema = z.object(
                        customMiddleware.path.reduce((acc, curr) => {
                            acc[curr.key] = z.string();
                            return acc;
                        }, {} as { [key: string]: z.ZodType<any, any, any> })
                    );
                    request.params = request.params ? request.params.merge(pathSchema) : pathSchema;
                }
        
                // Header 처리
                if (customMiddleware.header) {
                    const headerSchema = z.object(
                        customMiddleware.header.reduce((acc, curr) => {
                            acc[curr.key] = z.string();
                            return acc;
                        }, {} as { [key: string]: z.ZodType<any, any, any> })
                    );
                    request.headers = request.headers ? request.headers.merge(headerSchema) : headerSchema;
                }
            }
                

            }
        }
    }

    return request;
}

interface ResponseConfig {
    [status: string]: { description: string, schema?: z.ZodSchema }
}
async function createResponseConfig(middlewares: string[], schemaUrl: string): Promise<ResponseConfig> {
    const responses: ResponseConfig = {};

    for (const middleware of middlewares) {
        if (middleware.includes('validateResponse')) {
            const regex = /{status: (\d+), schema: (functionSchemas\.\w+)}/g;
            let matches;
            while ((matches = regex.exec(middleware)) !== null) {
                const [moduleName, schemaName] = matches[2].split('.').slice(-2);
                const schema = await getSchemaObject(moduleName, schemaName, schemaUrl)
                responses[matches[1]] = { description: matches[2], schema: schema};
            }
        }
    }

    return responses;
}

function extractSummary(middlewares: string[], deniedMiddlewares: string[]): string {
    const definedMiddlewares = ["validateBody", "validateParam", "validateResponse", "validatePath", "validateHeader"];
    const combinedMiddlewares = [...deniedMiddlewares, ...definedMiddlewares];
    let summary = middlewares.find(middleware => !combinedMiddlewares.some(keyword => middleware.includes(keyword))) ?? '';

    if (summary.includes('usecaseWrapper')) {
        summary = summary.match(/usecaseWrapper\(\s*(\w+)/)![1]
    }
    
    return summary;
}

async function getSchemaObject(moduleName: string, schemaName: string, schemaUrl: string): Promise<z.ZodSchema> {
    try {
        const module = await import('file://' + Deno.cwd() + schemaUrl + `/${moduleName}.ts`);
        return module[schemaName];
       
    } catch (error) {
        console.error(`Error importing module: ${moduleName}`, error);
        throw error;
    }
}
