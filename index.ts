require('source-map-support').install();

export { PHPEngine, PHPEngineOptions } from "./src/PHPEngine";
export { PHPContext, PHPContextOptions } from "./src/PHPContext";
export { PHPExtension } from "./src/PHPExtension";
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
} from "./src/runtime/PHPError";
export { PHPObject, PHPClass, PHPMethodMetadata, PHPPropertyMetadata, PHPParameterMetadata } from "./src/runtime/PHPObject";
export { Superglobals } from "./src/runtime/Superglobals";
export { OutputBufferStack } from "./src/runtime/OutputBuffer";
export { PHPParser } from "./src/parser/PHPParser";
export { ASTOptimizer } from "./src/parser/ASTOptimizer";
export { JSTranspiler } from "./src/parser/JSTranspiler";
export { runHTTPServer } from "./src/cli/php-http-server";
export { runFPM } from "./src/cli/php-fpm";
export {
  defineFunction,
  FunctionMetaOptions,
  Reflection,
  ReflectionClass,
  ReflectionMethod,
  ReflectionProperty,
  ReflectionFunction,
  ReflectionParameter,
  ReflectionType,
} from "./src/runtime/Reflection";
export {
  NodeJSExtension,
  NodeJSObject,
  NodeJSService,
  wrapJSValue,
  unwrapPHPValue,
} from "./src/extensions/nodejs";
