# Extension System

Extensions in `jsphp` extend the abstract class `PHPExtension`:

```typescript
import { PHPExtension, PHPEngine, PHPContext } from "jsphp";

export class CustomExtension extends PHPExtension {
  public readonly name = "custom";

  public onInit(engine: PHPEngine): void {
    this.constants = {
      CUSTOM_CONST: 42,
    };

    this.functions = {
      custom_hello: (ctx: PHPContext, name: string) => {
        return `Hello, ${name}!`;
      },
    };
  }
}
```

Registering a custom extension:

```typescript
const engine = new PHPEngine({
  extensions: [new CustomExtension()],
});
```
