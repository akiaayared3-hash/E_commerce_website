import { ApiError } from "../utils/apiError.util.js";

export const errorHandler = (err, req, resp, next) => {
  console.error(err); // always log on the server

  let statusCode = 500;
  let message = "Something went wrong";

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  }
  // duplicate 
  else if (err.code === "ER_DUP_ENTRY") {
    statusCode = 409;
    message = "A record with this value already exists.";
  }
  // does not related 
   else if (err.code === "ER_NO_REFERENCED_ROW_2") {
    statusCode = 400;
    message = "Related record does not exist.";
  }
   //invalid token
   else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token, please login again.";
  }
  // expired token
   else if (err.name === "TokenExpiredError") {
     statusCode = 401;
     message = "Session expired, please login again.";
   }
   // invalid json body
   else if (err.type === "entity.parse.failed") {
     statusCode = 400;
     message = "Invalid JSON body.";
   }
    else if (process.env.NODE_ENV !== "production") {
     message = err.message || message; // show real message outside production
   }

  resp.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
