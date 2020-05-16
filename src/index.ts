const brand = Symbol();

interface Brand<B extends object> {
    readonly [brand]: B
}

/**
 * Branded object type
 */
export type Branded<T, B extends object> = [T & Brand<B>][0];  // from: https://github.com/microsoft/TypeScript/pull/33290#issuecomment-529116445

type BrandedObject<B extends object, X extends object> = (object extends X ? [Brand<B>][0] : Branded<X, B>);

/**
 * Branding function definition
 */
export interface Branding<B extends object, X extends object = object> extends Brand<B> {

    /**
     * Brands an object
     * @param obj the object to brand
     * @throws Error if the object is already branded
     */
    <T extends X>(obj: T): Branded<T, B>;

    /**
     * Asserts this brand for the given object.
     * @param obj the object to assert brand on
     * @throws Error when object is not branded.
     */
    assert(obj: object): asserts obj is BrandedObject<B, X>;

    /**
     * Checks if the given object has this brand.
     * @param obj the object to check
     */
    has(obj: object): obj is BrandedObject<B, X>;

    /**
     * Refines this branding with a new outer brand. The resulting branding will
     * be a composition (merge) between the inner and outer brand.
     * This method is actually a shortcut for createBranding and subsequent merge.
     * 
     * @param newBrand the new brand that refines the current one
     * @param callback a callback invoked when object are branded with the refined branding
     */
    refine<N extends object>(newBrand: N, callback?: BrandingCallback<N, X>): Branding<N & B, X>;

    /**
     * Merges the given branding with the current one.
     * 
     * @param branding the other brand to merge with
     */
    merge<C extends object, Y extends object>(branding: Branding<C, Y>): Branding<B & C, X & Y>
}

/**
 * A branding callback invoked during object branding
 */
export type BrandingCallback<B extends object, T extends object = object> = (obj: T, brand: B) => void;


// TODO: do we need a global branding map?

/**
 * Creates a new brand, identified by the provided branding object.
 * 
 * @param brandObject An object that represents the brand. The shape of this object should be unique, and symbols may be used as unique keys.
 * @param callback An optional callback with variable arguments which is invoked during object branding
 */
export function createBranding<B extends object, X extends object = object>(brandObject: B, callback?: BrandingCallback<B, X>): Branding<B, X> {

    const brandedObjects = new WeakSet<object>();

    function has(obj: object): obj is BrandedObject<B, X> {
        return brandedObjects.has(obj);
    }

    function assert(obj: object): asserts obj is BrandedObject<B, X> {
        if (!brandedObjects.has(obj)) {
            throw new Error("Object not branded.");
        }
    }

    function branding<T extends X>(obj: T): Branded<T, B> {
        if (has(obj)) {
            throw new Error("Object already branded.");
        }
        brandedObjects.add(obj);
        if (callback) {
            try {
                callback(obj, brandObject);
            } catch (e) {
                brandedObjects.delete(obj);
                throw e;
            }
        }
        return obj as Branded<T, B>;
    }

    function refine<N extends object>(newBrand: N, newCallback?: BrandingCallback<N, X>): Branding<N & B, X> {
        const b = Object.assign({}, newBrand, brandObject);
        const refinedBranding = createBranding<N & B, X>(b, newCallback);
        return merge<N, X>(refinedBranding);
    }

    function merge<C extends object, Y extends object>(other: Branding<C, Y>): Branding<B & C, X & Y> {
        return mixin<B, C, X, Y>(branding, other);
    }

    branding.has = has; // maybe all these should be built separately, then Object.assigned to branding()
    branding.assert = assert;
    branding.refine = refine;
    branding.merge = merge;
    branding[brand] = brandObject;

    return branding;
}


/**
 * Mixes two differend brandings in a single one.
 * 
 * @param fn1 The first branding function
 * @param fn2 The second branding function
 */
function mixin<B1 extends object, B2 extends object, X1 extends object, X2 extends object>
    (fn1: Branding<B1, X1>, fn2: Branding<B2, X2>): Branding<B1 & B2, X1 & X2> {

    function has(obj: object): obj is BrandedObject<B1 & B2, X1 & X2> {
        return fn1.has(obj) && fn2.has(obj);
    }

    function assert(obj: object): asserts obj is BrandedObject<B1 & B2, X1 & X2> {
        fn1.assert(obj);
        fn2.assert(obj);
    }

    function branding<T extends X1 & X2>(obj: T): Branded<T, B1 & B2> {
        fn1(obj);
        fn2(obj);
        return obj as Branded<T, B1 & B2>;
    }

    function refine<N extends object>(newBrand: N, callback?: BrandingCallback<N, X1 & X2>): Branding<N & B1 & B2, X1 & X2> {
        const b = Object.assign({}, newBrand, fn1[brand], fn2[brand]);
        return createBranding(b, callback);
    }

    function merge<C extends object, Y extends object>(branding1: Branding<C, Y>): Branding<B1 & B2 & C, X1 & X2 & Y> {
        return mixin<B1 & B2, C, X1 & X2, Y>(branding, branding1);
    }

    const newBrand = Object.assign({}, fn1[brand], fn2[brand]);

    branding.has = has;
    branding.assert = assert;
    branding.refine = refine;
    branding.merge = merge;
    branding[brand] = newBrand;

    return branding;
}
