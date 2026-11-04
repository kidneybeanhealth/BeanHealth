import { describe, it, expect } from 'vitest';
import { fitWithin, PHOTO_MAX_EDGE } from './feedbackPhoto';

describe('fitWithin', () => {
    it('scales a landscape phone photo to the long-edge limit', () => {
        expect(fitWithin(4000, 3000)).toEqual({ width: PHOTO_MAX_EDGE, height: 1200 });
    });

    it('scales a portrait photo by its height', () => {
        expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: PHOTO_MAX_EDGE });
    });

    it('never scales a small image up', () => {
        expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
    });

    it('keeps a very thin image at least one pixel wide', () => {
        expect(fitWithin(10000, 2)).toEqual({ width: PHOTO_MAX_EDGE, height: 1 });
    });

    it('returns zero for an image with no size, so encode refuses it', () => {
        expect(fitWithin(0, 1080)).toEqual({ width: 0, height: 0 });
        expect(fitWithin(NaN, 1080)).toEqual({ width: 0, height: 0 });
    });
});
