import 'mocha';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as sinon from 'sinon';
import { createBranding, Branding } from '../src/index';
chai.use(sinonChai);
chai.should();

describe(`Basic branding functionality`, () => {

    it(`Should create a branding`, () => {
        const sym = Symbol();
        const customBrand = { [sym]: true };

        type CustomBranding = Branding<typeof customBrand>;
        const branding: CustomBranding = createBranding(customBrand);

        chai.expect(branding).to.be.instanceOf(Function);
        chai.expect(branding).haveOwnProperty('has');
        chai.expect(branding).haveOwnProperty('assert');
    });

    it(`Should brand an object`, () => {
        const sym = Symbol();
        const customBrand = { [sym]: true };

        type CustomBranding = Branding<typeof customBrand>;
        const branding: CustomBranding = createBranding(customBrand);

        const o = {};
        branding(o);

        chai.expect(branding.has(o)).to.be.true;
    });

    it(`Should throw when branding an object twice`, () => {
        const sym = Symbol();
        const customBrand = { [sym]: true };

        type CustomBranding = Branding<typeof customBrand>;
        const branding: CustomBranding = createBranding(customBrand);

        const o = {};
        branding(o);

        chai.expect(() => branding(o)).to.throw();
    });

    it(`Should assert brand on object`, () => {
        const sym = Symbol();
        const customBrand = { [sym]: true };

        type CustomBranding = Branding<typeof customBrand>;
        const branding: CustomBranding = createBranding(customBrand);

        const o = {};
        branding(o);

        chai.expect(() => branding.assert(o)).to.not.throw();
    });

    it(`Should throw when asserting brand on unbranded object`, () => {
        const sym = Symbol();
        const customBrand = { [sym]: true };

        type CustomBranding = Branding<typeof customBrand>;
        const branding: CustomBranding = createBranding(customBrand);

        const o = {};

        chai.expect(() => branding.assert(o)).to.throw();
    });

    it(`Should invoke a callback while branding an object`, () => {
        const sym = Symbol();
        const customBrand = { [sym]: true };

        function callback<T>(_obj: T, _s: typeof customBrand) { }
        const s = sinon.spy(callback);

        const branding = createBranding(customBrand, s);

        const o = {};
        branding(o);
        s.should.have.been.calledOnceWith(o, { [sym]: true });
    });

    it(`Should already have branded an object when the callback is invoked`, () => {
        const sym = Symbol();
        const customBrand = { [sym]: true };
        function callback<T>(_obj: T) {
            chai.expect(branding.has(o)).to.be.true;
        }
        const s = sinon.spy(callback);

        const branding = createBranding(customBrand, s);

        const o = {};
        branding(o);
        s.should.have.been.calledOnce;
    });

    it(`Should not brand an object if the callback throws`, () => {
        const sym = Symbol();
        const customBrand = { [sym]: true };
        function callback<T>(_obj: T) { throw new Error() }
        const s = sinon.spy(callback);

        const branding = createBranding(customBrand, s);

        const o = {};
        chai.expect(() => branding(o)).to.throw();
        chai.expect(branding.has(o)).to.be.false;
    });

    it(`Should invoke a callback with preset params while branding an object`, () => {
        const sym = Symbol();
        const customBrand = { [sym]: true };
        function callback<T>(_obj: T, _s: { value: string }) { }
        const s = sinon.spy(callback);

        const branding = createBranding(customBrand);
        const refined = branding.refine({ value: 'test' }, s);

        const o = {};
        refined(o);
        s.should.have.been.calledWith(o, { value: 'test' });
    });

    it(`Should invoke parent branding callback while branding an object with refined branding`, () => {
        const sym = Symbol();
        const customBrand = { [sym]: true };
        const s1 = sinon.spy();

        const branding = createBranding(customBrand, s1);

        const s2 = sinon.spy();
        const refined = branding.refine({ value: 'test' }, s2);

        const o = {};
        refined(o);
        s1.should.have.been.calledWith(o, { [sym]: true });
        s2.should.have.been.calledWith(o, { value: 'test' });
    });

});

describe(`Branding mixin functionality`, () => {
    type CustomBranding1 = Branding<typeof customBrand1>;
    type CustomBranding2 = Branding<typeof customBrand2>;
    type MixinBranding = Branding<typeof customBrand1 & typeof customBrand2>;

    const sym1 = Symbol(),
        sym2 = Symbol(),
        customBrand1 = { [sym1]: true },
        customBrand2 = { [sym2]: true };

    let branding1: CustomBranding1,
        branding2: CustomBranding2;

    beforeEach(() => {
        branding1 = createBranding(customBrand1);
        branding2 = createBranding(customBrand2);
    });

    it(`Should create a mixin branding`, () => {
        branding1.merge(branding2);

        const branding: MixinBranding = branding1.merge(branding2);

        chai.expect(branding).to.be.instanceOf(Function);
        chai.expect(branding).haveOwnProperty('has');
        chai.expect(branding).haveOwnProperty('assert');
    });

    it(`Should brand an object with mixin`, () => {
        const branding: MixinBranding = branding1.merge(branding2);

        const o = {};
        branding(o);

        chai.expect(branding.has(o)).to.be.true;
    });

    it(`Should assert mixin brand on object`, () => {
        const branding: MixinBranding = branding1.merge(branding2);

        const o = {};
        branding(o);

        chai.expect(() => branding.assert(o)).to.not.throw();
    });

    it(`Should throw when asserting mixin brand on partially branded object`, () => {
        const branding: MixinBranding = branding1.merge(branding2);

        const o = {};
        branding1(o);

        chai.expect(() => branding.assert(o)).to.throw();
    });

    it(`Should assert mixin brand on object branded using mixin components`, () => {
        const branding: MixinBranding = branding1.merge(branding2);

        const o = {};
        branding1(o);
        branding2(o);

        chai.expect(() => branding.assert(o)).to.not.throw();
    });

    it(`Should refine mixin branding`, () => {
        const branding: MixinBranding = branding1.merge(branding2);
        function callback<T>(_obj: T, _s: { value: string }) { }
        const s = sinon.spy(callback);
        const refined = branding.refine({ value: 'test' }, s);

        const o = {};
        refined(o);
        s.should.have.been.calledWith(o, { value: 'test' });
    });

    it(`Should merge simple branding with mixin branding`, () => {
        const sym = Symbol();
        const customBrand = { [sym]: true };

        const otherBranding = createBranding(customBrand);

        const branding: MixinBranding = branding1.merge(branding2);
        const merged = branding.merge(otherBranding);
        const o = {};
        merged(o);

        chai.expect(merged.has(o)).to.be.true;
        chai.expect(otherBranding.has(o)).to.be.true;
        chai.expect(branding.has(o)).to.be.true;
    });

});



