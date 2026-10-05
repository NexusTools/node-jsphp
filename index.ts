export { PHPEngine } from "./src/PHPEngine.js";
export type { PHPEngineOptions } from "./src/PHPEngine.js";
export { PHPContext } from "./src/PHPContext.js";
export type { PHPContextOptions } from "./src/PHPContext.js";
export { PHPExtension } from "./src/PHPExtension.js";
export {
  PHPError,
  PHPException,
  PHPTypeError,
  PHPParseError,
  PHPFatalError,
  PHPNotice,
  PHPWarning,
  PHPExit,
  ErrorException,
} from "./src/runtime/PHPError.js";
export { PHPObject, PHPClass } from "./src/runtime/PHPObject.js";
export type { PHPMethodMetadata, PHPPropertyMetadata, PHPParameterMetadata } from "./src/runtime/PHPObject.js";
export { Superglobals } from "./src/runtime/Superglobals.js";
export { OutputBufferStack } from "./src/runtime/OutputBuffer.js";
export { PHPParser } from "./src/parser/PHPParser.js";
export { ASTOptimizer } from "./src/parser/ASTOptimizer.js";
export { JSTranspiler } from "./src/parser/JSTranspiler.js";
export { runHTTPServer, runHTTPServerCLI } from "./src/cli/php-http-server.js";
export { runFPM } from "./src/cli/php-fpm.js";
export {
  defineFunction,
  Reflection,
  ReflectionClass,
  ReflectionMethod,
  ReflectionProperty,
  ReflectionFunction,
  ReflectionParameter,
  ReflectionType,
} from "./src/runtime/Reflection.js";
export type { FunctionMetaOptions } from "./src/runtime/Reflection.js";
export {
  NodeJSExtension,
  NodeJSObject,
  NodeJSService,
  wrapJSValue,
  unwrapPHPValue,
} from "./src/extensions/nodejs.js";
