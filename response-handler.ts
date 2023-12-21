export const isJsonType = (receive: string): boolean => {
  try {
    const json = JSON.parse(receive);
    return (typeof json === "object");
  } catch (_e) {
    return false;
  }
}

function getBody(rec: any) {
  if (typeof rec !== "string") return rec;
  if (isJsonType(rec)) {
    return JSON.parse(rec);
  } else {
    return { message: rec };
  }
}

function getStatus(sta?: number) {
  if (sta !== undefined) return sta;
  else return 200;
}

const ResponseHandler = (receive: any, response: any, status?: number) => {
  const recvBody = getBody(receive);
 
  if(Object.hasOwnProperty.call(recvBody, 'body')) {
    response.body = recvBody.body;
  } else {
    response.body = recvBody;
  }
  if(Object.hasOwnProperty.call(recvBody, 'code')) {
    response.status = recvBody.code;
  }else {
    response.status = getStatus(status);
  }
}

export { ResponseHandler};
