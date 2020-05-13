# runtime-branding

A compile time & runtime object metadata branding API for TypeScript, basically it's like [nominal types with branding](https://medium.com/@KevinBGreene/surviving-the-typescript-ecosystem-branding-and-type-tagging-6cf6e516523d) but with runtime support. This library allows the creation of custom branding functions for creating nominal types (compile time) and linking metadata to objects lifecycle (runtime), without changing the objects structure or content (yes, we are immutable-friendly).

## Requirements & Installation
This library uses `WeakSet`, the minimum runtime requirement is `ES6`.

Installation:

```shell
npm i --save branding-metadata
```

## Example
The ideas behind this library are rooted in the concept of type branding, that is a technique used to refine types for a better (and safer) development experience, leveraging the 
[intersection types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-1-6.html#intersection-types).
Furthermore, there are some scenarios in which would be useful to link contextual information at runtime. The following example shows how to keep track of the origin of a request, that can be an external integration service or an internal soruce.
### Step 1: define the branding functions.
```Typescript
// source-branding.ts
interface SourceBrand {
    source: 'external';
}
const brand: SourceBrand = { source: 'external' };
export const externalSourceBranding = createBranding<SourceBrand>(brand);
```
### Step 2: brand object as they get into the system
```Typescript
// external-endpoint.ts
import { externalSourceBranding, SourceBrand } from './source-branding.ts'
import { invokeBusinessLogic } from './core.ts'
import { Branded } from 'runtime-branding'
export function onExternalRequest(req: Request, res: Response) {
    const brandedReq: Request & Branded<SourceBrand> = externalSourceBranding(req);
    invokeBusinessLogic(brandedReq, res);
}
```
### Step 3: read object branding metadata
```Typescript
// core.ts
import { externalSourceBranding, SourceBrand } from './source-branding.ts'
import { Branded } from 'runtime-branding'
export function invokeBusinessLogic(req: Request, res: Response) {
    
    if (isOrderRequest(req) && req.order.total > 5000 && externalSourceBranding.has(req)) {
        // here req type is Request & Branded<SourceBrand>, because of the type guard
        res.status(400).send({error: 'This order cannot be confirmed from external services'});
        return;
    }

    // logic here...
}
```
There are some things to consider here:
- The `invokeBusinessLogic` method may be called from many different sources, but it has some business constraints related to the _source_ of the request (and order total value, in this case). 
- The original request **has not been changed** (no additional fields): the runtime branding would work with immutable objects, too.
- There is no need to pass a "source" flag or object as an additional parameter: if `invokeBusinessLogic` was behind some kind of routing middleware, nothing should be changed to make this work.
- The branding type guard allows to build conditional logic for routing objects to functions that enforce brand type check on input parameters.
- The same object may be branded by many branding functions

Last but not least, we may add a branding callback function to the `externalSourceBranding` in order to execute some custom code when an object is branded:
```Typescript
export const externalSourceBranding = createBranding<SourceBrand>(brand, (obj, brand) => {
    // custom metadata handling here.
});
```

There are many different scenarios for runtime branding (see [examples](examples.md)):
- Get "current" user/session from a request object.
- Request/response (or command/events) correlation, without adding additional data.
- Transactional boundary management (retrieve the "current" transaction from request object)
- \[Type|priority|version|etc.\]-based message routing.
- Type metadata for serialization/deserialization.

## Documentation

The main entry point is the `createBranding` function:
```Typescript
declare function createBranding<B extends object, X extends object = object>
        (brandObject: B, callback?: BrandingCallback<B, X>): Branding<B, X>;
```
The return type `Branding<B, X>` is the branding function.
Since objects can be branded by different branding functions, the `brandObject` param should have a unique _shape_, in order to avoid _type clash_ between brands. Symbols may be useful to achieve brand uniqueness:
```Typescript
const symA = Symbol()
type BrandA = { [symA]: object;}

const symB = Symbol()
type BrandB = { [symB]: object }

const brandingA = createBranding<BrandA>({ [symA]: {} });
const brandingB = createBranding<BrandB>({ [symB]: {} });

interface Person {
    id: number;
    name: string;
}

const person1: Person = { id: 123, name: 'foo' };
const person2 = brandingA(person1);  // type: Person & Brand<BrandA>
const person3 = brandingB(person2);  // type: Person & Brand<BrandA> & Brand<BrandB>
```
The second parameter of createBranding is a callback function invoked for each branded object:
```Typescript
const brandingA = createBranding<BrandA>({ [symA]: {} }, (obj, brand) => {
    console.log('Branding an object!');
});
const person2 = brandingA(person1); // prints 'Branding an object!'
```
### Type guard & assertion
The `has()` and `assert()` static methods implement runtime type guard and assertion:
```Typescript
const person : Person = readPerson(123);
if (brandingA.has(person)) {
    // here person const has type: Person & Brand<BrandA>
}

/*
the following is needed due to a Typescript design limitation.
See https://github.com/microsoft/TypeScript/pull/32695
*/
const assertBrandA : typeof brandingA['assert'] = brandingA.assert; 

assertBrandA(person) // throws if person object is not branded with BrandA

// here person const has type: Person & Brand<BrandA>
```
### Branding merge & refine
The `merge()` static method allows to merge two branding functions.
```Typescript
const mergedBranding = brandingA.merge(brandingB);
const person1 = mergedBranding(person) // type: Person & Brand<BrandA & BrandB>
```
The `merge()` method is commutative:
```Typescript
const mergedBranding = brandingB.merge(brandingA); // it's equivalent to brandingA.merge(brandingB)
const person1 = mergedBranding(person) // type: Person & Brand<BrandA & BrandB>
```
If merged brandings were created with callbacks, both of them would be called:
```Typescript
const brandingA = createBranding<BrandA>({ [symA]: {} }, (obj, brand) => console.log('Branding A'));
const brandingB = createBranding<BrandB>({ [symB]: {} }, (obj, brand) => console.log('Branding B'));
const mergedBranding = brandingA.merge(brandingB);
const person1 = mergedBranding(person); // prints 'Branding A' and 'Branding B'
```
The `refine()` method allows to specialize an existing branding with a new brand object:
```Typescript
const brandingA = createBranding<BrandA>({ [symA]: {} });
const brandingB = brandingA.refine<BrandB>({ [symB]: {} });
const person1 = mergedBranding(person); //  Person & Brand<BrandB & BrandA>
```
The `refine()` method is equivalent to a `createBranding()` and an implicit `merge()`. It's basically a useful shortcut for creating many sub-brands from a base one.